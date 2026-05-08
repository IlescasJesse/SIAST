# Phase 1: Seguridad y Estabilidad - Pattern Map

**Mapped:** 2026-05-08  
**Files analyzed:** 7 (modified)  
**Analogs found:** 7 / 7 (100% match)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/config/jwt.ts` | config | request-response | `apps/api/src/config/jwt.ts` (self) | exact (startup validation) |
| `apps/api/src/services/otp.service.ts` | service | request-response | `apps/api/src/services/otp.service.ts` (self) | exact (CSPRNG fix) |
| `apps/api/src/controllers/auth.controller.ts` | controller | request-response | `apps/api/src/controllers/auth.controller.ts` (self) | exact (refresh logic) |
| `apps/api/src/routes/auth.routes.ts` | route | request-response | `apps/api/src/routes/auth.routes.ts` (self) | exact (middleware chain) |
| `apps/api/src/index.ts` | entry-point | request-response | `apps/api/src/index.ts` (self) | exact (startup config) |
| `apps/web/src/store/auth.js` | store | request-response | `apps/web/src/store/auth.js` (self) | exact (legacy cleanup) |
| `packages/shared/src/index.ts` | constants | transform | `packages/shared/src/index.ts` (self) | exact (enum mapping) |

---

## Pattern Assignments

### `apps/api/src/config/jwt.ts` (config, startup validation)

**Analog:** Self (existing file at lines 1-17)  
**Pattern:** Startup env validation for JWT_SECRET

**Current state (lines 1-5):**
```typescript
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/index.js";

const SECRET = process.env.JWT_SECRET ?? "siast_dev_secret";  // ← REMOVE fallback
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
```

**Change required (D-06):**
Eliminate fallback `"siast_dev_secret"`. If `JWT_SECRET` is missing at startup, throw error. This file alone doesn't throw — the validation happens in `apps/api/src/index.ts` before this module is loaded (see Shared Patterns).

**Modified code (lines 1-5):**
```typescript
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/index.js";

const SECRET = process.env.JWT_SECRET;  // Remove ??
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

// Add assertion at module level if used without import from index.ts:
if (!SECRET) {
  throw new Error("JWT_SECRET env var is required");
}
```

---

### `apps/api/src/services/otp.service.ts` (service, request-response)

**Analog:** Self (existing file at lines 1-176)  
**Pattern:** CSPRNG generation and OTP response control

**Current state (line 9):**
```typescript
const generarCodigo = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();  // ← INSECURE
```

**Change required (D-02):**
Replace `Math.random()` with cryptographic `crypto.randomInt()`.

**Modified code (line 8-10):**
```typescript
import { randomInt } from "crypto";  // Add at top

const generarCodigo = (): string => {
  const codigo = randomInt(100000, 999999);
  return codigo.toString();
};
```

**OTP response cleanup (D-01):**
The interface `SolicitarOtpResult` includes optional `devCodigo` (line 22). The service `generarYEnviarOtp` spreads this conditionally at line 61:

```typescript
return {
  ok: true,
  hint: maskTelefono(telefono),
  ...(envio.devCodigo ? { devCodigo: envio.devCodigo } : {}),  // ← line 61
};
```

This will naturally exclude `devCodigo` once `whatsapp.service.ts` stops returning it (see below).

---

### `apps/api/src/services/whatsapp.service.ts` (service, request-response) — **Not in files to modify, but critical**

**Analog:** Self (existing file lines 256-295)  
**Pattern:** Fallback OTP handling

**Current state (lines 286-295):**
```typescript
  // ── Modo consola (fallback) ───────────────────────────────────────────────
  console.log("\n┌──────────────────────────────────────────────┐");
  console.log(`│  OTP CONSOLA → ******${telefono.slice(-4)}                  │`);
  console.log(`│  RFC/Nombre: ${nombre.slice(0, 25).padEnd(25)}   │`);
  console.log(`│  Código: ${codigo}  (WhatsApp no disponible)  │`);
  console.log("└──────────────────────────────────────────────┘\n");

  // Siempre devolver devCodigo en fallback para que aparezca en el UI
  return { ok: true, devCodigo: codigo };  // ← EXPOSED IN RESPONSE
