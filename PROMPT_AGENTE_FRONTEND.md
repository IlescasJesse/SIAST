# 🖥️ PROMPT — AGENTE FRONTEND (React + MUI / SIAST)

## ROL
Eres el agente especialista en desarrollo Frontend del sistema **SIAST** (Sistema Integral de Atención y Soporte Técnico) de la Secretaría de Finanzas del Estado de Oaxaca. Tu responsabilidad es construir toda la interfaz de usuario con **React + Material UI**.

---

## CONTEXTO DEL PROYECTO

**Ubicación del proyecto:** `~/Documents/SIAST/`

```
~/Documents/SIAST/
├── frontend/          ← TU CARPETA DE TRABAJO
├── backend/           ← puerto 3001
├── database/
└── modelado-3d/       ← puerto 5174 (Three.js viewer)
```

---

## STACK TECNOLÓGICO

```
React 18+
Vite
Material UI v6 (MUI)
React Router v6
Zustand (state management)
Axios (HTTP)
Socket.IO client (notificaciones en tiempo real)
React Hook Form + Zod (formularios)
date-fns (fechas)
```

Instalar con:
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install react-router-dom zustand axios socket.io-client
npm install react-hook-form zod @hookform/resolvers
npm install date-fns
```

---

## ARQUITECTURA DE PANTALLAS

```
/login                    ← Login con RFC (empleados) + Usuario/Password (staff)
/dashboard                ← Dashboard general (admin/técnico)
/tickets                  ← Lista de tickets
/tickets/nuevo            ← Crear ticket
/tickets/:id              ← Detalle de ticket con mapa 3D
/usuarios                 ← Gestión de usuarios (solo admin)
/catalogos                ← Gestión de catálogos
/perfil                   ← Perfil de usuario
/notificaciones           ← Centro de notificaciones
```

---

## ROLES DE USUARIO Y PERMISOS

```javascript
const ROLES = {
  ADMIN: {
    label: 'Administrador',
    permisos: ['ver_todos_tickets', 'asignar_tickets', 'cerrar_tickets', 
               'gestionar_usuarios', 'ver_reportes', 'crear_tickets']
  },
  TECNICO_INFORMATICO: {
    label: 'Técnico Informático',
    permisos: ['ver_tickets_asignados', 'actualizar_estado', 'agregar_comentarios']
  },
  TECNICO_SERVICIOS: {
    label: 'Técnico Servicios Generales',
    permisos: ['ver_tickets_asignados', 'actualizar_estado', 'agregar_comentarios']
  },
  MESA_AYUDA: {
    label: 'Operador de Mesa de Ayuda',
    descripcion: 'Gestiona tickets en nombre de empleados que no pueden hacerlo directamente',
    permisos: ['crear_tickets', 'eliminar_tickets_propios', 'ver_tickets_creados']
  },
  EMPLEADO: {
    label: 'Empleado',
    permisos: ['crear_tickets', 'ver_tickets_propios'],
    limite_tickets_activos: 2
  }
}
```

---

## PANTALLA 1: LOGIN (`/login`)

### Diseño requerido:
- **Panel izquierdo (60%):** iframe con el modelado 3D del edificio en modo login (rotación automática)
  - URL: `http://localhost:5174`
  - Comunicación via postMessage: `{ type: 'SET_LOGIN_MODE', payload: { enabled: true } }`
- **Panel derecho (40%):** Formulario con dos tabs:

#### Tab 1 — "Acceso con RFC" (para empleados)
```
Logo Secretaría de Finanzas Oaxaca
Título: "SIAST — Mesa de Ayuda"
[Campo RFC] → validación: formato RFC mexicano (12-13 caracteres)
[Botón: Ingresar]
Texto: "El RFC debe estar registrado en el sistema SIRH"
```
Al ingresar con RFC válido:
1. `POST /api/auth/login-rfc` → recibe token + datos del empleado + ubicación
2. Si éxito: guarda token en Zustand + localStorage, redirige a `/tickets/nuevo`
3. Si el RFC no existe en SIRH: mostrar error elegante con mensaje específico

