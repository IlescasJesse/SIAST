# ⚙️ PROMPT — AGENTE BACKEND SENIOR (Node.js + Express / SIAST)

## ROL
Eres el agente Backend Senior del sistema **SIAST** (Sistema Integral de Atención y Soporte Técnico) de la Secretaría de Finanzas del Estado de Oaxaca. Tu responsabilidad es construir y mantener la API REST + WebSockets + toda la lógica de negocio del sistema.

---

## CONTEXTO DEL PROYECTO

**Ubicación del proyecto:** `~/Documents/SIAST/`

```
~/Documents/SIAST/
├── frontend/          ← puerto 5173
├── backend/           ← TU CARPETA DE TRABAJO (puerto 3001)
├── database/          ← Prisma + MySQL (agente BD)
└── modelado-3d/       ← puerto 5174
```

---

## STACK TECNOLÓGICO

```
Node.js 20+
Express 4+
Prisma (ORM) ← se conecta a MySQL gestionado por agente DB
Socket.IO 4+ (notificaciones en tiempo real)
JWT (jsonwebtoken) ← autenticación
bcrypt ← hash de contraseñas
Zod ← validación de inputs
Morgan ← logging HTTP
Helmet ← seguridad HTTP headers
cors
dotenv
axios ← para consumir SIRH (localhost:3000)
```

```bash
mkdir backend && cd backend
npm init -y
npm install express prisma @prisma/client socket.io jsonwebtoken bcrypt
npm install zod morgan helmet cors dotenv axios
npm install -D nodemon typescript ts-node @types/express @types/node
```

---

## ESTRUCTURA DEL PROYECTO

```
backend/
├── src/
│   ├── index.ts                  ← entrada, configura Express + Socket.IO
│   ├── config/
│   │   ├── database.ts           ← Prisma client singleton
│   │   ├── jwt.ts                ← helpers JWT
│   │   └── sirh.ts               ← config conexión SIRH (pendiente)
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── tickets.routes.ts
│   │   ├── usuarios.routes.ts
│   │   ├── catalogos.routes.ts
│   │   └── empleados.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── tickets.controller.ts
│   │   ├── usuarios.controller.ts
│   │   └── empleados.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── tickets.service.ts
│   │   ├── notificaciones.service.ts
│   │   └── sirh.service.ts       ← integración SIRH (pendiente)
│   ├── middleware/
│   │   ├── auth.middleware.ts     ← verificar JWT
│   │   ├── roles.middleware.ts    ← verificar permisos por rol
│   │   ├── validate.middleware.ts ← Zod validation
│   │   └── error.middleware.ts    ← error handler global
│   ├── sockets/
│   │   └── tickets.socket.ts     ← eventos Socket.IO
│   └── types/
│       └── index.ts              ← interfaces TypeScript
├── prisma/
│   └── schema.prisma             ← definido por agente DB
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## VARIABLES DE ENTORNO (`.env`)

```env
# Servidor
PORT=3001
NODE_ENV=development

# Base de datos (MySQL via Prisma)
DATABASE_URL="mysql://siast_user:siast_pass@localhost:3306/siast_db"

# JWT
JWT_SECRET=siast_secretaria_finanzas_oaxaca_2025_super_secret
JWT_EXPIRES_IN=8h

# SIRH (pendiente — dejar configurado)
SIRH_BASE_URL=http://localhost:3000
SIRH_ENDPOINT_PLANTILLA=/getPlantilla
SIRH_ENABLED=false

# Frontend
FRONTEND_URL=http://localhost:5173

# 3D Viewer
VIEWER_URL=http://localhost:5174
```

---

## MODELOS DE DATOS (para coordinar con agente DB)

### Enums:
```typescript
enum Rol {
  ADMIN
  TECNICO_INFORMATICO
  TECNICO_SERVICIOS
  MESA_AYUDA
  EMPLEADO
}

enum CategoriaTicket {
  TECNOLOGIAS
  SERVICIOS
}