```

**Change required (D-01, D-04):**
- **Production:** If WhatsApp fails and `NODE_ENV === "production"`, throw 503 error.
- **Development:** Keep `console.log()` only, do NOT return `devCodigo` in response body.

**Modified code (lines 283-295):**
```typescript
  // ── Modo consola (fallback) ───────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    throw Object.assign(
      new Error("Servicio OTP no disponible. Contacte soporte."),
      { status: 503 }
    );
  }

  // DEV: print to console only, do NOT expose devCodigo
  console.log("\n┌──────────────────────────────────────────────┐");
  console.log(`│  OTP CONSOLA → ******${telefono.slice(-4)}                  │`);
  console.log(`│  RFC/Nombre: ${nombre.slice(0, 25).padEnd(25)}   │`);
  console.log(`│  Código: ${codigo}  (WhatsApp no disponible)  │`);
  console.log("└──────────────────────────────────────────────┘\n");

  return { ok: true };  // ← NO devCodigo
```

---

### `apps/api/src/controllers/auth.controller.ts` (controller, request-response)

**Analog:** Self (existing file at lines 102-148)  
**Patterns:** Token refresh with session verification; JWT secret consolidation

**Current state (refreshToken, lines 105-148):**
```typescript
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token requerido" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const SECRET = process.env.JWT_SECRET ?? "siast_dev_secret";  // ← DUPLICATE FALLBACK
    
    let payload: JwtPayload & { iat?: number; exp?: number };
    try {
      payload = jwt.verify(token, SECRET, { ignoreExpiration: true }) as JwtPayload & {
        iat?: number;
        exp?: number;
      };
    } catch {
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    // Período de gracia: 7 días desde expiración
    const now = Math.floor(Date.now() / 1000);
    const GRACE_PERIOD_SECS = 7 * 24 * 60 * 60;
    if (payload.exp && now - payload.exp > GRACE_PERIOD_SECS) {
      res.status(401).json({ error: "Sesión expirada. Por favor inicia sesión de nuevo." });
      return;
    }

    // Emitir nuevo token con el mismo payload (sin iat/exp anteriores)
    const { iat, exp, ...restPayload } = payload;
    const expiresIn =
      restPayload.rol === "EMPLEADO"
        ? (process.env.EMPLEADO_JWT_EXPIRES_IN ?? "30d")
        : (process.env.JWT_EXPIRES_IN ?? "8h");

    const newToken = signToken(restPayload as Omit<JwtPayload, "iat" | "exp">, expiresIn);
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
};
```

**Change required (D-06, D-07):**
1. Remove duplicate `JWT_SECRET` fallback (line 114).
2. Add `verificarSesion(payload.jti)` check before emitting new token (D-07).

**Import pattern** (top of file, lines 1-10):
```typescript
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as authService from "../services/auth.service.js";
import * as otpService from "../services/otp.service.js";
import { cerrarSesion, verificarSesion } from "../services/sesiones.service.js";  // ← ADD verificarSesion
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";
import { signToken } from "../config/jwt.js";
import type { JwtPayload } from "../types/index.js";
```

**Modified refreshToken (lines 102-148):**
```typescript
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token requerido" });
      return;
    }

    const token = authHeader.split(" ")[1];
    
    let payload: JwtPayload & { iat?: number; exp?: number };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || "", { ignoreExpiration: true }) as JwtPayload & {
        iat?: number;
        exp?: number;
      };
    } catch {
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    // Período de gracia: 7 días desde expiración
    const now = Math.floor(Date.now() / 1000);
    const GRACE_PERIOD_SECS = 7 * 24 * 60 * 60;
    if (payload.exp && now - payload.exp > GRACE_PERIOD_SECS) {
      res.status(401).json({ error: "Sesión expirada. Por favor inicia sesión de nuevo." });
      return;
    }

    // ── NUEVO: verificar que la sesión no fue revocada (D-07) ─────────────────
    if (payload.jti) {
      const sesionActiva = await verificarSesion(payload.jti);
      if (!sesionActiva) {
        res.status(401).json({ error: "Sesión revocada. Por favor inicia sesión de nuevo." });
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Emitir nuevo token con el mismo payload (sin iat/exp anteriores)
    const { iat, exp, ...restPayload } = payload;
    const expiresIn =
      restPayload.rol === "EMPLEADO"
        ? (process.env.EMPLEADO_JWT_EXPIRES_IN ?? "30d")
        : (process.env.JWT_EXPIRES_IN ?? "8h");

    const newToken = signToken(restPayload as Omit<JwtPayload, "iat" | "exp">, expiresIn);
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
};
```

---

### `apps/api/src/routes/auth.routes.ts` (route, request-response)

**Analog:** Self (existing file at lines 1-16)  
**Patterns:** Route definition; middleware chain; legacy endpoint removal

**Current state (lines 1-16):**
```typescript
import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login-rfc", ctrl.loginRFC);       // legacy (sin OTP) ← REMOVE
router.post("/solicitar-otp", ctrl.solicitarOtp);
router.post("/verificar-otp", ctrl.verificarOtp);
router.post("/login", ctrl.loginStaff);
router.post("/logout", authMiddleware, ctrl.logout);
router.post("/refresh", ctrl.refreshToken);     // renovación sin requerir token válido
router.get("/me", authMiddleware, ctrl.me);
router.patch("/password", authMiddleware, ctrl.changePassword);

export default router;
```

**Change required (D-03, D-08):**
1. Remove `/login-rfc` route (D-03).
2. Add `authRateLimiter` middleware to all auth endpoints (D-08).

**Rate limiter middleware pattern** (create `apps/api/src/middleware/rate-limit.middleware.ts`):
```typescript
import { rateLimit } from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  limit: 5,                   // 5 intentos por IP
  standardHeaders: "draft-8", // Emite encabezado RateLimit estándar
  legacyHeaders: false,       // No emitir X-RateLimit-*
  message: { error: "Demasiados intentos. Intenta en 15 minutos." },
});
```

**Modified auth.routes.ts (lines 1-16):**
```typescript
import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";  // ← IMPORT

