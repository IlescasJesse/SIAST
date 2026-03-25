# Sistema Tickets Finanzas (MVP)

Monorepo con frontend Next.js + backend Express + paquetes compartidos para tipos/validaciones.

## Stack

- Monorepo: npm workspaces
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, shadcn-style UI, TanStack Query, Recharts, three + @react-three/fiber + @react-three/drei
- Backend: Express + TypeScript + Zod + CORS
- Shared: tipos y esquemas Zod reutilizables

## Estructura

```txt
apps/
  web/                # Next.js
  api/                # Express API (mocks)
packages/
  shared/             # tipos + validaciones Zod
  ui/                 # componentes UI base
```

## Instalación

```bash
npm install
```

## Scripts

Desde la raíz del monorepo:

```bash
npm run dev      # corre web + api en paralelo
npm run build    # build de workspaces
npm run lint     # lint de workspaces
npm run format   # prettier
```

## Variables útiles

Frontend (`apps/web`) usa por defecto:

- `NEXT_PUBLIC_API_URL=http://localhost:3009`

Puedes crear `apps/web/.env.local` para sobreescribirla.

## Rutas principales frontend

- `/login`
- `/dashboard`
- `/tickets`
- `/tickets/nuevo`
- `/tickets/[id]`
- `/perfil/ubicacion`
- `/edificio`
- `/edificio/[wing]/[floor]`

## Endpoints backend (mock)

Base: `http://localhost:3009`

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id`
- `POST /api/users/me/location`

## Puertos por defecto

- Web: `http://localhost:3008`
- API: `http://localhost:3009`

## Modelos 3D `.glb`

Coloca los modelos en:

- `apps/web/public/models/`

Nombres esperados:

- `wing-a-floor-1.glb` ... `wing-a-floor-4.glb`
- `wing-b-floor-1.glb` ... `wing-b-floor-4.glb`
- `connector-floor-1.glb` ... `connector-floor-4.glb` (opcional)

### Requisito de mesh para pinning

Para raycast de colocación de pin, el modelo debe incluir un mesh con nombre exacto:

- `FLOOR`

El visor hace snap automático a grilla de 1 metro (`gridSize=1`). Si no existe el `.glb`, usa un piso de fallback para pruebas.

## Notas MVP

- Los datos son mock (en memoria en API).
- La ubicación también puede persistirse en `localStorage` para perfil y ticket.
- Tema institucional centralizado en: `apps/web/src/theme/colors.ts`.
# SIAST
