# Phase 2: Features Pendientes — Procesos y Flujos - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 4 files (all modifications to existing files)
**Analogs found:** 4 / 4 (100% coverage)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/services/tickets.service.ts` | service | CRUD | Same file (existing patterns) | exact |
| `apps/api/src/controllers/metricas.controller.ts` | controller | request-response | Same file (existing patterns) | exact |
| `packages/shared/src/index.ts` | utility/shared | transform (deletion) | Same file (existing patterns) | exact |
| `packages/database/prisma/seed.ts` | seed/database-init | batch | `packages/database/prisma/seed_procesos.ts` | role-match |

---

## Pattern Assignments

### `apps/api/src/services/tickets.service.ts` (service, CRUD)

**Analog:** Same file — existing patterns at lines 325–534

**Error handling pattern with status** (lines 307, 327, 332, 337, 472, 476):
```typescript
// Consistent error pattern: throw Object.assign(new Error(msg), { status: HTTP })
throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

// Validation errors
throw Object.assign(
  new Error("El usuario seleccionado no tiene el rol adecuado para solicitudes..."),
  { status: 400 },
);

// Auth errors (403)
throw Object.assign(
  new Error("No tienes el rol requerido para completar este paso"),
  { status: 403 },
);
```

**DB query pattern with include** (lines 39–53, 301–305):
```typescript
const ticketInclude = {
  area: true,
  empleado: { select: { rfc: true, nombreCompleto: true, areaId: true } },
  tecnico: { select: { id: true, nombre: true, apellidos: true } },
  creadoPor: { select: { id: true, nombre: true, rol: true } },
  historial: { orderBy: { createdAt: "asc" as const } },
  comentarios: {
    orderBy: { createdAt: "asc" as const },
    include: { usuario: { select: { nombre: true, apellidos: true, rol: true } } },
  },
  pasos: {
    orderBy: { orden: "asc" as const },
    include: { tecnico: { select: { id: true, nombre: true, apellidos: true, rol: true } } },
  },
};

// Usage in queries
const ticket = await prisma.ticket.findFirst({
  where: { id, activo: true },
  include: ticketInclude,
});
```

**ProcesoDefinicion query pattern** (to replace `getProcesoInfo()` in D-01):
```typescript
// From admin-procesos.controller.ts lines 9–10, adapted for tickets.service.ts
const proceso = await prisma.procesoDefinicion.findFirst({
  where: { subcategoria, subTipo, activo: true },
  include: { pasos: { orderBy: { orden: "asc" } } },
});
```

**Historial creation pattern** (lines 262–269, 352–360, 504–511):
```typescript
// Always record state transitions
await prisma.historialTicket.create({
  data: {
    ticketId: id,
    estadoAnterior: ticket.estado,  // D-13: read before update, don't hardcode
    estadoNuevo: "ASIGNADO",
    usuarioId: user.id,              // or undefined for empleado
    comentario: `Asignado a ${tecnico.nombre} ${tecnico.apellidos}`,
  },
});
```

**Paso-related query pattern** (lines 468–495, 536–572):
```typescript
// Find specific paso by id and ticketId
const paso = await prisma.pasoTicket.findFirst({
  where: { id: pasoId, ticketId },
});

// Find next paso: order by orden ASC, filter by estado (D-08 pattern)
const siguientePaso = await prisma.pasoTicket.findFirst({
  where: { ticketId, orden: { gt: paso.orden }, estado: { not: "COMPLETADO" } },
  orderBy: { orden: "asc" },
});

// Update paso with completion data
await prisma.pasoTicket.update({
  where: { id: pasoId },
  data: {
    estado: "COMPLETADO",
    completadoAt: new Date(),
    notas: body.notas ?? null,
    cantidadUnidades: body.cantidadUnidades ?? null,
  },
});
```

**Where clause guards pattern** (for D-10, D-11, D-12 new validations):
```typescript
// Guard: check if ticket has incomplete pasos before resolving (D-10)
const pasosPendientes = await prisma.pasoTicket.findMany({
  where: { ticketId: id, estado: { not: "COMPLETADO" } },
});
if (pasosPendientes.length > 0) {
  throw Object.assign(
    new Error("El ticket tiene pasos pendientes. Completa todos los pasos para resolver."),
    { status: 400 },
  );
}