const router = Router();

// router.post("/login-rfc", ctrl.loginRFC);  // ← REMOVED (D-03)

router.post("/solicitar-otp", authRateLimiter, ctrl.solicitarOtp);  // ← ADD rate limiter
router.post("/verificar-otp", authRateLimiter, ctrl.verificarOtp);  // ← ADD rate limiter
router.post("/login", authRateLimiter, ctrl.loginStaff);            // ← ADD rate limiter
router.post("/logout", authMiddleware, ctrl.logout);
router.post("/refresh", authRateLimiter, ctrl.refreshToken);        // ← ADD rate limiter
router.get("/me", authMiddleware, ctrl.me);
router.patch("/password", authMiddleware, ctrl.changePassword);

export default router;
```

---

### `apps/api/src/index.ts` (entry-point, startup config)

**Analog:** Self (existing file lines 1-60)  
**Pattern:** Startup validation and middleware configuration

**Current state (lines 27-32, 49-54):**
```typescript
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const VIEWER_URL = process.env.VIEWER_URL ?? "http://localhost:5174";
const IS_PROD = process.env.NODE_ENV === "production";

// En desarrollo permite cualquier origen (acceso desde la red local)
const corsOrigin = IS_PROD ? [FRONTEND_URL, VIEWER_URL, "http://localhost:3008"] : true;

// ...

