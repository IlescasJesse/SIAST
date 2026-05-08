# Phase 1: Seguridad y Estabilidad - Research

**Researched:** 2026-05-08
**Domain:** Express 5 + TypeScript — hardening de autenticación, middleware de seguridad, limpieza de deuda técnica
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OTP Security (SEC-02 + scope ampliado)**
- D-01: `devCodigo` removido del HTTP response en producción. En dev (`NODE_ENV !== "production"`), el OTP se imprime únicamente en `console.log` del servidor — nunca en el response body.
- D-02: `Math.random()` → `crypto.randomInt(100000, 999999)` en `apps/api/src/services/otp.service.ts`. Fix CSPRNG incluido en esta fase.
- D-03: `/api/auth/login-rfc` eliminado limpio del router y `loginRFC()` eliminado del store. No feature flag — eliminación completa.
- D-04: Si WhatsApp falla en producción → retornar `503 { error: "Servicio OTP no disponible. Contacte soporte." }`. No silenciar.
- D-05: TTL del OTP se mantiene en 10 minutos (no cambia).

**JWT Security (SEC-01)**
- D-06: `apps/api/src/config/jwt.ts` — eliminar fallback `"siast_dev_secret"`. Si `JWT_SECRET` no está en env → `throw new Error("JWT_SECRET env var is required")`. Servidor no arranca.

**Token Refresh (SEC-05)**
- D-07: `refreshToken` — añadir llamada a `verificarSesion(payload.jti)` antes de emitir nuevo token. Si sesión revocada → 401.

**Rate Limiting (SEC-04)**
- D-08: Instalar `express-rate-limit`. Aplicar en todos los endpoints de auth.
- D-09: Límite: 5 intentos / 15 minutos por IP. Hardcodeado — no env vars.
- D-10: Almacenamiento in-memory (sin Redis).
- D-11: Response al exceder límite: `429 Too Many Requests { error: "Demasiados intentos. Intenta en 15 minutos." }`.

**CORS (SEC-03)**
- D-12: Orígenes via env var `CORS_ORIGINS` (comma-separated). Si falta → fatal error en startup.
- D-13: Dev default en `.env.example`: `CORS_ORIGINS=http://localhost:5173,http://localhost:5174`.
- D-14: Producción requiere URL real en `.env` del servidor.

**Startup Env Validation (consolidado)**
- D-15: `JWT_SECRET` y `CORS_ORIGINS` validan en startup en `apps/api/src/index.ts` antes de registrar middlewares.

**Estabilidad (STB-01, STB-02, STB-03)**
- D-16: `npm run db:generate` ejecutado en `packages/database`.
- D-17: `FOLIO_PREFIX` en `packages/shared/src/index.ts` — actualizar keys para patrón `"${CategoriaTicket}-${SubcategoriaTicket}"`.
- D-18: Archivos stale en `apps/web/src/components/Building3D/` identificados y eliminados.

### Claude's Discretion
- Orden exacto de validación en startup (JWT_SECRET primero o CORS_ORIGINS primero) — indiferente, elegir el más legible.
- Formato exacto del message en rate limit response — mantener consistencia con el estilo de `errorMiddleware`.
- Identificación de qué archivos específicos son "stale" en `Building3D/` — el agente ejecutor debe verificar en codebase actual.

