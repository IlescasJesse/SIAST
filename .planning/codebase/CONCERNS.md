# Technical Concerns & Debt

**Analysis Date:** 2026-05-06

---

## Critical (Blocking or High Risk)

### Prisma Client Not Regenerated After Latest Migration

The last migration `20260429180311_unify_tecnico_ti_role` has been applied to the schema but `prisma generate` has not been run since. The generated client in `packages/database/src/index.ts` may be out of sync with the actual schema. Any code referencing the new enum values or model fields added in recent migrations may fail at runtime with type errors or unexpected `undefined` results.

- Files: `packages/database/prisma/schema.prisma`, `packages/database/src/index.ts`
- Fix: Run `npm run db:generate` from `packages/database/`

### Hardcoded JWT Fallback Secret

In `apps/api/src/config/jwt.ts` (line 4), the JWT secret falls back to the literal string `"siast_dev_secret"` when `JWT_SECRET` is not set. If the production server ever starts without a `.env` file, all employee and staff tokens are signed with this predictable secret, making them trivially forgeable by anyone who reads the source code.

- File: `apps/api/src/config/jwt.ts`
- Risk: Full authentication bypass in production if env var is missing
- Fix: Remove the fallback and throw a startup error if `JWT_SECRET` is absent

### No Rate Limiting on Auth Endpoints

The `POST /api/auth/solicitar-otp`, `POST /api/auth/verificar-otp`, `POST /api/auth/login`, and `POST /api/auth/login-rfc` endpoints have no rate limiting (`express-rate-limit` is not installed). An attacker can brute-force OTP codes (6-digit numeric = 1,000,000 possibilities) or staff passwords without any throttling.

- Files: `apps/api/src/routes/auth.routes.ts`, `apps/api/src/index.ts`
- Risk: OTP brute-force is practical; staff password spray attacks are unrestricted
- Fix: Install `express-rate-limit` and apply strict limits (e.g., 5 attempts/15 min) on auth routes

### CORS Allows All Origins in Development

In `apps/api/src/index.ts` (line 32), `corsOrigin` is set to `true` (allow any origin) when `NODE_ENV !== "production"`. If the API is deployed to a staging or UAT server without explicitly setting `NODE_ENV=production`, all CORS protections are disabled.

- File: `apps/api/src/index.ts`
- Fix: Use an explicit allowlist even in non-production environments

---

## High Priority

### Token Refresh Endpoint Accepts Expired Tokens Without Session Check

In `apps/api/src/controllers/auth.controller.ts` (lines 119-131), `refreshToken` calls `jwt.verify(..., { ignoreExpiration: true })` and skips the session validity check (`verificarSesion`). A user whose session was explicitly revoked (via admin panel or logout) can still obtain a fresh token up to 7 days after their original token expired. This breaks the session revocation model entirely for token refresh.

- File: `apps/api/src/controllers/auth.controller.ts`
- Fix: Call `verificarSesion(payload.jti)` before issuing a new token in `refreshToken`

### Frontend Is Plain JavaScript (No TypeScript)

The entire `apps/web/src/` directory uses `.jsx` and `.js` files with no TypeScript. The `apps/api` backend uses strict TypeScript, but the frontend shares types from `@stf/shared` without type enforcement. Mismatches between API response shapes and UI assumptions cause silent runtime failures rather than compile-time errors.

- Files: `apps/web/src/**/*.jsx`, `apps/web/src/**/*.js`
- Impact: No type safety in any UI component, page, or store
- Fix: Migrate web app to TypeScript (`.tsx`/`.ts`) incrementally, starting with stores and API clients

### MUI Used in Web App Despite shadcn/ui Mandate

`apps/web/package.json` lists `@mui/material`, `@mui/icons-material`, `@mui/lab`, `@mui/x-date-pickers`, and `@emotion/*` as dependencies. `CLAUDE.md` explicitly states: "shadcn/ui con Tailwind — NO usar MUI en este proyecto." The web app's components (`SolicitudDetailPage.jsx`, etc.) import directly from `@mui/material`. The `packages/ui/` package uses shadcn conventions, but the web app pages ignore it and use MUI.

