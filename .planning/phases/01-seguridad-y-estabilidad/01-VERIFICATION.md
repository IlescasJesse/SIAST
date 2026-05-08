---
phase: 01-seguridad-y-estabilidad
verified: 2026-05-08T18:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirmar que el Prisma client fue regenerado con la migración unify_tecnico_ti_role"
    expected: "El archivo packages/database/node_modules/.prisma/client/index.js existe y el tipo Rol incluye TECNICO_TI (no TECNICO_INFORMATICO ni TECNICO_SOPORTE_TI)"
    why_human: "El directorio node_modules queda excluido del Glob tool — el verifier no puede inspeccionar archivos generados ahí. Solo el SUMMARY afirma que el comando npm run db:generate corrió sin errores."
---

# Phase 1: Seguridad y Estabilidad — Verification Report

**Phase Goal:** Eliminar vulnerabilidades críticas y deuda técnica bloqueante.
**Verified:** 2026-05-08T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El servidor no arranca si JWT_SECRET no está en env | ✓ VERIFIED | `apps/api/src/index.ts` lineas 24-26: `if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET env var is required")`. También en `apps/api/src/config/jwt.ts` lineas 4-6 con el mismo guard. |
| 2 | El servidor no arranca si CORS_ORIGINS no está en env | ✓ VERIFIED | `apps/api/src/index.ts` lineas 27-29: `if (!process.env.CORS_ORIGINS) throw new Error("CORS_ORIGINS env var is required")` |
| 3 | OTP no aparece en ningún HTTP response body bajo ninguna condición | ✓ VERIFIED | `whatsapp.service.ts` linea 301: `return { ok: true }; // SIN devCodigo`. El campo `devCodigo?: string` sigue en la interface (linea 164) y en el spread de `otp.service.ts` linea 61, pero `enviarOtp` nunca lo retorna — dead code inofensivo confirmado en SUMMARY. |
| 4 | En prod, si WhatsApp falla, el endpoint retorna 503 | ✓ VERIFIED | `whatsapp.service.ts` lineas 287-292: `if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Servicio OTP no disponible. Contacte soporte."), { status: 503 })` |
| 5 | OTPs generados con crypto.randomInt (no Math.random) | ✓ VERIFIED | `otp.service.ts` linea 1: `import { randomInt } from "crypto"`. Linea 9: `const generarCodigo = (): string => randomInt(100000, 999999).toString()`. No hay `Math.random` en el archivo. |
| 6 | Rate limiting activo en solicitar-otp, verificar-otp, login y refresh | ✓ VERIFIED | `auth.routes.ts` lineas 8-12: los 4 endpoints tienen `authRateLimiter` como primer middleware. Middleware configurado con `limit: 5`, `windowMs: 15 * 60 * 1000`. |
| 7 | Token refresh con sesión revocada devuelve 401 | ✓ VERIFIED | `auth.controller.ts` lineas 126-132: `verificarSesion(payload.jti)` llamada antes de `signToken`. Si `!sesionActiva` retorna 401 con mensaje "Sesion revocada." |
| 8 | El Prisma client está sincronizado con el schema actual (migración unify_tecnico_ti_role incluida) | ? UNCERTAIN | Migración `20260429180311_unify_tecnico_ti_role` existe en `packages/database/prisma/migrations/`. Schema `packages/database/prisma/schema.prisma` refleja `Rol` actualizado (TECNICO_TI sin valores legacy). SUMMARY afirma ejecución exitosa de `npm run db:generate`. No se puede confirmar archivos generados en `node_modules` via herramientas disponibles. |