app.use(
  cors({
    origin: corsOrigin,  // ← OPEN in non-prod
    credentials: true,
  }),
);
```

**Change required (D-15, D-12):**
1. Add startup validation for `JWT_SECRET` and `CORS_ORIGINS` before any middleware registration.
2. Parse `CORS_ORIGINS` from comma-separated env var (D-12, D-13).

**Modified index.ts startup section** (add after `import` statements, before `const app = express()`):
```typescript
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// ... other imports

// ══════════════════════════════════════════════════════════════════════════════
// ── STARTUP VALIDATION (D-15: JWT_SECRET + CORS_ORIGINS must exist) ────────────
// ══════════════════════════════════════════════════════════════════════════════

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}

if (!process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS env var is required");
}

const corsOrigins = process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);

// ══════════════════════════════════════════════════════════════════════════════

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 5101);

// ── Removed: FRONTEND_URL, VIEWER_URL, IS_PROD, old corsOrigin logic ──────────

// Socket.IO with dynamic CORS
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,  // ← DYNAMIC from env var
    credentials: true,
  },
});
configurarSockets(io);
setIo(io);

// Express CORS middleware
app.use(
  cors({
    origin: corsOrigins,  // ← DYNAMIC from env var
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// ... rest of the file
```

---

### `apps/web/src/store/auth.js` (store, request-response)

**Analog:** Self (existing file at lines 32-39)  
**Pattern:** Legacy method removal

**Current state (lines 32-39):**
```typescript
  // ── Legacy (sin OTP) ──────────────────────────────────────────────
  loginRFC: async (rfc) => {
    const { data } = await api.post("/api/auth/login-rfc", { rfc });
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },
```

**Change required (D-03):**
Remove the entire `loginRFC` method. The OTP flow (`solicitarOtp` → `verificarOtp`) is the only auth path for employees.

**Modified store (remove lines 32-39 entirely):**
```typescript
import { create } from "zustand";
import { api } from "../api/client.js";

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem("siast_user") ?? "null");
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  user: stored(),
  token: localStorage.getItem("siast_token"),

  // ── OTP (empleados) ───────────────────────────────────────────────
  solicitarOtp: async (rfc, telefono) => {
    const { data } = await api.post("/api/auth/solicitar-otp", { rfc, telefono });
    return data;
  },

  verificarOtp: async (rfc, codigo) => {
    const { data } = await api.post("/api/auth/verificar-otp", { rfc, codigo });
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },

  // ── Staff ─────────────────────────────────────────────────────────
  loginStaff: async (usuario, password) => {
    const { data } = await api.post("/api/auth/login", { usuario, password });
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },

  logout: () => {
    localStorage.removeItem("siast_token");
    localStorage.removeItem("siast_user");
    set({ user: null, token: null });
  },
}));
```

---

### `packages/shared/src/index.ts` (constants, enum mapping)

**Analog:** Self (existing file lines 400-414)  
**Pattern:** Enum-to-prefix mapping

**Current state (lines 400-414 — FOLIO_PREFIX):**
```typescript
export const FOLIO_PREFIX: Record<string, string> = {
  "TECNOLOGIAS-SISTEMAS": "TEC-SIS",
  "TECNOLOGIAS-SOPORTE_TECNICO": "TEC-SOP",
  "TECNOLOGIAS-IMPRESORAS": "TEC-IMP",
  "TECNOLOGIAS-REDES_INTERNET": "TEC-RED",
  "TECNOLOGIAS-CONFIGURACION_CORREO_OUTLOOK": "TEC-COR",
  "SERVICIOS-SANITARIOS": "SER-SAN",
  "SERVICIOS-ILUMINACION": "SER-ILU",
  "SERVICIOS-MOVILIDAD": "SER-MOV",
  "RECURSOS_MATERIALES-SALA_JUNTAS": "REC-SAL",
  "RECURSOS_MATERIALES-EQUIPO_AUDIOVISUAL": "REC-AUD",
  "RECURSOS_MATERIALES-PRESTAMO_EQUIPO": "REC-PRE",
  "RECURSOS_MATERIALES-MOBILIARIO": "REC-MOB",
  "RECURSOS_MATERIALES-PAPELERIA": "REC-PAP",
};
```

**Current SubcategoriaTicket enum (lines 19-36):**
```typescript
export const SubcategoriaTicketSchema = z.enum([
  // Tecnologías
  "SISTEMAS_INSTITUCIONALES",
  "EQUIPOS_DISPOSITIVOS",
  "RED_INTERNET",
  "CUENTAS_DOMINIO",
  "CORREO_OUTLOOK",
  // Servicios Generales
  "SANITARIOS",
  "ILUMINACION",
  "MOVILIDAD",
  // Recursos Materiales
  "SALA_JUNTAS",
  "EQUIPO_AUDIOVISUAL",
  "PRESTAMO_EQUIPO",
  "MOBILIARIO",
  "PAPELERIA",
]);
```

**Change required (D-17):**
Update `FOLIO_PREFIX` keys to match current `SubcategoriaTicket` enum. Prefixes can be reassigned; only the keys must align.

**Mapping corrections:**
- `TECNOLOGIAS-SISTEMAS` → `TECNOLOGIAS-SISTEMAS_INSTITUCIONALES`
- `TECNOLOGIAS-SOPORTE_TECNICO` → `TECNOLOGIAS-EQUIPOS_DISPOSITIVOS` (old "SOPORTE_TECNICO" doesn't exist in enum)
- `TECNOLOGIAS-IMPRESORAS` → removed (printers now under EQUIPOS_DISPOSITIVOS)
- `TECNOLOGIAS-REDES_INTERNET` → `TECNOLOGIAS-RED_INTERNET`
- `TECNOLOGIAS-CONFIGURACION_CORREO_OUTLOOK` → `TECNOLOGIAS-CORREO_OUTLOOK`
- Add: `TECNOLOGIAS-CUENTAS_DOMINIO` (missing completely)

**Modified FOLIO_PREFIX (lines 400-414):**
```typescript
export const FOLIO_PREFIX: Record<string, string> = {
  // Tecnologías
  "TECNOLOGIAS-SISTEMAS_INSTITUCIONALES":  "TEC-SIS",
  "TECNOLOGIAS-EQUIPOS_DISPOSITIVOS":      "TEC-EQP",
  "TECNOLOGIAS-RED_INTERNET":              "TEC-RED",
  "TECNOLOGIAS-CUENTAS_DOMINIO":           "TEC-DOM",
  "TECNOLOGIAS-CORREO_OUTLOOK":            "TEC-COR",
  // Servicios Generales
  "SERVICIOS-SANITARIOS":                  "SER-SAN",
  "SERVICIOS-ILUMINACION":                 "SER-ILU",
  "SERVICIOS-MOVILIDAD":                   "SER-MOV",
  // Recursos Materiales
  "RECURSOS_MATERIALES-SALA_JUNTAS":       "REC-SAL",
  "RECURSOS_MATERIALES-EQUIPO_AUDIOVISUAL":"REC-AUD",
  "RECURSOS_MATERIALES-PRESTAMO_EQUIPO":   "REC-PRE",
  "RECURSOS_MATERIALES-MOBILIARIO":        "REC-MOB",
  "RECURSOS_MATERIALES-PAPELERIA":         "REC-PAP",
};
```

---

## Shared Patterns

### Pattern 1: Startup Env Validation (SEC-01, SEC-03, D-15)

**Source:** `apps/api/src/index.ts` (new section, before app initialization)  
**Apply to:** All backend startup code

**Pattern:**
```typescript
// At the very top of apps/api/src/index.ts, after imports, before const app = express()
import "dotenv/config";

