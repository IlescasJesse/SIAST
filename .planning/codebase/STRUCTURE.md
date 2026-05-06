# File Structure

<!-- refreshed: 2026-05-06 -->
**Analysis Date:** 2026-05-06

---

## Root Layout

```
SIAST/                              ← monorepo root
├── apps/
│   ├── api/                        ← Express 5 + TypeScript backend (port 5101)
│   ├── web/                        ← Vite + React frontend (port 5173)
│   └── modelado-3d/                ← Vite + Three.js 3D viewer (port 5174)
├── packages/
│   ├── shared/                     ← Zod schemas + inferred TS types
│   ├── ui/                         ← Base UI components (shadcn-style, unused by apps/web)
│   └── database/                   ← Prisma schema, migrations, seeds
├── scripts/
│   └── kill-ports.js               ← Dev utility to free ports before dev start
├── .claude/
│   └── agents/                     ← Claude agent definitions
├── package.json                    ← npm workspaces root; dev/build/lint scripts
├── package-lock.json
├── CLAUDE.md                       ← Project instructions for Claude
└── .planning/
    └── codebase/                   ← GSD codebase analysis documents (this directory)
```

---

## apps/api Structure

```
apps/api/
├── src/
│   ├── index.ts                    ← Entry point: Express + Socket.IO bootstrap
│   ├── config/
│   │   ├── database.ts             ← Prisma client singleton (globalThis pattern)
│   │   └── jwt.ts                  ← signToken / verifyToken helpers
│   ├── routes/
│   │   ├── auth.routes.ts          ← /api/auth (login, OTP, logout, refresh, me)
│   │   ├── tickets.routes.ts       ← /api/solicitudes + /api/tickets (alias)
│   │   ├── usuarios.routes.ts      ← /api/usuarios
│   │   ├── empleados.routes.ts     ← /api/empleados + /api/employee (alias for 3D)
│   │   ├── catalogos.routes.ts     ← /api/catalogos (areas, subcategories)
│   │   ├── admin.routes.ts         ← /api/admin (procesos, seguridad)
│   │   ├── recursos.routes.ts      ← /api/recursos
│   │   └── metricas.routes.ts      ← /api/metricas
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── tickets.controller.ts
│   │   ├── usuarios.controller.ts
│   │   ├── empleados.controller.ts
│   │   ├── catalogos.controller.ts
│   │   ├── admin.controller.ts
│   │   ├── admin-procesos.controller.ts
│   │   ├── admin-seguridad.controller.ts
│   │   ├── recursos.controller.ts
│   │   └── metricas.controller.ts
│   ├── services/
│   │   ├── auth.service.ts         ← loginRFC, loginStaff (credential validation + JWT)
│   │   ├── tickets.service.ts      ← All ticket CRUD, state machine, folio, steps
│   │   ├── notificaciones.service.ts ← Socket.IO emission + DB notification creation
│   │   ├── otp.service.ts          ← OTP generation, validation, first-access flow
│   │   ├── sesiones.service.ts     ← Session lifecycle, max-2 enforcement, jti verify
│   │   ├── sirh.service.ts         ← SIRH sync (bulk + on-demand RFC lookup)
│   │   ├── sirhAuth.service.ts     ← Authenticated HTTP client for SIRH API
│   │   └── whatsapp.service.ts     ← WhatsApp Web.js client (OTP + ticket notifications)
│   ├── middleware/
│   │   ├── auth.middleware.ts      ← JWT verification + active session check
│   │   ├── roles.middleware.ts     ← requireRol(...roles) — coarse role guard
│   │   ├── permisos.middleware.ts  ← requirePermiso(perm) — granular permission guard
│   │   ├── validate.middleware.ts  ← Zod schema validation helper
│   │   └── error.middleware.ts     ← Global error handler (reads err.status)
│   ├── sockets/
│   │   └── tickets.socket.ts       ← Socket.IO room join event handlers
│   └── types/
│       └── index.ts                ← AuthRequest interface, JwtPayload type
└── package.json
```

**Key entry points:**
- Bootstrap: `apps/api/src/index.ts`
- Database singleton: `apps/api/src/config/database.ts`
- Business logic: `apps/api/src/services/`

---

## apps/web Structure