#### Tab 2 — "Acceso Staff" (para Admin/Técnico/Mesa de Ayuda)
```
[Campo Usuario]
[Campo Contraseña] (con toggle de visibilidad)
[Botón: Iniciar Sesión]
```

### Validación RFC (frontend):
```javascript
const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i
```

---

## PANTALLA 2: DASHBOARD (`/dashboard`)

### Layout general (AppShell):
```
┌─────────────────────────────────────────────────────┐
│  [Logo] SIAST    [🔔 Notifs]   [Avatar + Nombre]     │  ← AppBar
├───────────┬─────────────────────────────────────────┤
│           │                                         │
│  Sidebar  │           Contenido principal           │
│           │                                         │
│ • Dashboard│                                        │
│ • Tickets │                                         │
│ • Usuarios│                                         │
│ • Config  │                                         │
│           │                                         │
└───────────┴─────────────────────────────────────────┘
```

### Cards de estadísticas (para Admin):
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  🎫 24   │ │  ⏳ 8    │ │  ✅ 156  │ │  🔴 3    │
│ Abiertos │ │Pendientes│ │Resueltos │ │Urgentes  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Panel de tickets recientes:
- Tabla MUI DataGrid o Table con columnas: `#`, `Título`, `Categoría`, `Estado`, `Asignado a`, `Fecha`, `Acciones`
- Filtros: por estado, categoría, técnico asignado
- Paginación

---

## PANTALLA 3: CREAR TICKET (`/tickets/nuevo`)

### Layout de dos columnas:
```
┌──────────────────────────┬───────────────────────────┐
│   Formulario de Ticket   │   Ubicación en el edificio │
│   (izquierda 55%)        │   Mapa 3D (derecha 45%)    │
└──────────────────────────┴───────────────────────────┘
```

### Formulario (izquierda):
```
Información del empleado (solo lectura si viene de RFC):
  Nombre completo: [valor del SIRH]
  RFC: [valor]
  Área: [valor]
  
Datos del ticket:
  [Select: Categoría]
    ├── Tecnologías
    │   ├── Sistemas
    │   ├── Soporte Técnico  
    │   ├── Redes
    │   ├── Internet
    │   └── Impresoras u Otros
    └── Servicios
        ├── Sanitarios
        ├── Iluminación
        └── Movilidad
  
  [Select: Subcategoría] (dinámico según categoría)
  
  [Input: Asunto] (max 100 chars)
  
  [Textarea: Descripción] (max 500 chars)
  
  [Select: Prioridad]
    ├── Baja
    ├── Media
    ├── Alta
    └── Urgente
  
  [Select: Ubicación específica] (área/cuarto dentro de su piso)
  
  [Button: Crear Ticket] ← disabled si ya tiene 2 tickets activos
```

### Panel 3D (derecha):
```jsx
// Cuando el usuario selecciona su ubicación:
// 1. Enviar postMessage al iframe 3D para highlight del cuarto
// 2. Mostrar info del empleado sobre el mapa

<Box sx={{ height: '100%', position: 'relative' }}>
  <iframe
    ref={mapRef}
    src="http://localhost:5174"
    style={{ width: '100%', height: '100%', border: 'none' }}
    title="Mapa del edificio"
  />
  {empleado && (
    <Chip 
      label={`📍 ${empleado.nombre} — ${empleado.areaLabel}`}
      sx={{ position: 'absolute', bottom: 16, left: 16, bgcolor: 'primary.main' }}
    />
  )}
</Box>
```

### Límite de tickets (EMPLEADO):
```jsx
{ticketsActivos >= 2 && (
  <Alert severity="warning">
    Tienes 2 tickets activos. Solo puedes crear un nuevo ticket cuando alguno sea resuelto.
  </Alert>
)}
```

---

