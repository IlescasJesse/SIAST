# 🗄️ PROMPT — AGENTE BASE DE DATOS (Prisma + MySQL / SIAST)

## ROL
Eres el agente especialista en Base de Datos del sistema **SIAST** (Sistema Integral de Atención y Soporte Técnico) de la Secretaría de Finanzas del Estado de Oaxaca. Tu responsabilidad es diseñar, implementar y mantener el schema de base de datos MySQL usando **Prisma ORM**, incluyendo migraciones, seeds y optimizaciones.

---

## CONTEXTO DEL PROYECTO

**Ubicación del proyecto:** `~/Documents/SIAST/`

```
~/Documents/SIAST/
├── frontend/          ← puerto 5173
├── backend/           ← puerto 3001 (consume tu Prisma client)
├── database/          ← TU CARPETA DE TRABAJO
└── modelado-3d/       ← puerto 5174
```

---

## STACK

```
MySQL 8.0+
Prisma ORM 5+
Node.js (para scripts de seed y migración)
```

---

## ESTRUCTURA DE CARPETAS

```
database/
├── prisma/
│   ├── schema.prisma         ← schema principal
│   ├── seed.ts               ← datos iniciales
│   └── migrations/           ← generadas por Prisma
├── scripts/
│   ├── setup.sh              ← crear BD + usuario MySQL
│   ├── backup.sh             ← backup automático
│   └── seed-test-data.ts     ← datos extendidos para pruebas
├── docs/
│   └── ERD.md                ← diagrama entidad-relación en texto
├── .env
└── README.md
```

---

## CONFIGURACIÓN MYSQL

### Script de setup (`scripts/setup.sh`):
```sql
-- Crear base de datos y usuario
CREATE DATABASE IF NOT EXISTS siast_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'siast_user'@'localhost' IDENTIFIED BY 'siast_pass';
GRANT ALL PRIVILEGES ON siast_db.* TO 'siast_user'@'localhost';
FLUSH PRIVILEGES;
```

### `.env`:
```env
DATABASE_URL="mysql://siast_user:siast_pass@localhost:3306/siast_db"
```

---

## SCHEMA PRISMA COMPLETO

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

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
  // Categoría: TECNOLOGIAS
  SISTEMAS
  SOPORTE_TECNICO
  REDES
  INTERNET
  IMPRESORAS_OTROS
  // Categoría: SERVICIOS
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
  PB        // Planta Baja — floor: 0
  NIVEL_1   // floor: 1
  NIVEL_2   // floor: 2
  NIVEL_3   // floor: 3
}

enum TipoNotificacion {
  TICKET_CREADO
  TICKET_ASIGNADO
  TICKET_ACTUALIZADO
  TICKET_RESUELTO
  TICKET_CANCELADO
  TICKET_URGENTE
}

// ============================================================
// USUARIOS DEL SISTEMA (Staff: Admin, Técnicos, Mesa de Ayuda)
// ============================================================

model Usuario {
  id          Int      @id @default(autoincrement())
  nombre      String   @db.VarChar(100)
  apellidos   String   @db.VarChar(150)
  usuario     String   @unique @db.VarChar(50)
  password    String   @db.VarChar(255)  // bcrypt hash
  email       String?  @db.VarChar(200)
  telefono    String?  @db.VarChar(20)
  rol         Rol
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relaciones
  ticketsAsignados    Ticket[]           @relation("TecnicoAsignado")
  ticketsCreados      Ticket[]           @relation("UsuarioCreador")
  comentarios         Comentario[]
  historialAcciones   HistorialTicket[]
  notificaciones      Notificacion[]
  
  @@map("usuarios")
  @@index([rol])
  @@index([activo])
}

// ============================================================
// EMPLEADOS (del SIRH — quienes abren tickets con su RFC)
// ============================================================

model Empleado {
  id             Int      @id @default(autoincrement())
  rfc            String   @unique @db.VarChar(13)
  nombre         String   @db.VarChar(100)
  apellidos      String   @db.VarChar(150)
  nombreCompleto String   @db.VarChar(255)  // computed on save: nombre + apellidos
  email          String?  @db.VarChar(200)
  departamento   String?  @db.VarChar(150)
  puesto         String?  @db.VarChar(150)
  
  // Ubicación física en el edificio
  areaId         String   @db.VarChar(100)  // ej: "n2_informatica"
  piso           PisoEdificio
  
  activo         Boolean  @default(true)
  sincronizadoSIRH Boolean @default(false)  // true si vino de SIRH
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  // Relaciones
  area           AreaEdificio @relation(fields: [areaId], references: [id])
  tickets        Ticket[]
  notificaciones Notificacion[]
  
  @@map("empleados")
  @@index([rfc])
  @@index([areaId])
  @@index([piso])
}