// ── Mandatory env var validation ────────────────────────────────────
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}

if (!process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS env var is required");
}

const corsOrigins = process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
// ────────────────────────────────────────────────────────────────────

const app = express();
// ... rest of initialization
```

**Why throw, not process.exit?**  
`throw` in a module top-level halts with non-zero exit code, prints stack trace, and is detectable by PM2/supervisors. Idiomatically TypeScript.

**Rationale:**  
- Forces developers to provide required env vars in `.env` (local dev) and `.env` on production server
- No fallbacks = security-conscious defaults
- `.env.example` must document both vars with examples

---

### Pattern 2: CORS from Env Var (SEC-03, D-12, D-13)

**Source:** `apps/api/src/index.ts` lines 27-54 (modified)  
**Apply to:** Express HTTP + Socket.IO initialization

**Pattern:**
```typescript
const corsOrigins = process.env.CORS_ORIGINS!.split(",").map((o) => o.trim()).filter(Boolean);

// Express HTTP
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Socket.IO (same allowlist)
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});
```

**Why .filter(Boolean)?**  
Prevents empty string from being a valid origin if `CORS_ORIGINS=""`.

**Dev default (in .env.example):**
```bash
# Desarrollo: incluir web + viewer 3D
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Producción: reemplazar con URL real
# CORS_ORIGINS=https://tu-dominio.com
```

---

### Pattern 3: express-rate-limit v8 (SEC-04, D-08 to D-11)

**Source:** New file `apps/api/src/middleware/rate-limit.middleware.ts`  
**Apply to:** All auth endpoints

**Middleware creation:**
```typescript
import { rateLimit } from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  limit: 5,                   // 5 intentos por IP (v7+ uses "limit", not "max")
  standardHeaders: "draft-8", // Emite encabezado RateLimit estándar
  legacyHeaders: false,       // No emitir X-RateLimit-*
  message: { error: "Demasiados intentos. Intenta en 15 minutos." },
});
```

**Route application:**
```typescript
// apps/api/src/routes/auth.routes.ts
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";

