# Phase 3: Roles y Áreas de Soporte - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 10 (new/modified files from CONTEXT.md and RESEARCH.md)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/database/prisma/schema.prisma` | model/config | CRUD | `schema.prisma` itself — `AreaEdificio` model + `Rol` enum | exact (internal extension) |
| `packages/shared/src/index.ts` | config/utility | transform | `index.ts` itself — `RolSchema` + `PERMISOS_DEFAULT` | exact (internal extension) |
| `packages/database/prisma/seed.ts` | config/batch | batch | `seed.ts` itself — `areaEdificio` upsert block | exact (internal extension) |
| `packages/database/prisma/seed_procesos.ts` | config/batch | batch | `seed_procesos.ts` itself — `PROCESO_SEED_MAP` DIRECTO entries | exact (internal extension) |
| `apps/api/src/middleware/roles.middleware.ts` | middleware | request-response | `apps/api/src/middleware/permisos.middleware.ts` | exact (same async DB-read guard pattern) |
| `apps/api/src/services/tickets.service.ts` | service | CRUD | `tickets.service.ts` itself — `asignarTicket` + `cambiarEstado` + `listarTickets` | exact (internal extension) |
| `apps/api/src/controllers/usuarios.controller.ts` | controller | CRUD | `usuarios.controller.ts` itself — `crear` + `actualizar` + `userSelect` | exact (internal extension) |
| `apps/api/src/routes/admin.routes.ts` | route | request-response | `apps/api/src/routes/catalogos.routes.ts` + `admin.routes.ts` | exact (add one GET endpoint) |
| `apps/web/src/pages/UsuariosPage.jsx` | component | request-response | `UsuariosPage.jsx` itself — `{form.esEmpleadoEstructura && ...}` conditional block | exact (internal extension) |
| `apps/web/src/pages/AdminUsuariosPage.jsx` | component | request-response | `AdminUsuariosPage.jsx` itself — `handleRolChange` + permisos conditional block | exact (internal extension) |

---

## Pattern Assignments

### `packages/database/prisma/schema.prisma` (model/config, CRUD)

**Analog:** `schema.prisma` — existing `Rol` enum (lines 16-24) and `AreaEdificio` model (lines 209-236) and `Usuario.permisos Json?` (line 108)

**Enum extension pattern** (lines 16-24 — current state to extend):
```prisma
enum Rol {
  ADMIN
  TECNICO_TI
  TECNICO_REDES
  TECNICO_SERVICIOS       // deprecated in Phase 3 — preserve for existing rows
  MESA_AYUDA
  GESTOR_RECURSOS_MATERIALES
  EMPLEADO
  // ── Phase 3: 7 new values to append below ──
  // RESPONSABLE_TI
  // RESPONSABLE_REDES
  // RESPONSABLE_MANTENIMIENTO
  // RESPONSABLE_RECURSOS_MATERIALES
  // TECNICO_ELECTRICISTA
  // TECNICO_PLOMERO
  // TECNICO_MOVILIDAD
}
```

**New AreaSoporte model — pattern from `AreaEdificio` + `Usuario.permisos Json?`** (lines 209-236 and line 108):
```prisma
// Json field precedent: Usuario.permisos (line 108)
permisos  Json?    // permisos adicionales u overrides sobre los defaults del rol

// AreaEdificio model structure to follow (lines 209-236):
model AreaEdificio {
  id    String       @id @db.VarChar(100)
  label String       @db.VarChar(200)
  piso  PisoEdificio
  floor Int
  activo Boolean @default(true)
  empleados Empleado[]
  tickets   Ticket[]
  @@index([piso])
  @@map("areas_edificio")
}

// New AreaSoporte model to create — same conventions:
model AreaSoporte {
  id             Int      @id @default(autoincrement())
  nombre         String   @unique @db.VarChar(50)
  subcategorias  Json     // string[] of SubcategoriaTicket values
  rolesIncluidos Json     // string[] of Rol values
  activo         Boolean  @default(true)
  createdAt      DateTime @default(now()) @map("created_at")
  usuarios       Usuario[]
  @@map("areas_soporte")
}
```

**FK on Usuario — pattern from `Empleado.area` relation** (line 176):
```prisma
// Existing FK pattern in Empleado:
areaId         String       @db.VarChar(100)
area           AreaEdificio @relation(fields: [areaId], references: [id])

// New optional FK to add to Usuario model (after line 113 rfc field):
areaSoporteId  Int?     @map("area_soporte_id")
areaSoporte    AreaSoporte? @relation(fields: [areaSoporteId], references: [id])
```