- Files: `apps/web/src/pages/SolicitudDetailPage.jsx`, `apps/web/package.json`
- Impact: Dual UI system, increased bundle size, inconsistent look and future maintenance burden
- Fix: Migrate pages from MUI to shadcn/ui + Tailwind; the monorepo's `packages/ui` already provides base components

### N+1 Query Pattern in Metrics Endpoints

`apps/api/src/controllers/metricas.controller.ts` fetches all technicians in one query, then runs 4 separate Prisma queries per technician inside a `for` loop. With 10 technicians, that is 41 queries. The process metrics endpoint similarly runs `findMany` queries per category group inside a loop.

- File: `apps/api/src/controllers/metricas.controller.ts`
- Impact: Dashboard load time scales linearly with technician count; slow on any reasonable team size
- Fix: Use `groupBy` aggregations or `$queryRaw` to compute all metrics in a single pass

### SIRH Department Mapping Is a 200-Line Static Lookup Table With Duplicates

`apps/api/src/services/sirh.service.ts` contains a `DEPT_TO_AREA` record with ~120 string keys mapping department names to building areas. The same mapping exists verbatim in `packages/database/scripts/sync-sirh.ts`. Duplicate definitions will drift when department names change in SIRH.

- Files: `apps/api/src/services/sirh.service.ts`, `packages/database/scripts/sync-sirh.ts`
- Fix: Extract into a single shared module in `packages/shared`, import in both places

### OTP Code Uses `Math.random()` (Not Cryptographically Secure)

`apps/api/src/services/otp.service.ts` (line 9) generates OTP codes with `Math.floor(100000 + Math.random() * 900000)`. `Math.random()` is not a CSPRNG. For government authentication, OTP codes should be generated with `crypto.randomInt(100000, 999999)` (Node.js built-in, cryptographically secure).

- File: `apps/api/src/services/otp.service.ts`
- Fix: Replace `Math.random()` with `crypto.randomInt(100000, 999999)`

---

## Medium Priority

### Legacy `/api/auth/login-rfc` Endpoint (No OTP) Is Still Active

`apps/api/src/routes/auth.routes.ts` (line 7) exposes `POST /api/auth/login-rfc`, which grants a JWT session to anyone who provides a valid RFC — no OTP required. The comment says "legacy (sin OTP)". The `auth.js` store in the frontend also still calls `loginRFC`. This endpoint bypasses the entire OTP authentication flow.

- Files: `apps/api/src/routes/auth.routes.ts`, `apps/web/src/store/auth.js`
- Risk: Any employee RFC (which is semi-public information) grants access without verification
- Fix: Remove or gate behind a feature flag; ensure all employee login flows go through OTP

### SISTEMAS_INSTITUCIONALES Ticket Flow Is Undefined

In `packages/shared/src/index.ts` (lines 597-608), both `SISTEMAS_INSTITUCIONALES:SIRH` and `SISTEMAS_INSTITUCIONALES:SIAST` have `tipoFlujo: "PENDIENTE"` and empty `pasos: []`. Tickets in these subcategories can be created but have no workflow steps, no auto-assignment, and no escalation path. They open but effectively stay in limbo.

- File: `packages/shared/src/index.ts`
- Impact: Tickets about SIRH or SIAST itself have no resolution path
- Fix: Define actual workflow steps for these subtypes or hide them from the ticket creation UI until ready

### Recursos Materiales Escalation to "Repuesto/Garantía" Not Linked

`packages/shared/src/index.ts` (line 537) contains the comment: "Si se requiere pieza de repuesto o garantía, escala a Recursos Materiales (pendiente de vincular)." The `EQUIPOS_DISPOSITIVOS:MANTENIMIENTO_CORRECTIVO` workflow ends at the TI technician with no formal handoff to the materiales gestor.

- File: `packages/shared/src/index.ts`
- Fix: Add a conditional escalation step or a linking mechanism between ticket types

### Folio Generation Has a Race Condition

`apps/api/src/services/tickets.service.ts` (lines 21-29) generates folios by counting existing tickets with the same prefix and incrementing. Under concurrent ticket creation, two tickets could receive the same folio before either is written. The `folio` column has a `@unique` constraint so one will fail with a Prisma unique constraint error, but the user gets an unhandled 500 with no retry logic.