// Guard: check if ticket has pasos before assigning (D-12)
const pasos = await prisma.pasoTicket.findMany({
  where: { ticketId: id },
});
if (pasos.length > 0) {
  throw Object.assign(
    new Error("Este ticket usa flujo de pasos. Asignar técnico desde el panel de pasos."),
    { status: 400 },
  );
}

// Filter for técnico view (D-11)
if (user.rol === "TECNICO_TI" || user.rol === "TECNICO_REDES" || user.rol === "TECNICO_SERVICIOS") {
  where.tecnicoId = user.id;
  where.estado = { notIn: ["RESUELTO", "CANCELADO"] };  // Add this line
}
```

**Tech identity validation pattern** (D-09: new validation):
```typescript
// At line 475 in completarPaso, ADD before role check:
if (paso.tecnicoId !== user.id) {
  throw Object.assign(
    new Error("Solo el técnico asignado puede completar este paso"),
    { status: 403 },
  );
}
```

**Socket.IO emission pattern** (lines 272–279, 368–378, 513–531):
```typescript
// All emissions go through notificaciones.service, never direct io.emit()
import * as notif from "./notificaciones.service.js";

// Emit when creating ticket
await notif.emitirTicketNuevo({
  id: ticket.id,
  asunto: ticket.asunto,
  categoria: ticket.categoria,
  prioridad: ticket.prioridad,
  empleadoRfc,
  areaLabel: area.label,
});

// Emit when assigning ticket
await notif.emitirTicketAsignado({
  ticketId: id,
  asunto: ticket.asunto,
  prioridad: ticket.prioridad,
  tecnicoId,
  tecnicoNombre: `${tecnico.nombre} ${tecnico.apellidos}`,
  adminNombre: user.nombre,
  empleadoRfc: ticket.empleadoRfc,
  empleadoNombre: empleado?.nombreCompleto ?? ticket.empleadoRfc,
  areaLabel: updated.area?.label ?? "",
});

// Emit when paso is ready for next assignment
await notif.emitirPasoListo({
  ticketId,
  pasoOrden: siguientePaso.orden,
  pasoNombre: siguientePaso.nombre ?? `Paso ${siguientePaso.orden}`,
  rolRequerido: siguientePaso.rolRequerido,
  asunto: ticket!.asunto,
  empleadoRfc: ticket!.empleadoRfc,
});
```

---

### `apps/api/src/controllers/metricas.controller.ts` (controller, request-response)

**Analog:** Same file — existing patterns at lines 1–80

**Imports pattern** (lines 1–6):
```typescript
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";
import type { MetricasSolicitudesResponse, MetricaTecnico, MetricaProceso } from "@stf/shared";
// REMOVE: import { getProcesoKey, PROCESO_MAP } from "@stf/shared";
```

**Prisma query for metrics grouping** (lines 38–65):
```typescript
// Group by categoría
const porCategoriaRaw = await prisma.ticket.groupBy({
  by: ["categoria"],
  where,
  _count: { _all: true },
  orderBy: { _count: { categoria: "desc" } },
});
const porCategoria = porCategoriaRaw.map((r) => ({
  categoria: r.categoria as string,
  total: r._count._all,
}));

// Raw SQL for nullable fields like subTipo (existing pattern)
type SubcatRow = { subcategoria: string; sub_tipo: string | null; total: bigint };
const porSubcategoriaRaw = await prisma.$queryRaw<SubcatRow[]>`
  SELECT subcategoria, sub_tipo, COUNT(*) AS total
  FROM tickets
  WHERE activo = true
    AND (${fechaFiltro?.gte ?? null} IS NULL OR created_at >= ${fechaFiltro?.gte ?? null})
    AND (${fechaFiltro?.lte ?? null} IS NULL OR created_at <= ${fechaFiltro?.lte ?? null})
  GROUP BY subcategoria, sub_tipo
  ORDER BY total DESC
`;
```

**Replace PROCESO_MAP reference with DB query** (where metricas currently reads process info):
```typescript
// OLD: const procesos = PROCESO_MAP; // hardcoded
// NEW: read from DB with analogous pattern
const procesos = await prisma.procesoDefinicion.findMany({
  where: { activo: true },
  include: { pasos: { orderBy: { orden: "asc" } } },
  orderBy: [{ subcategoria: "asc" }, { subTipo: "asc" }],
});