---

### `packages/shared/src/index.ts` (config/utility, transform)

**Analog:** `index.ts` itself — `RolSchema` (lines 7-15), `LABEL_ROL` (lines 309-317), `PERMISOS_DEFAULT` (lines 530-544)

**RolSchema — current block to extend** (lines 7-15):
```typescript
export const RolSchema = z.enum([
  "ADMIN",
  "TECNICO_TI",
  "TECNICO_REDES",
  "TECNICO_SERVICIOS",
  "MESA_AYUDA",
  "GESTOR_RECURSOS_MATERIALES",
  "EMPLEADO",
  // Phase 3: append 7 new values here
]);
```

**LABEL_ROL — current block to extend** (lines 309-317):
```typescript
export const LABEL_ROL: Record<string, string> = {
  ADMIN: "Administrador",
  TECNICO_TI: "Técnico TI",
  TECNICO_REDES: "Técnico de Redes",
  TECNICO_SERVICIOS: "Técnico de Servicios",   // deprecated but keep
  MESA_AYUDA: "Mesa de Ayuda",
  GESTOR_RECURSOS_MATERIALES: "Gestor de Recursos Materiales",
  EMPLEADO: "Empleado",
  // Phase 3: add labels for 7 new roles here
};
```

**PERMISOS_DEFAULT — current block to extend** (lines 530-544):
```typescript
export const PERMISOS_DEFAULT: Record<Rol, Permiso[]> = {
  ADMIN: [...PERMISOS_LIST],
  MESA_AYUDA: [
    "solicitudes.ver_todas",
    "solicitudes.crear_empleado",
    "solicitudes.asignar",
    "pasos.asignar",
    "metricas.ver",
  ],
  TECNICO_TI: ["solicitudes.ver_todas", "metricas.ver"],
  TECNICO_REDES: ["solicitudes.ver_todas"],
  TECNICO_SERVICIOS: ["solicitudes.ver_todas"],   // keep — deprecated but must remain
  GESTOR_RECURSOS_MATERIALES: ["solicitudes.ver_todas", "recursos.gestionar", "metricas.ver"],
  EMPLEADO: [],
  // Phase 3: add 7 new entries — TypeScript will error at build if any Rol value is missing
  // RESPONSABLE_*: ["solicitudes.ver_todas", "solicitudes.asignar", "pasos.asignar", "metricas.ver"],
  // TECNICO_ELECTRICISTA/PLOMERO/MOVILIDAD: ["solicitudes.ver_todas"],
};
```

**Critical note:** `PERMISOS_DEFAULT` is typed `Record<Rol, Permiso[]>` — all 7 new enum values MUST have entries or `npm run build` fails with TypeScript error.

---

### `packages/database/prisma/seed.ts` (config/batch, batch)

**Analog:** `seed.ts` itself — `areaEdificio` upsert block (lines 257-263) and seed call order (lines 266-295)

**Upsert pattern to copy** (lines 257-263):
```typescript
for (const area of areas) {
  await prisma.areaEdificio.upsert({
    where: { id: area.id },   // unique key for areaEdificio is id
    update: area,
    create: area,
  });
}
console.log(`${areas.length} areas del edificio sincronizadas`);
```

**AreaSoporte upsert uses `nombre` as unique key (different from areaEdificio which uses `id`):**
```typescript
// Insertion point: AFTER areaEdificio upserts (line 263), BEFORE admin usuario.create (line 271)
const areasSoporte = [
  {
    nombre: "TI",
    subcategorias: ["SISTEMAS_INSTITUCIONALES", "EQUIPOS_DISPOSITIVOS", "CUENTAS_DOMINIO", "CORREO_OUTLOOK"],
    rolesIncluidos: ["RESPONSABLE_TI", "TECNICO_TI"],
  },
  // ... 3 more areas
];

for (const area of areasSoporte) {
  await prisma.areaSoporte.upsert({
    where: { nombre: area.nombre },   // unique key is nombre, NOT id
    update: { subcategorias: area.subcategorias, rolesIncluidos: area.rolesIncluidos },
    create: { ...area, activo: true },
  });
}
```

**Current seed call order** (lines 257-295):
```
Step 2: areaEdificio upserts  (line 257)
Step 3: admin usuario.create  (line 271)  ← INSERT AreaSoporte seed BETWEEN here
Step 4: seedProcesos(prisma)  (line 288)
```