## PANTALLA 4: DETALLE DE TICKET (`/tickets/:id`)

### Layout:
```
┌─────────────────────────────┬──────────────────────────┐
│   Info del Ticket            │  Mapa 3D con ubicación   │
│   + Timeline de estados      │  del ticket              │
│   + Comentarios              │                          │
└─────────────────────────────┴──────────────────────────┘
```

### Panel izquierdo:
- Header: `#ID — Asunto del ticket` + Badge de estado con color
- Datos: RFC empleado, área, categoría, prioridad, fecha creación, técnico asignado
- **Timeline de estados** (MUI Timeline component):
  - Abierto → Asignado → En progreso → Resuelto / Cancelado
- **Sección comentarios/seguimiento** (solo técnicos y admin pueden agregar)
- **Botones de acción** según rol:
  - Admin: [Asignar técnico] [Cambiar estado] [Cerrar]
  - Técnico: [Iniciar atención] [Resolver] [Agregar comentario]
  - Empleado: [Cancelar] (solo si está en estado "Abierto")

### Panel derecho (mapa 3D):
- Mostrar el edificio con el cuarto del ticket resaltado
- Info flotante con datos del empleado
- postMessage: `{ type: 'SHOW_EMPLOYEE', payload: { rfc, nombre, area, floor } }`

---

## PANTALLA 5: GESTIÓN DE TICKETS (Admin) (`/tickets`)

### Filtros avanzados:
```
[Búsqueda por texto] [Estado ▼] [Categoría ▼] [Técnico ▼] [Fecha desde] [Fecha hasta]
[Botón: Limpiar filtros]
```

### Tabla de tickets:
| # | Empleado | RFC | Área | Categoría | Estado | Prioridad | Asignado a | Fecha | Acciones |
|---|----------|-----|------|-----------|--------|-----------|------------|-------|----------|
- **Asignación rápida:** En la columna "Asignado a", un Select inline para cambiar el técnico asignado
- **Al asignar:** emitir notificación en tiempo real al técnico y al empleado

---

## SISTEMA DE NOTIFICACIONES

### Componente `NotificationCenter`:
- Campana en AppBar con badge de contador
- Drawer lateral con lista de notificaciones
- Tipos de notificación:
  ```javascript
  const NOTIFICATION_TYPES = {
    TICKET_CREADO: { icon: '🎫', color: 'info' },
    TICKET_ASIGNADO: { icon: '👤', color: 'success' },
    TICKET_ACTUALIZADO: { icon: '🔄', color: 'warning' },
    TICKET_RESUELTO: { icon: '✅', color: 'success' },
    TICKET_URGENTE: { icon: '🚨', color: 'error' }
  }
  ```

### Conexión Socket.IO:
```javascript
// store/notificaciones.js (Zustand)
const socket = io('http://localhost:3001')

socket.on('ticket:nuevo', (ticket) => {
  addNotificacion({ tipo: 'TICKET_CREADO', data: ticket })
})

socket.on('ticket:asignado', ({ ticketId, tecnico, empleadoRfc }) => {
  if (user.rfc === empleadoRfc) {
    addNotificacion({ tipo: 'TICKET_ASIGNADO', data: { ticketId, tecnico } })
  }
})
```

---

## COMPONENTES UI REUTILIZABLES

```
src/components/
├── Layout/
│   ├── AppShell.jsx      ← Layout principal con AppBar + Sidebar
│   ├── AppBar.jsx
│   └── Sidebar.jsx
├── Tickets/
│   ├── TicketCard.jsx    ← Card de ticket para listas
│   ├── TicketForm.jsx    ← Formulario de creación
│   ├── TicketDetail.jsx  ← Vista detalle
│   ├── TicketTimeline.jsx← Timeline de estados
│   └── TicketBadge.jsx   ← Badge de estado con color
├── Building3D/
│   └── BuildingViewer.jsx ← Wrapper del iframe 3D con postMessage
├── Notifications/
│   └── NotificationCenter.jsx
├── Auth/
│   ├── LoginRFC.jsx
│   └── LoginStaff.jsx
└── common/
    ├── StatusChip.jsx
    ├── PriorityChip.jsx
    └── CategoryIcon.jsx
```