```
apps/web/
├── src/
│   ├── main.jsx                    ← ReactDOM.createRoot → <App />
│   ├── App.jsx                     ← BrowserRouter, Routes, ProtectedRoute, ThemeProvider
│   ├── pages/
│   │   ├── LoginPage.jsx           ← OTP + staff login (multi-step: rfc → tel → otp)
│   │   ├── DashboardPage.jsx       ← Staff metrics overview
│   │   ├── SolicitudListPage.jsx   ← Ticket list (filtered by role)
│   │   ├── SolicitudNewPage.jsx    ← New ticket form
│   │   ├── SolicitudDetailPage.jsx ← Ticket detail + comments + steps
│   │   ├── UsuariosPage.jsx        ← Staff user management (ADMIN only)
│   │   ├── PerfilPage.jsx          ← User profile
│   │   ├── AreasPage.jsx           ← Building area editor (ADMIN only)
│   │   ├── RecursosPage.jsx        ← Material resources (ADMIN + GESTOR)
│   │   ├── AdminPage.jsx           ← Admin panel (processes, settings)
│   │   ├── AdminProcesosPage.jsx
│   │   ├── AdminSeguridadPage.jsx
│   │   ├── AdminSirhPage.jsx       ← SIRH sync status/trigger
│   │   └── AdminUsuariosPage.jsx
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppShell.jsx        ← Root layout: sidebar + content area
│   │   │   └── Sidebar.jsx         ← Role-aware navigation links
│   │   ├── Building3D/
│   │   │   ├── BuildingViewer.jsx  ← <iframe> wrapper + postMessage API
│   │   │   ├── building.js         ← (Duplicated Three.js source — see modelado-3d)
│   │   │   ├── camera.js
│   │   │   ├── exterior.js
│   │   │   ├── highlight.js
│   │   │   ├── labels.js
│   │   │   ├── main.js
│   │   │   └── rooms.js
│   │   ├── Notifications/
│   │   │   └── NotificationCenter.jsx
│   │   ├── common/
│   │   │   ├── StatusChip.jsx      ← Ticket status badge (MUI Chip)
│   │   │   └── PriorityChip.jsx    ← Ticket priority badge (MUI Chip)
│   │   ├── areas/                  ← Area editor sub-components
│   │   └── BarcodeScanner.jsx
│   ├── store/
│   │   ├── auth.js                 ← useAuthStore (Zustand): user, token, login, logout
│   │   └── notificaciones.js       ← useNotifStore (Zustand): Socket.IO, notifs, ticketsVersion
│   ├── api/
│   │   ├── client.js               ← Axios instance, interceptors, token refresh logic
│   │   ├── auth.js
│   │   ├── solicitudes.js
│   │   ├── tickets.js
│   │   ├── notificaciones.js
│   │   ├── catalogos.js
│   │   ├── admin.js
│   │   ├── usuarios.js
│   │   └── recursos.js
│   ├── hooks/
│   │   └── useUnsavedChanges.jsx
│   ├── theme/
│   │   └── index.js                ← MUI v5 theme (createTheme)
│   └── img/
│       ├── background-img.jpg
│       ├── logo-oaxaca.png
│       └── siast-logo.png
├── public/
│   └── favicon.ico
└── package.json
```

**Key entry points:**
- App bootstrap: `apps/web/src/main.jsx`
- Routing + auth guard: `apps/web/src/App.jsx`
- HTTP client: `apps/web/src/api/client.js`
- Auth state: `apps/web/src/store/auth.js`
- Real-time state: `apps/web/src/store/notificaciones.js`

---

## apps/modelado-3d Structure

```
apps/modelado-3d/
├── src/
│   ├── main.js                     ← Entry: Three.js scene, postMessage listener, API calls
│   ├── building.js                 ← Procedural building geometry from area grid data
│   ├── rooms.js                    ← Static room definitions (ALL_ROOMS, FLOOR_LABELS)
│   ├── camera.js                   ← OrbitControls wrapper, flyToFloor, login camera mode
│   ├── highlight.js                ← Room selection highlight overlay
│   ├── labels.js                   ← CSS2D labels over 3D rooms
│   └── exterior.js                 ← Exterior-only building view (used in login mode)
├── dist/                           ← Built output (served in production)
└── package.json                    ← three.js as direct dep, Vite build config
```

**Note:** `apps/web/src/components/Building3D/` contains copies of these same files (building.js, camera.js, etc.). The canonical source is `apps/modelado-3d/src/`. The copies in `apps/web` appear to be stale duplicates and are not imported by `BuildingViewer.jsx`, which uses the iframe at port 5174.

---

## packages/shared Structure

```
packages/shared/
├── src/
│   └── index.ts                    ← All exports (single file)
└── package.json                    ← name: "@stf/shared"
```

**Exports from `packages/shared/src/index.ts`:**