**Anti-pattern to avoid:** Do NOT add `areaSoporte` to the `deleteMany` block (lines 15-21). It is configuration data like `areaEdificio`, not transactional data.

---

### `packages/database/prisma/seed_procesos.ts` (config/batch, batch)

**Analog:** `seed_procesos.ts` itself — existing DIRECTO single-paso entries (lines 103-131)

**Pattern to copy — DIRECTO single-paso entry** (lines 103-109):
```typescript
"RED_INTERNET:SIN_ACCESO_INTERNET": {
  nombre: "Sin acceso a internet",
  tipoFlujo: "DIRECTO",
  pasos: [
    { orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Diagnóstico y restauración de acceso por Redes" },
  ],
},
```

**Fallback subcategoria entry (no subTipo)** (lines 127-131):
```typescript
RED_INTERNET: {
  nombre: "Red / Internet",
  tipoFlujo: "DIRECTO",
  pasos: [{ orden: 1, rolRequerido: "TECNICO_REDES", nombre: "Atención por Redes" }],
},
```

**Three new entries to add to `PROCESO_SEED_MAP`** — copy the DIRECTO/fallback pattern above, substituting new roles:
```typescript
// Under category SERVICIOS — add these 3 entries:
SANITARIOS: {
  nombre: "Sanitarios y plomería",
  tipoFlujo: "DIRECTO",
  pasos: [{ orden: 1, rolRequerido: "TECNICO_PLOMERO", nombre: "Atención por Técnico Plomero" }],
},
ILUMINACION: {
  nombre: "Iluminación y electricidad",
  tipoFlujo: "DIRECTO",
  pasos: [{ orden: 1, rolRequerido: "TECNICO_ELECTRICISTA", nombre: "Atención por Técnico Electricista" }],
},
MOVILIDAD: {
  nombre: "Movilidad y accesibilidad",
  tipoFlujo: "DIRECTO",
  pasos: [{ orden: 1, rolRequerido: "TECNICO_MOVILIDAD", nombre: "Atención por Técnico de Movilidad" }],
},
```

**upsert loop — no changes needed** (lines 192-end): the existing `seedProcesos()` loop handles new entries automatically via the upsert by `[subcategoria, subTipo]` unique constraint.

---

### `apps/api/src/middleware/roles.middleware.ts` (middleware, request-response)

**Analog:** `apps/api/src/middleware/permisos.middleware.ts` (entire file, 43 lines)

**Existing `requireRol` pattern** (lines 1-13 of roles.middleware.ts — synchronous, no DB read):
```typescript
import type { Response, NextFunction } from "express";
import type { Rol } from "@stf/shared";
import type { AuthRequest } from "../types/index.js";

export const requireRol =
  (...roles: Rol[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: "Sin permisos para esta acción" });
      return;
    }
    next();
  };
```

**Async DB-read guard pattern to follow** (`permisos.middleware.ts` lines 1-43):
```typescript
import type { Response, NextFunction } from "express";
import type { Permiso } from "@stf/shared";
import { tienePermiso } from "@stf/shared";
import { prisma } from "../config/database.js";    // singleton — import this, never new PrismaClient()
import type { AuthRequest } from "../types/index.js";

export const requirePermiso =
  (perm: Permiso) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Fast bypass for privileged roles (avoids unnecessary DB query)
    if (req.user.rol === "ADMIN") {
      next();
      return;
    }

    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        select: { permisos: true, activo: true },    // narrow select — only what you need
      });

      if (!usuario?.activo) {
        res.status(403).json({ error: "Usuario inactivo" });
        return;
      }

      const permisosExtra = (usuario.permisos as Permiso[] | null) ?? [];

      if (!tienePermiso(req.user.rol, permisosExtra, perm)) {
        res.status(403).json({ error: "Sin permiso para esta acción" });
        return;
      }

      next();
    } catch (err) {
      next(err);    // always delegate to Express error handler
    }
  };
```