- File: `apps/api/src/services/tickets.service.ts`
- Fix: Use `prisma.$transaction` with an atomic counter, or use a DB `AUTO_INCREMENT` sequence for folio numbers

### WhatsApp Session State Is Global Module-Level Mutable State

`apps/api/src/services/whatsapp.service.ts` uses module-level `let client`, `let clientState`, `let waFailReason` variables. There is no cleanup on reconnect and no mechanism for the running server to reset the WhatsApp session without a full restart. The `disconnected` event sets `clientState = "failed"` permanently with no auto-reconnect.

- File: `apps/api/src/services/whatsapp.service.ts`
- Fix: Add auto-reconnect logic or an admin endpoint to trigger re-initialization

### Ticket `RESUELTO` Auto-Transition From Resource Assignment Bypasses State Machine

In `apps/api/src/controllers/recursos.controller.ts` (line 581), when a resource assignment is approved (`estado === "APROBADA"`), the linked ticket is directly set to `RESUELTO` via `prisma.ticket.update`. This skips the `TRANSICIONES` state machine defined in `tickets.service.ts`, creates no `HistorialTicket` entry, and emits no Socket.IO notification.

- File: `apps/api/src/controllers/recursos.controller.ts`
- Impact: Ticket history is incomplete; employees receive no real-time notification that their ticket is resolved
- Fix: Call `ticketsService.cambiarEstado()` instead of raw `prisma.ticket.update`

### `morgan("dev")` Active in All Environments

`apps/api/src/index.ts` (line 56) uses `morgan("dev")` unconditionally. The `dev` format logs every request in color and with response time. In production this is noisy and may log sensitive URL parameters.

- File: `apps/api/src/index.ts`
- Fix: Use `morgan(IS_PROD ? "combined" : "dev")` and consider writing to a log file in production

---

## Low Priority

### `packages/database/scripts/sync-sirh.ts` Is a Standalone Duplicate

`packages/database/scripts/sync-sirh.ts` reimplements the SIRH sync logic that already exists in `apps/api/src/services/sirh.service.ts`, including its own copy of `DEPT_TO_AREA`. This was likely the original standalone script before the service was built into the API. It is now redundant and will silently diverge.

- Files: `packages/database/scripts/sync-sirh.ts`
- Fix: Delete or convert to a thin wrapper that imports from the API service

### Two Worktrees in `.claude/worktrees/` Are Likely Stale

The project has Claude worktrees (`inspiring-lamarr`, `serene-pare`) under `.claude/worktrees/`. These are AI agent work-in-progress branches that were never merged or cleaned up. They consume disk space and may contain partial changes that conflict with main branch work.

- Files: `.claude/worktrees/`
- Fix: Review and delete stale worktrees

### `VITE_API_URL` Missing from Web App Config

`apps/web/src/api/client.js` (line 4) falls back to `window.location.hostname:5101` when `VITE_API_URL` is not set. In production this assumes the API is accessible at the same hostname on port 5101, which may not be true behind a reverse proxy. There is no documented `.env.example` for the web app.

- Files: `apps/web/src/api/client.js`
- Fix: Add `.env.example` to `apps/web/` with `VITE_API_URL=http://localhost:5101`

### `deletePrismaAreas.ts` and `resetAreas.ts` Are Destructive Utility Scripts Without Guards

`packages/database/prisma/deleteAreas.ts` and `packages/database/prisma/resetAreas.ts` appear to be one-off maintenance scripts left in the repo. They can delete or reset area records if run accidentally.

- Files: `packages/database/prisma/deleteAreas.ts`, `packages/database/prisma/resetAreas.ts`
- Fix: Move to a `scripts/admin/` subdirectory with prominent warnings, or delete if no longer needed

---

## Security Concerns

### JWT Secret Fallback (`"siast_dev_secret"`)

See Critical section. Any JWT signed with the fallback secret can be decoded and verified by anyone with the source code.

- File: `apps/api/src/config/jwt.ts`

### OTP Delivered to Console in Fallback Mode (`devCodigo`)

When WhatsApp is unavailable, `apps/api/src/services/otp.service.ts` returns `devCodigo` in the HTTP response. This code is also sent back to the frontend in `solicitarOtp`. In production with a broken WhatsApp session, the OTP code appears in the HTTP API response, allowing authentication without physical access to the phone.

