# Phase 1: Seguridad y Estabilidad - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminar vulnerabilidades críticas de seguridad y deuda técnica bloqueante. Esta fase entrega un API endurecido y estable. **Sin nuevas features, sin cambios de UI funcional.**

Deliverables concretos (del ROADMAP):
- JWT secret forzado desde env var — sin fallback hardcodeado
- OTP nunca expuesto en HTTP response
- CORS con lista blanca de orígenes via env var
- Rate limiting en auth endpoints
- Refresh token verifica revocación de sesión
- Endpoint legacy `/api/auth/login-rfc` eliminado
- `npm run db:generate` ejecutado (Prisma client sincronizado)
- `FOLIO_PREFIX` corregido para enum actual
- Archivos Building3D stale eliminados de `apps/web/src/components/Building3D/`

</domain>

<decisions>
## Implementation Decisions

### OTP Security (SEC-02 + scope ampliado)

- **D-01:** `devCodigo` removido del HTTP response en producción. En dev (`NODE_ENV !== "production"`), el OTP se imprime únicamente en `console.log` del servidor — nunca en el response body.
- **D-02:** `Math.random()` → `crypto.randomInt(100000, 999999)` en `apps/api/src/services/otp.service.ts`. Fix CSPRNG incluido en esta fase (misma función, 1 línea).
- **D-03:** `/api/auth/login-rfc` eliminado limpio del router (`apps/api/src/routes/auth.routes.ts`) y `loginRFC()` eliminado del store (`apps/web/src/store/auth.js`). El flujo OTP (`solicitar-otp` → `verificar-otp`) es el único path de autenticación para empleados. No feature flag — eliminación completa.
- **D-04:** Si WhatsApp falla en producción y no puede entregar el OTP → retornar `503 { error: "Servicio OTP no disponible. Contacte soporte." }`. No silenciar ni dejar el empleado esperando en vano.
- **D-05:** TTL del OTP se mantiene en 10 minutos (no cambia — valor actual en `OtpToken`).

### JWT Security (SEC-01)

- **D-06:** `apps/api/src/config/jwt.ts` — eliminar fallback `"siast_dev_secret"`. Si `JWT_SECRET` no está en env al iniciar → `throw new Error("JWT_SECRET env var is required")`. Servidor no arranca sin ella.

### Token Refresh (SEC-05)

- **D-07:** `apps/api/src/controllers/auth.controller.ts` `refreshToken` — añadir llamada a `verificarSesion(payload.jti)` antes de emitir nuevo token. Si sesión revocada → 401.

### Rate Limiting (SEC-04)

- **D-08:** Instalar `express-rate-limit`. Aplicar en todos los endpoints de auth: `POST /api/auth/solicitar-otp`, `POST /api/auth/verificar-otp`, `POST /api/auth/login`, `POST /api/auth/refresh`.
- **D-09:** Límite: **5 intentos / 15 minutos por IP**. Hardcodeado en código — no env vars.
- **D-10:** Almacenamiento in-memory (sin Redis). El bloqueo auto-expira al terminar la ventana. Sin panel de desbloqueo manual necesario.
- **D-11:** Response al exceder límite: `429 Too Many Requests { error: "Demasiados intentos. Intenta en 15 minutos." }`.

### CORS (SEC-03)

- **D-12:** Orígenes configurados via env var `CORS_ORIGINS` (comma-separated). Si `CORS_ORIGINS` no está en env al iniciar → `throw new Error("CORS_ORIGINS env var is required")`. Servidor no arranca sin ella.
- **D-13:** Dev default documentado en `.env.example`: `CORS_ORIGINS=http://localhost:5173,http://localhost:5174`. El puerto 5174 (visor 3D) incluido en dev.
- **D-14:** Producción requiere agregar URL real al `.env` del servidor — placeholder documentado en `.env.example` como `# CORS_ORIGINS=https://tu-dominio.com,http://localhost:5173`.

### Startup Env Validation (consolidado)

- **D-15:** Las vars `JWT_SECRET` y `CORS_ORIGINS` validan en startup con error fatal. Patrón: verificar en `apps/api/src/index.ts` antes de registrar middlewares.

### Estabilidad (STB-01, STB-02, STB-03)

- **D-16:** `npm run db:generate` ejecutado en `packages/database` — Prisma client sincronizado con migración `unify_tecnico_ti_role`.
- **D-17:** `FOLIO_PREFIX` en `packages/shared/src/index.ts` — actualizar keys para que coincidan con el patrón `"${CategoriaTicket}-${SubcategoriaTicket}"` del enum actual (ej. `"TECNOLOGIAS-SISTEMAS_INSTITUCIONALES"`).
- **D-18:** Archivos stale en `apps/web/src/components/Building3D/` identificados y eliminados (scope de STB-03).

