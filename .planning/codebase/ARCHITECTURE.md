# Architecture

<!-- refreshed: 2026-05-06 -->
**Analysis Date:** 2026-05-06

---

## Overview

SIAST is a government helpdesk ticketing system (Secretaría de Finanzas, Oaxaca). It follows a three-tier monorepo architecture: a React SPA frontend, an Express REST+WebSocket API backend, and a standalone Three.js 3D building viewer embedded via iframe.

```text
┌──────────────────────────────────────────────────────────────────────┐
│              Browser (apps/web — Vite + React, port 5173)            │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │  React Router   │  │  Zustand stores  │  │  Axios API client   │ │
│  │  (page routing) │  │ auth / notifics  │  │ + token interceptor │ │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬──────────┘ │
│           │                    │ Socket.IO              │ HTTP       │
└───────────┼────────────────────┼────────────────────────┼────────────┘
            │ iframe+postMessage │ WebSocket              │ REST
┌───────────▼────────────────────▼────────────────────────▼────────────┐
│            apps/api — Express 5 + Socket.IO (port 5101)               │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────────┐ │
│  │  Route layer │→ │  Controllers  │→ │  Services (business logic) │ │
│  │ auth/tickets │  │  + validation │  │  tickets / auth / notif /  │ │
│  │ /recursos /  │  │  middleware   │  │  otp / sirh / sesiones /   │ │
│  │ /admin /...  │  │               │  │  whatsapp                  │ │
│  └──────────────┘  └───────────────┘  └────────────┬───────────────┘ │
│                                                     │ Prisma ORM     │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │
┌─────────────────────────────────────────────────────▼────────────────┐
│  packages/database — Prisma + MySQL (XAMPP, port 3306)               │
│  packages/shared   — Zod schemas + TypeScript types                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  apps/modelado-3d — Vite + Three.js (port 5174)                      │
│  Standalone SPA embedded as <iframe> in apps/web                     │
│  Communication: window.postMessage (bidirectional)                   │
└──────────────────────────────────────────────────────────────────────┘

External integrations:
  SIRH API (localhost:3000, MongoDB-backed)  ←→ sirh.service.ts / sirhAuth.service.ts
  WhatsApp Web.js client                     ←→ whatsapp.service.ts  (OTP delivery)
```

---

## Frontend Architecture

**Entry point:** `apps/web/src/main.jsx` → mounts `<App />` into `#root`.

**App shell:** `apps/web/src/App.jsx`
- `BrowserRouter` + `Routes` with `ProtectedRoute` guard (checks `useAuthStore` for `token` and `user`)
- Role-based route restrictions use `roles` prop on `ProtectedRoute`
- Root redirect (`/`) sends EMPLEADO → `/solicitudes/nueva`, GESTOR_RECURSOS_MATERIALES → `/recursos`, others → `/dashboard`
- All authenticated routes are wrapped in `<AppShell>` (sidebar + topbar layout)
- `PageErrorBoundary` (class component) wraps admin-area routes to catch crashes

**Routing table:**

| Path | Page | Roles |
|------|------|-------|
| `/login` | `LoginPage.jsx` | Public |
| `/` | RootRedirect | All authenticated |
| `/dashboard` | `DashboardPage.jsx` | ADMIN, TECNICO_*, MESA_AYUDA, GESTOR_RECURSOS_MATERIALES |
| `/solicitudes` | `SolicitudListPage.jsx` | All authenticated |
| `/solicitudes/nueva` | `SolicitudNewPage.jsx` | All authenticated |
| `/solicitudes/:id` | `SolicitudDetailPage.jsx` | All authenticated |
| `/recursos` | `RecursosPage.jsx` | ADMIN, GESTOR_RECURSOS_MATERIALES |
| `/usuarios` | `UsuariosPage.jsx` | ADMIN |
| `/admin` | `AdminPage.jsx` | ADMIN |
| `/admin/areas` | `AreasPage.jsx` | ADMIN |
| `/perfil` | `PerfilPage.jsx` | All authenticated |

**State management:** Zustand (two stores)
- `apps/web/src/store/auth.js` — `useAuthStore`: user object, JWT token, login/logout/OTP actions. Persists to `localStorage` (`siast_token`, `siast_user`).
- `apps/web/src/store/notificaciones.js` — `useNotifStore`: Socket.IO connection management, in-memory notification list, `noLeidas` count, `ticketsVersion` counter (incremented on any ticket event — used as `useEffect` dependency to trigger list refetches).

