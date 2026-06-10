# SIAST — Secretaría de Finanzas del Estado de Oaxaca

> Contexto global de Jesse cargado automáticamente desde `~/.claude/CLAUDE.md`

## Stack

Express + TypeScript + Prisma + Socket.IO (API) + Vite + React + MUI v6 (Web) + Three.js (3D)
Monorepo: npm workspaces (`apps/web`, `apps/api`, `apps/modelado-3d`, `packages/shared`, `packages/ui`, `packages/database`)

> ⚠️ UI: **MUI v6** en `apps/web` — `packages/ui` tiene componentes shadcn/ui pero NO se usan en páginas

## Contexto de Dominio

- Sistema gubernamental — Secretaría de Finanzas, Oaxaca
- Usuarios: funcionarios del gobierno estatal
- Datos fiscales y presupuestales
- Cumplir normativas de gobierno digital mexicano

## Notas importantes

- Empleados se autentican solo con RFC (sin contraseña).
- Staff (Admin, Técnicos, Mesa Ayuda) usan usuario + contraseña.
- Máximo 2 tickets activos por empleado simultáneamente.
- Soft delete en tickets: `activo = false` en lugar de borrado físico.
- Los packages se referencian: `@stf/shared`, `@stf/ui`, `@stf/database`.

## Al agregar features

- Verificar si la feature depende del mock o necesita DB real
- Si requiere DB: implementar schema Prisma primero
- Mantener tipos en `packages/shared`
- shadcn/ui para todos los componentes nuevos

---

## Agentes disponibles

Usa `/agent` para invocar un agente especializado según la tarea:

| Agente | Invocar con | Cuándo usarlo |
|--------|-------------|---------------|
| `modelado-3d` | `/agent modelado-3d` | Three.js, GLB, raycasting, pins, visor edificio |
| `senior-programacion` | `/agent senior-programacion` | Arquitectura, features fullstack, revisión de código |
| `analizador-db` | `/agent analizador-db` | Esquema DB, migraciones, queries, análisis de datos |
| `revisor-seguridad` | `/agent revisor-seguridad` | Auditoría de seguridad: OTP, JWT, CORS, roles, soft delete — antes de deploy o tras tocar auth |
| `orquestador` | `/agent orquestador` | Inicio de sesión o alcance no claro — mapa de alcance + plan de delegación |

---

## Arquitectura

Monorepo con **npm workspaces**:

```
apps/
  api/          # Express 5 + TypeScript + Prisma + Socket.IO (puerto 5101)
  web/          # Vite + React (puerto 5173)
packages/
  shared/       # tipos Zod SIAST: Ticket, Empleado, Rol, etc.
  ui/           # componentes base: Button, Card, Input, Table, Badge
  database/     # Prisma schema + seed + migraciones (MySQL)
```

## Requisito: MySQL

La API requiere MySQL (MariaDB via XAMPP). Iniciar antes de `npm run dev:api`.
Puertos: API 5101, Web 5173, Visor 3D 5174, Prisma Studio 5555.

---

## Estilo de código

Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.

---

## Comandos

Desde la raíz del monorepo:

```bash
npm install          # instalar dependencias
npm run dev          # corre api + web en paralelo
npm run dev:api      # solo la API Express (puerto 5101)
npm run dev:web      # solo el frontend Vite (puerto 5173)
npm run build        # build de todos los workspaces
npm run lint         # lint de todos los workspaces
npm run format       # prettier en todo el repo
```

Dentro de `packages/database`:

```bash
npm run db:migrate   # prisma migrate dev
npm run db:generate  # prisma generate
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio (puerto 5555)
```

---

## Estado Actual

- Backend con mock data en memoria → roadmap: migrar a Prisma + MySQL
- Frontend funcional con datos simulados
- SIRH (`localhost:3000`) pendiente — activar con `SIRH_ENABLED=true` en `.env` del API
