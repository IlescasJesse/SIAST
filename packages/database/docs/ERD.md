# ERD — SIAST Base de Datos

## Diagrama Entidad-Relación

```
┌─────────────────┐     ┌──────────────────────────┐     ┌───────────────────┐
│   AreaEdificio  │     │         Empleado          │     │     Ticket        │
├─────────────────┤     ├──────────────────────────┤     ├───────────────────┤
│ id (PK) VARCHAR │◄────│ areaId (FK)               │────►│ areaId (FK)       │
│ label           │     │ id (PK)                  │     │ id (PK)           │
│ piso (enum)     │     │ rfc (UNIQUE)             │◄────│ empleadoRfc (FK)  │
│ floor (INT)     │     │ nombre                   │     │ asunto            │
│ gridX1          │     │ apellidos                │     │ descripcion       │
│ gridY1          │     │ nombreCompleto           │     │ categoria (enum)  │
│ gridX2          │     │ email                    │     │ subcategoria(enum)│
│ gridY2          │     │ departamento             │     │ estado (enum)     │
│ activo          │     │ puesto                   │     │ prioridad (enum)  │
└─────────────────┘     │ piso (enum)              │     │ piso (enum)       │
                        │ activo                   │     │ creadoPorId (FK)  │
                        │ sincronizadoSIRH         │     │ tecnicoId (FK)    │
                        └──────────────────────────┘     │ fechaAsignacion   │
                                                         │ fechaInicio       │
┌──────────────────┐                                     │ fechaResolucion   │
│    Usuario       │                                     │ activo            │
├──────────────────┤                                     └───────────────────┘
│ id (PK)          │◄─── creadoPorId (FK en Ticket)            │
│ nombre           │◄─── tecnicoId (FK en Ticket)              │
│ apellidos        │                                           │
│ usuario (UNIQUE) │     ┌───────────────────┐                 │
│ password (bcrypt)│◄────│  HistorialTicket  │◄────────────────┘
│ email            │     ├───────────────────┤
│ telefono         │     │ id (PK)           │
│ rol (enum)       │     │ ticketId (FK)     │
│ activo           │     │ estadoAnterior    │
└──────────────────┘     │ estadoNuevo       │
        │                │ usuarioId (FK)    │
        │                │ empleadoRfc       │
        │                │ comentario        │
        ▼                └───────────────────┘
┌──────────────────┐
│   Comentario     │     ┌───────────────────┐
├──────────────────┤     │  Notificacion     │
│ id (PK)          │     ├───────────────────┤
│ ticketId (FK)    │     │ id (PK)           │
│ texto            │     │ tipo (enum)       │
│ esInterno        │     │ titulo            │
│ usuarioId (FK)   │     │ mensaje           │
└──────────────────┘     │ leida             │
                         │ usuarioId (FK)    │
                         │ empleadoRfc (FK)  │
                         │ ticketId (FK)     │
                         └───────────────────┘
```

## Entidades

### Usuario
Staff del sistema con autenticación usuario/contraseña. Roles: `ADMIN`, `TECNICO_INFORMATICO`, `TECNICO_SERVICIOS`, `MESA_AYUDA`.

### Empleado
Personal de la Secretaría. Se autentica únicamente con RFC. Vinculado a un área del edificio. Puede tener máximo **2 tickets activos** simultáneos.

### AreaEdificio
Espacios físicos del Edificio Saúl Martínez extraídos de los planos arquitectónicos. Cuadrícula 32×27 por piso.

### Ticket
Solicitud de soporte. Flujo de estados: `ABIERTO → ASIGNADO → EN_PROGRESO → RESUELTO`. Soft delete con campo `activo`.

### HistorialTicket
Auditoría de cambios de estado. Registra quién cambió qué y cuándo.

### Comentario
Seguimiento interno (solo staff) o externo (visible al empleado) sobre un ticket.

### Notificacion
Mensajes en tiempo real para usuarios y empleados. Relacionados a eventos del ticket.

## Enums

| Enum | Valores |
|------|---------|
| `Rol` | ADMIN, TECNICO_INFORMATICO, TECNICO_SERVICIOS, MESA_AYUDA, EMPLEADO |
| `CategoriaTicket` | TECNOLOGIAS, SERVICIOS |
| `SubcategoriaTicket` | SISTEMAS, SOPORTE_TECNICO, REDES, INTERNET, IMPRESORAS_OTROS, SANITARIOS, ILUMINACION, MOVILIDAD |
| `EstadoTicket` | ABIERTO, ASIGNADO, EN_PROGRESO, RESUELTO, CANCELADO |
| `PrioridadTicket` | BAJA, MEDIA, ALTA, URGENTE |
| `PisoEdificio` | PB, NIVEL_1, NIVEL_2, NIVEL_3 |
| `TipoNotificacion` | TICKET_CREADO, TICKET_ASIGNADO, TICKET_ACTUALIZADO, TICKET_RESUELTO, TICKET_CANCELADO, TICKET_URGENTE |

## Índices clave

- `tickets(empleadoRfc, estado, activo)` — verificar límite de 2 tickets activos por empleado
- `tickets(estado)`, `tickets(tecnicoId)` — dashboard de administrador
- `notificaciones(usuarioId, leida)`, `notificaciones(empleadoRfc, leida)` — notificaciones no leídas
