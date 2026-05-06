# Tech Stack

**Analysis Date:** 2026-05-06

## Runtime & Language

**Runtime:** Node.js v24.12.0 (active at analysis time; no `.nvmrc` present)

**Language:** TypeScript 5.9.3 (API and database packages); JavaScript (web frontend — no tsconfig in `apps/web`)

**TypeScript compiler options (API):** `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`. Config at `apps/api/tsconfig.json`.

**Module system:** All packages use `"type": "module"` (ESM throughout). API built with `tsup` targeting both ESM and CJS via `dist/`.

## Frontend

**App:** `apps/web` — `@stf/web`

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React | 18.3.1 |
| Build tool | Vite + `@vitejs/plugin-react` | 5.4.10 / 4.3.4 |
| Routing | react-router-dom | 6.28.1 |
| UI components | Material UI (`@mui/material`) | 6.3.0 |
| MUI icons | `@mui/icons-material` | 6.3.0 |
| MUI lab | `@mui/lab` | 6.0.0-beta.22 |
| MUI date pickers | `@mui/x-date-pickers` | 9.0.2 |
| Emotion (MUI peer) | `@emotion/react`, `@emotion/styled` | 11.13.5 |
| Forms | react-hook-form + `@hookform/resolvers` | 7.54.2 / 3.9.1 |
| Validation | Zod | 4.1.12 |
| State management | Zustand | 5.0.3 |
| HTTP client | Axios | 1.7.9 |
| Real-time | socket.io-client | 4.8.1 |
| Drag and drop | `@dnd-kit/core`, `/sortable`, `/utilities` | 6.3.1 / 10.0.0 / 3.2.2 |
| QR scanning | `@zxing/browser`, `@zxing/library` | 0.1.5 / 0.21.3 |
| Date utilities | date-fns, dayjs | 4.1.0 / 1.11.20 |

> NOTE: CLAUDE.md specifies shadcn/ui + Tailwind, but the actual `apps/web/package.json` uses MUI v6. The `packages/ui` package uses shadcn-style primitives (CVA + clsx + tailwind-merge) but is not consumed by `apps/web`.

**Dev server port:** 5173

**Path alias:** `@stf/shared` resolves to `packages/shared/src/index.ts` via Vite alias in `apps/web/vite.config.js`.

## 3D Viewer

**App:** `apps/modelado-3d` — `@stf/modelado-3d`

| Concern | Library | Version |
|---------|---------|---------|
| 3D rendering | Three.js | 0.169.0 |
| Animation tweening | `@tweenjs/tween.js` | 23.1.3 |
| Build tool | Vite | 5.4.10 |

**Dev server port:** 5174. Embedded as an `<iframe>` inside the React frontend. `X-Frame-Options: ALLOWALL` set via Vite dev server headers.

## Backend

**App:** `apps/api` — `@stf/api`

| Concern | Library | Version |
|---------|---------|---------|
| HTTP framework | Express | 5.1.0 |
| Real-time | Socket.IO | 4.8.1 |
| ORM | `@prisma/client` | 5.22.0 |
| Auth tokens | jsonwebtoken | 9.0.2 |
| Password hashing | bcrypt | 5.1.1 |
| HTTP security | helmet | 8.0.0 |
| CORS | cors | 2.8.5 |
| HTTP logging | morgan | 1.10.0 |
| HTTP client (SIRH) | Axios | 1.7.9 |
| Validation | Zod | 4.1.12 |
| WhatsApp OTP | whatsapp-web.js | 1.34.6 |
| QR terminal | qrcode-terminal | 0.12.0 |
| Env loading | dotenv | 17.4.1 |

**Dev runner:** `tsx watch src/index.ts` (hot reload)
**Build:** `tsup src/index.ts --format esm,cjs --out-dir dist`
**Production start:** `node dist/index.js`
**Port:** 5101

## Database

**Engine:** MySQL 8 / MariaDB (via XAMPP in development)

**ORM:** Prisma 5.22.0 (`packages/database`)

**Schema location:** `packages/database/prisma/schema.prisma`

**Migration strategy:** `prisma migrate dev` (development), `prisma migrate deploy` (production)

**Seed:** `packages/database/prisma/seed.ts` (run with `tsx`)

**Prisma client:** Singleton pattern in `apps/api/src/config/database.ts` using `globalThis` to avoid hot-reload duplication.

**Key models:** `Usuario`, `Empleado`, `Ticket`, `HistorialTicket`, `Comentario`, `Notificacion`, `OtpToken`, `AreaEdificio`, `CatalogoRecurso`, `RecursoUnidad`, `AsignacionRecurso`, `Sesion`, `LogAcceso`, `PasoTicket`, `ProcesoDefinicion`, `PasoDefinicion`.

**Soft delete:** `activo: Boolean @default(true)` on `Ticket`, `Empleado`, `Usuario`.

**Connection:** `DATABASE_URL` env variable. Format: `mysql://user:pass@localhost:3306/siast`

## Shared Packages

| Package | Name | Purpose |
|---------|------|---------|
| `packages/shared` | `@stf/shared` | Zod schemas + TypeScript types shared between API and web |
| `packages/ui` | `@stf/ui` | Base UI primitives (CVA + clsx + tailwind-merge + React 19) |
| `packages/database` | `@stf/database` | Prisma schema, migrations, seeds, SIRH sync scripts |

`@stf/shared` exports source TypeScript directly (`src/index.ts`) — no build step. Consumers resolve it via workspace symlink.

## Monorepo

**Tool:** npm workspaces (root `package.json`, `"workspaces": ["apps/*", "packages/*"]`)

**Orchestration:** `concurrently ^9.2.1` runs all three dev servers in parallel.

**Cross-package references:**
```json
{ "@stf/shared": "*", "@stf/database": "*" }
```

**Root scripts:**
```bash
npm run dev         # kills ports, then runs api + 3d + web concurrently
npm run dev:api     # apps/api only (port 5101)
npm run dev:3d      # apps/modelado-3d only (port 5174)
npm run dev:web     # apps/web only (port 5173)
npm run build       # build all workspaces
npm run format      # prettier on entire repo
```

**Port cleanup:** `scripts/kill-ports.js` runs before `dev` to clear 5101/5173/5174.

## Dev Tooling

**Formatter:** Prettier 3.6.2 (root devDependency). Settings: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100` (per CLAUDE.md).

**Linting:** Not formally configured. `apps/api` and `apps/web` lint scripts echo "No lint configured".

**Type checking:** `tsc` via TypeScript 5.9.3 in `apps/api` and `packages/database`. Frontend (`apps/web`) is JavaScript — no tsc configured.

**Testing:** No test framework detected in any `package.json`.

---

*Stack analysis: 2026-05-06*