**New `requireResponsableDeArea()` structure** — follows same async pattern, reading `areaSoporteId` from DB and a Json cast:
```typescript
// Add to roles.middleware.ts after requireRol

const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI", "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
] as const;

export const requireResponsableDeArea =
  (getTicketSubcategoria: (req: AuthRequest) => Promise<string | null>) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "No autenticado" }); return; }

    // ADMIN and MESA_AYUDA bypass — global scope
    if (req.user.rol === "ADMIN" || req.user.rol === "MESA_AYUDA") { next(); return; }

    if (!ROLES_RESPONSABLE.includes(req.user.rol as never)) {
      res.status(403).json({ error: "Sin permisos para esta acción" }); return;
    }

    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        select: { areaSoporteId: true, activo: true },    // narrow select
      });
      if (!usuario?.activo || !usuario.areaSoporteId) {
        res.status(403).json({ error: "Responsable sin área asignada" }); return;
      }

      const areaSoporte = await prisma.areaSoporte.findUnique({
        where: { id: usuario.areaSoporteId },
      });
      if (!areaSoporte) {
        res.status(403).json({ error: "Área de soporte no encontrada" }); return;
      }

      const subcategoriaTicket = await getTicketSubcategoria(req);
      const subcategorias = areaSoporte.subcategorias as string[];    // Json cast — same as permisos.middleware.ts:32
      if (subcategoriaTicket && !subcategorias.includes(subcategoriaTicket)) {
        res.status(403).json({ error: "Solicitud fuera del área de soporte asignada" }); return;
      }

      (req as any).areaSoporte = areaSoporte;    // attach for downstream service use
      next();
    } catch (err) { next(err); }
  };
```

**Alternative:** Put the area scope check inside the service functions instead of middleware. This avoids the async ticket lookup in middleware and is consistent with how `cambiarEstado` currently guards state transitions inside the service. The planner should choose — service-layer is less code and equally correct.

---

### `apps/api/src/services/tickets.service.ts` (service, CRUD)

**Analog:** `tickets.service.ts` itself — three functions need extension

**`listarTickets` role branches to extend** (lines 72-85 — current):
```typescript
if (user.rol === "EMPLEADO") {
  where.empleadoRfc = user.rfc;
} else if (
  user.rol === "TECNICO_TI" ||
  user.rol === "TECNICO_REDES" ||
  user.rol === "TECNICO_SERVICIOS"
) {
  where.tecnicoId = user.id;
  where.estado = { notIn: ["RESUELTO", "CANCELADO"] };
} else if (user.rol === "GESTOR_RECURSOS_MATERIALES") {
  where.categoria = "RECURSOS_MATERIALES";
}
// ADMIN, MESA_AYUDA — no filter (implicit fallthrough)
```

**Two branches to add to `listarTickets`:**
```typescript
// 1. New TECNICO_* roles see their own assigned active tickets (same as existing tecnico branch)
else if (
  user.rol === "TECNICO_ELECTRICISTA" ||
  user.rol === "TECNICO_PLOMERO" ||
  user.rol === "TECNICO_MOVILIDAD"
) {
  where.tecnicoId = user.id;
  where.estado = { notIn: ["RESUELTO", "CANCELADO"] };
}
// 2. RESPONSABLE_* see all tickets in their area's subcategorias (requires DB lookup)
else if (ROLES_RESPONSABLE.includes(user.rol as never)) {
  const usuarioDb = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { areaSoporteId: true },
  });
  if (usuarioDb?.areaSoporteId) {
    const areaSoporte = await prisma.areaSoporte.findUnique({ where: { id: usuarioDb.areaSoporteId } });
    if (areaSoporte) {
      where.subcategoria = { in: areaSoporte.subcategorias as string[] };
    }
  }
}
```

**`CATEGORIA_ROL_MAP` — current** (lines 323-327):
```typescript
const CATEGORIA_ROL_MAP: Record<string, string[]> = {
  TECNOLOGIAS: ["TECNICO_TI", "TECNICO_REDES"],
  SERVICIOS: ["TECNICO_SERVICIOS"],
  RECURSOS_MATERIALES: ["GESTOR_RECURSOS_MATERIALES"],
};
```

**Update `SERVICIOS` entry** (TECNICO_SERVICIOS kept for backwards compat with existing assigned tickets):
```typescript
SERVICIOS: ["TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD", "TECNICO_SERVICIOS"],
```

**`asignarTicket` — current guard structure** (lines 329-393): ticket not found → 404, has pasos → 400, tecnico not found → 404, rol mismatch → 400. Add after the `rolesPermitidos` check:
```typescript
// New guard for RESPONSABLE_* assigning within their area only
if (ROLES_RESPONSABLE.includes(user.rol as never)) {
  const usuarioDb = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { areaSoporteId: true },
  });
  const areaSoporte = usuarioDb?.areaSoporteId
    ? await prisma.areaSoporte.findUnique({ where: { id: usuarioDb.areaSoporteId } })
    : null;
  if (!areaSoporte) {
    throw Object.assign(new Error("Responsable sin área asignada"), { status: 403 });
  }
  const rolesArea = areaSoporte.rolesIncluidos as string[];
  if (!rolesArea.includes(tecnico.rol)) {
    throw Object.assign(
      new Error("El técnico no pertenece al área de soporte del responsable"),
      { status: 403 },
    );
  }
}
```