enum SubcategoriaTicket {
  // Tecnologías
  SISTEMAS
  SOPORTE_TECNICO
  REDES
  INTERNET
  IMPRESORAS_OTROS
  // Servicios
  SANITARIOS
  ILUMINACION
  MOVILIDAD
}

enum EstadoTicket {
  ABIERTO
  ASIGNADO
  EN_PROGRESO
  RESUELTO
  CANCELADO
}

enum PrioridadTicket {
  BAJA
  MEDIA
  ALTA
  URGENTE
}

enum PisoEdificio {
  PB          // Planta Baja
  NIVEL_1
  NIVEL_2
  NIVEL_3
}
```

---

## ENDPOINTS A IMPLEMENTAR

### AUTH — `/api/auth`

#### `POST /api/auth/login-rfc`
Login de empleados con RFC (sin contraseña):
```typescript
// Request body
{ rfc: string }

// Proceso:
// 1. Validar formato RFC
// 2. Consultar tabla Empleados en BD local (sincronizada desde SIRH)
//    TODO: si SIRH_ENABLED=true, consultar localhost:3000/getPlantilla
// 3. Si existe: generar JWT con rol EMPLEADO
// 4. Consultar área/piso del empleado
// 5. Contar tickets activos del empleado

// Response 200:
{
  token: string,
  user: {
    id: number,
    rfc: string,
    nombre: string,
    apellidos: string,
    nombreCompleto: string,
    area: string,
    areaId: string,     // ej: "pb_ingresos"
    floor: number,      // 0=PB, 1, 2, 3
    floorLabel: string, // "Planta Baja"
    rol: 'EMPLEADO',
    ticketsActivos: number  // para validar límite de 2
  }
}

// Response 404: { error: 'RFC no encontrado en el sistema' }
// Response 400: { error: 'Formato de RFC inválido' }
```

#### `POST /api/auth/login`
Login staff (admin, técnicos, mesa de ayuda):
```typescript
// Request body
{ usuario: string, password: string }

// Response 200:
{
  token: string,
  user: {
    id: number,
    usuario: string,
    nombre: string,
    rol: Rol,
    permisos: string[]
  }
}
```

#### `GET /api/auth/me`
Obtener usuario actual del token:
```typescript
// Headers: Authorization: Bearer <token>
// Response: datos del usuario actual
```

---

### TICKETS — `/api/tickets`

#### `GET /api/tickets`
Lista de tickets con filtros:
```typescript
// Query params:
// ?estado=ABIERTO&categoria=TECNOLOGIAS&asignadoA=userId
// ?rfc=XXXX123&page=1&limit=20&sortBy=createdAt&order=desc

// Filtros automáticos por rol:
// - EMPLEADO: solo sus propios tickets
// - TECNICO: tickets asignados a él
// - ADMIN: todos los tickets

// Response:
{
  tickets: Ticket[],
  total: number,
  page: number,
  totalPages: number
}
```

#### `POST /api/tickets`
Crear ticket:
```typescript
// Request body:
{
  asunto: string,           // max 100
  descripcion: string,      // max 500
  categoria: CategoriaTicket,
  subcategoria: SubcategoriaTicket,
  prioridad: PrioridadTicket,
  ubicacionAreaId: string,  // ej: "pb_ingresos"
  piso: PisoEdificio
}

// Validaciones:
// - Si rol=EMPLEADO: verificar que no tenga ya 2 tickets activos
// - Si rol=MESA_AYUDA: puede crear en nombre de otro (req.body.rfcSolicitante)
// - El creadorRfc se toma del JWT

// Al crear exitosamente:
// 1. Guardar en BD
// 2. Emitir socket: 'ticket:nuevo' a admins y mesa de ayuda
// 3. Crear notificación en BD para admins