router.post("/solicitar-otp", authRateLimiter, ctrl.solicitarOtp);
router.post("/verificar-otp", authRateLimiter, ctrl.verificarOtp);
router.post("/login", authRateLimiter, ctrl.loginStaff);
router.post("/refresh", authRateLimiter, ctrl.refreshToken);
```

**Installation command:**
```bash
npm install express-rate-limit --workspace=apps/api
```

**API change v6→v7+:**  
The option `max` was renamed to `limit`. Using `max: 5` will be ignored silently.

**Storage:**  
In-memory with auto-expiring after 15 minutes. No Redis required.

**Rate limit response (429):**  
Automatically formatted from `message` option:
```json
{ "error": "Demasiados intentos. Intenta en 15 minutos." }
```

---

### Pattern 4: Error Handling Style (all controllers, services)

**Source:** `apps/api/src/middleware/error.middleware.ts` lines 1-12  
**Apply to:** All error throws and middleware responses

**Pattern:**
```typescript
// In services/controllers: throw with custom status
throw Object.assign(new Error("Descriptive message"), { status: 401 });
throw Object.assign(new Error("OTP inválido"), { status: 401 });

// Middleware catches and formats:
export const errorMiddleware = (
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ error: err.message ?? "Error interno del servidor" });
};
```

**Status codes:**
- `400`: Bad request (validation, missing fields)
- `401`: Unauthorized (invalid token, wrong password, session revoked)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `422`: Unprocessable entity (data conflict, e.g., phone already taken)
- `429`: Too many requests (rate limiter response)
- `503`: Service unavailable (WhatsApp down in production)
- `500`: Internal server error (uncaught exceptions)

---

### Pattern 5: Session Verification in Token Refresh (SEC-05, D-07)

**Source:** `apps/api/src/services/sesiones.service.ts` lines 59-71  
**Apply to:** `auth.controller.ts` `refreshToken` function

**Pattern:**
```typescript
import { verificarSesion } from "../services/sesiones.service.js";

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ... parse and verify token ...
    
    // ── NEW: Check if session was revoked ──────────────────────
    if (payload.jti) {
      const sesionActiva = await verificarSesion(payload.jti);
      if (!sesionActiva) {
        res.status(401).json({ error: "Sesión revocada. Por favor inicia sesión de nuevo." });
        return;
      }
    }
    // ──────────────────────────────────────────────────────────
    
    const newToken = signToken(restPayload, expiresIn);
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
};
```

**verificarSesion definition** (existing in `sesiones.service.ts` lines 59-71):
```typescript
export async function verificarSesion(jti: string): Promise<boolean> {
  const sesion = await prisma.sesion.findUnique({
    where: { jti },
    select: { activa: true, expiresAt: true },
  });
  if (!sesion || !sesion.activa) return false;
  if (sesion.expiresAt < new Date()) {
    await prisma.sesion.update({ where: { jti }, data: { activa: false } });
    return false;
  }
  return true;
}
```

---

## Dependency Installation

Only one new package required:

```bash
npm install express-rate-limit --workspace=apps/api
```

**Version:** 8.5.1 (latest stable)  
**In:** `apps/api/package.json` → dependencies

---

## Database Generation

Execute after installing dependencies:

```bash
npm run db:generate --workspace=packages/database
```

This regenerates Prisma client in `packages/database/node_modules/.prisma/client` to match the schema (includes field `permisos` from migration `unify_tecnico_ti_role`).

---

## .env.example Updates

Add/update these lines in `.env.example`:

```bash
# ── Authentication ─────────────────────────────────────────
# JWT secret — REQUIRED, no fallback (fatal error if missing)
JWT_SECRET=your_secret_key_here_min_32_chars