**`cambiarEstado` — error pattern** (lines 404-409 — `Object.assign` pattern):
```typescript
throw Object.assign(
  new Error(`Transición no permitida: ${ticket.estado} → ${body.estado}`),
  { status: 400 },
);
```

**`cambiarEstado` — area scope check to add** (after ticket not found guard, line 402):
```typescript
// Guard for RESPONSABLE_* — can only close/cancel tickets in their area
if (ROLES_RESPONSABLE.includes(user.rol as never)) {
  const usuarioDb = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { areaSoporteId: true },
  });
  const areaSoporte = usuarioDb?.areaSoporteId
    ? await prisma.areaSoporte.findUnique({ where: { id: usuarioDb.areaSoporteId } })
    : null;
  const subcategorias = (areaSoporte?.subcategorias as string[]) ?? [];
  if (!subcategorias.includes(ticket.subcategoria)) {
    throw Object.assign(new Error("Solicitud fuera del área de soporte asignada"), { status: 403 });
  }
}
```

**Critical bug to fix — `crearTicket` only generates pasos for TECNOLOGIAS** (line 247):
```typescript
// Current — broken for SERVICIOS tickets:
if (categoriaVal === "TECNOLOGIAS") { ... }

// Fix — extend condition:
if (["TECNOLOGIAS", "SERVICIOS"].includes(categoriaVal)) { ... }
```

---

### `apps/api/src/controllers/usuarios.controller.ts` (controller, CRUD)

**Analog:** `usuarios.controller.ts` itself — `userSelect`, `crear`, `actualizar` (lines 1-109)

**`userSelect` — current** (lines 8-22):
```typescript
const userSelect = {
  id: true, nombre: true, apellidos: true, usuario: true,
  email: true, telefono: true, rol: true, activo: true,
  permisos: true, esEmpleadoEstructura: true, empleadoId: true, rfc: true, createdAt: true,
};
```

**Add two fields to `userSelect`:**
```typescript
areaSoporteId: true,
areaSoporte: { select: { nombre: true } },   // for display in frontend
```

**`crear` — destructure pattern** (lines 34-58):
```typescript
const { password, esEmpleadoEstructura, empleadoId, rfc, permisos, ...rest } = req.body as { ... };
```

**Add `areaSoporteId` to destructure and validation:**
```typescript
const { password, esEmpleadoEstructura, empleadoId, rfc, permisos, areaSoporteId, ...rest } = req.body as {
  // ... existing types ...
  areaSoporteId?: number;
};

// Validation: RESPONSABLE_* requires areaSoporteId
const ROLES_RESPONSABLE_PREFIX = "RESPONSABLE_";
if ((rest.rol as string)?.startsWith(ROLES_RESPONSABLE_PREFIX) && !areaSoporteId) {
  res.status(400).json({ error: "El campo areaSoporteId es obligatorio para roles RESPONSABLE_*" });
  return;
}

// Include in create data:
await prisma.usuario.create({
  data: {
    ...rest,
    rol: rest.rol as never,
    password: hashedPassword,
    esEmpleadoEstructura: esEmpleadoEstructura ?? false,
    empleadoId: esEmpleadoEstructura ? (empleadoId ?? null) : null,
    rfc: esEmpleadoEstructura ? (rfc ?? null) : null,
    areaSoporteId: areaSoporteId ?? null,    // new field
    ...(permisos !== undefined && { permisos: permisos ?? [] }),
  },
  select: userSelect,
});
```

**`actualizar` — spread pattern** (lines 74-96):
```typescript
const { password, esEmpleadoEstructura, empleadoId, rfc, permisos, ...rest } = req.body;
const data: Record<string, unknown> = { ...rest };    // areaSoporteId flows through automatically
// But clear it when rol changes away from RESPONSABLE_*:
if (rest.rol && !(rest.rol as string).startsWith("RESPONSABLE_")) {
  data.areaSoporteId = null;
}
```

---

### `apps/api/src/routes/admin.routes.ts` (route, request-response)

**Analog:** `admin.routes.ts` itself (lines 1-37) — add one `GET /areas-soporte` endpoint; and `catalogos.routes.ts` for the pattern of a simple GET returning prisma query.