// Then adapt existing metric calculation logic to use procesos from DB
```

**Try/catch pattern** (standard for all controllers):
```typescript
export const metricasSolicitudes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // ... logic ...
    res.json({ data: porCategoria });
  } catch (err) {
    next(err);  // Pass to centralized error handler
  }
};
```

---

### `packages/shared/src/index.ts` (utility/shared, transform)

**Analog:** Same file — functions to delete at lines ~472–621

**Functions to REMOVE** (D-04):
```typescript
// Delete these entire functions:
// - PROCESO_MAP (lines ~472–621, large multi-line object)
// - getProcesoKey(subcategoria: string, subTipo?: string | null): string
// - getProcesoInfo(subcategoria: string, subTipo?: string | null): ProcesoInfo | null

// Also remove ProcesoInfo type if it's only used by these functions
export type ProcesoInfo = { 
  nombre: string; 
  tipoFlujo: "DIRECTO" | "SECUENCIAL" | "PENDIENTE"; 
  pasos: Array<{ ... }>;
  ...
};
```

**Impact scope:**
- Remove import in `tickets.service.ts` line 6: `getProcesoInfo`
- Remove import in `metricas.controller.ts` line 5: `getProcesoKey`, `PROCESO_MAP`
- Grep for any other imports of `PROCESO_MAP` or `getProcesoInfo` in the codebase and remove them

---

### `packages/database/prisma/seed.ts` (seed/database-init, batch)

**Analog:** `packages/database/prisma/seed_procesos.ts` (lines 1–84)

**Seed structure** (seed.ts already exists; add seedProcesos call):
```typescript
import { PrismaClient, PisoEdificio, Rol } from "@prisma/client";
import bcrypt from "bcrypt";
import { seedProcesos } from "./seed_procesos.js";  // Already imported

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed SIAST...");

  // ... existing cleanup (deleteMany) and areas upsert ...

  // ADD THIS SECTION after areas are seeded (D-02):
  // ──────────────────────────────────────────────────────────────
  // 3. PROCESOS Y PASOS (mediante seed_procesos.ts idempotente)
  // ──────────────────────────────────────────────────────────────
  await seedProcesos(prisma);
  console.log("Procesos y pasos sembrados desde PROCESO_MAP.");

  // ... rest of existing seed (users, etc.) ...
}
```

**Idempotent upsert pattern from seed_procesos.ts** (lines 13–84):
```typescript
/**
 * Patrón idempotente: findFirst + update OR create
 * No usa Prisma upsert porque subTipo puede ser null
 * y Prisma no maneja bien nulls en claves únicas compuestas
 */
