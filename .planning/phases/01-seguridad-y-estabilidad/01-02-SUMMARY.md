---
phase: 01-seguridad-y-estabilidad
plan: 02
subsystem: auth
tags: [express-rate-limit, jwt, rate-limiting, brute-force, session-management, security]

# Dependency graph
requires:
  - phase: 01-seguridad-y-estabilidad
    provides: "Plan 01 establece JWT_SECRET sin fallback y CORS con allowlist; plan 02 usa JWT_SECRET! sin fallback en refreshToken"
provides:
  - "authRateLimiter middleware (5 req/15min por IP) activo en 4 endpoints de auth"
  - "Endpoint /api/auth/login-rfc eliminado del router y del store"
  - "refreshToken verifica sesión activa via verificarSesion(jti) antes de emitir token"
  - "Fallback hardcodeado siast_dev_secret eliminado de auth.controller.ts"
affects: [auth-flows, empleado-login, staff-login, token-refresh, security]

# Tech tracking
tech-stack:
  added: ["express-rate-limit ^8.5.1"]
  patterns:
    - "Rate limiter por ruta (no global) — se aplica solo a endpoints de auth sensibles"
    - "verificarSesion(jti) en refreshToken — verificación de sesión revocada antes de emitir token nuevo"
    - "Eliminación limpia de legacy endpoint + store method — sin feature flag"

key-files:
  created:
    - "apps/api/src/middleware/rate-limit.middleware.ts"
  modified:
    - "apps/api/src/routes/auth.routes.ts"
    - "apps/api/src/controllers/auth.controller.ts"
    - "apps/web/src/store/auth.js"
    - "apps/api/package.json"

key-decisions:
  - "Rate limiter aplicado por ruta (no global en index.ts) para no throttlear endpoints de tickets/recursos"
  - "limit: 5 (no max: 5) — API de express-rate-limit v7+ renombró la opción"
  - "standardHeaders: draft-8 para headers IETF estándar; legacyHeaders: false"
  - "Eliminación completa de loginRFC del controller (no solo de la ruta) — reduce superficie de código"
  - "verificarSesion importada estáticamente (no dynamic import) para evitar latencia en hot path de refresh"

patterns-established:
  - "Pattern: authRateLimiter como primer middleware en rutas de auth sin auth previo"
  - "Pattern: verificarSesion(jti) antes de signToken en refreshToken — SEC-05"

requirements-completed: [SEC-04, SEC-05]

# Metrics
duration: ~15min
completed: 2026-05-08
---

# Phase 1 Plan 02: Rate Limiting, Eliminación Login-RFC y Session Verification en Refresh Summary

**Rate limiting con express-rate-limit 8.x activo en 4 endpoints de auth (5 req/15min/IP), endpoint legacy /login-rfc eliminado del router y store Zustand, y refreshToken verifica revocación de sesión via verificarSesion(jti) antes de emitir token**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-08T16:25:00Z
- **Completed:** 2026-05-08T16:44:31Z
- **Tasks:** 2
- **Files modified:** 4 (+ package.json + package-lock.json)

## Accomplishments

- Instala express-rate-limit ^8.5.1 y crea middleware authRateLimiter con 5 intentos/15 min por IP, almacenamiento in-memory, mensaje en español, headers IETF estándar
- Aplica authRateLimiter en los 4 endpoints sensibles: solicitar-otp, verificar-otp, login y refresh; elimina ruta legacy POST /login-rfc del router (SEC-04, T-02-01, T-02-02)
- Añade verificarSesion(jti) en refreshToken antes de emitir token nuevo — un usuario cuya sesión fue revocada por logout recibe 401 (SEC-05, T-02-03)
- Elimina fallback hardcodeado "siast_dev_secret" de auth.controller.ts refreshToken — usa process.env.JWT_SECRET! directamente (T-02-04)
- Elimina método loginRFC del store Zustand auth.js — el frontend ya no puede llamar el endpoint eliminado

## Task Commits

1. **Task 1: Instalar express-rate-limit y crear middleware authRateLimiter** - `6f0d58e` (feat)
2. **Task 2: Aplicar rate limiter en rutas, eliminar login-rfc, y corregir refreshToken** - `3dd6954` (feat)

## Files Created/Modified

- `apps/api/src/middleware/rate-limit.middleware.ts` - Nuevo middleware authRateLimiter exportado con rateLimit() v8
- `apps/api/src/routes/auth.routes.ts` - Import authRateLimiter, rutas de auth con rate limiter, sin ruta /login-rfc
- `apps/api/src/controllers/auth.controller.ts` - Import verificarSesion, refreshToken con session check, sin loginRFC handler, sin fallback secret
- `apps/web/src/store/auth.js` - Eliminado método loginRFC (incluyendo comentario de sección Legacy)
- `apps/api/package.json` - Agrega express-rate-limit ^8.5.1 en dependencies

## Decisions Made

- Rate limiter aplicado por ruta específica en auth.routes.ts, no como middleware global en index.ts, para no impactar endpoints de tickets, recursos y otros módulos
- Uso de `limit: 5` (no `max: 5`) — express-rate-limit v7+ renombró la opción; `max` se ignora silenciosamente
- Handler loginRFC eliminado del controller (no solo de la ruta) para reducir código muerto; el servicio auth.service.loginRFC aún existe y es usado por verificarOtp internamente
- Import estático de verificarSesion (no dynamic import) — mismo patrón que auth.middleware.ts que ya usaba verificarSesion

## Deviations from Plan

None - plan ejecutado exactamente como especificado.

## Issues Encountered

- La primera ejecución de `npm install` fue en la ruta del proyecto original (C:\Users\ilesm\Documents\SIAST\) en lugar del worktree. Se detectó inmediatamente al verificar los checks del Task 1. Se corrigió instalando en el worktree y verificando que apps/api/package.json del worktree tuviera la dependencia. El archivo de middleware fue creado en la ruta correcta del worktree a continuación.

## User Setup Required

None - no external service configuration required. express-rate-limit usa almacenamiento in-memory sin dependencias externas.

## Next Phase Readiness

- SEC-04 y SEC-05 satisfechos
- Los 4 endpoints de auth tienen protección brute-force activa
- El flujo OTP es el único path de autenticación para empleados (legacy eliminado)
- refreshToken verifica revocación de sesión — logout verdaderamente invalida tokens
- Plan 03 (STB-01/02/03): estabilidad de DB, FOLIO_PREFIX y limpieza de archivos stale

---
*Phase: 01-seguridad-y-estabilidad*
*Completed: 2026-05-08*
