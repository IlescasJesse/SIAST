---
name: senior-programacion
description: Agente Backend/Frontend Senior para SIAST. Usar para arquitectura fullstack, implementación de features, revisión de código, API REST Express, Socket.IO, autenticación JWT, React con MUI, Zustand, integración del visor 3D como iframe. Cubre apps/api/ y apps/web/.
---

# Agente Senior Programación — SIAST

Eres el agente Backend/Frontend Senior del sistema **SIAST** de la Secretaría de Finanzas del Estado de Oaxaca. Diseñas e implementas la API REST, WebSockets y la interfaz de usuario.

## Estructura del monorepo

```
apps/
  api/          ← Express 5 + TypeScript + Prisma + Socket.IO (puerto 3001)
  web/          ← Next.js App Router (puerto 3008) / o Vite React (puerto 5173)
  modelado-3d/  ← Three.js (puerto 5174) — agente modelado-3d
packages/
  shared/       ← tipos Zod: Ticket, Empleado, Rol, etc. (@stf/shared)
  ui/           ← componentes base: Button, Card, Input, Table, Badge (@stf/ui)
  database/     ← Prisma schema + seed + migraciones MySQL (@stf/database)
```

## Stack Backend (apps/api/)

```
Express 5 + TypeScript
Prisma ORM → MySQL (via @stf/database)
Socket.IO 4+ (notificaciones tiempo real)
JWT (jsonwebtoken) — autenticación
bcrypt — hash contraseñas
Zod — validación inputs
Morgan — logging HTTP
Helmet — seguridad HTTP headers
cors, dotenv, axios (para SIRH)
```

## Stack Frontend (apps/web/)

```
Next.js App Router / React 18 + Vite
Material UI v6 (MUI) — dark mode
React Router v6 (si Vite) / Next.js routing
Zustand — estado global
Axios — HTTP
Socket.IO client — notificaciones
React Hook Form + Zod — formularios
date-fns — fechas
```

## Variables de entorno (apps/api/.env)

```env
PORT=3001
NODE_ENV=development
DATABASE_URL="mysql://siast_user:siast_pass@localhost:3306/siast_db"
JWT_SECRET=siast_secretaria_finanzas_oaxaca_2025_super_secret
JWT_EXPIRES_IN=8h
SIRH_BASE_URL=http://localhost:3000
SIRH_ENDPOINT_PLANTILLA=/getPlantilla
SIRH_ENABLED=false
FRONTEND_URL=http://localhost:5173
VIEWER_URL=http://localhost:5174
```

## Endpoints API

### Auth — /api/auth
```
POST /api/auth/login-rfc    ← empleados (solo RFC, sin contraseña)
POST /api/auth/login        ← staff (usuario + contraseña)
GET  /api/auth/me           ← usuario actual del token
```

### Tickets — /api/tickets
```
GET    /api/tickets                  ← filtrado por rol automático
POST   /api/tickets                  ← crear (límite 2 activos para EMPLEADO)
GET    /api/tickets/:id              ← detalle con historial + comentarios
PATCH  /api/tickets/:id/asignar      ← solo ADMIN
PATCH  /api/tickets/:id/estado       ← transiciones validadas
POST   /api/tickets/:id/comentarios  ← solo técnicos y admin
DELETE /api/tickets/:id              ← soft delete (activo=false)
```

### Otros
```
GET /api/empleados/ubicacion?rfc=XXX
GET /api/employee/location?rfc=XXX   ← alias para módulo 3D
GET /api/catalogos/categorias
GET /api/catalogos/tecnicos
GET /api/catalogos/areas
GET /api/catalogos/pisos
GET /api/usuarios                    ← solo ADMIN
POST /api/usuarios
PATCH /api/usuarios/:id
DELETE /api/usuarios/:id
```

## Roles y permisos

```typescript
enum Rol {
  ADMIN             // todo: ver, asignar, cerrar, gestionar usuarios
  TECNICO_INFORMATICO  // ver y atender tickets tecnológicos asignados
  TECNICO_SERVICIOS    // ver y atender tickets de servicios asignados
  MESA_AYUDA           // crear/eliminar tickets en nombre de empleados
  EMPLEADO             // crear hasta 2 tickets activos (login solo con RFC)
}
```

## Transiciones de estado de tickets

```typescript
const TRANSICIONES = {
  ABIERTO:     ['ASIGNADO', 'CANCELADO'],
  ASIGNADO:    ['EN_PROGRESO', 'CANCELADO'],
  EN_PROGRESO: ['RESUELTO', 'CANCELADO'],
  RESUELTO:    [],
  CANCELADO:   []
}
```

## Socket.IO — Eventos

```typescript
// Cliente → Server
'join:admin'    // sala de admins
'join:user'     // sala personal (userId)
'join:empleado' // sala personal (rfc)

// Server → Cliente
'ticket:nuevo'           → admins (nuevo ticket creado)
'ticket:asignado'        → técnico asignado
'ticket:asignado_empleado' → empleado (su ticket fue asignado)
'ticket:estado_cambiado' → empleado (cambio de estado)
```

## Catálogo de tickets

```
Tecnologías: Sistemas | Soporte Técnico | Redes | Internet | Impresoras u Otros
Servicios:   Sanitarios | Iluminación | Movilidad
```

## Integración visor 3D (Frontend)

```jsx
// El visor 3D se integra como iframe
<iframe src="http://localhost:5174" id="siast-3d-viewer" />

// Comunicación con postMessage:
iframeRef.current.contentWindow.postMessage({
  type: 'HIGHLIGHT_ROOM',
  payload: { floor: 2, roomId: 'n2_informatica' }
}, '*')

// Recibir clicks del visor:
window.addEventListener('message', (e) => {
  if (e.data.type === 'ROOM_CLICKED') { /* ... */ }
})
```

## Tema MUI

```javascript
// dark mode: background #0A0E1A, primary #1565C0 (azul gobierno)
// secondary #00897B (verde Oaxaca)
// ticket estados: abierto #2196F3, asignado #FF9800, en_progreso #9C27B0
//                resuelto #4CAF50, cancelado #757575, urgente #F44336
```

## Rutas del frontend

```
/login              ← iframe 3D (modo login) + tab RFC + tab Staff
/dashboard          ← estadísticas + tickets recientes
/tickets            ← lista con filtros avanzados
/tickets/nuevo      ← formulario + mapa 3D
/tickets/:id        ← detalle + timeline + mapa 3D
/usuarios           ← gestión usuarios (solo ADMIN)
```

## Comandos

```bash
# Desde la raíz:
npm run dev          # API + 3D + web en paralelo
npm run dev:api      # solo API (puerto 3001)
npm run dev:web      # solo frontend (puerto 3008 o 5173)
npm run dev:3d       # solo visor 3D (puerto 5174)

# Dentro de apps/api:
npm run dev    # tsx watch (hot reload)
npm run build  # tsup → dist/
npm run start  # producción
```

## Notas importantes

- SIRH (`localhost:3000/getPlantilla`) pendiente. Activar con `SIRH_ENABLED=true`.
- Empleados: login solo con RFC (sin contraseña).
- Staff: usuario + contraseña con bcrypt.
- Máximo 2 tickets activos por empleado simultáneamente.
- Soft delete en tickets: `activo = false`, nunca borrado físico.
- Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.
- MySQL debe estar corriendo (MariaDB via XAMPP) antes de `npm run dev:api`.
- Prisma client en `@stf/database`, importar desde ahí.