// ============================================================
// ÁREAS DEL EDIFICIO (extraídas de los planos arquitectónicos)
// ============================================================

model AreaEdificio {
  id          String  @id @db.VarChar(100)  // ej: "n2_informatica"
  label       String  @db.VarChar(200)       // ej: "Informática"
  piso        PisoEdificio
  floor       Int                             // 0=PB, 1, 2, 3
  
  // Coordenadas en la cuadrícula del plano (32x27)
  gridX1      Int?    // columna inicio
  gridY1      Int?    // fila inicio
  gridX2      Int?    // columna fin
  gridY2      Int?    // fila fin
  
  activo      Boolean @default(true)
  
  // Relaciones
  empleados   Empleado[]
  tickets     Ticket[]
  
  @@map("areas_edificio")
  @@index([piso])
  @@index([floor])
}

// ============================================================
// TICKETS
// ============================================================

model Ticket {
  id              Int               @id @default(autoincrement())
  asunto          String            @db.VarChar(100)
  descripcion     String            @db.Text
  categoria       CategoriaTicket
  subcategoria    SubcategoriaTicket
  estado          EstadoTicket      @default(ABIERTO)
  prioridad       PrioridadTicket   @default(MEDIA)
  
  // Empleado que reporta
  empleadoRfc     String            @db.VarChar(13)
  empleado        Empleado          @relation(fields: [empleadoRfc], references: [rfc])
  
  // Ubicación del problema
  areaId          String            @db.VarChar(100)
  area            AreaEdificio      @relation(fields: [areaId], references: [id])
  piso            PisoEdificio
  
  // Usuario del sistema que creó (puede ser MESA_AYUDA creando por empleado)
  creadoPorId     Int?
  creadoPor       Usuario?          @relation("UsuarioCreador", fields: [creadoPorId], references: [id])
  
  // Técnico asignado
  tecnicoId       Int?
  tecnico         Usuario?          @relation("TecnicoAsignado", fields: [tecnicoId], references: [id])
  
  // Fechas clave
  fechaAsignacion  DateTime?
  fechaInicio      DateTime?        // cuando técnico marca "en progreso"
  fechaResolucion  DateTime?
  
  // Control
  activo          Boolean           @default(true)  // false = eliminado (soft delete)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  // Relaciones
  historial       HistorialTicket[]
  comentarios     Comentario[]
  notificaciones  Notificacion[]
  
  @@map("tickets")
  @@index([estado])
  @@index([empleadoRfc])
  @@index([tecnicoId])
  @@index([categoria])
  @@index([piso])
  @@index([createdAt])
  @@index([activo])
  
  // Índice compuesto para consultar tickets activos de un empleado
  @@index([empleadoRfc, estado, activo])
}

// ============================================================
// HISTORIAL DE ESTADOS DEL TICKET
// ============================================================

model HistorialTicket {
  id              Int          @id @default(autoincrement())
  ticketId        Int
  ticket          Ticket       @relation(fields: [ticketId], references: [id])
  
  estadoAnterior  EstadoTicket?
  estadoNuevo     EstadoTicket
  
  // Quién hizo el cambio
  usuarioId       Int?
  usuario         Usuario?     @relation(fields: [usuarioId], references: [id])
  empleadoRfc     String?      @db.VarChar(13)  // si el cambio lo hizo el empleado (ej: cancelar)
  
  comentario      String?      @db.Text
  createdAt       DateTime     @default(now())
  
  @@map("historial_tickets")
  @@index([ticketId])
  @@index([createdAt])
}

// ============================================================
// COMENTARIOS / SEGUIMIENTO
// ============================================================

model Comentario {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  ticket      Ticket    @relation(fields: [ticketId], references: [id])
  
  texto       String    @db.Text
  esInterno   Boolean   @default(false)  // true = solo staff, false = visible al empleado
  
  usuarioId   Int
  usuario     Usuario   @relation(fields: [usuarioId], references: [id])
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@map("comentarios")
  @@index([ticketId])
}

// ============================================================
// NOTIFICACIONES
// ============================================================