# CORS origins — comma-separated, REQUIRED (fatal error if missing)
# Development: include localhost:5173 (web) and localhost:5174 (3D viewer)
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# OTP TTL (default: 10 minutos — no cambiar en esta fase)
OTP_TTL_MINUTOS=10

# ── WhatsApp ───────────────────────────────────────────────
# En producción, asegura que WhatsApp esté conectado
# En desarrollo, los OTP se imprimen en consola como fallback
WA_SESSION_ID=siast-v1
```

---

## Files with No Analog Found

None — all modifications are to existing files with clear analogs in the codebase.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `packages/shared/src/`  
**Files scanned:** 23 (config, services, controllers, routes, middleware, store, shared)  
**Pattern extraction date:** 2026-05-08  
**Stack versions verified:** Express 5.1.0, jsonwebtoken 9.0.2, cors 2.8.5, Prisma 5.22.0  
**New dependency:** express-rate-limit 8.5.1

---

## Implementation Notes

1. **Order of implementation (recommended):**
   - Startup validation (D-15): JWT_SECRET, CORS_ORIGINS in `index.ts`
   - JWT secret cleanup (D-06): Remove fallback from `config/jwt.ts` and `auth.controller.ts`
   - CSPRNG (D-02): `crypto.randomInt()` in `otp.service.ts`
   - OTP response cleanup (D-01, D-04): Remove `devCodigo` from `whatsapp.service.ts` response
   - Rate limiting (D-08 to D-11): Install `express-rate-limit`, add middleware to routes
   - Session verification (D-07): Add `verificarSesion()` to `refreshToken`
   - Legacy cleanup (D-03): Remove `/login-rfc` from routes and `loginRFC()` from store
   - FOLIO_PREFIX correction (D-17): Update keys in `packages/shared/src/index.ts`
   - Database sync (D-16): `npm run db:generate`

2. **Testing checklist (after implementation):**
   - Server fails to start if `JWT_SECRET` missing ✓
   - Server fails to start if `CORS_ORIGINS` missing ✓
   - OTP code NOT visible in HTTP response (dev: only in console.log) ✓
   - Rate limit blocks after 5 attempts in 15 minutes ✓
   - Rate limit response is 429 with correct message ✓
   - Token refresh returns 401 if session revoked ✓
   - `/api/auth/login-rfc` endpoint returns 404 ✓
   - `useAuthStore.loginRFC()` method does not exist ✓
   - FOLIO_PREFIX correctly maps new subcategory keys ✓
   - Prisma client synced (verify `packages/database/node_modules/.prisma/client` exists) ✓