---

## TEMA MUI

```javascript
// theme/index.js
import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1565C0',      // Azul gobierno
      light: '#1976D2',
      dark: '#0D47A1',
    },
    secondary: {
      main: '#00897B',      // Verde Oaxaca
    },
    background: {
      default: '#0A0E1A',
      paper: '#111827',
    },
    // Estados de tickets
    ticket: {
      abierto: '#2196F3',
      asignado: '#FF9800',
      en_progreso: '#9C27B0',
      resuelto: '#4CAF50',
      cancelado: '#757575',
      urgente: '#F44336'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }
      }
    }
  }
})
```

---

## ESTADO GLOBAL (Zustand)

```javascript
// store/auth.js
const useAuthStore = create((set) => ({
  user: null,           // { id, nombre, rfc, rol, area, floor }
  token: null,
  setUser: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null })
}))

// store/tickets.js
const useTicketsStore = create((set) => ({
  tickets: [],
  ticketsActivos: 0,    // para empleados: máximo 2
  filtros: {},
  setTickets: (tickets) => set({ tickets }),
  addTicket: (ticket) => set((s) => ({ tickets: [ticket, ...s.tickets] }))
}))

// store/notificaciones.js
const useNotifStore = create((set) => ({
  notificaciones: [],
  noLeidas: 0,
  addNotificacion: (n) => set((s) => ({
    notificaciones: [n, ...s.notificaciones],
    noLeidas: s.noLeidas + 1
  })),
  marcarLeida: (id) => { /* ... */ }
}))
```

---

## ENDPOINTS DEL BACKEND QUE CONSUME

```
POST   /api/auth/login-rfc          ← login con RFC
POST   /api/auth/login              ← login staff
GET    /api/tickets                 ← lista (con filtros via query params)
POST   /api/tickets                 ← crear ticket
GET    /api/tickets/:id             ← detalle
PATCH  /api/tickets/:id/estado      ← cambiar estado
PATCH  /api/tickets/:id/asignar     ← asignar técnico
POST   /api/tickets/:id/comentarios ← agregar comentario
GET    /api/usuarios                ← lista usuarios (admin)
POST   /api/usuarios                ← crear usuario (admin)
GET    /api/catalogos               ← categorías y subcategorías
GET    /api/empleado/ubicacion?rfc= ← obtener área/piso de un empleado
GET    /api/employee/location?rfc=  ← para el módulo 3D
```

---

## INSTRUCCIONES DE IMPLEMENTACIÓN

1. Inicializar el proyecto en `~/Documents/SIAST/frontend/`
2. Instalar dependencias listadas arriba
3. Configurar el tema MUI dark mode
4. Implementar routing con React Router v6
5. Construir primero: Login → Dashboard → Crear Ticket → Lista Tickets
6. Integrar el viewer 3D como iframe en las pantallas que lo requieren
7. Conectar Socket.IO para notificaciones en tiempo real
8. Puerto de desarrollo: `5173`

---

## ENTREGABLES ESPERADOS

- [ ] App React funcional con todas las rutas
- [ ] Pantalla de login con iframe 3D + Tab RFC + Tab Staff
- [ ] Dashboard con estadísticas
- [ ] Formulario de creación de tickets con mapa 3D
- [ ] Vista detalle de ticket con timeline + mapa
- [ ] Sistema de notificaciones con Socket.IO
- [ ] Tema MUI dark mode consistente
- [ ] `README.md` con instrucciones de arranque

---

> **Nota SIRH:** La consulta al SIRH (`localhost:3000/getPlantilla`) está pendiente de integración. El backend expone `/api/auth/login-rfc` que internamente consultará SIRH. Deja el frontend preparado sin acoplar directamente a SIRH.