### Deferred Ideas (OUT OF SCOPE)
- UI admin para desbloqueo de IPs (requiere Redis para bloqueos persistentes — fase Admin avanzado futura).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | JWT secret leído de `JWT_SECRET` env var — eliminar fallback hardcodeado | Verificado en `apps/api/src/config/jwt.ts` línea 4 y `auth.controller.ts` línea 114 — dos sitios con el fallback |
| SEC-02 | OTP nunca retornado en HTTP response | Verificado: `whatsapp.service.ts` retorna `devCodigo` en fallback; `LoginPage.jsx` lo renderiza en UI; la corrección requiere cambiar el service Y el frontend |
| SEC-03 | CORS con lista blanca de orígenes — no `true` en ningún env | Verificado en `index.ts` línea 32: `corsOrigin = IS_PROD ? [...] : true` — non-prod permite todos los orígenes |
| SEC-04 | Rate limiting en endpoints de auth | Verificado: `express-rate-limit` no está en `apps/api/package.json` — requiere instalación |
| SEC-05 | Token refresh verifica revocación de sesión | Verificado en `auth.controller.ts` líneas 105-148: `refreshToken` NO llama `verificarSesion(jti)` — `verificarSesion` existe en `sesiones.service.ts` línea 59 |
| STB-01 | Prisma client regenerado con campo `permisos` | `npm run db:generate` desde `packages/database/` — comando documentado en CLAUDE.md |
| STB-02 | FOLIO_PREFIX map actualizado con keys correctos | Verificado: keys actuales usan nombres viejos (ej. `"TECNOLOGIAS-SISTEMAS"`); enum actual usa `"TECNOLOGIAS-SISTEMAS_INSTITUCIONALES"` etc. — mapa completo de corrección documentado abajo |
| STB-03 | Archivos 3D stale eliminados de `apps/web/src/components/Building3D/` | Verificado: el directorio contiene únicamente `BuildingViewer.jsx` — no hay archivos stale; STB-03 es no-op o el agente debe verificar si existen otros archivos no listados |
</phase_requirements>

---

## Summary

Esta fase es de hardening puro: no hay nuevas features, no hay cambios de UI funcional. Todos los cambios son en el API (`apps/api/`) y en el shared package (`packages/shared/`), con una eliminación menor en el frontend (`apps/web/src/store/auth.js`) y el Prisma client regenerado en `packages/database/`.

Los cambios de seguridad (SEC-01 a SEC-05) son quirúrgicos: modificaciones de 1-5 líneas en archivos ya conocidos. El único trabajo de instalación es `express-rate-limit` (no estaba en `package.json`). El riesgo principal de esta fase es la **regresión en startup**: si `JWT_SECRET` o `CORS_ORIGINS` no están en el `.env` local del desarrollador, el servidor no arrancará — el `.env.example` actualizado es crítico para evitar confusión.

La corrección del FOLIO_PREFIX (STB-02) requiere mapear los 5 keys viejos de tecnología a los nombres de enum actuales. STB-03 es potencialmente vacía: el directorio `Building3D` solo contiene `BuildingViewer.jsx`; no hay archivos stale visibles.

**Recomendación principal:** Implementar en orden: JWT_SECRET → CORS → OTP (service primero, luego controller, luego frontend) → Rate limiting → refreshToken → db:generate → FOLIO_PREFIX → STB-03 verificación.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT secret validation | API / Backend | — | La verificación del secret ocurre en el proceso Node.js al firmar/verificar tokens |
| Startup env validation | API / Backend | — | `index.ts` se ejecuta en Node.js antes de aceptar requests |
| CORS whitelist | API / Backend | — | El header `Access-Control-Allow-Origin` lo emite el servidor |
| Rate limiting | API / Backend | — | `express-rate-limit` es middleware del servidor Express |
| OTP generation (CSPRNG) | API / Backend | — | `crypto.randomInt` es Node.js built-in |
| OTP exposure in response | API / Backend + Frontend | — | El service retorna `devCodigo`; el controller lo pasa al response; el frontend lo renderiza — los tres deben cambiar |
| Token refresh session check | API / Backend | — | `verificarSesion` consulta la tabla `Sesion` en MySQL — solo puede hacerse en el backend |
| Legacy route removal | API / Backend + Frontend | — | El router en `auth.routes.ts` Y el store `auth.js` tienen referencias que deben eliminarse |
| Prisma client sync | Database | — | `prisma generate` actualiza el cliente generado en `packages/database/` |
| FOLIO_PREFIX correction | Shared Package | API (consumer) | El map vive en `packages/shared/src/index.ts`; el consumer es `tickets.service.ts` |
| Building3D stale files | Frontend | — | Archivos en `apps/web/src/components/Building3D/` |

---

## Standard Stack

### Core (ya instalado en el proyecto)

