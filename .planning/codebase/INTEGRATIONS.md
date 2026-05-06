# Integrations & External Services

**Analysis Date:** 2026-05-06

## Internal Services

### SIRH (Sistema de Recursos Humanos)

SIRH is an internal government HR system running at `http://localhost:3000`. It is a separate application with its own MongoDB database.

**Purpose:** Employee data source. SIAST syncs employee records from SIRH and falls back to it for individual RFC lookups on login.

**Integration points:**
- `packages/database/scripts/sync-sirh.ts` — manual full sync script
- `apps/api/src/services/sirh.service.ts` — sync logic called at API startup and every 12 hours
- `apps/api/src/services/sirhAuth.service.ts` — obtains and caches a SIRH session token (JWT)

**Protocol:** REST over HTTP. SIAST authenticates to SIRH using a service account, then calls `/api/personal/getEmployees` to pull employee records.

**Auth flow against SIRH:**
1. POST to `SIRH_BASE_URL + SIRH_LOGIN_ENDPOINT` (default: `/api/auth/login`) with service credentials
2. Cache the returned JWT (6-hour TTL assumed, 30-min refresh buffer)
3. Attach token as `Authorization: Bearer` on subsequent SIRH calls

**Sync strategy:**
- Full upsert on startup (when `SIRH_ENABLED=true`)
- Periodic re-sync every 12 hours via `setInterval`
- On-demand fetch-and-upsert for individual RFC on login (`fetchEmpleadoByRfc`)
- Sync status tracked in-memory in `syncStatus` object in `sirh.service.ts`

**Required env vars:**
```
SIRH_ENABLED=true              # toggle to disable all SIRH calls
SIRH_BASE_URL=http://localhost:3000
SIRH_LOGIN_ENDPOINT=/api/auth/login   # default
SIRH_SERVICE_USER=<service-account>
SIRH_SERVICE_PASS=<password>
```

**SIRH employee fields mapped to `Empleado` model:**
`_id → sirhId`, `RFC`, `NOMBRES`, `APE_PAT`, `APE_MAT`, `DEPARTAMENTO`, `ADSCRIPCION`, `EMAIL`, `NUMEMP`, `NUMPLA`, `NIVEL`, `FECHA_INGRESO`, `CURP`, `GRUPOSANGRE`, `SEXO`, `VACACIONES`.

---

## Authentication

### Staff Authentication (Admin, Técnicos, Mesa de Ayuda)

- **Flow:** `POST /api/auth/login` with `{ usuario, password }`
- **Password storage:** bcrypt hash in `Usuario.password` (`@db.VarChar(255)`)
- **Token:** JWT signed with `JWT_SECRET`, default expiry `8h` (`JWT_EXPIRES_IN`)
- **Implementation:** `apps/api/src/services/auth.service.ts` → `loginStaff()`
- **Session record:** Creates a `Sesion` row with a UUID `jti`, `expiresAt`, and client IP/UA

### Employee Authentication (Empleados — RFC + OTP)

- **Flow (full):**
  1. `POST /api/auth/solicitar-otp` — generates 6-digit code, saves to `OtpToken` table, sends via WhatsApp
  2. `POST /api/auth/verificar-otp` — validates code, issues JWT
- **Flow (legacy):** `POST /api/auth/login-rfc` — direct RFC login with no OTP (available for dev/fallback)
- **Token:** JWT with `rol: "EMPLEADO"`, default expiry `30d` (`EMPLEADO_JWT_EXPIRES_IN`)
- **Implementation:** `apps/api/src/services/auth.service.ts` → `loginRFC()`, `apps/api/src/services/otp.service.ts`

### JWT Lifecycle

- **Signing/verifying:** `apps/api/src/config/jwt.ts` using `jsonwebtoken ^9.0.2`
- **Secret:** `JWT_SECRET` env var (falls back to hardcoded `"siast_dev_secret"`)
- **Refresh endpoint:** `POST /api/auth/refresh` — accepts recently-expired tokens, issues new JWT
- **Session table:** `Sesion` model stores `jti` (UUID), `activa`, `expiresAt`, `ipAddress`, `userAgent`
- **Access logging:** All login attempts (success/fail) recorded in `LogAcceso` table
- **Frontend handling:** Axios interceptor in `apps/web/src/api/client.js` — 401 → auto-refresh → retry. Proactive renewal 10 min before expiry via `iniciarRenovacionProactiva()`.
- **Frontend storage:** Token + user object in `localStorage` under keys `siast_token`, `siast_user`, `siast_token_exp`

### Role-Based Access

Roles defined in `Rol` enum (Prisma schema + `@stf/shared`):
`ADMIN`, `TECNICO_TI`, `TECNICO_REDES`, `TECNICO_SERVICIOS`, `MESA_AYUDA`, `GESTOR_RECURSOS_MATERIALES`, `EMPLEADO`

Middleware:
- `apps/api/src/middleware/auth.middleware.ts` — JWT verification, attaches user to request
- `apps/api/src/middleware/roles.middleware.ts` — role guard
- `apps/api/src/middleware/permisos.middleware.ts` — granular permission overrides (stored as JSON in `Usuario.permisos`)

---

## Real-Time (Socket.IO)