**HTTP client:** `apps/web/src/api/client.js`
- Axios instance with `baseURL` = `VITE_API_URL ?? http://{hostname}:5101`
- Request interceptor: attaches `Authorization: Bearer {token}` from localStorage
- Response interceptor: on 401, attempts token refresh via `POST /api/auth/refresh` (queuing concurrent requests), then retries original; falls back to forced logout
- `iniciarRenovacionProactiva()`: proactively renews token 10 minutes before expiry (polling every 60 s)

**API call modules** (`apps/web/src/api/`):
- `auth.js`, `solicitudes.js`, `tickets.js`, `notificaciones.js`, `catalogos.js`, `admin.js`, `usuarios.js`, `recursos.js` — thin wrappers around the shared Axios instance

**Layout components** (`apps/web/src/components/Layout/`):
- `AppShell.jsx` — top-level layout with sidebar
- `Sidebar.jsx` — role-aware navigation links

**Shared UI components** (`apps/web/src/components/common/`):
- `StatusChip.jsx`, `PriorityChip.jsx`

**Notifications:** `apps/web/src/components/Notifications/NotificationCenter.jsx`

**Note on UI library:** Despite `CLAUDE.md` specifying shadcn/ui + Tailwind for SIAST, the actual web app uses **Material UI v5** (`@mui/material`). `packages/ui` contains shadcn-style components (Button, Card, Input, Table, Badge) but they are not imported by `apps/web`.

---

## Backend Architecture

**Entry point:** `apps/api/src/index.ts`

**Startup sequence:**
1. Create Express app + HTTP server
2. Attach Socket.IO server to HTTP server
3. Call `configurarSockets(io)` to register socket room join handlers
4. Call `setIo(io)` to inject Socket.IO instance into `notificaciones.service.ts`
5. Register global middlewares: CORS, Helmet, Morgan, `express.json()`
6. Register all route groups under `/api/*`
7. Register `errorMiddleware` as final handler
8. Start listening on port 5101
9. Call `initWhatsApp()` (non-blocking)
10. Call `syncEmpleados()` (non-blocking) + schedule periodic sync every 12 hours

**Route groups:**

| Mount path | Route file | Notes |
|------------|-----------|-------|
| `/api/auth` | `auth.routes.ts` | Login (RFC+OTP / staff), logout, refresh, me |
| `/api/solicitudes` | `tickets.routes.ts` | Primary ticket CRUD |
| `/api/tickets` | `tickets.routes.ts` | Alias for backward compatibility |
| `/api/usuarios` | `usuarios.routes.ts` | Staff user management |
| `/api/empleados` | `empleados.routes.ts` | |
| `/api/employee` | `empleados.routes.ts` | Alias for 3D viewer module |
| `/api/catalogos` | `catalogos.routes.ts` | Areas, subcategories |
| `/api/admin` | `admin.routes.ts` | Admin panel (procesos, seguridad) |
| `/api/recursos` | `recursos.routes.ts` | Material resources |
| `/api/metricas` | `metricas.routes.ts` | Metrics |
| `/health` | inline | Status check |

**Middleware chain per route:**
```
Request
  → CORS + Helmet + Morgan + express.json()   (global)
  → authMiddleware                             (most routes — verifies JWT + active session via jti)
  → requireRol(...roles)                       (role-based access)
  → requirePermiso(perm)                       (granular permission check, reads DB)
  → Controller handler
  → errorMiddleware                            (global error handler — reads err.status)
```

**Controller pattern:** Controllers in `apps/api/src/controllers/` are thin — they parse `req`, call service functions, and send responses. Business logic lives in `apps/api/src/services/`.

**Services:**

| File | Responsibility |
|------|---------------|
| `auth.service.ts` | `loginRFC`, `loginStaff` — credential validation, JWT issuance, session creation |
| `tickets.service.ts` | All ticket CRUD, state machine transitions, folio generation, paso (step) management |
| `notificaciones.service.ts` | DB notification creation + Socket.IO emission. Module-level `io` singleton injected at startup. |
| `otp.service.ts` | OTP generation/validation, first-access phone registration flow |
| `sesiones.service.ts` | Session lifecycle, max-2-sessions enforcement per user, jti verification |
| `sirh.service.ts` | SIRH sync (`SIRH_ENABLED=true`): bulk employee sync + on-demand RFC lookup/upsert |
| `sirhAuth.service.ts` | Authenticated HTTP client for SIRH API |
| `whatsapp.service.ts` | WhatsApp Web.js client — OTP delivery and ticket-assigned notifications |