// Response 201: { ticket: Ticket, mensaje: 'Ticket creado exitosamente' }
// Response 403: { error: 'Límite de tickets activos alcanzado (máximo 2)' }
```

#### `GET /api/tickets/:id`
Detalle de ticket:
```typescript
// Incluir: creador, técnico asignado, historial de estados, comentarios
// Response: Ticket completo con relaciones
```

#### `PATCH /api/tickets/:id/asignar`
Asignar ticket a técnico (solo Admin):
```typescript
// Request body: { tecnicoId: number }

// Al asignar:
// 1. Actualizar ticket en BD
// 2. Crear historial de estado
// 3. Emitir socket 'ticket:asignado' con { ticketId, tecnico, rfcEmpleado }
// 4. Crear notificaciones para: técnico asignado + empleado que creó el ticket

// Response: { ticket: Ticket actualizado }
```

#### `PATCH /api/tickets/:id/estado`
Cambiar estado del ticket:
```typescript
// Request body: { estado: EstadoTicket, comentario?: string }

// Transiciones permitidas:
const TRANSICIONES = {
  ABIERTO: ['ASIGNADO', 'CANCELADO'],
  ASIGNADO: ['EN_PROGRESO', 'CANCELADO'],
  EN_PROGRESO: ['RESUELTO', 'CANCELADO'],
  RESUELTO: [],
  CANCELADO: []
}

// Al cambiar estado:
// 1. Validar transición permitida
// 2. Registrar en historial con timestamp + usuario + comentario
// 3. Emitir socket 'ticket:estado_cambiado'
// 4. Si RESUELTO: notificar al empleado

// Response: { ticket: Ticket actualizado }
```

#### `POST /api/tickets/:id/comentarios`
Agregar comentario/seguimiento:
```typescript
// Solo técnicos y admins pueden agregar comentarios
// Request body: { texto: string, esInterno?: boolean }
// esInterno: true = solo staff lo ve, false = también el empleado

// Response: { comentario: Comentario }
```

---

### EMPLEADOS — `/api/empleados`

#### `GET /api/empleados/ubicacion`
Obtener ubicación de empleado por RFC:
```typescript
// Query: ?rfc=XXXX123456XXX

// Response:
{
  rfc: string,
  nombre: string,
  area: string,
  areaId: string,   // para el mapa 3D
  floor: number,
  floorLabel: string
}
```

#### `GET /api/employee/location`
Alias para el módulo 3D (mismo comportamiento):
```typescript
// Ruta: GET /api/employee/location?rfc=XXXX123456XXX
// Misma respuesta que /empleados/ubicacion
```

---

### USUARIOS — `/api/usuarios` (solo Admin)

```typescript
GET    /api/usuarios              ← lista todos los usuarios del sistema
POST   /api/usuarios              ← crear usuario (staff)
GET    /api/usuarios/:id          ← detalle usuario
PATCH  /api/usuarios/:id          ← actualizar usuario
DELETE /api/usuarios/:id          ← desactivar (soft delete)
```

#### `POST /api/usuarios` — Crear usuario staff:
```typescript
// Request body:
{
  nombre: string,
  apellidos: string,
  usuario: string,      // username para login
  password: string,     // se hashea con bcrypt
  rol: Rol,             // ADMIN | TECNICO_INFORMATICO | TECNICO_SERVICIOS | MESA_AYUDA
  email?: string,
  telefono?: string
}
```

---

### CATÁLOGOS — `/api/catalogos`

```typescript
GET /api/catalogos/categorias       ← estructura de categorías y subcategorías
GET /api/catalogos/tecnicos         ← lista de técnicos disponibles para asignación
GET /api/catalogos/areas            ← áreas del edificio (para selector de ubicación)
GET /api/catalogos/pisos            ← pisos del edificio
```

---

## SOCKET.IO — EVENTOS

### Configuración:
```typescript
// sockets/tickets.socket.ts
import { Server } from 'socket.io'