### Claude's Discretion

- Orden exacto de validación en startup (JWT_SECRET primero o CORS_ORIGINS primero) — indiferente, elegir el más legible.
- Formato exacto del message en rate limit response — mantener consistencia con el estilo de `errorMiddleware`.
- Identificación de qué archivos específicos son "stale" en `Building3D/` — el agente ejecutor debe verificar en codebase actual.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y Roadmap
- `.planning/REQUIREMENTS.md` — SEC-01 a SEC-05, STB-01 a STB-03 (requisitos de esta fase)
- `.planning/ROADMAP.md` §Phase 1 — deliverables y UAT criteria

### Audit de Concerns (fuente de verdad para issues)
- `.planning/codebase/CONCERNS.md` — audit completo: Critical, High Priority, Security sections

### Archivos a Modificar (con ubicaciones exactas)
- `apps/api/src/config/jwt.ts` — JWT secret fallback a eliminar (línea 4 aprox)
- `apps/api/src/services/otp.service.ts` — `Math.random()` (línea 9) + `devCodigo` en response fallback
- `apps/api/src/controllers/auth.controller.ts` — `refreshToken` ignora `verificarSesion` (líneas 119-131)
- `apps/api/src/routes/auth.routes.ts` — route `/login-rfc` legacy + sin rate limiting
- `apps/api/src/index.ts` — CORS `true` en non-prod (línea 32 aprox), punto de registro de middlewares
- `apps/web/src/store/auth.js` — método `loginRFC()` legacy a eliminar
- `packages/shared/src/index.ts` — `FOLIO_PREFIX` map con keys stale
- `packages/database/prisma/schema.prisma` — schema actual para verificar client regenerado

### Stack relevante
- `.planning/codebase/STACK.md` — versiones de jsonwebtoken (9.0.2), cors (2.8.5), Express (5.1.0)
- `.planning/codebase/ARCHITECTURE.md` §Authentication Flow — flujo OTP completo, sesiones, jti

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/services/sesiones.service.ts` → `verificarSesion(jti)` — ya existe, solo hay que llamarlo desde `refreshToken`
- `apps/api/src/middlewares/errorMiddleware` — patrón de error existente: `Object.assign(new Error(msg), { status: N })`
- `crypto` built-in de Node.js — `crypto.randomInt(100000, 999999)` disponible sin instalación

### Established Patterns
- Startup errors: patrón de throw en config ya establecido conceptualmente (JWT_SECRET puede seguir mismo patrón que DATABASE_URL)
- Auth middleware chain: `authMiddleware` → `requireRol` → `requirePermiso` — rate limiter va ANTES de `authMiddleware` en las rutas de auth
- Socket.IO events: no aplica en esta fase (solo backend/config changes)

### Integration Points
- `apps/api/src/index.ts` — punto de registro de middleware global (CORS, Helmet, Morgan, rate limit)
- `apps/api/src/routes/auth.routes.ts` — donde se añade rate limit middleware por ruta
- `apps/web/src/store/auth.js` — store de Zustand con `loginRFC()` a eliminar (verificar que `LoginPage.jsx` NO llame `loginRFC` directamente)

</code_context>

<specifics>
## Specific Ideas

- **Dev workflow sin WhatsApp:** El OTP se imprime en `console.log` del servidor (terminal donde corre `npm run dev:api`). Suficiente para desarrollo — no se expone en HTTP.
- **WhatsApp 503:** Mensaje específico en español para usuarios gubernamentales: `"Servicio OTP no disponible. Contacte soporte."` — coherente con el idioma del sistema.
- **CORS env var format:** `CORS_ORIGINS=http://localhost:5173,http://localhost:5174` — split por coma, trim whitespace al parsear.

</specifics>

<deferred>
## Deferred Ideas

- **UI admin para desbloqueo de IPs:** Jesse preguntó sobre desbloquear IPs manualmente. Con `express-rate-limit` in-memory, los bloqueos auto-expiran en 15 min y no hay lista persistente. Si en el futuro se migra a Redis para bloqueos persistentes, un panel admin de IPs en `/admin` tendría sentido — anotar para fase de Admin avanzado.

</deferred>

---

*Phase: 1-Seguridad y Estabilidad*
*Context gathered: 2026-05-08*