- **Zod schemas:** `RolSchema`, `CategoriaTicketSchema`, `SubcategoriaTicketSchema`, `EstadoTicketSchema`, `PrioridadTicketSchema`, `PisoEdificioSchema`, `TipoNotificacionSchema`, `TipoRecursoSchema`, `EstadoAsignacionSchema`, `AreaEdificioSchema`, `EmpleadoSchema`, `TicketSchema`, `TicketCreateSchema`, `TicketPatchSchema`, `UsuarioPublicoSchema`, `NotificacionSchema`, `RecursoSchema`, `RecursoCreateSchema`, `AsignacionRecursoCreateSchema`, `LoginSchema`, `LoginEmpleadoSchema`
- **Inferred TypeScript types:** `Rol`, `CategoriaTicket`, `SubcategoriaTicket`, `EstadoTicket`, `PrioridadTicket`, `PisoEdificio`, `TipoNotificacion`, `TipoRecurso`, `EstadoAsignacion`, `AreaEdificio`, `Empleado`, `Ticket`, `TicketCreateInput`, `TicketPatchInput`, `Comentario`, `UsuarioPublico`, `Notificacion`, `Recurso`, `RecursoCreateInput`, `LoginInput`, `LoginEmpleadoInput`, `Permiso`, `ProcesoInfo`, `PasoDefinicionInfo`, `TipoFlujo`
- **Label maps:** `LABEL_CATEGORIA`, `LABEL_SUBCATEGORIA`, `DESCRIPCION_SUBCATEGORIA`, `LABEL_ESTADO`, `LABEL_PRIORIDAD`, `LABEL_PISO`, `LABEL_ROL`, `LABEL_TIPO_RECURSO`, `LABEL_ESTADO_ASIGNACION`, `LABEL_PERMISO`
- **Catalog constants:** `SUBCATEGORIAS_POR_CATEGORIA`, `SUB_TIPO_EQUIPOS`, `SUBTIPO_EQUIPOS`, `SUBTIPO_RED`, `SUBTIPO_CUENTAS`, `SUBTIPO_SISTEMAS`
- **Workflow:** `FOLIO_PREFIX`, `PROCESO_MAP`, `getProcesoKey()`, `getProcesoInfo()`
- **Permissions:** `PERMISOS_LIST`, `PERMISOS_DEFAULT`, `tienePermiso()`
- **Metrics types:** `MetricasSolicitudesResponse`, `MetricaTecnico`, `MetricaProceso`

**Import in backend:** `import { Rol, tienePermiso, LABEL_PISO } from "@stf/shared";`
**Import in frontend:** same package name via workspace resolution.

---

