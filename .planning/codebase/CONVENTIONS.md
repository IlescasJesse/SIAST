# Code Conventions

**Analysis Date:** 2026-05-06

---

## Formatting

**Tool:** Prettier (configured in `.prettierrc` at monorepo root)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

All workspaces share this single Prettier config. Run with `npm run format` from root.

---

## Naming Conventions

### Files

| Location | Pattern | Examples |
|----------|---------|---------|
| `apps/api/src/controllers/` | `{domain}.controller.ts` | `tickets.controller.ts`, `auth.controller.ts` |
| `apps/api/src/services/` | `{domain}.service.ts` | `tickets.service.ts`, `notificaciones.service.ts` |
| `apps/api/src/routes/` | `{domain}.routes.ts` | `tickets.routes.ts`, `auth.routes.ts` |
| `apps/api/src/middleware/` | `{purpose}.middleware.ts` | `auth.middleware.ts`, `error.middleware.ts` |
| `apps/web/src/pages/` | `{Name}Page.jsx` (PascalCase) | `DashboardPage.jsx`, `SolicitudNewPage.jsx` |
| `apps/web/src/components/` | `{Name}.jsx` (PascalCase) | `StatusChip.jsx`, `AppShell.jsx` |
| `apps/web/src/store/` | `{domain}.js` (camelCase) | `auth.js`, `notificaciones.js` |
| `apps/web/src/api/` | `{domain}.js` (camelCase) | `solicitudes.js`, `catalogos.js` |
| `apps/web/src/hooks/` | `use{Name}.jsx` (camelCase) | `useUnsavedChanges.jsx` |

**Critical:** Web pages use `.jsx` (not `.tsx`). API uses `.ts` exclusively.

### Functions and Variables

**API (TypeScript):**
- Exported service functions: camelCase in Spanish — `listarTickets`, `crearTicket`, `obtenerTicket`
- Exported controller functions: camelCase in Spanish — `listar`, `crear`, `obtener`, `asignar`
- Internal helpers: camelCase in English or Spanish — `parseId`, `computeAutoPriority`, `generarFolio`
- Constants: UPPER_SNAKE_CASE — `PRIORIDAD_ORDER`, `TRANSICIONES`, `SUBCATEGORIAS_VALIDAS`

**Frontend (JSX/JS):**
- React components: PascalCase — `StatCard`, `OtpInput`, `StatusChip`
- Hooks: `use` prefix, camelCase — `useAuthStore`, `useNotifStore`, `useUnsavedChanges`
- Store actions: camelCase in Spanish — `solicitarOtp`, `verificarOtp`, `loginRFC`, `loginStaff`
- API client functions: camelCase in Spanish — `getSolicitudes`, `createSolicitud`, `cambiarEstado`
- Constants/lookup objects: UPPER_SNAKE_CASE — `ESTADO_LABEL`, `PRIORIDAD_COLOR`, `CATEGORIA_STYLE`

### Spanish vs English Split

**In Spanish** (domain-specific):
- All domain entity names: `Ticket`, `Empleado`, `Area`, `Solicitud`
- Database model names (Prisma): `Ticket`, `Empleado`, `Usuario`, `AreaEdificio`
- Database table names (via `@@map`): `empleados`, `usuarios`, `areas_edificio`, `otp_tokens`
- Database field names: `activo`, `folio`, `asunto`, `descripcion`, `nombreCompleto`
- Enum values that are domain concepts: `ABIERTO`, `ASIGNADO`, `EN_PROGRESO`, `RESUELTO`
- API response fields: `mensaje`, `ticket`, `empleado`, `comentario`
- Error messages in API responses: `"RFC requerido"`, `"Datos inválidos"`, `"Sin permisos..."`
- Controller and service function names: `listar`, `crear`, `obtener`, `asignar`, `comentar`
- Service module names: `notificaciones.service.ts`, `sesiones.service.ts`
- Socket events: `ticket:nuevo`, `ticket:asignado`, `sirh:sync_completada`

**In English** (code infrastructure):
- All TypeScript types and interfaces: `JwtPayload`, `AuthRequest`
- Middleware function names: `authMiddleware`, `errorMiddleware`, `requireRol`
- Infrastructure config names: `database.ts`, `jwt.ts`
- Generic utility names: `parseId`, `processQueue`, `forceLogout`
- localStorage keys: `siast_token`, `siast_user`
- Zustand store state fields: `token`, `user`, `socket`

**Mixed (pragmatic):**
- Comments explaining code blocks are in Spanish
- Log messages use bracketed prefix in English + message in Spanish: `[SIRH] Sync ya en progreso`

---

## TypeScript Patterns

### Strict Mode

`apps/api/tsconfig.json` has `"strict": true`. Avoid `any`; use `unknown` when type is truly unknown.

### Type Sources

All shared domain types live in `packages/shared/src/index.ts` as Zod schemas with inferred types:

```typescript
// Define schema first
export const TicketCreateSchema = z.object({ ... });

// Then infer type from schema — no separate interface needed
export type TicketCreateInput = z.infer<typeof TicketCreateSchema>;
```

Do NOT define types independently from Zod schemas in `@stf/shared`. The Zod schema IS the source of truth.

### API-local Types

Types used only within the API live in `apps/api/src/types/index.ts`:

```typescript
export interface JwtPayload {
  id: number;
  rol: Rol;
  usuario?: string;  // staff
  rfc?: string;      // empleado
  nombre: string;
  jti?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
```

### Non-null Assertion

Use `req.user!` after auth middleware has confirmed the user exists — acceptable because `authMiddleware` guarantees the field is populated before controllers run.

### Type Imports

Always use `import type` for type-only imports:

```typescript
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
```

### ESM `.js` Extensions

All relative imports in the API must use `.js` extension (ESM with `"type": "module"`):

```typescript
import * as ticketsService from "../services/tickets.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
```

---

## API Conventions

### Route-Controller-Service Pattern

Every domain follows this three-layer pattern:

1. **Route** (`routes/*.routes.ts`) — mounts middleware and delegates to controller
2. **Controller** (`controllers/*.controller.ts`) — parses request, calls service, sends response
3. **Service** (`services/*.service.ts`) — all business logic and DB access via Prisma

Controllers never access `prisma` directly — only services do. Exception: `auth.controller.ts` does a few direct Prisma queries for password operations (acknowledged pattern to address).

### Route Naming

API routes use `/api/{spanish-plural}` naming:

```
/api/solicitudes        → tickets (note: not /api/tickets)
/api/usuarios           → users
/api/empleados          → employees
/api/catalogos          → catalogs
/api/recursos           → resources
/api/metricas           → metrics
/api/admin              → admin operations
```

`/api/tickets` exists as a retrocompatibility alias for `/api/solicitudes`.

### Controller Shape

All controllers follow this exact shape — no variations:

```typescript
export const {verbInSpanish} = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await {domain}Service.{method}(req.user!, req.body);
    res.json({ {entity}: result, mensaje: "..." });  // or res.status(201).json(...)
  } catch (err) {
    next(err);  // always pass to error middleware
  }
};
```

**Never** put error handling logic in controllers — only `next(err)`.

### Response Shape

| Scenario | Shape |
|----------|-------|
| Single entity | `res.json({ ticket })` or `res.json(ticket)` |
| Created entity | `res.status(201).json({ ticket, mensaje: "..." })` |
| List with pagination | `res.json({ tickets, total, page, totalPages })` |
| Generic success | `res.json({ ok: true })` |
| Error (via middleware) | `res.status(N).json({ error: "message" })` |
| Validation error | `res.status(400).json({ error: "...", issues: result.error.flatten() })` |

### Error Handling

Errors with HTTP status codes are thrown using `Object.assign`:

```typescript
throw Object.assign(
  new Error("El RFC del solicitante es obligatorio"),
  { status: 400 },
);
```

The global `errorMiddleware` in `apps/api/src/middleware/error.middleware.ts` catches all errors passed via `next(err)` and responds with `{ error: err.message }` at the error's `status` (defaults to 500).

### Validation Middleware

Request bodies are validated with the `validate` middleware before reaching controllers:

```typescript
// In route file:
router.post("/", validate(TicketCreateSchema), ctrl.crear);
```

`validate` in `apps/api/src/middleware/validate.middleware.ts` uses `schema.safeParse()` and replaces `req.body` with the parsed/coerced data.

### Role Guards

Route-level guards use `requireRol(...roles)` from `apps/api/src/middleware/roles.middleware.ts`:

```typescript
router.post("/", requireRol("EMPLEADO", "MESA_AYUDA", "ADMIN"), ctrl.crear);
```

Fine-grained permission checks use `tienePermiso(rol, permisosExtra, perm)` from `@stf/shared`.

### Logging

No structured logging library. Conventions:
- Startup messages: `console.log` with emoji prefix
- Service trace messages: `console.log("[MODULE_TAG] message")`
- Errors: `console.error("[MODULE_TAG] message:", error.message)`
- Warnings: `console.warn("[MODULE_TAG] message")`
- 500-level errors: logged via `errorMiddleware` using `err.stack`

---

## Frontend Conventions

### Component Structure

Pages live in `apps/web/src/pages/` as large JSX files. Sub-components are defined inline within the same file or extracted to `apps/web/src/components/`.

```jsx
// Sub-component defined above the main page component in the same file
const StatCard = ({ icon, label, value, color, subtitle }) => (
  <Card ...>...</Card>
);

// Main page component is the default or named export
export default function DashboardPage() { ... }
```

### State Management

**Global state:** Zustand stores in `apps/web/src/store/`:
- `auth.js` — `useAuthStore` — user session, token, login/logout actions
- `notificaciones.js` — `useNotifStore` — Socket.IO connection, notification list, `ticketsVersion`