- Files: `apps/api/src/services/otp.service.ts`, `apps/api/src/controllers/auth.controller.ts`
- Fix: In production (`NODE_ENV=production`), never include `devCodigo` in the response; fail hard instead

### SIRH Service Credentials Stored Only in `.env`

`apps/api/src/services/sirhAuth.service.ts` reads `SIRH_SERVICE_USER` and `SIRH_SERVICE_PASS` directly from `process.env`. There is no validation that these are present at startup beyond a `console.warn`. If these are misconfigured the sync starts silently failing.

- File: `apps/api/src/services/sirhAuth.service.ts`
- Fix: Add startup assertion that validates all required env vars are present and non-empty

### No Input Sanitization on `descripcion` (Free-Text `@db.Text` Fields)

Ticket `descripcion` and comment `texto` fields are stored as `@db.Text` with no character limits in the validation layer (only `asunto` has `.max(100)` via Zod on ticket creation, but `descripcion` has none). The schema allows unlimited text. While Prisma prevents SQL injection, extremely large payloads can cause DB write timeouts and memory pressure.

- Files: `apps/api/src/services/tickets.service.ts`, schema `descripcion String @db.Text`
- Fix: Add `.max(5000)` (or similar) to the Zod schema for `descripcion` and `texto`

### `x-forwarded-for` IP Without Proxy Trust Configuration

`apps/api/src/controllers/auth.controller.ts` reads the real IP from `x-forwarded-for` without configuring Express `trust proxy`. If there is no trusted proxy, this header can be spoofed by any client, poisoning IP-based log entries and rate limits.

- File: `apps/api/src/controllers/auth.controller.ts`
- Fix: Add `app.set("trust proxy", 1)` in `apps/api/src/index.ts` when behind a reverse proxy

---

## Performance Concerns

### Ticket Listing Sorts in JavaScript After Fetching From DB

`apps/api/src/services/tickets.service.ts` (lines 95-130) fetches all tickets matching the `where` clause using pagination, then applies JavaScript-level sorting (`activos.sort(...)`, `finales.sort(...)`). The DB `orderBy` is set to `createdAt: "asc"` as a placeholder comment says "final sort is applied in JS." This means the paginated results are sorted correctly within the fetched page but not across pages. Ticket priority order is inconsistent across pages.

- File: `apps/api/src/services/tickets.service.ts`
- Fix: Compute priority as a DB column or use a Prisma `orderBy` expression instead of JS post-sort

### Full SIRH Employee List Fetched as Fallback on Every Failed RFC Lookup

`apps/api/src/services/sirh.service.ts` (lines 373-376): when the individual-employee endpoint fails, `fetchEmpleadoByRfc` falls back to downloading the entire employee list (`fetchAllEmployees`) and searching in memory. With 1,994 employees, this is a large payload fetched synchronously during employee login. A slow SIRH will directly block the login response.

- File: `apps/api/src/services/sirh.service.ts`
- Fix: Remove the full-list fallback; log the failure and return `false` to avoid blocking login

### SIRH Sync Processes All Employees on Every Server Restart

`apps/api/src/index.ts` (line 93) calls `syncEmpleados()` on every startup when `SIRH_ENABLED=true`. With ~1,994 valid employees processed in batches of 10, this runs ~200 DB upsert batches at boot. In dev environments where the server restarts frequently, this creates unnecessary load.

- File: `apps/api/src/index.ts`
- Fix: Skip boot-time sync if last sync was less than N hours ago (use `syncStatus.ultimaSync` already tracked)

---

## Architectural Concerns

### Process Definition Is Duplicated: In-Memory Map and DB Table

Workflow process definitions exist in two places: the static `PROCESO_MAP` in `packages/shared/src/index.ts` (runtime source of truth for ticket creation and the 3D viewer) and the `ProcesoDefinicion`/`PasoDefinicion` tables in the database (editable via `GET/POST/PUT /api/admin/procesos`). The ticket creation code in `apps/api/src/services/tickets.service.ts` reads only from the in-memory `PROCESO_MAP` via `getProcesoInfo()`, ignoring any DB customizations. The admin UI edits the DB table but changes have no effect on new tickets.