**Existing route registration pattern** (lines 25-29 of admin.routes.ts):
```typescript
// ── Usuarios (movido aquí desde /api/usuarios) ────────────────────────────────
router.get("/usuarios", usuariosCtrl.listar);
router.post("/usuarios", usuariosCtrl.crear);
router.get("/usuarios/:id", usuariosCtrl.obtener);
router.patch("/usuarios/:id", usuariosCtrl.actualizar);
router.delete("/usuarios/:id", usuariosCtrl.desactivar);
```

**Pattern — simple GET catalog endpoint** (`catalogos.controller.ts` lines 7-14):
```typescript
export const categorias = (_req: Request, res: Response) => {
  res.json({
    data: Object.entries(SUBCATEGORIAS_POR_CATEGORIA).map(([cat, subs]) => ({
      categoria: cat,
      subcategorias: subs,
    })),
  });
};
```

**New endpoint to add to `admin.routes.ts`** (behind existing `requireRol("ADMIN")` from line 11):
```typescript
// ── Áreas de Soporte ──────────────────────────────────────────────────────────
router.get("/areas-soporte", areasSoporteCtrl.listar);
```

The handler can be inlined in a new `areas-soporte.controller.ts` or added directly to `admin.controller.ts`:
```typescript
export const listarAreasSoporte = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.areaSoporte.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ data });
  } catch (err) { next(err); }
};
```

---

### `apps/web/src/pages/UsuariosPage.jsx` (component, request-response)

**Analog:** `UsuariosPage.jsx` itself — `ROLES_STAFF` (line 26), `emptyForm` (lines 36-40), `set()` helper (line 209), conditional RFC block (lines 447-483), `handleGuardar` payload cleanup (lines 177-184)

**`ROLES_STAFF` — current** (line 26):
```javascript
const ROLES_STAFF = ["ADMIN", "TECNICO_TI", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES"];
```

**Extend with all new roles** (note: `TECNICO_REDES` was already missing — add it too):
```javascript
const ROLES_STAFF = [
  "ADMIN", "MESA_AYUDA",
  "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
  "TECNICO_TI", "TECNICO_REDES",
  "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
  "TECNICO_SERVICIOS",   // keep — deprecated but visible for reasignación
  "GESTOR_RECURSOS_MATERIALES",
];

const RESPONSABLE_ROLES = [
  "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
];
```

**`emptyForm` — add `areaSoporteId`** (lines 36-40):
```javascript
const emptyForm = {
  nombre: "", apellidos: "", usuario: "", password: "", rol: "MESA_AYUDA",
  telefono: "", email: "",
  esEmpleadoEstructura: false, empleadoId: "", rfc: "",
  areaSoporteId: null,    // new field
};
```

**Conditional rendering pattern to copy** (lines 447-483 — shows RFC search only when switch is on):
```jsx
{form.esEmpleadoEstructura && (
  <Box>
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <TextField label="RFC del empleado" ... />
      <Button ... >Buscar</Button>
    </Box>
  </Box>
)}
```

**New AreaSoporte selector — same pattern:**
```jsx
{RESPONSABLE_ROLES.includes(form.rol) && (
  <FormControl fullWidth required>
    <InputLabel>Área de Soporte</InputLabel>
    <Select
      value={form.areaSoporteId ?? ""}
      label="Área de Soporte"
      onChange={(e) => set("areaSoporteId", e.target.value || null)}
    >
      {areasSoporte.map((a) => (
        <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
      ))}
    </Select>
  </FormControl>
)}
```

**Payload cleanup in `handleGuardar`** — follows `empleadoId`/`rfc` cleanup pattern (lines 181-184):
```javascript
// Current pattern for conditional fields:
if (!payload.esEmpleadoEstructura) {
  payload.empleadoId = null;
  payload.rfc = null;
}

// Copy for areaSoporteId:
if (!RESPONSABLE_ROLES.includes(payload.rol)) {
  payload.areaSoporteId = null;
}
```

**New API call needed** — `getAreasSoporte()` added to `apps/web/src/api/catalogos.js` (follows line 3 pattern):
```javascript
export const getAreasSoporte = () => api.get("/api/admin/areas-soporte").then((r) => r.data.data);
```

**Load in `useEffect`** — follows `loadSyncStatus` pattern (lines 58-63):
```javascript
const [areasSoporte, setAreasSoporte] = useState([]);
useEffect(() => {
  getAreasSoporte().then(setAreasSoporte).catch(() => {});
}, []);
```

---

### `apps/web/src/pages/AdminUsuariosPage.jsx` (component, request-response)

