---
status: complete
phase: 01-seguridad-y-estabilidad
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-05-11T00:00:00Z
updated: 2026-05-11T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Detener la API si está corriendo. Eliminar o vaciar JWT_SECRET de apps/api/.env.
  Intentar arrancar con `npm run dev:api`. El servidor debe fallar con el mensaje:
  "JWT_SECRET env var is required" (u otro mensaje claro) y NO quedar en escucha.
  Restaurar JWT_SECRET y CORS_ORIGINS en .env. Arrancar de nuevo — el servidor
  debe iniciar sin errores y responder a http://localhost:5101.
result: pass

### 2. JWT_SECRET — arranque bloqueado sin env var
expected: |
  Con JWT_SECRET ausente o vacío en .env: `npm run dev:api` falla inmediatamente
  con error explícito antes de registrar cualquier ruta. El proceso termina, no queda
  en escucha. Con JWT_SECRET presente: arranque normal.
result: skipped
reason: Sistema en línea/producción — JWT_SECRET ya configurado en .env, no viable remover en vivo

### 3. CORS — origen no whitelisted rechazado
expected: |
  Desde un origen no incluido en CORS_ORIGINS (ej. http://evil.test), enviar
  una petición a la API (puede ser con curl: `curl -H "Origin: http://evil.test" http://localhost:5101/api/health`).
  La respuesta debe incluir error CORS o no incluir Access-Control-Allow-Origin con ese origen.
  Desde http://localhost:5173 sí debe pasar.
result: pass

### 4. OTP — devCodigo no aparece en response HTTP
expected: |
  Solicitar OTP para un empleado vía POST /api/auth/solicitar-otp.
  La respuesta JSON no debe contener campo "devCodigo" ni el código numérico del OTP.
  Solo debe aparecer { ok: true } o similar. Revisar en DevTools Network o con curl.
result: pass

### 5. Rate limiting — brute force bloqueado
expected: |
  Intentar login o solicitar OTP 6 veces seguidas rápido en el mismo endpoint
  (ej. POST /api/auth/solicitar-otp). La 6a o posterior petición debe recibir
  HTTP 429 con mensaje en español indicando demasiados intentos.
result: pass

### 6. Refresh con sesión revocada → 401
expected: |
  1. Login con un empleado/staff → obtener refreshToken.
  2. Logout (POST /api/auth/logout o la acción de la UI).
  3. Intentar POST /api/auth/refresh con el refreshToken anterior.
  Debe recibir 401 — la sesión ya está revocada, no se emite nuevo accessToken.
result: pass

### 7. Folio nuevo con CUENTAS_DOMINIO
expected: |
  Crear un ticket nuevo de categoría TECNOLOGIAS con subcategoría CUENTAS_DOMINIO.
  El folio generado debe comenzar con "TEC-DOM-" (ej. TEC-DOM-0001).
  No debe aparecer el prefijo antiguo ni un error de folio undefined.
result: pass

## Summary

total: 7
passed: 6
issues: 0
skipped: 1
blocked: 0
pending: 0

## Gaps

[none yet]