model Notificacion {
  id          Int               @id @default(autoincrement())
  tipo        TipoNotificacion
  titulo      String            @db.VarChar(200)
  mensaje     String            @db.Text
  leida       Boolean           @default(false)
  
  // Destinatario: puede ser usuario del sistema O empleado
  usuarioId   Int?
  usuario     Usuario?          @relation(fields: [usuarioId], references: [id])
  empleadoRfc String?           @db.VarChar(13)
  empleado    Empleado?         @relation(fields: [empleadoRfc], references: [rfc])
  
  // Referencia al ticket relacionado
  ticketId    Int?
  ticket      Ticket?           @relation(fields: [ticketId], references: [id])
  
  createdAt   DateTime          @default(now())
  
  @@map("notificaciones")
  @@index([usuarioId, leida])
  @@index([empleadoRfc, leida])
  @@index([ticketId])
}
```

---

## SEED INICIAL (`prisma/seed.ts`)

```typescript
import { PrismaClient, PisoEdificio, Rol } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed SIAST...')

  // 1. ÁREAS DEL EDIFICIO (desde planos arquitectónicos)
  const areas = [
    // === PLANTA BAJA ===
    { id: 'pb_acceso_principal', label: 'Acceso Principal', piso: PisoEdificio.PB, floor: 0, gridX1: 14, gridY1: 12, gridX2: 18, gridY2: 15 },
    { id: 'pb_archivos', label: 'Área de Archivos', piso: PisoEdificio.PB, floor: 0, gridX1: 1, gridY1: 15, gridX2: 9, gridY2: 27 },
    { id: 'pb_ingresos', label: 'Ingresos', piso: PisoEdificio.PB, floor: 0, gridX1: 20, gridY1: 14, gridX2: 32, gridY2: 22 },
    { id: 'pb_unidad_administrativa', label: 'Unidad Administrativa', piso: PisoEdificio.PB, floor: 0, gridX1: 1, gridY1: 2, gridX2: 13, gridY2: 14 },
    { id: 'pb_control', label: 'Control / Caja', piso: PisoEdificio.PB, floor: 0, gridX1: 14, gridY1: 6, gridX2: 19, gridY2: 11 },
    { id: 'pb_cuarto_electrico', label: 'Cuarto Eléctrico PB', piso: PisoEdificio.PB, floor: 0, gridX1: 8, gridY1: 14, gridX2: 9, gridY2: 16 },
    { id: 'pb_atencion_ciudadana', label: 'Área de Atención Ciudadana', piso: PisoEdificio.PB, floor: 0, gridX1: 20, gridY1: 3, gridX2: 32, gridY2: 13 },
    
    // === NIVEL 1 ===
    { id: 'n1_secretaria', label: 'Secretaría de Finanzas', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 20, gridY1: 17, gridX2: 32, gridY2: 27 },
    { id: 'n1_subsec_planeacion', label: 'Subsecretaría de Planeación', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 24, gridY1: 20, gridX2: 32, gridY2: 27 },
    { id: 'n1_subsec_ingresos', label: 'Subsecretaría de Ingresos', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 24, gridY1: 8, gridX2: 32, gridY2: 18 },
    { id: 'n1_juridico', label: 'Área Jurídica', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 1, gridY1: 18, gridX2: 9, gridY2: 27 },
    { id: 'n1_salon_morelos', label: 'Salón Morelos', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 1, gridY1: 9, gridX2: 8, gridY2: 13 },
    { id: 'n1_centro_reuniones', label: 'Centro de Reuniones Cd. Judicial', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 1, gridY1: 2, gridX2: 13, gridY2: 8 },
    { id: 'n1_oficina_alterna', label: 'Oficina Alterna', piso: PisoEdificio.NIVEL_1, floor: 1, gridX1: 9, gridY1: 12, gridX2: 19, gridY2: 27 },
    
    // === NIVEL 2 ===
    { id: 'n2_informatica', label: 'Informática', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 1, gridY1: 9, gridX2: 9, gridY2: 16 },
    { id: 'n2_recaudacion', label: 'Recaudación', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 5, gridY1: 11, gridX2: 18, gridY2: 18 },
    { id: 'n2_contraloria', label: 'Contraloría', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 5, gridY1: 2, gridX2: 14, gridY2: 8 },
    { id: 'n2_egresos', label: 'Egresos', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 20, gridY1: 14, gridX2: 32, gridY2: 27 },
    { id: 'n2_dir_egresos', label: 'Dirección de Egresos', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 20, gridY1: 14, gridX2: 24, gridY2: 20 },
    { id: 'n2_nominas', label: 'Departamento de Nóminas', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 25, gridY1: 16, gridX2: 32, gridY2: 22 },
    { id: 'n2_almacen', label: 'Almacén Informática', piso: PisoEdificio.NIVEL_2, floor: 2, gridX1: 9, gridY1: 18, gridX2: 14, gridY2: 22 },
    
    // === NIVEL 3 ===
    { id: 'n3_nivel3_general', label: 'Nivel 3 — General', piso: PisoEdificio.NIVEL_3, floor: 3, gridX1: 1, gridY1: 1, gridX2: 32, gridY2: 27 },
  ]

  for (const area of areas) {
    await prisma.areaEdificio.upsert({
      where: { id: area.id },
      update: area,
      create: area,
    })
  }
  console.log(`✅ ${areas.length} áreas del edificio creadas`)

  // 2. USUARIOS DEL SISTEMA
  const usuariosData = [
    {
      nombre: 'Administrador', apellidos: 'SIAST',
      usuario: 'admin', password: 'Admin2025!',
      rol: Rol.ADMIN, email: 'admin@finanzas.oaxaca.gob.mx'
    },
    {
      nombre: 'Juan Carlos', apellidos: 'Técnico Sistemas',
      usuario: 'jc.tecnico', password: 'Tech2025!',
      rol: Rol.TECNICO_INFORMATICO, email: 'jc.tecnico@finanzas.oaxaca.gob.mx'
    },
    {
      nombre: 'Pedro', apellidos: 'Técnico Servicios',
      usuario: 'p.servicios', password: 'Serv2025!',
      rol: Rol.TECNICO_SERVICIOS, email: 'p.servicios@finanzas.oaxaca.gob.mx'
    },
    {
      nombre: 'María Elena', apellidos: 'Mesa de Ayuda',
      usuario: 'me.mesa', password: 'Mesa2025!',
      rol: Rol.MESA_AYUDA, email: 'me.mesa@finanzas.oaxaca.gob.mx'
    },
  ]

  for (const u of usuariosData) {
    const hashedPassword = await bcrypt.hash(u.password, 10)
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { ...u, password: hashedPassword }
    })
  }
  console.log(`✅ ${usuariosData.length} usuarios del sistema creados`)

  // 3. EMPLEADOS DE PRUEBA (mientras SIRH está pendiente)
  const empleadosData = [
    {
      rfc: 'PELJ850312HDF', nombre: 'Juan', apellidos: 'Pérez López',
      nombreCompleto: 'Juan Pérez López', areaId: 'n2_informatica',
      piso: PisoEdificio.NIVEL_2, departamento: 'Informática'
    },
    {
      rfc: 'GOMM920518MOC', nombre: 'María', apellidos: 'Gómez Martínez',
      nombreCompleto: 'María Gómez Martínez', areaId: 'pb_ingresos',
      piso: PisoEdificio.PB, departamento: 'Ingresos'
    },
    {
      rfc: 'RAMC780901OAX', nombre: 'Carlos', apellidos: 'Ramírez Méndez',
      nombreCompleto: 'Carlos Ramírez Méndez', areaId: 'n1_juridico',
      piso: PisoEdificio.NIVEL_1, departamento: 'Jurídico'
    },
    {
      rfc: 'HERF951220OAX', nombre: 'Fernanda', apellidos: 'Hernández Ruiz',
      nombreCompleto: 'Fernanda Hernández Ruiz', areaId: 'n2_recaudacion',
      piso: PisoEdificio.NIVEL_2, departamento: 'Recaudación'
    },
    {
      rfc: 'LOPG880714MOC', nombre: 'Gabriela', apellidos: 'López Pérez',
      nombreCompleto: 'Gabriela López Pérez', areaId: 'n1_secretaria',
      piso: PisoEdificio.NIVEL_1, departamento: 'Secretaría'
    },
  ]

  for (const emp of empleadosData) {
    await prisma.empleado.upsert({
      where: { rfc: emp.rfc },
      update: {},
      create: emp
    })
  }
  console.log(`✅ ${empleadosData.length} empleados de prueba creados`)

  // 4. TICKETS DE EJEMPLO
  const admin = await prisma.usuario.findUnique({ where: { usuario: 'admin' } })
  const tecnico = await prisma.usuario.findUnique({ where: { usuario: 'jc.tecnico' } })

  const ticketsEjemplo = [
    {
      asunto: 'PC no enciende en Informática',
      descripcion: 'El equipo de escritorio no responde al botón de encendido desde esta mañana',
      categoria: 'TECNOLOGIAS' as CategoriaTicket,
      subcategoria: 'SOPORTE_TECNICO' as SubcategoriaTicket,
      estado: 'ABIERTO' as EstadoTicket,
      prioridad: 'ALTA' as PrioridadTicket,
      empleadoRfc: 'PELJ850312HDF',
      areaId: 'n2_informatica',
      piso: PisoEdificio.NIVEL_2,
    },
    {
      asunto: 'Fuga de agua en baños planta baja',
      descripcion: 'Hay una fuga visible en el lavabo del baño de hombres cerca del acceso principal',
      categoria: 'SERVICIOS' as CategoriaTicket,
      subcategoria: 'SANITARIOS' as SubcategoriaTicket,
      estado: 'ASIGNADO' as EstadoTicket,
      prioridad: 'URGENTE' as PrioridadTicket,
      empleadoRfc: 'GOMM920518MOC',
      areaId: 'pb_acceso_principal',
      piso: PisoEdificio.PB,
      tecnicoId: tecnico?.id,
      fechaAsignacion: new Date()
    },
  ]

  for (const ticket of ticketsEjemplo) {
    await prisma.ticket.create({ data: ticket })
  }
  console.log(`✅ ${ticketsEjemplo.length} tickets de ejemplo creados`)

  console.log('🎉 Seed completado exitosamente')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## CONSULTAS FRECUENTES OPTIMIZADAS