**Local state:** `useState` / `useEffect` directly in page components (no Redux, no Context for domain data).

**Real-time pattern:** All components that display ticket data must include `ticketsVersion` from `useNotifStore` in their `useEffect` dependency array to trigger refetch on socket events:

```jsx
const { ticketsVersion } = useNotifStore();

useEffect(() => {
  // fetch tickets
}, [ticketsVersion]);  // re-runs when any ticket event arrives via socket
```

### API Calls

All HTTP calls go through the Axios instance in `apps/web/src/api/client.js`. Domain-specific functions wrap Axios calls in `apps/web/src/api/{domain}.js`:

```javascript
// Pattern: named export, returns .data directly, no try/catch
export const getSolicitudes = (params) =>
  api.get("/api/solicitudes", { params }).then((r) => r.data);
```

Error handling happens at the call site in the page component (try/catch around the API call).

### UI Library

**Critical:** The web app uses **MUI v6** (`@mui/material`) for all UI — NOT shadcn/ui as stated in CLAUDE.md. The actual installed and used library is MUI. Tailwind is not configured in `apps/web/`.

Institutional color is guinda/granate: `#9d2449` — exported from `apps/web/src/theme/index.js` as `PRIMARY_MAIN`.

Theme customization is in `apps/web/src/theme/index.js`. Always use theme tokens, not raw hex values in components. For colors outside MUI theme access (SVG, canvas), import from `apps/web/src/theme/index.js`.

### Authentication Tokens

- Token stored in `localStorage` under key `siast_token`
- User object stored in `localStorage` under key `siast_user`
- Attached to all requests via Axios request interceptor in `apps/web/src/api/client.js`
- 401 responses trigger automatic refresh via `POST /api/auth/refresh`

---

## Database Conventions

### Prisma Model Naming

- Model names: PascalCase English-influenced but domain-Spanish — `Ticket`, `Empleado`, `Usuario`, `AreaEdificio`, `OtpToken`
- Table names via `@@map`: lowercase_snake_case Spanish — `empleados`, `usuarios`, `areas_edificio`, `otp_tokens`
- Field names: camelCase — `nombreCompleto`, `areaId`, `createdAt`, `updatedAt`
- All models have `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`

### Soft Delete

Tickets and Empleados use soft delete with `activo Boolean @default(true)`. Hard delete is never used for these entities. Service layer always filters `where: { activo: true }` in list queries.

```typescript
// Always include activo: true in list queries
const where: Record<string, unknown> = { activo: true };
```

The `eliminarTicket` service function sets `activo: false`, not a physical delete.

### Prisma Client Singleton

The Prisma client is a module-level singleton in `apps/api/src/config/database.ts`, reused via `globalThis` to avoid multiple connections in development hot-reload:

```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... });
```

Import as: `import { prisma } from "../config/database.js";`

### Indexes

All foreign key fields and frequently queried fields have explicit `@@index([field])` declarations. Add indexes for any new field used in `where` clauses.

### Enums

Enums are defined in both Prisma schema (`packages/database/prisma/schema.prisma`) AND as Zod enums in `packages/shared/src/index.ts`. They must be kept in sync manually — if an enum value is added to Prisma, add it to the corresponding Zod schema and run a migration.

---

## Import/Export Patterns

### Package References

Packages reference each other using workspace names:

```typescript
import { TicketCreateSchema, type Rol } from "@stf/shared";
import { prisma } from "@stf/database";  // when used from outside api
```

### Barrel Exports

`packages/shared/src/index.ts` — single file, all exports in one place (no sub-modules).

`packages/ui/src/index.ts` — named re-exports from individual component files:

```typescript
export { Badge } from "./badge";
export { Button } from "./button";
```

### API Internal Imports

Services import from other services when needed (not from controllers). No circular imports between layers.

```typescript
// In notificaciones.service.ts
import { enviarNotifTicketAsignado } from "./whatsapp.service.js";
```

### Frontend Imports

```javascript
// External packages
import { create } from "zustand";
import { io } from "socket.io-client";

// Internal stores
import { useAuthStore } from "../store/auth.js";

// Internal API
import { getSolicitudes } from "../api/solicitudes.js";

// Shared types/constants
import { LABEL_SUBCATEGORIA, PROCESO_MAP } from "@stf/shared";

// Theme
import { TICKET_ESTADO_COLOR } from "../theme/index.js";
```

---

## Comments

**API:** JSDoc blocks on exported controller functions that are non-obvious:

```typescript
/**
 * GET /api/admin/sirh/status
 * Devuelve el estado de la última sincronización con SIRH.
 */
```

**Inline:** Section dividers use `// ── {Section Name} ──────────────` pattern throughout the codebase.

**Constant sections:** Large files use `// ============================================================` banners.

---

*Convention analysis: 2026-05-06*