**Analog:** `AdminUsuariosPage.jsx` itself — `ROLES` (lines 16-19), `EMPTY_FORM` (lines 21-24), `handleRolChange` (lines 69-72), permisos conditional block (lines 248-287)

**`ROLES` — current** (lines 16-19):
```javascript
const ROLES = ["ADMIN", "MESA_AYUDA", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS", "GESTOR_RECURSOS_MATERIALES"];
```

**Extend with same list as UsuariosPage.jsx** and define `RESPONSABLE_ROLES` constant.

**`EMPTY_FORM` — add `areaSoporteId`** (lines 21-24):
```javascript
const EMPTY_FORM = {
  nombre: "", apellidos: "", usuario: "", password: "", email: "",
  telefono: "", rol: "MESA_AYUDA", activo: true, permisos: [],
  areaSoporteId: null,    // new field
};
```

**`handleRolChange` — must also reset `areaSoporteId`** (lines 69-72):
```javascript
const handleRolChange = (newRol) => {
  // Reset permisos extra AND clear areaSoporteId when leaving RESPONSABLE_* role
  const clearArea = !RESPONSABLE_ROLES.includes(newRol);
  setForm((f) => ({
    ...f,
    rol: newRol,
    permisos: [],
    areaSoporteId: clearArea ? null : f.areaSoporteId,
  }));
};
```

**Permisos conditional block — placement pattern** (lines 248-287): The AreaSoporte selector should appear BEFORE the permisos divider, following the same `{condition && <Box>...</Box>}` JSX pattern:
```jsx
{/* Selector AreaSoporte — solo para RESPONSABLE_* */}
{RESPONSABLE_ROLES.includes(form.rol) && (
  <FormControl size="small" fullWidth required>
    <InputLabel>Área de Soporte</InputLabel>
    <Select
      value={form.areaSoporteId ?? ""}
      label="Área de Soporte"
      onChange={(e) => setForm((f) => ({ ...f, areaSoporteId: e.target.value || null }))}
    >
      {areasSoporte.map((a) => (
        <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
      ))}
    </Select>
  </FormControl>
)}

<Divider />

{/* Permisos — existing block below */}
```

**API call — uses `admin.js` module** (different from UsuariosPage which uses `catalogos.js`). Add to `apps/web/src/api/admin.js`:
```javascript
export const getAreasSoporte = () => api.get("/api/admin/areas-soporte").then((r) => r.data.data);
```

**`abrirEditar` — must also populate `areaSoporteId`** (lines 58-67):
```javascript
const abrirEditar = (u) => {
  setEditId(u.id);
  setForm({
    nombre: u.nombre, apellidos: u.apellidos, usuario: u.usuario,
    password: "", email: u.email ?? "", telefono: u.telefono ?? "",
    rol: u.rol, activo: u.activo, permisos: u.permisos ?? [],
    areaSoporteId: u.areaSoporteId ?? null,    // new field
  });
  ...
};
```

---

### `apps/api/src/routes/tickets.routes.ts` — route guards to extend (route, request-response)

**Analog:** `tickets.routes.ts` itself (entire file, 42 lines)

**Current guards** (lines 20-35):
```typescript
router.patch("/:id/asignar", requireRol("ADMIN"), ctrl.asignar);
router.patch(
  "/:id/estado",
  requireRol("ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS", "EMPLEADO"),
  ctrl.cambiarEstado,
);
router.post(
  "/:id/comentarios",
  requireRol("ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS", "MESA_AYUDA"),
  ctrl.comentar,
);
router.patch(
  "/:id/pasos/:pasoId/completar",
  requireRol("TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS"),
  ctrl.completarPaso,
);
router.patch("/:id/pasos/:pasoId/asignar", requireRol("ADMIN", "MESA_AYUDA"), ctrl.asignarPaso);
```