| Library | Version | Purpose | Nota |
|---------|---------|---------|------|
| `express` | 5.1.0 | HTTP framework | [VERIFIED: apps/api/package.json] |
| `cors` | 2.8.5 | CORS middleware | [VERIFIED: apps/api/package.json] |
| `jsonwebtoken` | 9.0.2 | JWT sign/verify | [VERIFIED: apps/api/package.json] |
| `dotenv` | 17.4.1 | Env var loading | [VERIFIED: apps/api/package.json] |
| `crypto` | built-in Node.js | CSPRNG via `randomInt` | No instalación necesaria |
| `@prisma/client` | 5.22.0 | ORM client | [VERIFIED: apps/api/package.json] |

### A Instalar

| Library | Version a instalar | Purpose | Por qué este |
|---------|---------|---------|------|
| `express-rate-limit` | 8.5.1 (latest) | Rate limiting middleware | [VERIFIED: npm registry — `npm view express-rate-limit version`] Estándar de facto para Express, sin dependencias externas, soporta ESM |

**Instalación:**
```bash
npm install express-rate-limit --workspace=apps/api
```

---

## Architecture Patterns

### System Architecture Diagram (flujo de auth request con los cambios)

```
HTTP Request → POST /api/auth/solicitar-otp
                │
                ▼
         [Startup validation]              ← D-15: JWT_SECRET + CORS_ORIGINS verificados
         CORS middleware                   ← D-12: origen contra CORS_ORIGINS allowlist
                │
                ▼
         rateLimiter middleware            ← SEC-04: 5 req / 15 min por IP (express-rate-limit)
                │ si excede → 429
                ▼
         authRoutes → solicitarOtp ctrl
                │
                ▼
         otpService.solicitarOtp()
                │
                ▼
         generarCodigo()                  ← D-02: crypto.randomInt(100000, 999999)
                │
                ▼
         whatsapp.enviarOtp()
          ├── WhatsApp OK → { ok: true }   (sin devCodigo en response)
          └── WhatsApp falla:
               ├── NODE_ENV=production → throw 503  ← D-04
               └── NODE_ENV=dev → console.log solo  ← D-01
                │
                ▼
         HTTP Response                     ← NUNCA contiene devCodigo
```

### Recommended Structure (archivos a tocar)

```
apps/api/src/
├── index.ts              # D-15: validación startup + D-12: CORS desde env var
├── config/
│   └── jwt.ts            # D-06: eliminar fallback "siast_dev_secret"
├── routes/
│   └── auth.routes.ts    # D-03: eliminar route login-rfc + D-08: añadir rateLimiter
├── controllers/
│   └── auth.controller.ts # D-01: eliminar devCodigo del response + D-07: verificarSesion en refreshToken + D-06: eliminar fallback en línea 114
├── services/
│   ├── otp.service.ts    # D-02: crypto.randomInt
│   └── whatsapp.service.ts # D-01/D-04: producción falla con 503, dev solo console.log
packages/shared/src/
└── index.ts              # D-17: FOLIO_PREFIX keys corregidos
apps/web/src/
└── store/auth.js         # D-03: eliminar loginRFC()
packages/database/
└── (sin cambio de código) # D-16: solo ejecutar npm run db:generate
```

### Pattern 1: Startup Env Validation (D-15, D-06, D-12)

Patrón: validar antes del primer `app.use()`, con `throw` que aborta el proceso.

```typescript
// apps/api/src/index.ts — AL INICIO, antes de cualquier middleware
import "dotenv/config";
import express from "express";
// ...

// ── Validación de entorno obligatoria ──────────────────────────
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}
if (!process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS env var is required");
}

const corsOrigins = process.env.CORS_ORIGINS.split(",").map((o) => o.trim());

const app = express();
// ... resto del servidor
```

**Por qué throw y no process.exit:** `throw` en módulo top-level aborta el proceso con código de salida no-cero, imprime el stack trace, y es detectable por PM2/proceso supervisor. `process.exit(1)` es equivalente pero menos idiomático en TypeScript.

### Pattern 2: CORS desde env var (D-12, D-13)

```typescript
// apps/api/src/index.ts
const corsOrigins = process.env.CORS_ORIGINS!.split(",").map((o) => o.trim());

// Para Express HTTP
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Para Socket.IO (mismo array)
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});
```