**Error handling:**
- Services throw `Object.assign(new Error(msg), { status: N })` to attach HTTP status codes
- `errorMiddleware` reads `err.status ?? 500` and sends `{ error: err.message }`
- 4xx errors are not logged; 5xx errors log `err.stack`

---

## Data Architecture

**Database:** MySQL (via XAMPP). Schema in `packages/database/prisma/schema.prisma`. 22 migrations as of 2026-05-06.

**Prisma client:** Singleton exported from `apps/api/src/config/database.ts` — uses `globalThis` to prevent multiple instantiations in development hot-reload.

**Core models and relations:**

```
Usuario (staff)
  ├── ticketsAsignados[]   → Ticket (as "TecnicoAsignado")
  ├── ticketsCreados[]     → Ticket (as "UsuarioCreador")
  ├── comentarios[]        → Comentario
  ├── notificaciones[]     → Notificacion
  ├── pasosAsignados[]     → PasoTicket (as "TecnicoPaso")
  ├── sesiones[]           → Sesion
  └── logsAcceso[]         → LogAcceso

Empleado (government employee — logs in by RFC)
  ├── area                 → AreaEdificio
  ├── tickets[]            → Ticket
  ├── notificaciones[]     → Notificacion
  ├── asignacionesRecurso[]→ AsignacionRecurso
  ├── sesiones[]           → Sesion
  └── logsAcceso[]         → LogAcceso

Ticket
  ├── empleado             → Empleado (owner/reporter)
  ├── area                 → AreaEdificio
  ├── creadoPor?           → Usuario (optional: MESA_AYUDA creating on behalf)
  ├── tecnico?             → Usuario (assigned technician)
  ├── historial[]          → HistorialTicket
  ├── comentarios[]        → Comentario
  ├── notificaciones[]     → Notificacion
  ├── asignacionesRecurso[]→ AsignacionRecurso
  └── pasos[]              → PasoTicket

PasoTicket (workflow step within a ticket)
  ├── ticket               → Ticket
  └── tecnico?             → Usuario

AreaEdificio (building area/room)
  ├── empleados[]          → Empleado
  └── tickets[]            → Ticket

CatalogoRecurso (resource catalog entry)
  └── unidades[]           → RecursoUnidad

RecursoUnidad (individual physical resource)
  └── asignaciones[]       → AsignacionRecurso

AsignacionRecurso (resource loan/assignment)
  ├── unidad               → RecursoUnidad
  ├── ticket?              → Ticket
  ├── empleado?            → Empleado
  └── gestor?              → Usuario

ProcesoDefinicion (DB-editable workflow template)
  └── pasos[]              → PasoDefinicion

Sesion       — active JWT sessions (jti-keyed, max 2 per user)
LogAcceso    — login audit log (OK / FAIL_PASSWORD / FAIL_NOT_FOUND / FAIL_INACTIVE)
OtpToken     — 6-digit OTP codes, 10-minute TTL
Notificacion — per-user or per-employee in-app notifications
```

**Key enums (mirrored in `packages/shared/src/index.ts` via Zod):**
- `Rol`: ADMIN, TECNICO_TI, TECNICO_REDES, TECNICO_SERVICIOS, MESA_AYUDA, GESTOR_RECURSOS_MATERIALES, EMPLEADO
- `CategoriaTicket`: TECNOLOGIAS, SERVICIOS, RECURSOS_MATERIALES
- `SubcategoriaTicket`: 14 values (5 TI, 3 Servicios, 5+ Recursos)
- `EstadoTicket`: ABIERTO → ASIGNADO → EN_PROGRESO → RESUELTO (or CANCELADO from any)
- `PrioridadTicket`: BAJA, MEDIA, ALTA, URGENTE
- `PisoEdificio`: PB, NIVEL_1, NIVEL_2, NIVEL_3

**Soft delete:** `activo: Boolean @default(true)` on `Ticket` and `Empleado`. All queries filter `activo: true`. No physical deletion of tickets.

