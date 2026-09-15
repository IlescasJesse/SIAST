# SIAST — Sistema Integral de Atención y Soporte Técnico

Sistema de tickets, gestión de recursos materiales y visualización 3D del edificio para la
**Secretaría de Finanzas del Gobierno del Estado de Oaxaca** (Edificio Saúl Martínez).

> Para reglas de dominio, convenciones de código y contexto pensado para agentes de IA, ver
> [`CLAUDE.md`](./CLAUDE.md). Este README es la puerta de entrada para cualquier desarrollador.

## Stack

| Capa          | Tecnología                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| API           | Express 5 + TypeScript + Prisma + Socket.IO                                   |
| Web           | Vite + React + Material UI (MUI) v6 + Zustand                                 |
| Visor 3D      | Three.js (vanilla JS)                                                         |
| Base de datos | MySQL / MariaDB, vía Prisma ORM                                               |
| Autenticación | JWT — empleados por RFC + OTP (WhatsApp/correo), staff por usuario/contraseña |

Monorepo con **npm workspaces**. No usa Docker ni Kubernetes — el deploy es a un VPS con PM2.

## Estructura

```
apps/
  api/            # Express + Prisma + Socket.IO — puerto 5101
  web/            # Vite + React — puerto 5173
  modelado-3d/    # Visor 3D del edificio (Three.js) — puerto 5174
packages/
  shared/         # Tipos y esquemas Zod compartidos (Ticket, Empleado, Rol, ...)
  ui/             # Componentes base (no usados actualmente en apps/web, que usa MUI directo)
  database/       # Schema Prisma, migraciones y seed — ver packages/database/README.md
```

## Requisitos

- Node.js 18+
- MySQL 8.0+ / MariaDB 10.4+ (XAMPP funciona bien en desarrollo)

## Puesta en marcha (desarrollo)

```bash
# 1. Instalar dependencias de todo el monorepo
npm install

# 2. Configurar la base de datos (ver packages/database/README.md para el detalle)
cd packages/database
cp .env.example .env   # si no existe, crear con DATABASE_URL
npm run db:generate
npm run db:migrate
npm run db:seed        # crea ADMIN + un usuario de prueba por cada rol de staff
cd ../..

# 3. Configurar la API
cd apps/api
cp .env.example .env   # revisar JWT_SECRET, CORS_ORIGINS, DATABASE_URL, etc.
cd ../..

# 4. Levantar todo
npm run dev             # API + Web en paralelo
# o por separado:
npm run dev:api         # solo API   (puerto 5101)
npm run dev:web         # solo Web   (puerto 5173)
npm run dev:3d          # solo Visor 3D (puerto 5174)
```

## Comandos principales

Desde la raíz del monorepo:

```bash
npm install          # instalar dependencias
npm run dev           # corre api + web en paralelo (mata puertos ocupados primero)
npm run build         # build de producción de todos los workspaces
npm run lint          # ESLint sobre los 6 workspaces (raíz: eslint.config.js)
npm run format         # Prettier en todo el repo
```

Dentro de `packages/database`:

```bash
npm run db:migrate    # prisma migrate dev (desarrollo, interactivo)
npm run db:generate   # prisma generate
npm run db:seed       # tsx prisma/seed.ts
npm run db:studio     # prisma studio — http://localhost:5555
```

## Autenticación

- **Empleados**: login con RFC + código OTP (WhatsApp por defecto, con correo institucional
  como canal alterno). Sin contraseña.
- **Staff** (Admin, Técnicos, Mesa de Ayuda, Responsables, Gestores): usuario + contraseña.
- 20 roles distintos — ver `enum Rol` en `packages/database/prisma/schema.prisma`.

## Deploy

Manual, a un VPS vía PM2 (sin CI/CD configurado todavía):

```bash
git pull origin main
npm install
npm run db:generate -w packages/database
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm run build -w apps/api
npm run build -w apps/web
pm2 restart <nombre-del-proceso>
```

## Estado del proyecto

Ver [`CLAUDE.md`](./CLAUDE.md#estado-actual-actualizado-2026-09-14) y
[`.planning/STATE.md`](./.planning/STATE.md) para el estado detallado de cada fase y el
seguimiento del feedback de staff.

## Documentos históricos

Los archivos `PROMPT_AGENTE_*.md` y `SIAST_GUIA_AGENTES.md` en la raíz fueron los prompts
originales usados para arrancar el proyecto (describen una estructura de carpetas distinta a
la actual). Están **superados** por `.claude/agents/*.md` (las definiciones reales de los
agentes disponibles hoy) y por este README — se conservan solo como referencia histórica.