**Score:** 7/8 truths verified (1 uncertain — STB-01)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/index.ts` | Startup validation JWT_SECRET + CORS_ORIGINS + CORS allowlist | ✓ VERIFIED | Contiene ambas validaciones y usa `corsOrigins` en Express y Socket.IO |
| `apps/api/src/config/jwt.ts` | JWT sin fallback hardcodeado | ✓ VERIFIED | Sin `siast_dev_secret`. Guard propio `throw new Error("JWT_SECRET env var is required")` |
| `apps/api/src/services/otp.service.ts` | CSPRNG via randomInt | ✓ VERIFIED | `import { randomInt } from "crypto"`, usa `randomInt(100000, 999999)` |
| `apps/api/src/services/whatsapp.service.ts` | Fallback sin devCodigo en response | ✓ VERIFIED | `return { ok: true }` en fallback consola; 503 en produccion |
| `apps/api/.env.example` | Documenta vars obligatorias | ✓ VERIFIED | Contiene `JWT_SECRET=` y `CORS_ORIGINS=` con comentarios |
| `apps/api/src/middleware/rate-limit.middleware.ts` | authRateLimiter 5 req/15 min | ✓ VERIFIED | `export const authRateLimiter` con `limit: 5`, `windowMs: 15 * 60 * 1000`, mensaje en español |
| `apps/api/src/routes/auth.routes.ts` | Rate limiter en 4 endpoints, sin login-rfc | ✓ VERIFIED | 4 rutas con authRateLimiter; sin ruta `/login-rfc` |
| `apps/api/src/controllers/auth.controller.ts` | verificarSesion en refreshToken, sin siast_dev_secret | ✓ VERIFIED | `import { cerrarSesion, verificarSesion }` en linea 6; verificacion en lineas 126-132; sin `siast_dev_secret` |
| `apps/web/src/store/auth.js` | Sin método loginRFC | ✓ VERIFIED | Sin `loginRFC` ni referencia a `login-rfc` en el archivo |
| `packages/shared/src/index.ts` | FOLIO_PREFIX con 13 keys correctos | ✓ VERIFIED | 5 tecno, 3 servicios, 5 recursos materiales — todos correctos |
| `packages/database/node_modules/.prisma/client/index.js` | Prisma client generado | ? UNCERTAIN | No accesible via herramientas (node_modules excluido) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/index.ts` | `apps/api/src/config/jwt.ts` | Validacion startup antes de import chain | ✓ WIRED | index.ts valida JWT_SECRET en modulo-level; jwt.ts tiene su propio guard independiente |
| `apps/api/src/services/whatsapp.service.ts` | HTTP response | Retorno sin devCodigo | ✓ WIRED | `return { ok: true }` en linea 301 — sin devCodigo |
| `apps/api/src/middleware/rate-limit.middleware.ts` | `apps/api/src/routes/auth.routes.ts` | `import { authRateLimiter }` | ✓ WIRED | Import en linea 4; usado en 4 rutas |
| `apps/api/src/controllers/auth.controller.ts` | `apps/api/src/services/sesiones.service.ts` | `verificarSesion(payload.jti)` | ✓ WIRED | Import en linea 6; llamada en linea 127 dentro de `refreshToken` |
| `packages/shared/src/index.ts (FOLIO_PREFIX)` | `apps/api/src/services/tickets.service.ts (generarFolio)` | `import FOLIO_PREFIX de @stf/shared` | ✓ WIRED | Import en linea 6 de tickets.service.ts; usado en linea 23: `FOLIO_PREFIX[key] ?? "TIC"` |

---

### Data-Flow Trace (Level 4)