**Folio generation:** `tickets.service.ts` → `generarFolio()`. Pattern: `{PREFIX}-{NNNN}` where prefix is looked up from `FOLIO_PREFIX` map in `@stf/shared` (e.g., `TEC-SIS-0001`). Count is based on existing folios with that prefix.

**State machine** (enforced in `tickets.service.ts`):
```
ABIERTO → ASIGNADO | CANCELADO
ASIGNADO → EN_PROGRESO | CANCELADO
EN_PROGRESO → RESUELTO | CANCELADO
RESUELTO → (terminal)
CANCELADO → (terminal)
```

---

## Real-time Architecture

**Server:** Socket.IO attached to the same HTTP server as Express (`apps/api/src/index.ts`).

**Room setup** (`apps/api/src/sockets/tickets.socket.ts`):
- Client emits `join:user` with `userId` → joins room `user:{userId}` (staff)
- Client emits `join:empleado` with `rfc` → joins room `emp:{rfc}` (employee)
- Client emits `join:admin` → joins room `admins` (ADMIN and MESA_AYUDA roles)

**Client connection** (`apps/web/src/store/notificaciones.js`):
- `useNotifStore.conectar(user)` is called after login
- On `connect`, the client auto-joins the correct rooms based on role
- Module-level `socket` variable (singleton, not re-created on store updates)

**Socket events (server → client):**

| Event | Target room | Trigger |
|-------|-------------|---------|
| `ticket:nuevo` | `admins` | New ticket created |
| `ticket:asignado` | `user:{tecnicoId}` | Ticket assigned to technician |
| `ticket:asignado_empleado` | `emp:{rfc}` | Ticket assigned (employee notification) |
| `ticket:estado_cambiado` | `emp:{rfc}`, `user:{tecnicoId}`, `admins` | State transition |
| `ticket:paso_asignado` | `user:{tecnicoId}` | Workflow step assigned to technician |
| `ticket:paso_listo` | `admins` | Step completed, next step needs assignment |

**`ticketsVersion` pattern:** `useNotifStore` exposes a `ticketsVersion: number` that increments on every incoming ticket socket event. Components include `ticketsVersion` in their `useEffect` dependency arrays to auto-refetch ticket lists without polling.

**Emission:** All socket emissions happen inside `apps/api/src/services/notificaciones.service.ts` via the module-level `io` singleton. Controllers call `notif.emitirTicketNuevo(...)` etc. after DB writes.

---

## Authentication Flow

**Two distinct login paths:**

### Employee login (RFC + OTP via WhatsApp)

```
1. POST /api/auth/solicitar-otp  { rfc }
   → otp.service.ts: solicitarOtp(rfc)
   → If first access AND no phone: return { necesitaTelefono: true }
   → If first access AND has phone: return { necesitaConfirmarTelefono, telefonoCensurado }
   → Otherwise: generate 6-digit OTP (10 min TTL), send via WhatsApp, return { ok, hint }

2. POST /api/auth/solicitar-otp  { rfc, telefono }   (first-access phone registration)
   → Save phone to DB, optionally sync back to SIRH, mark primerAcceso=false
   → Generate and send OTP

3. POST /api/auth/verificar-otp  { rfc, codigo }
   → otp.service.ts: verificarOtp() — validates code, marks used
   → auth.service.ts: loginRFC() — fetches empleado, issues JWT
   → JWT payload: { id, rol: "EMPLEADO", rfc, nombre, jti }
   → Expiry: EMPLEADO_JWT_EXPIRES_IN (default 30d)

4. Client stores token in localStorage, calls useNotifStore.conectar(user)
```

### Staff login (username + password)

```
1. POST /api/auth/login  { usuario, password }
   → auth.service.ts: loginStaff()
   → bcrypt.compare password against DB hash
   → Issue JWT: { id, rol, usuario, nombre, jti }
   → Expiry: JWT_EXPIRES_IN (default 8h)

2. Client stores token, joins Socket.IO rooms
```

### Session management
- Every JWT contains a `jti` (UUID) stored in the `sesiones` table (`Sesion` model)
- `authMiddleware` calls `verificarSesion(jti)` on every request — rejects if session is `activa: false`
- Max 2 concurrent sessions per user/employee — oldest is evicted on new login
- `POST /api/auth/logout` marks the session's `jti` as inactive in DB
- `POST /api/auth/refresh` (in `apps/web/src/api/client.js`): exchanges expiring token for new one; frontend intercepts 401s and queues requests during refresh

