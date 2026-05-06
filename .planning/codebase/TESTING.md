# Testing

**Analysis Date:** 2026-05-06

---

## Current State

**There are zero test files in the SIAST codebase.**

A search for `*.test.*` and `*.spec.*` across all workspaces returns no results. No test runner is configured in any `package.json`. No test framework is installed in any workspace's dependencies. The project has no test infrastructure of any kind.

The codebase is entirely covered by manual testing and live development against real MySQL data.

---

## Test Framework

**Not configured.** No test runner, assertion library, or mocking framework is installed.

Recommended additions based on the stack:

| Layer | Recommended Tool | Purpose |
|-------|-----------------|---------|
| API unit/integration | `vitest` + `supertest` | Route and service testing |
| Shared package | `vitest` | Zod schema validation testing |
| Frontend | `vitest` + `@testing-library/react` | Component and hook testing |

---

## Test Locations

No test directories exist. When tests are added, the recommended locations are:

- `apps/api/src/**/__tests__/` — API unit and integration tests
- `apps/api/src/**/*.test.ts` — co-located unit tests (alternative)
- `apps/web/src/**/*.test.jsx` — co-located component tests
- `packages/shared/src/**/*.test.ts` — Zod schema and utility tests

---

## What's Tested

Nothing. No automated coverage exists.

---

## Critical Path Gaps

These are the highest-risk untested areas, ordered by impact:

### 1. Authentication Logic — `apps/api/src/services/auth.service.ts`, `apps/api/src/services/otp.service.ts`

- RFC login flow for employees (no password)
- Staff login with username + password (bcrypt comparison)
- OTP generation, expiry (5-minute window), and single-use enforcement
- JWT issuance and the 7-day grace period on refresh
- `requireRol` middleware rejecting unauthorized roles

### 2. Ticket State Machine — `apps/api/src/services/tickets.service.ts`

- State transition validation via the `TRANSICIONES` map — invalid transitions must throw 400
- Soft delete: `eliminarTicket` must set `activo: false`, never physically delete
- 2-ticket limit per employee (business rule, not yet visible in code — may not be enforced)
- `computeAutoPriority` time-based logic (URGENTE after 24h, MEDIA after 6h)
- Folio generation uniqueness: `generarFolio` race condition under concurrent creation

### 3. Zod Schema Validation — `packages/shared/src/index.ts`

- `TicketCreateSchema` rejects invalid `subcategoria` / `categoria` combinations
- `LoginEmpleadoSchema` enforces exactly 13-character RFC
- `validate` middleware in `apps/api/src/middleware/validate.middleware.ts` rejects malformed bodies with `{ error, issues }`

### 4. Multi-Step Process Flows — `apps/api/src/services/tickets.service.ts`

- Sequential paso activation: paso N only becomes active after paso N-1 is completed
- `PENDIENTE` flow type: tickets with `tipoFlujo === "PENDIENTE"` should not auto-create pasos
- `completarPaso` correctly activates the next paso for `SECUENCIAL` processes

### 5. Permission System — `packages/shared/src/index.ts`, `apps/api/src/middleware/permisos.middleware.ts`

- `tienePermiso` returns correct results for each `Rol` and `permisosExtra` combination
- Extra permissions in `Usuario.permisos` (JSON field) override default role permissions

### 6. SIRH Sync — `apps/api/src/services/sirh.service.ts`

- Concurrent sync guard: second sync attempt while one is in progress returns early
- RFC validation filter: only 13-character RFCs with `status === 1` are synced
- Upsert correctness: existing employees are updated, new ones are created

### 7. Frontend Zustand Stores — `apps/web/src/store/auth.js`, `apps/web/src/store/notificaciones.js`

- `loginStaff` and `loginRFC` persist token and user to `localStorage` on success
- `logout` clears both `localStorage` keys and resets store state
- `ticketsVersion` increments on every Socket.IO ticket event

---

## Recommended Next Steps

Priority order for introducing tests:

1. **Configure vitest in `apps/api`** — add `vitest` and `supertest` as dev dependencies, add `"test": "vitest"` script.

2. **Test Zod schemas in `packages/shared`** — easiest wins, pure functions, no DB needed. Cover `TicketCreateSchema`, `LoginEmpleadoSchema`, `tienePermiso`.

3. **Test `auth.service` with a test database or mocked Prisma** — authentication is the highest-security surface and completely untested.

4. **Test state transitions in `tickets.service`** — mock `prisma` and verify `TRANSICIONES` enforcement and soft delete behavior.

5. **Test the `validate` middleware** — unit test that malformed bodies are rejected with correct HTTP 400 shape.

6. **Add integration tests for critical routes** — use `supertest` against a test MySQL instance: `POST /api/auth/login`, `POST /api/solicitudes`, `PATCH /api/solicitudes/:id/estado`.

---

## Notes for Test Setup

- The API uses ESM (`"type": "module"`) — vitest config must use `"pool": "forks"` or equivalent ESM-compatible setting.
- Prisma client must be mocked (e.g., `vitest-mock-extended` or manual mocks) to avoid requiring a live MySQL database in CI.
- The shared package has no build step — tests can import directly from `packages/shared/src/index.ts`.
- Frontend pages import MUI components heavily; snapshot tests will require `@mui/material` in the test environment.

---

*Testing analysis: 2026-05-06*