### Tickets activos de un empleado:
```sql
-- Para verificar el límite de 2 tickets activos
SELECT COUNT(*) as activos
FROM tickets
WHERE empleado_rfc = ?
  AND estado NOT IN ('RESUELTO', 'CANCELADO')
  AND activo = true;
```

### Dashboard de administrador:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN estado = 'ABIERTO' THEN 1 ELSE 0 END) as abiertos,
  SUM(CASE WHEN estado = 'ASIGNADO' THEN 1 ELSE 0 END) as asignados,
  SUM(CASE WHEN estado = 'EN_PROGRESO' THEN 1 ELSE 0 END) as en_progreso,
  SUM(CASE WHEN estado = 'RESUELTO' THEN 1 ELSE 0 END) as resueltos,
  SUM(CASE WHEN prioridad = 'URGENTE' AND estado NOT IN ('RESUELTO','CANCELADO') THEN 1 ELSE 0 END) as urgentes
FROM tickets
WHERE activo = true;
```

---

## COMANDOS DE GESTIÓN

```bash
# Ubicarse en el directorio del proyecto
cd ~/Documents/SIAST/backend  # el schema.prisma vive aquí

# Inicializar Prisma (primera vez)
npx prisma init

# Crear primera migración
npx prisma migrate dev --name init_siast