### Token lifecycle (frontend)
- On app load: `iniciarRenovacionProactiva()` runs — checks token expiry every 60 s, renews if < 10 min remaining
- On 401 response: interceptor attempts refresh, queues concurrent requests, retries all on success, force-logouts on failure

---

## 3D Viewer Integration

**apps/modelado-3d** is a fully independent Vite app (port 5174) that renders a procedural Three.js model of the "Edificio Saúl Martínez" (4-floor government building). It has its own `package.json` with `three` as a direct dependency.

**Integration mechanism:** `apps/web/src/components/Building3D/BuildingViewer.jsx` renders an `<iframe src={VIEWER_URL}>`. Communication is entirely via `window.postMessage`.

**Messages web → viewer (sent by `BuildingViewer.jsx`):**

| Message type | Payload | Effect |
|-------------|---------|--------|
| `SET_TOKEN` | `{ token }` | Viewer stores JWT to authenticate its own API calls to `apps/api` |
| `SET_LOGIN_MODE` | `{ enabled: true }` | Enables decorative exterior-only camera mode (for login screen) |
| `HIGHLIGHT_ROOM` | `{ floor, roomId }` | Highlights a specific room (used to show employee's office) |

**Messages viewer → web:**

| Message type | Payload | When |
|-------------|---------|------|
| `ROOM_CLICKED` | `{ roomId, floor, label, ... }` | User clicks on a room in the 3D view |

**Viewer internals** (`apps/modelado-3d/src/`):
- `main.js` — entry point, Three.js scene setup, `postMessage` listener, API calls to `/api/empleados` (uses `_jwtToken` from `SET_TOKEN`)
- `building.js` — procedural building geometry generation from area grid data
- `rooms.js` — static room definitions (`ALL_ROOMS`, `FLOOR_LABELS`)
- `camera.js` — camera controls including `flyToFloor()` and login-mode animation
- `highlight.js` — room selection and highlight overlay
- `labels.js` — 3D CSS labels over rooms
- `exterior.js` — exterior-only building view

**API base in viewer:** Hardcoded as `http://${window.location.hostname}:5101` (no env var).

---

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. WhatsApp init and SIRH sync are non-blocking (`.catch()` + `setInterval().unref()`).
- **Global state (API):** `io` singleton in `notificaciones.service.ts` (injected at startup via `setIo()`). `socket` singleton in `apps/web/src/store/notificaciones.js`.
- **Session limit:** Max 2 concurrent sessions per user/employee — enforced in `sesiones.service.ts`.
- **Ticket limit:** Max 2 active tickets per employee simultaneously — enforced in `tickets.service.ts` during ticket creation.
- **SIRH gating:** All SIRH integration is guarded by `SIRH_ENABLED === "true"`. When disabled, `syncEmpleados()` is a no-op.
- **3D viewer token:** The viewer iframe receives the JWT via `postMessage` — it is not in localStorage of the 5174 origin.

---

## Anti-Patterns

### UI library mismatch

**What happens:** `apps/web` uses `@mui/material` throughout (pages, components, LoginPage, BuildingViewer). The `CLAUDE.md` and `packages/ui` target shadcn/ui + Tailwind.

**Why it's wrong:** New code added using shadcn/ui will clash visually and architecturally with existing MUI code. `packages/ui` components are not actually used by `apps/web`.

**Do this instead:** Continue using MUI v5 (`@mui/material`) for all `apps/web` components until a deliberate migration is planned.

### FOLIO_PREFIX map is stale

**What happens:** `FOLIO_PREFIX` in `packages/shared/src/index.ts` uses old subcategory key strings (e.g. `"TECNOLOGIAS-SISTEMAS"`) that do not match the current `SubcategoriaTicket` enum values (e.g. `SISTEMAS_INSTITUCIONALES`). The `generarFolio()` function falls back to `"TIC"` prefix for all unmatched keys.

**Why it's wrong:** All tickets in TECNOLOGIAS category get folio prefix `TIC-NNNN` instead of the intended category-specific prefix.

**Do this instead:** Update `FOLIO_PREFIX` keys to match current `"${CategoriaTicket}-${SubcategoriaTicket}"` combinations.

---

*Architecture analysis: 2026-05-06*