**Nota:** El `!` en `CORS_ORIGINS!` es seguro porque ya validamos arriba que no es undefined. [CITED: cors package — origin acepta string[] directamente]

### Pattern 3: express-rate-limit v8 — Import y uso ESM + TypeScript

```typescript
// Source: npm registry + GitHub README (verified 2026-05-08)
import { rateLimit } from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  limit: 5,                   // 5 intentos por IP (reemplaza `max` en v7+)
  standardHeaders: "draft-8", // Emite encabezado RateLimit estándar
  legacyHeaders: false,       // No emitir X-RateLimit-*
  message: { error: "Demasiados intentos. Intenta en 15 minutos." },
});
```

**Cambio importante v6→v7+:** El option `max` fue renombrado a `limit`. [VERIFIED: npm registry]

**Aplicación en rutas de auth:**

```typescript
// apps/api/src/routes/auth.routes.ts
import { Router } from "express";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";
import * as ctrl from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Rate limiter aplicado a todos los endpoints de auth sensibles
router.post("/solicitar-otp", authRateLimiter, ctrl.solicitarOtp);
router.post("/verificar-otp", authRateLimiter, ctrl.verificarOtp);
router.post("/login", authRateLimiter, ctrl.loginStaff);
router.post("/refresh", authRateLimiter, ctrl.refreshToken);
// ...
```

**Alternativa — global en index.ts:** Se puede aplicar `app.use("/api/auth", authRateLimiter, authRoutes)`. Misma semántica pero más conciso. El planner puede elegir.

### Pattern 4: OTP — eliminar devCodigo del response (D-01, D-04)

**El flujo actual:**
1. `whatsapp.service.ts` retorna `{ ok: true, devCodigo: codigo }` en fallback
2. `otp.service.ts` spread el resultado: `...(envio.devCodigo ? { devCodigo: envio.devCodigo } : {})`
3. El response HTTP incluye `devCodigo`
4. `LoginPage.jsx` lo lee y lo renderiza

**Cambio en `whatsapp.service.ts`:**
```typescript
// En enviarOtp() — modo fallback final (línea ~286)
// PRODUCCIÓN: lanzar error 503
if (process.env.NODE_ENV === "production") {
  throw Object.assign(
    new Error("Servicio OTP no disponible. Contacte soporte."),
    { status: 503 }
  );
}
// DEV: solo console.log, sin devCodigo en el retorno
return { ok: true };  // sin devCodigo
```

**Consecuencia en `otp.service.ts`:** El spread `...(envio.devCodigo ? ...)` queda como dead code pero no rompe nada. Puede quedar o eliminarse.

**Consecuencia en `LoginPage.jsx`:** El bloque `if (res.devCodigo) setDevCodigo(res.devCodigo)` nunca se ejecutará — el estado `devCodigo` siempre será `""`. El render condicional `{devCodigo && ...}` simplemente no mostrará nada. Se puede dejar el código sin romper funcionalidad, o limpiarlo. El planner debe decidir si limpiar LoginPage es parte de esta fase o deferred.

### Pattern 5: refreshToken + verificarSesion (D-07, SEC-05)

```typescript
// apps/api/src/controllers/auth.controller.ts — dentro de refreshToken
// DESPUÉS de verificar el token pero ANTES de emitir el nuevo:

const { iat, exp, ...restPayload } = payload;

// ── NUEVO: verificar que la sesión no fue revocada ────────────
const { verificarSesion } = await import("../services/sesiones.service.js");
const sesionActiva = await verificarSesion(payload.jti);
if (!sesionActiva) {
  res.status(401).json({ error: "Sesión revocada. Por favor inicia sesión de nuevo." });
  return;
}
// ─────────────────────────────────────────────────────────────

const expiresIn = ...
const newToken = signToken(restPayload, expiresIn);
res.json({ token: newToken });
```

**Nota de importación:** `sesiones.service.ts` ya importa `verificarSesion` en `auth.middleware.ts`, así que el import estático es mejor que el dinámico. Revisar si ya está importado en el controller; si no, añadir import estático al inicio del archivo.