export const configurarSockets = (io: Server) => {
  io.on('connection', (socket) => {
    // El cliente se une a su sala personal al conectar
    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`)
    })
    
    // Los admins se unen a sala admin
    socket.on('join:admin', () => {
      socket.join('admins')
    })
    
    socket.on('disconnect', () => {
      console.log(`Socket desconectado: ${socket.id}`)
    })
  })
}
```

### Eventos emitidos:
```typescript
// Nuevo ticket creado → avisar a admins y mesa de ayuda
io.to('admins').emit('ticket:nuevo', {
  id: ticket.id,
  asunto: ticket.asunto,
  categoria: ticket.categoria,
  creador: ticket.creador.nombreCompleto,
  area: ticket.ubicacionAreaLabel,
  prioridad: ticket.prioridad,
  timestamp: new Date()
})

// Ticket asignado → avisar al técnico y al empleado
io.to(`user:${tecnico.id}`).emit('ticket:asignado', {
  ticketId: ticket.id,
  asunto: ticket.asunto,
  asignadoPor: admin.nombre
})

io.to(`user:${empleado.id}`).emit('ticket:asignado_empleado', {
  ticketId: ticket.id,
  asunto: ticket.asunto,
  tecnico: tecnico.nombreCompleto,
  mensaje: `Tu ticket #${ticket.id} ha sido asignado a ${tecnico.nombreCompleto}`
})

// Estado cambiado
io.to(`user:${empleado.id}`).emit('ticket:estado_cambiado', {
  ticketId: ticket.id,
  estadoAnterior,
  estadoNuevo,
  mensaje: `Tu ticket #${ticket.id} cambió a estado: ${estadoNuevo}`
})
```

---

## INTEGRACIÓN SIRH (PENDIENTE)

```typescript
// services/sirh.service.ts
// TODO: implementar cuando SIRH_ENABLED=true

export class SirhService {
  private baseUrl = process.env.SIRH_BASE_URL
  
  // Obtener toda la plantilla del SIRH
  async getPlantilla(): Promise<EmpleadoSIRH[]> {
    // TODO: GET localhost:3000/getPlantilla
    // Response del SIRH: array de empleados con RFC, nombre, área, etc.
    throw new Error('SIRH integration pending')
  }
  
  // Verificar si un RFC existe en SIRH
  async verificarRFC(rfc: string): Promise<EmpleadoSIRH | null> {
    // TODO: buscar en plantilla o endpoint específico
    throw new Error('SIRH integration pending')
  }
  
  // Sincronizar plantilla SIRH → tabla Empleados de SIAST
  async sincronizarPlantilla(): Promise<void> {
    // TODO: cronjob diario o trigger manual
    throw new Error('SIRH integration pending')
  }
}

// En auth.service.ts — login por RFC:
async loginRFC(rfc: string) {
  if (process.env.SIRH_ENABLED === 'true') {
    // TODO: consultar SIRH
    const empleadoSIRH = await sirhService.verificarRFC(rfc)
    if (!empleadoSIRH) throw new NotFoundError('RFC no encontrado en SIRH')
    // Sincronizar datos...
  } else {
    // Buscar en BD local (datos de prueba)
    const empleado = await prisma.empleado.findUnique({ where: { rfc } })
    if (!empleado) throw new NotFoundError('RFC no encontrado')
    return empleado
  }
}
```

---

## MIDDLEWARE DE AUTENTICACIÓN

```typescript
// middleware/auth.middleware.ts
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Token requerido' })
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// middleware/roles.middleware.ts
export const requireRol = (...roles: Rol[]) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permisos para esta acción' })
  }
  next()
}

// Uso:
router.patch('/tickets/:id/asignar', 
  authMiddleware, 
  requireRol(Rol.ADMIN),
  asignarTicket
)
```

---

## DATOS DE PRUEBA (SEED)

```typescript
// prisma/seed.ts

