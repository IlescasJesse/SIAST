# SIAST — Secretaría de Finanzas del Estado de Oaxaca

> Contexto global de Jesse cargado automáticamente desde `~/.claude/CLAUDE.md`

## Stack

Next.js + TypeScript + Tailwind CSS + shadcn/ui + Express + Three.js
Monorepo: npm workspaces (`apps/web`, `apps/api`, `packages/shared`, `packages/ui`, `packages/database`)

> ⚠️ UI: **shadcn/ui con Tailwind** — NO usar MUI en este proyecto

## Estado Actual

- Backend con mock data en memoria → roadmap: migrar a Prisma + MySQL
- Frontend funcional con datos simulados
- SIRH (`localhost:3000`) pendiente — activar con `SIRH_ENABLED=true` en `.env` del API

## Contexto de Dominio

- Sistema gubernamental — Secretaría de Finanzas, Oaxaca
- Usuarios: funcionarios del gobierno estatal
- Datos fiscales y presupuestales
- Cumplir normativas de gobierno digital mexicano

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

---

## Comandos

Desde la raíz del monorepo:

```bash
npm install          # instalar dependencias
npm run dev          # corre api + web en paralelo
npm run dev:api      # solo la API Express (puerto 3001)
npm run dev:web      # solo el frontend Next.js (puerto 3008)
npm run build        # build de todos los workspaces
npm run lint         # lint de todos los workspaces
npm run format       # prettier en todo el repo
```

Dentro de `apps/api`:

```bash
npm run dev    # tsx watch (hot reload)
npm run build  # tsup → dist/
npm run start  # node dist/index.js (producción)
```

Dentro de `packages/database`:

```bash
npm run db:migrate   # prisma migrate dev
npm run db:generate  # prisma generate
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio (puerto 5555)
```

---

## Arquitectura

Monorepo con **npm workspaces**:

```
apps/
  api/          # Express 5 + TypeScript + Prisma + Socket.IO (puerto 3001)
  web/          # Next.js App Router (puerto 3008)
packages/
  shared/       # tipos Zod SIAST: Ticket, Empleado, Rol, etc.
  ui/           # componentes base: Button, Card, Input, Table, Badge
  database/     # Prisma schema + seed + migraciones (MySQL)
```

## Puertos

| Servicio | Puerto |
|----------|--------|
| API Backend | 3001 |
| Frontend Next.js | 3008 |
| Frontend Vite (alternativo) | 5173 |
| Visor 3D | 5174 |
| Prisma Studio | 5555 |
| SIRH (externo, pendiente) | 3000 |

## Requisito: MySQL

La API requiere MySQL (MariaDB via XAMPP). Iniciar antes de `npm run dev:api`.

---

## API — Endpoints principales

```
POST /api/auth/login-rfc        ← empleados (solo RFC)
POST /api/auth/login            ← staff (usuario + contraseña)
GET  /api/auth/me

GET  /api/tickets               ← filtrado por rol automático
POST /api/tickets
GET  /api/tickets/:id
PATCH /api/tickets/:id/asignar  ← solo ADMIN
PATCH /api/tickets/:id/estado
POST /api/tickets/:id/comentarios
DELETE /api/tickets/:id

GET /api/empleados/ubicacion?rfc=XXX
GET /api/employee/location?rfc=XXX  ← alias para módulo 3D

GET /api/catalogos/categorias
GET /api/catalogos/tecnicos
GET /api/catalogos/areas
GET /api/catalogos/pisos

GET  /api/usuarios               ← solo ADMIN
POST /api/usuarios
PATCH /api/usuarios/:id
DELETE /api/usuarios/:id
```

---

## Socket.IO — Eventos

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `join:admin` | cliente → server | unirse a sala admins |
| `join:user` | cliente → server | unirse a sala personal (staff) |
| `join:empleado` | cliente → server | unirse a sala personal (empleado) |
| `ticket:nuevo` | server → admins | nuevo ticket creado |
| `ticket:asignado` | server → técnico | ticket asignado a él |
| `ticket:asignado_empleado` | server → empleado | su ticket fue asignado |
| `ticket:estado_cambiado` | server → empleado | cambio de estado |

---

## Estilo de código

Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.

---

## Notas importantes

- Empleados se autentican solo con RFC (sin contraseña).
- Staff (Admin, Técnicos, Mesa Ayuda) usan usuario + contraseña.
- Máximo 2 tickets activos por empleado simultáneamente.
- Soft delete en tickets: `activo = false` en lugar de borrado físico.
- Los packages se referencian: `@stf/shared`, `@stf/ui`, `@stf/database`.