### Pattern 6: FOLIO_PREFIX — mapa de corrección (D-17, STB-02)

**Estado actual (keys stale):**
```typescript
"TECNOLOGIAS-SISTEMAS": "TEC-SIS",
"TECNOLOGIAS-SOPORTE_TECNICO": "TEC-SOP",
"TECNOLOGIAS-IMPRESORAS": "TEC-IMP",
"TECNOLOGIAS-REDES_INTERNET": "TEC-RED",
"TECNOLOGIAS-CONFIGURACION_CORREO_OUTLOOK": "TEC-COR",
```

**Enum actual de `SubcategoriaTicket`:**
```
SISTEMAS_INSTITUCIONALES, EQUIPOS_DISPOSITIVOS, RED_INTERNET,
CUENTAS_DOMINIO, CORREO_OUTLOOK, SANITARIOS, ILUMINACION, MOVILIDAD,
SALA_JUNTAS, EQUIPO_AUDIOVISUAL, PRESTAMO_EQUIPO, MOBILIARIO, PAPELERIA
```

**Mapa corregido completo:**
```typescript
export const FOLIO_PREFIX: Record<string, string> = {
  // Tecnologías — keys corregidos para SubcategoriaTicket actual
  "TECNOLOGIAS-SISTEMAS_INSTITUCIONALES":  "TEC-SIS",
  "TECNOLOGIAS-EQUIPOS_DISPOSITIVOS":      "TEC-EQP",
  "TECNOLOGIAS-RED_INTERNET":              "TEC-RED",
  "TECNOLOGIAS-CUENTAS_DOMINIO":           "TEC-DOM",
  "TECNOLOGIAS-CORREO_OUTLOOK":            "TEC-COR",
  // Servicios — sin cambio (keys ya coinciden)
  "SERVICIOS-SANITARIOS":                  "SER-SAN",
  "SERVICIOS-ILUMINACION":                 "SER-ILU",
  "SERVICIOS-MOVILIDAD":                   "SER-MOV",
  // Recursos Materiales — sin cambio (keys ya coinciden)
  "RECURSOS_MATERIALES-SALA_JUNTAS":       "REC-SAL",
  "RECURSOS_MATERIALES-EQUIPO_AUDIOVISUAL":"REC-AUD",
  "RECURSOS_MATERIALES-PRESTAMO_EQUIPO":   "REC-PRE",
  "RECURSOS_MATERIALES-MOBILIARIO":        "REC-MOB",
  "RECURSOS_MATERIALES-PAPELERIA":         "REC-PAP",
};
```

**Cambios respecto al mapa actual:**
- `TECNOLOGIAS-SISTEMAS` → `TECNOLOGIAS-SISTEMAS_INSTITUCIONALES`
- `TECNOLOGIAS-SOPORTE_TECNICO` → `TECNOLOGIAS-EQUIPOS_DISPOSITIVOS` (con nuevo prefix `TEC-EQP`)
- `TECNOLOGIAS-IMPRESORAS` → eliminado (no es subcategoría actual; impresoras van bajo `EQUIPOS_DISPOSITIVOS`)
- `TECNOLOGIAS-REDES_INTERNET` → `TECNOLOGIAS-RED_INTERNET`
- `TECNOLOGIAS-CONFIGURACION_CORREO_OUTLOOK` → `TECNOLOGIAS-CORREO_OUTLOOK`
- Añadir `TECNOLOGIAS-CUENTAS_DOMINIO` (faltaba completamente)

**Impacto en tickets existentes:** Los tickets en DB ya tienen folio asignado — el folio está grabado como string en el campo `folio`. Actualizar `FOLIO_PREFIX` solo afecta la generación de folios NUEVOS. No hay migración de datos.

### Anti-Patterns a Evitar