**Server:** Socket.IO 4.8.1 attached to the Express HTTP server in `apps/api/src/index.ts`.

**Socket configuration:** `apps/api/src/sockets/tickets.socket.ts`

**Rooms:**

| Room | Join event | Purpose |
|------|-----------|---------|
| `user:<userId>` | `join:user` | Notifications to a specific staff user |
| `emp:<rfc>` | `join:empleado` | Notifications to a specific employee |
| `admins` | `join:admin` | Broadcast to all admin users |

**Server-emitted events:**

| Event | Room | Trigger |
|-------|------|---------|
| `ticket:nuevo` | `admins` | New ticket created |
| `ticket:actualizado` | `user:<id>`, `emp:<rfc>`, `admins` | Ticket state/assignment changed |
| `notificacion` | `user:<id>` or `emp:<rfc>` | New notification record created |

**Notification service:** `apps/api/src/services/notificaciones.service.ts` — creates `Notificacion` rows in MySQL and emits Socket.IO events simultaneously.

**Frontend:** `apps/web/src/store/notificaciones.js` — Zustand store that connects Socket.IO client (`socket.io-client ^4.8.1`) to `API_BASE`, joins the appropriate room, and surfaces real-time notifications. Also uses the browser `Notification` API for native desktop notifications.

**CORS:** In development, Socket.IO allows any origin (`origin: true`). In production, restricted to `FRONTEND_URL` and `VIEWER_URL`.

---

## WhatsApp OTP

**Library:** `whatsapp-web.js ^1.34.6` (headless WhatsApp client)

**Purpose:** Delivers 6-digit OTP codes to employees via WhatsApp message for passwordless login.

**Initialization:** `initWhatsApp()` called at API startup (`apps/api/src/index.ts`). Outputs QR code to terminal on first run via `qrcode-terminal ^0.12.0`.

**Session persistence:** WhatsApp session stored in `.wwebjs_auth/` directory (not committed).

**Fallback behavior:**
- If WhatsApp client is not ready within 30 seconds → falls back to `CONSOLE` mode
- In console mode, the OTP code is printed to the server log and also returned in the HTTP response body (for development)

**State tracking:** `getWaStatus()` in `apps/api/src/services/whatsapp.service.ts` returns `{ state: "initializing" | "ready" | "failed", reason: string }`

**Implementation:** `apps/api/src/services/whatsapp.service.ts`, `apps/api/src/services/otp.service.ts`

---

## Database Connectivity

**Engine:** MySQL 8+ / MariaDB via XAMPP (development). Must be running before `npm run dev:api`.

**ORM:** Prisma 5.22.0

**Client instantiation:** `apps/api/src/config/database.ts` — global singleton on `globalThis` to survive `tsx watch` hot reloads.

**Schema:** `packages/database/prisma/schema.prisma`

**Migrations directory:** `packages/database/prisma/migrations/` (17+ migrations as of analysis)

**Prisma Studio:** Available at port 5555 via `npm run db:studio` in `packages/database`

**Connection env var:**
```
DATABASE_URL=mysql://root:@localhost:3306/siast
```

---

## 3D Viewer ↔ Frontend Communication

The 3D viewer (`apps/modelado-3d`, port 5174) is embedded as an `<iframe>` inside the React frontend (port 5173). The viewer fetches employee and area data directly from the API using the same `VITE_API_URL` base. The viewer's Vite config sets `X-Frame-Options: ALLOWALL` and `Content-Security-Policy: frame-ancestors *` to allow iframe embedding.

The viewer calls `GET /api/employee/:rfc` and area endpoints — the API exposes `/api/employee` as an alias for `/api/empleados`.

---

## External APIs / Third-Party Services

No third-party cloud services detected. All integrations are internal or local:

| Service | Status |
|---------|--------|
| Stripe / payment gateways | Not present |
| AWS / GCP / Azure | Not present |
| SendGrid / email providers | Not present |
| Firebase | Not present |
| SICIPO (government inventory) | Schema comment placeholder only — not yet integrated |

The only external network communication is WhatsApp (via `whatsapp-web.js`) which uses WhatsApp's own infrastructure through the headless browser client.

---

## Environment Variables

Full list of env vars consumed by `apps/api`:

```bash
# Server
PORT=5101
NODE_ENV=development

# Frontend URLs (for CORS in production)
FRONTEND_URL=http://localhost:5173
VIEWER_URL=http://localhost:5174

# Database
DATABASE_URL=mysql://root:@localhost:3306/siast

# JWT
JWT_SECRET=<secret>
JWT_EXPIRES_IN=8h                    # staff token expiry
EMPLEADO_JWT_EXPIRES_IN=30d          # employee token expiry

# SIRH Integration
SIRH_ENABLED=true
SIRH_BASE_URL=http://localhost:3000
SIRH_LOGIN_ENDPOINT=/api/auth/login  # default
SIRH_SERVICE_USER=<service-account>
SIRH_SERVICE_PASS=<password>
```

Frontend (`apps/web`) env vars:

```bash
VITE_API_URL=http://localhost:5101   # defaults to window.location.hostname:5101 if unset
```

**Secrets location:** `.env` file in `apps/api/` (not committed). WhatsApp session stored in `apps/api/.wwebjs_auth/` (not committed).

---

*Integration audit: 2026-05-06*