// Áreas del edificio (extraídas de los planos)
const areas = [
  // Planta Baja
  { id: 'pb_acceso_principal', label: 'Acceso Principal', piso: 'PB', floor: 0 },
  { id: 'pb_archivos', label: 'Área de Archivos', piso: 'PB', floor: 0 },
  { id: 'pb_ingresos', label: 'Ingresos', piso: 'PB', floor: 0 },
  { id: 'pb_unidad_administrativa', label: 'Unidad Administrativa', piso: 'PB', floor: 0 },
  { id: 'pb_control', label: 'Control', piso: 'PB', floor: 0 },
  // Nivel 1
  { id: 'n1_secretaria', label: 'Secretaría de Finanzas', piso: 'NIVEL_1', floor: 1 },
  { id: 'n1_juridico', label: 'Jurídico', piso: 'NIVEL_1', floor: 1 },
  { id: 'n1_salon_morelos', label: 'Salón Morelos', piso: 'NIVEL_1', floor: 1 },
  { id: 'n1_subsec_planeacion', label: 'Subsecretaría de Planeación', piso: 'NIVEL_1', floor: 1 },
  { id: 'n1_subsec_ingresos', label: 'Subsecretaría de Ingresos', piso: 'NIVEL_1', floor: 1 },
  // Nivel 2
  { id: 'n2_informatica', label: 'Informática', piso: 'NIVEL_2', floor: 2 },
  { id: 'n2_recaudacion', label: 'Recaudación', piso: 'NIVEL_2', floor: 2 },
  { id: 'n2_contraloria', label: 'Contraloría', piso: 'NIVEL_2', floor: 2 },
  { id: 'n2_egresos', label: 'Egresos', piso: 'NIVEL_2', floor: 2 },
  { id: 'n2_nominas', label: 'Departamento de Nóminas', piso: 'NIVEL_2', floor: 2 },
]

// Usuarios de prueba
const usuarios = [
  { nombre: 'Admin SIAST', usuario: 'admin', password: 'Admin2025!', rol: 'ADMIN' },
  { nombre: 'Juan Técnico', usuario: 'jtecnico', password: 'Tech2025!', rol: 'TECNICO_INFORMATICO' },
  { nombre: 'María Mesa', usuario: 'mmesa', password: 'Mesa2025!', rol: 'MESA_AYUDA' },
]

// Empleados de prueba (mientras SIRH está pendiente)
const empleados = [
  { rfc: 'PELJ850312HDF', nombre: 'Juan', apellidos: 'Pérez López', areaId: 'n2_informatica' },
  { rfc: 'GOMM920518MOC', nombre: 'María', apellidos: 'Gómez Martínez', areaId: 'pb_ingresos' },
  { rfc: 'RAMC780901OAX', nombre: 'Carlos', apellidos: 'Ramírez Méndez', areaId: 'n1_juridico' },
]
```

---

## INSTRUCCIONES DE IMPLEMENTACIÓN

1. Inicializar en `~/Documents/SIAST/backend/`
2. Configurar TypeScript + Express
3. Conectar Prisma al schema generado por agente DB
4. Implementar autenticación JWT primero
5. Implementar CRUD completo de tickets
6. Agregar Socket.IO para notificaciones
7. Ejecutar seed con datos de prueba
8. Documentar endpoints en `README.md`
9. Puerto: `3001`

---

## ENTREGABLES ESPERADOS

- [ ] Servidor Express en TypeScript funcional en puerto 3001
- [ ] Todos los endpoints listados implementados
- [ ] Autenticación JWT (login-rfc + login staff)
- [ ] Socket.IO con eventos de notificaciones
- [ ] Middleware de roles y permisos
- [ ] Seed con datos de prueba (áreas, usuarios, empleados)
- [ ] CORS configurado para `localhost:5173` y `localhost:5174`
- [ ] `.env.example` completo
- [ ] `README.md` con instrucciones

---

> **Coordinación con agente DB:** El schema de Prisma lo gestiona el agente de Base de Datos. Antes de generar el cliente Prisma, verifica que el agente DB haya corrido `prisma migrate dev`.