- **Anti-pattern — CORS_ORIGINS con default en código:** `process.env.CORS_ORIGINS ?? "http://localhost:5173"`. Aunque conveniente en dev, contradice D-12 (fatal error si falta). El `.env.example` documentado es el mecanismo correcto.
- **Anti-pattern — rate limiter global en app:** `app.use(authRateLimiter)` aplica el límite a TODOS los endpoints, no solo auth. Otros endpoints (tickets, recursos) quedarían throttleados innecesariamente.
- **Anti-pattern — importar `verificarSesion` dinámicamente:** Un import dinámico (`await import(...)`) en el hot path de refresh añade latencia y complejidad. Usar import estático al top del archivo.
- **Anti-pattern — eliminar solo `loginRFC` del router sin eliminar del store:** El store `auth.js` todavía llama `/api/auth/login-rfc` — quedará como llamada rota. Ambas eliminaciones van en el mismo commit.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting por IP | Middleware propio con Map + setInterval | `express-rate-limit` | Maneja clock skew, cleanup de memoria, headers estándar, sliding vs fixed window correctamente |
| CSPRNG para OTP | Fórmula custom con Math | `crypto.randomInt(min, max)` | Node.js built-in, no requiere instalación, garantía criptográfica |
| CORS dynamic origin | Función custom comparando headers | `cors` npm package con array de origins | Ya instalado, maneja preflight, OPTIONS, credenciales correctamente |

---

## Common Pitfalls

### Pitfall 1: express-rate-limit — `max` vs `limit`

**What goes wrong:** Usar `max: 5` en lugar de `limit: 5`. En v7+ el option `max` fue deprecated y renombrado a `limit`. Con `max` el limiter ignora el valor y usa el default (100 requests/window).
**Why it happens:** Toda la documentación pre-2023 usa `max`.
**How to avoid:** Usar `limit: 5` [VERIFIED: npm registry, versión 8.5.1].
**Warning signs:** El limiter no bloquea después de 5 intentos.

### Pitfall 2: `cors` con `origin: string[]` vs `origin: true`

**What goes wrong:** Pasar `origin: corsOrigins` donde `corsOrigins` es un array vacío (si `CORS_ORIGINS=""`) resulta en que ningún origen es permitido — el frontend deja de funcionar completamente.
**Why it happens:** `.split(",")` en string vacío retorna `[""]`, que el paquete `cors` interpreta como un origen literal `""`.
**How to avoid:** Validar en startup que `CORS_ORIGINS` no está vacía (ya cubierto por D-12). Adicionalmente, hacer `.filter(Boolean)` al parsear: `process.env.CORS_ORIGINS.split(",").map(o => o.trim()).filter(Boolean)`.

### Pitfall 3: JWT fallback en dos lugares

**What goes wrong:** El fallback `"siast_dev_secret"` existe en DOS archivos:
1. `apps/api/src/config/jwt.ts` línea 4: `const SECRET = process.env.JWT_SECRET ?? "siast_dev_secret";`
2. `apps/api/src/controllers/auth.controller.ts` línea 114: `const SECRET = process.env.JWT_SECRET ?? "siast_dev_secret";`

El segundo está dentro de `refreshToken` y es un secret local a esa función — no usa el módulo `jwt.ts`.
**How to avoid:** Corregir AMBOS lugares. En `auth.controller.ts`, `refreshToken` debería importar y usar `verifyToken` de `config/jwt.ts` en lugar de llamar `jwt.verify` directamente con su propio secret local. Consolidación recomendada.

### Pitfall 4: `devCodigo` — frontend mantiene el campo aunque no llegue

**What goes wrong:** `LoginPage.jsx` tiene en múltiples lugares `if (res.devCodigo) setDevCodigo(res.devCodigo)`. Una vez que `devCodigo` deja de llegar en el response, el estado `devCodigo` en el componente simplemente no se actualiza — no causa un error. El código "funciona" pero queda dead code.
**How to avoid:** Decidir en el plan si limpiar `LoginPage.jsx` es parte de esta fase. No es bloqueante para la seguridad (el campo solo se renderiza si `devCodigo !== ""`), pero es deuda técnica.

### Pitfall 5: Building3D — el directorio solo tiene un archivo