## packages/database Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma               ← Canonical DB schema (MySQL, Prisma ORM)
│   └── migrations/
│       ├── 20260406044018_init_siast/          ← Initial schema
│       ├── 20260409000000_add_otp_tokens/
│       ├── 20260409000001_add_telefono_empleado/
│       ├── 20260414000000_add_empleado_estructura/
│       ├── 20260414000001_add_ticket_folio/
│       ├── 20260414000002_add_area_adscripcion/
│       ├── 20260414000003_rename_subcategorias_enum/
│       ├── 20260414000004_add_empleado_adscripcion/
│       ├── 20260415000000_add_empleado_sirh_fields/
│       ├── 20260415000001_add_primer_acceso/
│       ├── 20260415000010_add_recursos_materiales/
│       ├── 20260417000001_add_papeleria_recursos_adicionales/
│       ├── 20260417000002_restructure_recursos_catalogo_unidades/
│       ├── 20260420000001_add_sala_juntas_area/
│       ├── 20260423000001_update_subcategorias_tecnologias/
│       ├── 20260423000002_add_pasos_ticket/
│       ├── 20260423000003_add_proceso_definicion/
│       ├── 20260424000001_add_permisos_usuario/
│       ├── 20260424000002_add_sesiones_logs_acceso/
│       ├── 20260424000003_fix_subcategoria_enum/
│       └── 20260429180311_unify_tecnico_ti_role/   ← Latest (22 total)
├── src/
│   └── index.ts                    ← Re-exports PrismaClient for package consumers
├── scripts/
│   ├── sync-sirh.ts                ← Standalone SIRH sync script (tsx)
│   ├── setup.sql                   ← Manual DB setup SQL
│   └── analyze-n3.mjs              ← Analysis/debug script
├── docs/                           ← Internal documentation
└── package.json                    ← name: "@stf/database"
```

**Schema models (22 migrations, current):**
`Usuario`, `Empleado`, `OtpToken`, `AreaEdificio`, `Ticket`, `HistorialTicket`, `Comentario`, `Notificacion`, `CatalogoRecurso`, `RecursoUnidad`, `AsignacionRecurso`, `Sesion`, `LogAcceso`, `PasoTicket`, `ProcesoDefinicion`, `PasoDefinicion`

**Database commands (run from `packages/database/`):**
```bash
npm run db:migrate   # prisma migrate dev
npm run db:generate  # prisma generate
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio (port 5555)
```

---

## Key Entry Points

| App/Package | Entry Point | Purpose |
|-------------|-------------|---------|
| `apps/api` | `apps/api/src/index.ts` | Express + Socket.IO server bootstrap |
| `apps/web` | `apps/web/src/main.jsx` | React SPA mount |
| `apps/modelado-3d` | `apps/modelado-3d/src/main.js` | Three.js scene + postMessage |
| `packages/shared` | `packages/shared/src/index.ts` | All type/schema exports |
| `packages/database` | `packages/database/src/index.ts` | PrismaClient re-export |

---

## Naming Conventions

**Files:**
- API files: `{domain}.{layer}.ts` (e.g., `tickets.service.ts`, `auth.routes.ts`, `auth.middleware.ts`)
- Web pages: `{Name}Page.jsx` (PascalCase + `Page` suffix)
- Web components: PascalCase (e.g., `BuildingViewer.jsx`, `AppShell.jsx`)
- Web stores: lowercase (e.g., `auth.js`, `notificaciones.js`)
- Web API modules: lowercase by domain (e.g., `solicitudes.js`, `catalogos.js`)

**Directories:**
- API: snake_case (`routes/`, `controllers/`, `middleware/`, `services/`, `sockets/`, `types/`, `config/`)
- Web: PascalCase for component subdirs (`Building3D/`, `Layout/`, `Notifications/`), lowercase for feature dirs (`api/`, `store/`, `hooks/`, `theme/`, `pages/`)

**Package names:** `@stf/shared`, `@stf/ui`, `@stf/database`

---

## Where to Add New Code

### New API endpoint (new domain)

1. Create service: `apps/api/src/services/{domain}.service.ts`
2. Create controller: `apps/api/src/controllers/{domain}.controller.ts`
3. Create routes: `apps/api/src/routes/{domain}.routes.ts`
4. Mount in: `apps/api/src/index.ts` — add `app.use("/api/{domain}", {domain}Routes)`
5. Add API client module: `apps/web/src/api/{domain}.js`

### New page (web)

1. Create: `apps/web/src/pages/{Name}Page.jsx`
2. Import in: `apps/web/src/App.jsx` and add `<Route path="/{path}" element={<{Name}Page />} />`
3. If role-restricted, wrap in `<ProtectedRoute roles={[...]} />`
4. If protected, ensure it is inside the `<AppShell />` route group

### New shared type or schema

1. Add Zod schema and inferred type to: `packages/shared/src/index.ts`
2. Export the type — both API and web will pick it up automatically via workspace resolution

### New DB model or field

1. Edit: `packages/database/prisma/schema.prisma`
2. Run: `npm run db:migrate -w ./packages/database`
3. Run: `npm run db:generate -w ./packages/database` (regenerates Prisma client)
4. If new enum values are needed in frontend, mirror them in `packages/shared/src/index.ts`

### New UI component (shared)

- If only used in `apps/web`: place in `apps/web/src/components/{Category}/{Name}.jsx`
- If intended for reuse across apps: add to `packages/ui/src/` and export from `packages/ui/src/index.ts`
- Use MUI v5 (`@mui/material`) for `apps/web` — do NOT use shadcn/ui components in `apps/web` pages until a migration is completed

### New Socket.IO event

1. Emit from: `apps/api/src/services/notificaciones.service.ts` — add a new `emitir{EventName}()` function
2. Listen in: `apps/web/src/store/notificaciones.js` — add `socket.on("{event:name}", ...)` inside `conectar()`
3. If it should trigger a list refetch, call `set((s) => ({ ticketsVersion: s.ticketsVersion + 1 }))` inside the handler

---

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD mapper agent)
- Committed: Yes (source of truth for AI planning)

**`apps/api/.wwebjs_cache/`:**
- Purpose: WhatsApp Web.js session cache (browser state for WA authentication)
- Generated: Yes (auto-created by whatsapp-web.js on first init)
- Committed: No (in .gitignore or should be)

**`packages/database/prisma/migrations/`:**
- Purpose: Prisma migration history — one directory per migration with `migration.sql`
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes (required for production deploys)

**`.claude/worktrees/`:**
- Purpose: Git worktrees for parallel Claude agent work
- Generated: Yes (by Claude agent tooling)
- Committed: No

---

*Structure analysis: 2026-05-06*