export async function seedProcesos(prisma: PrismaClient): Promise<void> {
  console.log("Sembrando procesos de flujo (ProcesoDefinicion + PasoDefinicion)...");

  for (const [key, procesoInfo] of Object.entries(PROCESO_MAP)) {
    // Parse key: "SUBCATEGORIA" or "SUBCATEGORIA:SUBTIPO"
    const colonIdx = key.indexOf(":");
    const subcategoria = (colonIdx === -1 ? key : key.slice(0, colonIdx)) as SubcategoriaTicket;
    const subTipo = colonIdx === -1 ? null : key.slice(colonIdx + 1);

    // Step 1: Try to find existing proceso
    const existing = await prisma.procesoDefinicion.findFirst({
      where: { subcategoria, subTipo: subTipo ?? null },
    });

    let procesoId: number;

    if (existing) {
      // Step 2a: Update existing
      await prisma.procesoDefinicion.update({
        where: { id: existing.id },
        data: {
          tipoFlujo: procesoInfo.tipoFlujo,
          nombre: procesoInfo.nombre,
          descripcion: procesoInfo.descripcion ?? null,
          activo: true,
        },
      });
      procesoId = existing.id;

      // Delete previous pasos to recreate fresh
      await prisma.pasoDefinicion.deleteMany({ where: { procesoId } });
    } else {
      // Step 2b: Create new proceso
      const created = await prisma.procesoDefinicion.create({
        data: {
          subcategoria,
          subTipo: subTipo ?? null,
          tipoFlujo: procesoInfo.tipoFlujo,
          nombre: procesoInfo.nombre,
          descripcion: procesoInfo.descripcion ?? null,
          activo: true,
        },
      });
      procesoId = created.id;
    }

    // Step 3: Create pasos for this proceso
    for (const paso of procesoInfo.pasos) {
      await prisma.pasoDefinicion.create({
        data: {
          procesoId,
          orden: paso.orden,
          rolRequerido: paso.rolRequerido,
          nombre: paso.nombre,
          descripcion: paso.descripcion ?? null,
          registraUnidades: paso.registraUnidades ?? false,
          labelUnidades: paso.labelUnidades ?? null,
        },
      });
    }

    const subLabel = subTipo ? `:${subTipo}` : "";
    console.log(
      `  [${existing ? "UPDATED" : "CREATED"}] ${subcategoria}${subLabel} — "${procesoInfo.nombre}" (${procesoInfo.pasos.length} paso(s))`,
    );
  }

  const total = Object.keys(PROCESO_MAP).length;
  console.log(`Procesos sembrados: ${total} proceso(s) listos.`);
}
```

---

## Shared Patterns

### Error Handling
**Source:** `apps/api/src/services/tickets.service.ts` (throughout)
**Apply to:** All validation guards in `tickets.service.ts` modifications

Pattern: Use `Object.assign(new Error(msg), { status: HTTP_CODE })` — centralized error middleware catches and extracts `.status` property.

```typescript
throw Object.assign(new Error("Descriptive message"), { status: 400 });
throw Object.assign(new Error("Descriptive message"), { status: 403 });
throw Object.assign(new Error("Descriptive message"), { status: 404 });
```

---

### Socket.IO Event Emission
**Source:** `apps/api/src/services/notificaciones.service.ts` (lines 1–200)
**Apply to:** All paso-related events in `completarPaso` and `asignarPaso`

Pattern: **Never** call `io.emit()` directly. Always use wrapper functions in `notificaciones.service.ts`:
- `emitirPasoAsignado()` — emits to `user:{tecnicoId}` (D-14)
- `emitirPasoListo()` — emits to `admins` room (D-15)
- `emitirCambioEstado()` — existing, update estadoAnterior to use read value (D-13)

```typescript
// All paso-related emissions follow this pattern
io?.to(`user:${params.tecnicoId}`).emit("ticket:paso_asignado", { ... });
io?.to("admins").emit("ticket:paso_listo", { ... });
```

---

### Database Query Patterns
**Source:** `apps/api/src/controllers/admin-procesos.controller.ts` (lines 7–30)
**Apply to:** All ProcesoDefinicion queries in `tickets.service.ts` and `metricas.controller.ts`

Pattern: Always include `pasos` relation with `orderBy: { orden: "asc" }` to maintain step order.

```typescript
const proceso = await prisma.procesoDefinicion.findFirst({
  where: { subcategoria, subTipo, activo: true },
  include: { pasos: { orderBy: { orden: "asc" } } },
});

const procesos = await prisma.procesoDefinicion.findMany({
  where: { activo: true },
  include: { pasos: { orderBy: { orden: "asc" } } },
  orderBy: [{ subcategoria: "asc" }, { subTipo: "asc" }],
});
```

---

## No Analog Found

None. All files being modified are pre-existing with established patterns. Phase 2 is entirely refactoring and fixing, not building from scratch.

---

## Metadata

**Analog search scope:** 
- `apps/api/src/services/` — 8 service files scanned
- `apps/api/src/controllers/` — 10 controller files scanned
- `packages/database/prisma/` — 3 seed files scanned
- `packages/shared/src/` — 1 index file (export module)

**Files scanned:** 22
**Pattern extraction date:** 2026-05-08

---

## Key Insights

1. **Error handling is consistent:** All services use `Object.assign(new Error(msg), { status })` for typed errors.
2. **ticketInclude object is reusable:** Already defined at line 39–53 in tickets.service.ts; use everywhere ticket is fetched.
3. **Socket.IO goes through notificaciones.service:** No direct `io.emit()` calls from service layer.
4. **Seed is idempotent:** seed_procesos.ts handles null subTipo correctly via findFirst + update/create pattern.
5. **DB is single source of truth:** After D-02 (seed populates ProcesoDefinicion), all queries read from DB, never from PROCESO_MAP.
6. **Step order is critical:** All pasos queries must include `orderBy: { orden: "asc" }` to maintain consistency.