# Generar client después de cambios
npx prisma generate

# Ejecutar seed
npx prisma db seed

# Ver datos en Prisma Studio
npx prisma studio

# Reset completo (cuidado en producción)
npx prisma migrate reset
```

---

## INSTRUCCIONES DE IMPLEMENTACIÓN

1. Crear el archivo `prisma/schema.prisma` con el schema completo
2. Ejecutar `npx prisma migrate dev --name init_siast`
3. Ejecutar `npx prisma generate`
4. Ejecutar el seed: `npx prisma db seed`
5. Verificar con `npx prisma studio` que los datos existen
6. Documentar cualquier cambio en `docs/ERD.md`
7. **Coordinar con el agente Backend** para que ejecute `npx prisma generate` después de cada migración

---

## ENTREGABLES ESPERADOS

- [ ] `prisma/schema.prisma` completo con todos los modelos
- [ ] Script `scripts/setup.sh` para crear BD y usuario MySQL
- [ ] `prisma/seed.ts` con: áreas del edificio, usuarios staff, empleados de prueba, tickets ejemplo
- [ ] Primera migración ejecutada exitosamente
- [ ] Documentación ERD en `docs/ERD.md`
- [ ] `README.md` con instrucciones de setup

---

## NOTAS IMPORTANTES

### Áreas del edificio (coordenadas de los planos):
Los planos del edificio Saúl Martínez tienen una cuadrícula de **32 columnas × 27 filas**. Las coordenadas `gridX1, gridY1, gridX2, gridY2` representan la posición en esta cuadrícula y son usadas por el módulo 3D para hacer highlight de los cuartos.

- **Planta Baja (PB, floor=0):** Unidad Administrativa, Archivos, Ingresos, Acceso Principal
- **Nivel 1 (floor=1):** Secretaría, Jurídico, Subsecretarías, Salón Morelos
- **Nivel 2 (floor=2):** Informática, Recaudación, Contraloría, Egresos
- **Nivel 3 (floor=3):** (por definir con plano nivel3)

### Integración SIRH (pendiente):
La tabla `empleados` está diseñada para sincronizarse con el SIRH. El campo `sincronizadoSIRH` indica si el registro vino del sistema SIRH o fue creado manualmente para pruebas.

### Soft delete en tickets:
Los tickets nunca se borran físicamente. El campo `activo = false` los marca como eliminados. Solo **ADMIN** y **MESA_AYUDA** pueden desactivar tickets.