**What goes wrong:** Según el filesystem actual, `apps/web/src/components/Building3D/` contiene únicamente `BuildingViewer.jsx`. No hay archivos stale visibles. Si STB-03 se implementa como "eliminar archivos stale", el agente puede marcar la tarea como completada sin hacer nada (o verificando que no existen otros archivos como `.old`, `.bak`, drafts, etc.).
**How to avoid:** El agente ejecutor debe listar el directorio en el momento de implementación y confirmar. Si solo existe `BuildingViewer.jsx`, STB-03 es no-op y debe documentarse como tal.

### Pitfall 6: `npm run db:generate` — dónde ejecutar

**What goes wrong:** Ejecutar `prisma generate` desde la raíz del monorepo en lugar de desde `packages/database/`. El schema está en `packages/database/prisma/schema.prisma` — Prisma necesita estar en el directorio correcto para encontrarlo.
**How to avoid:** Usar el script documentado: `cd packages/database && npm run db:generate`, o desde la raíz: `npm run db:generate --workspace=packages/database`.

---

## Runtime State Inventory

Esta fase NO es un rename/refactor de strings a través del sistema. Es eliminación de código y configuración. No aplica el inventario completo de runtime state, pero sí hay un punto de atención:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Tickets existentes con folios generados por el mapa stale de FOLIO_PREFIX | Ninguna — los folios ya generados son strings en DB; el fix solo afecta generación futura |
| Live service config | `.env` del servidor de producción — no tiene `CORS_ORIGINS` (env var nueva) | Agregar `CORS_ORIGINS=...` al `.env` de producción ANTES de desplegar |
| OS-registered state | Ninguno | — |
| Secrets/env vars | `JWT_SECRET` ya existe en producción (el fallback implica que se usaba en dev sin env var) | Verificar que `.env` de dev tenga `JWT_SECRET` después del cambio — si no, el servidor local no arrancará |
| Build artifacts | Prisma client desincronizado en `packages/database/node_modules/.prisma/` | `npm run db:generate` desde packages/database — requerido antes de arrancar la API |

**Advertencia de deployment:** El cambio de CORS de `true` a allowlist + el cambio de JWT de fallback a fatal son **breaking changes para el entorno de desarrollo** si el `.env` local no tiene `JWT_SECRET` y `CORS_ORIGINS`. Actualizar `.env.example` y comunicar a cualquier otro desarrollador.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `crypto.randomInt` (SEC-02) | ✓ | 24.12.0 | — (built-in) |
| MySQL / XAMPP | Prisma client (STB-01) | Asumido ✓ | — | Ninguno — requerido |
| `express-rate-limit` | SEC-04 | ✗ — no en package.json | — | Ninguno — debe instalarse |
| `cors` npm package | SEC-03 | ✓ 2.8.5 | 2.8.5 | — |
| Prisma CLI | STB-01 db:generate | ✓ (en devDeps de packages/database) | 5.22.0 | — |

**Missing dependencies con fallback:** Ninguna.
**Missing dependencies sin fallback (bloquean ejecución):**
- `express-rate-limit` — debe instalarse con `npm install express-rate-limit --workspace=apps/api` antes de la tarea SEC-04.

---

## Assumptions Log

| # | Claim | Section | Risk si es incorrecto |
|---|-------|---------|----------------------|
| A1 | `Building3D/` solo contiene `BuildingViewer.jsx` — no hay archivos stale | Common Pitfalls #5, STB-03 | Bajo — si hay más archivos, STB-03 tiene trabajo real; si no, es no-op |
| A2 | El prefix `TEC-EQP` para `EQUIPOS_DISPOSITIVOS` es un prefix razonable que no colisiona con folios existentes | FOLIO_PREFIX correction | Bajo — los folios existentes ya están generados como strings; el planner puede elegir cualquier prefix corto |
| A3 | La DB de producción tiene `JWT_SECRET` ya configurada (el sistema está corriendo en prod) | Runtime State Inventory | Medio — si no lo tiene, el cambio no afecta prod hasta el próximo despliegue |

---

## Open Questions

1. **¿Limpiar `LoginPage.jsx` de las referencias a `devCodigo`?**
   - Lo que sabemos: `devCodigo` deja de llegar del backend pero el dead code en el frontend no causa errores.
   - Lo que no está claro: el planner/CONTEXT.md no menciona limpiar el frontend más allá de eliminar `loginRFC()` del store.
   - Recomendación: incluir la limpieza como subtarea de SEC-02 — es 5 líneas y evita confusión futura.