- Files: `packages/shared/src/index.ts`, `apps/api/src/services/tickets.service.ts`, `apps/api/src/controllers/admin-procesos.controller.ts`
- Impact: Admin-configured process changes are silently ignored during ticket creation
- Fix: Unify to a single source of truth; either always read from DB, or remove the DB table and admin UI

### Frontend State Not Persisted on Logout

`apps/web/src/store/auth.js` `logout()` removes token and user from localStorage but does not call `POST /api/auth/logout` to close the server-side session record. The session remains `activa: true` in the `Sesion` table until it expires naturally.

- File: `apps/web/src/store/auth.js`
- Fix: Call `api.post("/api/auth/logout")` before clearing local state

### Ticket State Transitions Duplicated Between Frontend and Backend

`apps/web/src/pages/SolicitudDetailPage.jsx` (lines 22-28) hardcodes the `TRANSICIONES` map identically to `apps/api/src/services/tickets.service.ts` (lines 31-37). When the backend state machine changes, the frontend must be updated separately. Since the frontend is plain JS, there is no type-check to catch divergence.

- Files: `apps/web/src/pages/SolicitudDetailPage.jsx`, `apps/api/src/services/tickets.service.ts`
- Fix: Export `TRANSICIONES` from `packages/shared` and import in both places

---

## Missing Infrastructure

### No Automated Tests

Zero test files exist in the entire monorepo. No unit tests for business logic (folio generation, state transitions, OTP validation), no integration tests for API endpoints, no end-to-end tests for the UI. Critical paths like auth, ticket creation, and resource assignment have no automated coverage.

- Impact: Regressions go undetected; high risk when modifying shared logic in `packages/shared`
- Recommendation: Start with unit tests for `packages/shared` (pure functions) using Vitest; add API integration tests for auth routes

### No CI/CD Pipeline

No `.github/workflows/`, no CI configuration files found. All deployments are manual. There is no automated lint, type-check, or build verification on commits.

- Fix: Add a minimal GitHub Actions workflow: `npm run lint && npm run build` on PR

### No Log Rotation or External Log Aggregation

`morgan("dev")` writes to stdout. Logs are only retained as long as the PM2 log buffer persists. There is no structured logging (JSON format), no log file, and no external aggregation (Loki, Datadog, etc.). Debugging production incidents requires SSH access and `pm2 logs`.

- Fix: Replace `morgan("dev")` with `morgan("combined")` in production; write to a file or ship to an external service

### No Database Backup Strategy

The system runs on MySQL via XAMPP. There is no backup script, no cron job, and no automated snapshot. Ticket, employee, and session data is at risk of total loss on disk failure.

- Fix: Implement `mysqldump` on a daily cron with off-site storage

### No Health Check Beyond `/health` Status OK

`GET /health` returns `{ status: "ok", env }` without checking DB connectivity or SIRH reachability. A process monitor that polls `/health` would not detect a DB connection pool exhaustion or a Prisma initialization failure.

- File: `apps/api/src/index.ts`
- Fix: Include a `prisma.$queryRaw\`SELECT 1\`` call in the health endpoint

---

## Stale / Dead Code

### `apps/web/src/store/auth.js` Contains Legacy `loginRFC` (No OTP)

The Zustand store's `loginRFC` method calls `POST /api/auth/login-rfc` directly. This is the pre-OTP authentication path. It exists alongside the OTP flow but should be removed once the OTP migration is confirmed complete.

- File: `apps/web/src/store/auth.js`

### `packages/database/scripts/sync-sirh.ts` Is Redundant

Described in Low Priority. The script duplicates `sirh.service.ts` in full. It should be deleted.

- File: `packages/database/scripts/sync-sirh.ts`

### `packages/database/prisma/deleteAreas.ts` and `resetAreas.ts`

One-off maintenance scripts not integrated into any documented workflow.

- Files: `packages/database/prisma/deleteAreas.ts`, `packages/database/prisma/resetAreas.ts`

### `.claude/worktrees/` Stale Agent Branches

Worktrees `inspiring-lamarr` and `serene-pare` from previous agent sessions are uncommitted and not integrated.

- Files: `.claude/worktrees/`

---

*Concerns audit: 2026-05-06*