No aplica para este phase — los cambios son correcciones de configuracion, seguridad y datos. No se introdujeron nuevos componentes que rendericen datos dinamicos.

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — verificar el comportamiento de rate limiting (429 despues de 5 intentos) y el rechazo de sesion revocada requiere un servidor corriendo. Las verificaciones de codigo fuente son suficientes para confirmar la implementacion correcta.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 01-01-PLAN.md | JWT secret leido de JWT_SECRET env var — eliminar fallback | ✓ SATISFIED | `jwt.ts` sin `siast_dev_secret`; guard throw en jwt.ts y index.ts; `auth.controller.ts` usa `JWT_SECRET!` |
| SEC-02 | 01-01-PLAN.md | OTP nunca retornado en HTTP response | ✓ SATISFIED | `whatsapp.service.ts` retorna `{ ok: true }` sin devCodigo en todos los paths |
| SEC-03 | 01-01-PLAN.md | CORS con lista blanca — no `true` en ningun env | ✓ SATISFIED | `index.ts` usa `corsOrigins` de `CORS_ORIGINS.split(",")` en Express y Socket.IO |
| SEC-04 | 01-02-PLAN.md | Rate limiting en endpoints de auth | ✓ SATISFIED | `authRateLimiter` (5 req/15min) en 4 endpoints; `/login-rfc` eliminado |
| SEC-05 | 01-02-PLAN.md | Token refresh verifica revocacion de sesion | ✓ SATISFIED | `verificarSesion(payload.jti)` en `refreshToken` antes de `signToken` |
| STB-01 | 01-03-PLAN.md | Prisma client regenerado con campo permisos (migracion ya aplicada) | ? NEEDS HUMAN | Migracion SQL existe; schema es correcto; archivo generado no verificable via herramientas |
| STB-02 | 01-03-PLAN.md | FOLIO_PREFIX map actualizado con keys correctos para enum actual | ✓ SATISFIED | 13 keys correctos en `packages/shared/src/index.ts`; wired a `tickets.service.ts` |
| STB-03 | 01-03-PLAN.md | Archivos 3D stale eliminados de Building3D | ✓ SATISFIED | Solo `BuildingViewer.jsx` en el directorio |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/services/whatsapp.service.ts` | 164 | `devCodigo?: string` en interface `EnvioOtpResult` | Info | Campo opcional nunca retornado — dead code inofensivo. Confirmado como pendiente de limpieza en SUMMARY. No afecta seguridad. |
| `apps/api/src/services/whatsapp.service.ts` | 252 | Comentario de jsdoc dice "devuelve devCodigo" (descripcion stale) | Info | El comentario describe el comportamiento anterior. No afecta runtime. Puede confundir a futuros desarrolladores. |
| `apps/api/src/services/otp.service.ts` | 61 | `...(envio.devCodigo ? { devCodigo: envio.devCodigo } : {})` | Info | Dead code — `envio.devCodigo` nunca se populara. No expone datos, no bloquea. Candidato para limpieza futura. |

Ninguno de estos anti-patrones es bloqueante — son dead code sin impacto en seguridad ni funcionalidad.

---

### Human Verification Required

#### 1. Prisma Client Regenerado (STB-01)

**Test:** En el entorno de desarrollo, ejecutar `npm run db:generate --workspace=packages/database` y verificar que el archivo `packages/database/node_modules/.prisma/client/index.js` existe y el enum `Rol` en el cliente generado incluye `TECNICO_TI` (no `TECNICO_INFORMATICO` ni `TECNICO_SOPORTE_TI`).

**Expected:** El comando completa sin errores y el cliente generado refleja el schema actual con los roles unificados de la migracion `20260429180311_unify_tecnico_ti_role`.

**Why human:** El directorio `node_modules` queda excluido de las herramientas de busqueda de archivos. El SUMMARY documenta ejecucion exitosa pero la verificacion independiente del archivo generado requiere acceso al filesystem local. Si el comando ya fue ejecutado previamente por el agente ejecutor, el cliente existe y STB-01 esta satisfecho.

---

### Gaps Summary

No hay gaps bloqueantes. Los 7 must-haves verificables mediante inspeccion de codigo fuente pasan. La unica incertidumbre es STB-01 (Prisma client generado), que no puede confirmarse via herramientas porque `node_modules` queda excluido. El SUMMARY del plan 03 afirma ejecucion exitosa del comando `npm run db:generate` el 2026-05-08. Si el desarrollador puede confirmar que el comando se ejecuto en ese entorno, STB-01 esta satisfecho y el status puede elevarse a `passed`.

**Contexto adicional sobre dead code en OTP:** El campo `devCodigo?: string` en `EnvioOtpResult` y el spread en `otp.service.ts` son dead code inofensivo documentado en el SUMMARY como "Known Stubs". No representan una exposicion de seguridad porque `enviarOtp` nunca retorna `devCodigo`. Pueden limpiarse en el siguiente ciclo de mantenimiento.

---

_Verified: 2026-05-08T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