2. **¿`refreshToken` debe consolidar el secret usando `verifyToken` de `config/jwt.ts`?**
   - Lo que sabemos: `auth.controller.ts` línea 114 tiene su propio fallback `"siast_dev_secret"` duplicado — no usa el módulo `jwt.ts`.
   - Lo que no está claro: si el planner quiere hacer la consolidación (importar `verifyToken` en el controller) o solo eliminar el fallback del local `const SECRET`.
   - Recomendación: consolidar — es más limpio y elimina la duplicación del secret en dos módulos.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sí | OTP via CSPRNG, rate limiting, eliminación de endpoint legacy |
| V3 Session Management | Sí | `verificarSesion(jti)` en refresh, sesiones revocables |
| V4 Access Control | No (esta fase) | — |
| V5 Input Validation | No (esta fase) | — |
| V6 Cryptography | Sí | `crypto.randomInt` reemplaza `Math.random()` |

### Known Threat Patterns para este stack

| Pattern | STRIDE | Mitigación estándar |
|---------|--------|---------------------|
| OTP brute force (6 dígitos = 1M combinaciones) | Tampering | Rate limiting 5/15min por IP (express-rate-limit) |
| Forged JWT con secret predecible | Spoofing | Eliminar fallback hardcodeado; fatal error si no hay secret |
| CSRF + CORS open | Elevation of Privilege | CORS allowlist explícita con origins de confianza |
| Session token reuse post-logout | Repudiation | `verificarSesion(jti)` en refresh verifica que la sesión no fue revocada |
| OTP code leakage via HTTP response | Information Disclosure | Eliminar `devCodigo` del response body en todos los entornos |
| Auth bypass via legacy endpoint | Elevation of Privilege | Eliminar `/api/auth/login-rfc` completamente |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: apps/api/package.json] — versiones de todas las dependencias del API
- [VERIFIED: apps/api/src/config/jwt.ts] — fallback hardcodeado línea 4, confirmado
- [VERIFIED: apps/api/src/controllers/auth.controller.ts] — segundo fallback línea 114 + refreshToken sin verificarSesion
- [VERIFIED: apps/api/src/services/otp.service.ts] — Math.random() línea 9, devCodigo spread línea 61
- [VERIFIED: apps/api/src/services/whatsapp.service.ts] — devCodigo retornado en fallback línea 294
- [VERIFIED: apps/api/src/routes/auth.routes.ts] — login-rfc presente línea 7, sin rate limiting
- [VERIFIED: apps/api/src/index.ts] — CORS open en non-prod línea 32
- [VERIFIED: apps/web/src/store/auth.js] — loginRFC presente líneas 33-38
- [VERIFIED: apps/web/src/pages/LoginPage.jsx] — devCodigo leído y renderizado múltiples líneas
- [VERIFIED: packages/shared/src/index.ts] — FOLIO_PREFIX keys stale líneas 401-414, SubcategoriaTicket enum actual líneas 19-36
- [VERIFIED: npm view express-rate-limit version] — versión 8.5.1 (latest)
- [CITED: github.com/express-rate-limit/express-rate-limit README] — import ESM `import { rateLimit }`, option `limit` (no `max` en v7+)

### Secondary (MEDIUM confidence)
- [VERIFIED: ls Building3D/] — directorio contiene solo `BuildingViewer.jsx`; STB-03 posiblemente no-op

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos los archivos relevantes leídos directamente del codebase
- Architecture patterns: HIGH — código fuente verificado, no asumido
- Pitfalls: HIGH — identificados desde código fuente real (dos fallbacks, ESM import, etc.)
- FOLIO_PREFIX correction: HIGH — enums verificados directamente en `packages/shared/src/index.ts`
- express-rate-limit API: MEDIUM — README verificado, version confirmada con npm view; MCP Context7 no accesible en este entorno

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stack estable; solo `express-rate-limit` podría tener cambios menores de API)