**Extended guards for Phase 3** — add all new roles in same comma-list pattern:
```typescript
// /mis-pasos — new TECNICO_* see their own pasos
router.get(
  "/mis-pasos",
  requireRol("TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
             "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD"),
  ctrl.misPasos,
);

// asignar — RESPONSABLE_* can now assign (area scope enforced in service)
router.patch(
  "/:id/asignar",
  requireRol("ADMIN", "RESPONSABLE_TI", "RESPONSABLE_REDES",
             "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.asignar,
);

// estado — RESPONSABLE_* can close/cancel their area's tickets
router.patch(
  "/:id/estado",
  requireRol("ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
             "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
             "RESPONSABLE_TI", "RESPONSABLE_REDES",
             "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
             "EMPLEADO"),
  ctrl.cambiarEstado,
);

// comentarios — new TECNICO_* and RESPONSABLE_* can comment
router.post(
  "/:id/comentarios",
  requireRol("ADMIN", "MESA_AYUDA",
             "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
             "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
             "RESPONSABLE_TI", "RESPONSABLE_REDES",
             "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.comentar,
);

// completar paso — new TECNICO_* complete their own pasos
router.patch(
  "/:id/pasos/:pasoId/completar",
  requireRol("TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
             "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD"),
  ctrl.completarPaso,
);

// asignar paso — RESPONSABLE_* can assign pasos within their area
router.patch(
  "/:id/pasos/:pasoId/asignar",
  requireRol("ADMIN", "MESA_AYUDA",
             "RESPONSABLE_TI", "RESPONSABLE_REDES",
             "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.asignarPaso,
);
```

---

## Shared Patterns

### Error pattern — `Object.assign(new Error, { status })`
**Source:** `apps/api/src/services/tickets.service.ts` lines 311, 331, 336-338, 345, 350-357
**Apply to:** All new guards in `tickets.service.ts` and `roles.middleware.ts`
```typescript
throw Object.assign(new Error("Solicitud fuera del área de soporte asignada"), { status: 403 });
throw Object.assign(new Error("Responsable sin área asignada"), { status: 403 });
throw Object.assign(new Error("El técnico no pertenece al área de soporte del responsable"), { status: 403 });
```

### Prisma singleton import
**Source:** All existing controller and service files, e.g. `permisos.middleware.ts` line 4
**Apply to:** `roles.middleware.ts` new function, any new controller
```typescript
import { prisma } from "../config/database.js";
```

### Json field cast pattern
**Source:** `apps/api/src/middleware/permisos.middleware.ts` line 32
**Apply to:** `requireResponsableDeArea()` and all service functions reading `areaSoporte.subcategorias` or `areaSoporte.rolesIncluidos`
```typescript
const permisosExtra = (usuario.permisos as Permiso[] | null) ?? [];
// Phase 3 equivalent:
const subcategorias = areaSoporte.subcategorias as string[];
const rolesIncluidos = areaSoporte.rolesIncluidos as string[];
```

### Soft delete filter
**Source:** `tickets.service.ts` line 70 and all prisma queries
**Apply to:** `listarAreasSoporte` controller and any new queries touching `areaSoporte`
```typescript
where: { activo: true }
```

### Socket.IO — RESPONSABLE_* join:admin room
**Source:** Deferred to Phase 4 (per CONTEXT.md). In Phase 3, ensure frontend `notificaciones.js` includes RESPONSABLE_* roles in the condition that emits `join:admin`. No new events needed.

---

## Pitfalls to Surface in Plan

| # | Pitfall | File | Fix |
|---|---------|------|-----|
| P1 | `PERMISOS_DEFAULT` TypeScript exhaustive-key error | `shared/index.ts` | Add all 7 new roles before any build |
| P2 | `crearTicket` only generates pasos for TECNOLOGIAS | `tickets.service.ts` line ~247 | Extend `if` to `["TECNOLOGIAS", "SERVICIOS"].includes(categoriaVal)` |
| P3 | `UsuariosPage.jsx` sends `areaSoporteId` for non-RESPONSABLE roles | `UsuariosPage.jsx` | Clear in `handleGuardar` payload, following `empleadoId`/`rfc` cleanup pattern |
| P4 | TECNICO_SERVICIOS removed from enum | `schema.prisma` | Keep it — migration fails if any row still uses it |
| P5 | `RESPONSABLE_*` falls through to "see all" in `listarTickets` | `tickets.service.ts` | Add explicit `else if` branch BEFORE implicit admin/mesa_ayuda fallthrough |
| P6 | `AdminUsuariosPage` uses `admin.js` not `catalogos.js` | `AdminUsuariosPage.jsx` | Add `getAreasSoporte()` to `admin.js`, not `catalogos.js` |
| P7 | `TECNICO_REDES` missing from `ROLES_STAFF` in UsuariosPage | `UsuariosPage.jsx` line 26 | Add it when extending the array |

---

## No Analog Found

All files have close or exact analogs in the codebase. No files require external pattern references beyond what RESEARCH.md already documents.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/pages/`, `packages/database/prisma/`, `packages/shared/src/`
**Files read directly:** 16 source files
**Pattern extraction date:** 2026-05-13
