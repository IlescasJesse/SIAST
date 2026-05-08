---
phase: 01-seguridad-y-estabilidad
plan: "01"
subsystem: api-security
tags: [security, jwt, cors, otp, csprng, hardening]
one_liner: "Startup fatal validation para JWT_SECRET y CORS_ORIGINS, CORS allowlist explícita, OTP con CSPRNG y eliminación de devCodigo del response HTTP"
dependency_graph:
  requires: []
  provides:
    - startup-env-validation
    - cors-allowlist
    - csprng-otp
    - otp-no-http-exposure
  affects:
    - apps/api/src/index.ts
    - apps/api/src/config/jwt.ts
    - apps/api/src/services/otp.service.ts
    - apps/api/src/services/whatsapp.service.ts
    - apps/api/src/controllers/auth.controller.ts
tech_stack:
  added: []
  patterns:
    - startup-env-validation-throw
    - cors-allowlist-from-env
    - csprng-randomint
key_files:
  created:
    - apps/api/.env.example
  modified:
    - apps/api/src/index.ts
    - apps/api/src/config/jwt.ts
    - apps/api/src/services/otp.service.ts
    - apps/api/src/services/whatsapp.service.ts
    - apps/api/src/controllers/auth.controller.ts
decisions:
  - "CORS allowlist via env var CORS_ORIGINS — servidor rechaza arrancar si falta"
  - "JWT_SECRET fatal en startup — elimina fallback siast_dev_secret de dos sitios"
  - "CSPRNG crypto.randomInt reemplaza Math.random en generación de OTP"
  - "devCodigo eliminado del HTTP response — en prod WhatsApp falla con 503; en dev solo console.log"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
requirements_satisfied:
  - SEC-01
  - SEC-02
  - SEC-03
---

# Phase 01 Plan 01: Vulnerabilidades Críticas de Seguridad — Summary

**One-liner:** Startup fatal validation para JWT_SECRET y CORS_ORIGINS, CORS allowlist explícita, OTP con crypto.randomInt y eliminación de devCodigo del response HTTP.

## What Was Built

Hardening de tres vulnerabilidades críticas en la API:

1. **SEC-01 + SEC-03 — Startup validation**: `apps/api/src/index.ts` lanza `Error("JWT_SECRET env var is required")` y `Error("CORS_ORIGINS env var is required")` antes de registrar cualquier middleware. El servidor no puede arrancar en ningún entorno sin estas dos variables.

2. **SEC-03 — CORS allowlist**: Reemplaza `origin: true` (todos los orígenes en non-prod) con `corsOrigins` — array parseado de `CORS_ORIGINS` env var con `.split(",").map(trim).filter(Boolean)`. Aplicado tanto en Express `cors()` como en Socket.IO `Server`. Las variables obsoletas `FRONTEND_URL`, `VIEWER_URL`, `IS_PROD`, `corsOrigin` fueron eliminadas.

3. **SEC-01 — JWT sin fallback**: `apps/api/src/config/jwt.ts` elimina `?? "siast_dev_secret"`. Ahora lanza error fatal si `JWT_SECRET` no está en env.

4. **SEC-02 + T-01-04 — CSPRNG**: `apps/api/src/services/otp.service.ts` usa `crypto.randomInt(100000, 999999)` en lugar de `Math.floor(100000 + Math.random() * 900000)`.

5. **SEC-02 + T-01-03 — OTP sin HTTP exposure**: `apps/api/src/services/whatsapp.service.ts` en el bloque fallback-consola: en producción lanza `503 "Servicio OTP no disponible. Contacte soporte."`; en dev solo imprime en `console.log`. El retorno es `{ ok: true }` sin `devCodigo` en todos los entornos.

6. **Archivo**: `apps/api/.env.example` creado documentando `JWT_SECRET` y `CORS_ORIGINS` como obligatorias con comentarios en español.

## Commits

| Hash | Descripción |
|------|-------------|
| `9cec5d0` | feat(01-01): startup env validation + CORS allowlist desde env var |
| `218dda2` | feat(01-01): JWT sin fallback + CSPRNG para OTP + eliminar devCodigo del response |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Segundo fallback siast_dev_secret en auth.controller.ts**
- **Found during:** Task 2
- **Issue:** El research identificó un segundo `process.env.JWT_SECRET ?? "siast_dev_secret"` en `apps/api/src/controllers/auth.controller.ts` línea 114, dentro de `refreshToken`. Este código no usa el módulo `config/jwt.ts` — tiene su propio fallback local que hubiera quedado activo aunque jwt.ts fuera corregido.
- **Fix:** Reemplazado con `process.env.JWT_SECRET!` con comentario indicando que la validación ocurre en startup (index.ts). El `!` es seguro porque index.ts garantiza que JWT_SECRET existe antes de que cualquier request llegue al controller.
- **Files modified:** `apps/api/src/controllers/auth.controller.ts`
- **Commit:** `218dda2`

## Known Stubs

Ninguno. Todos los cambios son correcciones de comportamiento real — sin valores de placeholder ni dead data paths que afecten la funcionalidad del plan.

El campo `devCodigo?: string` permanece en la interface `EnvioOtpResult` en `whatsapp.service.ts` (tipo opcional), y el spread en `otp.service.ts` línea 61 `...(envio.devCodigo ? { devCodigo: envio.devCodigo } : {})` es dead code inofensivo — nunca se populará porque `whatsapp.service.ts` ya no retorna `devCodigo`. Ambos pueden limpiarse en una fase posterior.

## Threat Flags

Ninguna superficie nueva introducida. Este plan solo elimina superficie de ataque existente.

## Deployment Notes

**Breaking changes para entornos de desarrollo:**
- Los desarrolladores que no tengan `JWT_SECRET` y `CORS_ORIGINS` en su `.env` local verán el servidor fallar al arrancar con un mensaje claro.
- Solución: copiar `apps/api/.env.example` a `apps/api/.env` y ajustar los valores.
- El `.env.example` incluye los defaults de desarrollo (`CORS_ORIGINS=http://localhost:5173,http://localhost:5174`).

**Producción:**
- El `.env` del servidor de producción debe tener `CORS_ORIGINS` agregado (nueva variable).
- `JWT_SECRET` ya debe existir en producción si el sistema estaba corriendo.

## Self-Check: PASSED

Todos los archivos creados/modificados verificados. Ambos commits confirmados en git log.
