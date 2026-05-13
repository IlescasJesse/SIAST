---
phase: 02-features-pendientes-procesos-y-flujos
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - apps/api/src/services/tickets.service.ts
  - apps/api/src/controllers/metricas.controller.ts
  - packages/shared/src/index.ts
  - packages/database/prisma/seed_procesos.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Fase 02: Reporte de Revisión de Código (re-revisión 2026-05-13)

**Revisado:** 2026-05-13
**Profundidad:** standard
**Archivos revisados:** 4
**Estado:** issues_found

---

## Resumen

Re-revisión enfocada en los cuatro archivos del alcance declarado. Se confirma que varios hallazgos de la revisión anterior (CR-01 folio race condition, WR-04 técnico activo, IN-02 duplicación de subtipos) siguen sin corregirse. Se agregan hallazgos nuevos derivados de la implementación de `asignarPaso` / `historialTicket` (NOT-02), la validación de fechas en métricas, y el riesgo de eliminación de `PasoDefinicion` en el seed. El N+1 en `metricasTecnicos` es nuevo y se clasifica como BLOCKER porque puede agotar el pool de Prisma bajo carga real.

---

## Problemas Críticos

### CR-01: Race condition en `generarFolio` — folios duplicados bajo carga concurrente

**Archivo:** `apps/api/src/services/tickets.service.ts:21-29`

**Problema:** `generarFolio` realiza `COUNT` y luego `create` en operaciones separadas sin transacción ni bloqueo de fila. Dos requests concurrentes con la misma subcategoría pueden leer el mismo `count` y generar el mismo folio. Si `folio` tiene restricción `UNIQUE` en la BD, la segunda escritura produce un error 500 sin mensaje claro al cliente. Si no tiene la restricción, los duplicados son silenciosos.

Este hallazgo fue reportado en la revisión anterior (CR-03) y no fue corregido.

```typescript
// Corrección mínima — transacción serializable:
async function generarFolio(categoria: string, subcategoria: string): Promise<string> {
  const key = `${categoria}-${subcategoria}`;
  const prefix = FOLIO_PREFIX[key] ?? "TIC";
  return prisma.$transaction(async (tx) => {
    const count = await tx.ticket.count({ where: { folio: { startsWith: prefix } } });
    const num = String(count + 1).padStart(4, "0");
    return `${prefix}-${num}`;
  }, { isolationLevel: "Serializable" });
}
```

---

### CR-02: N+1 queries en `metricasTecnicos` puede agotar el pool de conexiones de Prisma

**Archivo:** `apps/api/src/controllers/metricas.controller.ts:122-161`

**Problema:** El loop `for (const tecnico of tecnicos)` ejecuta 4 queries Prisma seriales por técnico: `pasoTicket.count` (asignados), `pasoTicket.count` (completados), `pasoTicket.aggregate` (unidades), `pasoTicket.findMany` (fechas). Con el rol `TECNICO_TI`, `TECNICO_REDES` y `TECNICO_SERVICIOS` activos en producción (p. ej. 12 técnicos), esto genera 48 queries seriales por llamada al endpoint. El pool de conexiones de Prisma es 10 por defecto. Si varias solicitudes de métricas llegan simultáneamente, el pool se agota y las peticiones de otros endpoints (`crearTicket`, `cambiarEstado`) también quedan bloqueadas, provocando timeouts en operaciones críticas de negocio.

Esto no es solo un problema de rendimiento: es un riesgo de correctness bajo carga concurrente real.

```typescript
// Corrección — consolidar en groupBy fuera del loop:
const statsAsignados = await prisma.pasoTicket.groupBy({
  by: ["tecnicoId"],
  where: { tecnicoId: { not: null } },
  _count: { _all: true },
});
const statsCompletados = await prisma.pasoTicket.groupBy({
  by: ["tecnicoId"],
  where: { tecnicoId: { not: null }, estado: "COMPLETADO" },
  _count: { _all: true },
  _sum: { cantidadUnidades: true },
});
const pasosFecha = await prisma.pasoTicket.findMany({
  where: { estado: "COMPLETADO", completadoAt: { not: null } },
  select: { tecnicoId: true, createdAt: true, completadoAt: true },
});
// Cruzar con la lista de técnicos en memoria (O(n) JS).
```

---

## Advertencias

### WR-01: `asignarPaso` — `estadoAnteriorTicket` usa valor sintético si `findUnique` devuelve null

**Archivo:** `apps/api/src/services/tickets.service.ts:595-597`

**Problema:** Si `prisma.ticket.findUnique` devuelve `null` (ticket borrado suavemente entre la validación del paso y esta query), el código colapsa silenciosamente al literal `"ASIGNADO"`. Ese valor puede ser incorrecto (el ticket podría estar en `"ABIERTO"`) y produce una entrada de `historialTicket` con `estadoAnterior` falso. El código debería lanzar error en este caso, no continuar con datos inventados.

```typescript
// Actual — fallback silencioso incorrecto:
const estadoAnteriorTicket = (
  await prisma.ticket.findUnique({ where: { id: ticketId }, select: { estado: true } })
)?.estado ?? "ASIGNADO";

// Corrección:
const ticketActual = await prisma.ticket.findUnique({
  where: { id: ticketId },
  select: { estado: true },
});
if (!ticketActual) {
  throw Object.assign(new Error("Ticket no encontrado"), { status: 404 });
}
const estadoAnteriorTicket = ticketActual.estado;
```

---

### WR-02: `asignarPaso` no verifica que el técnico esté activo

**Archivo:** `apps/api/src/services/tickets.service.ts:586`

**Problema:** `prisma.usuario.findUnique({ where: { id: tecnicoId } })` no filtra `activo: true`. Un técnico dado de baja puede ser asignado a un paso del flujo. La función `asignarTicket` (línea 343) sí usa `activo: true`, por lo que es una inconsistencia deliberada o un olvido.

Este hallazgo fue reportado como WR-04 en la revisión anterior y no fue corregido.

```typescript
// Corrección:
const tecnico = await prisma.usuario.findFirst({ where: { id: tecnicoId, activo: true } });
if (!tecnico) {
  throw Object.assign(new Error("Técnico no encontrado o inactivo"), { status: 404 });
}
```

---

### WR-03: `completarPaso` — actualización a RESUELTO no verifica activo del ticket

**Archivo:** `apps/api/src/services/tickets.service.ts:540-543`

**Problema:** Cuando todos los pasos se completan, `prisma.ticket.update` actualiza el ticket a `RESUELTO` sin verificar `activo: true`. Si el ticket fue cancelado (soft-delete, `activo = false`) entre el inicio y el fin del completado, el update procede igualmente, dejando el ticket con `estado = RESUELTO` y `activo = false` simultáneamente, un estado incoherente que confunde las queries de `listarTickets` que filtran `activo: true`.

```typescript
// Corrección — agregar activo: true al where del update:
const ticket = await prisma.ticket.update({
  where: { id: ticketId, activo: true },  // Prisma lanza P2025 si no existe
  data: { estado: "RESUELTO", fechaResolucion: new Date() },
  include: ticketInclude,
});
```

---

### WR-04: `seed_procesos.ts` — `deleteMany` de `PasoDefinicion` sin transacción ni verificación de pasos activos

**Archivo:** `packages/database/prisma/seed_procesos.ts:222-253`

**Problema:** Al actualizar un proceso existente, el seed borra todos sus `PasoDefinicion` (línea 224) y los recrea en un loop. Hay dos sub-problemas:

1. Si el proceso falla entre el `deleteMany` y el final del loop de `create`, el proceso queda sin pasos en DB. El campo `proceso.pasos.length > 0` en `tickets.service.ts:252` hará que los tickets futuros de esa subcategoría se creen sin pasos, silenciosamente.
2. Si hay `PasoTicket` activos (estado `PENDIENTE` o `EN_PROGRESO`) que referencian estos `PasoDefinicion` y la FK tiene `onDelete: Restrict`, el `deleteMany` falla con un error de FK en producción.

```typescript
// Corrección — envolver en transacción y verificar pasos activos:
await prisma.$transaction(async (tx) => {
  const pasosActivosCount = await tx.pasoTicket.count({
    where: { pasoDefinicionId: { in: existingPasos.map(p => p.id) }, estado: { not: "COMPLETADO" } },
  });
  if (pasosActivosCount > 0) {
    console.warn(`[SKIP] ${subcategoria} — ${pasosActivosCount} pasos activos en uso`);
    return;
  }
  await tx.procesoDefinicion.update({ where: { id: existing.id }, data: { ... } });
  await tx.pasoDefinicion.deleteMany({ where: { procesoId } });
  for (const paso of procesoInfo.pasos) {
    await tx.pasoDefinicion.create({ data: { procesoId, ...paso } });
  }
});
```

---

### WR-05: `metricasSolicitudes` — parámetros de fecha sin validación de formato

**Archivo:** `apps/api/src/controllers/metricas.controller.ts:23-29`

**Problema:** `new Date(desde)` y `new Date(hasta)` aceptan cualquier string. Con una cadena inválida como `"ayer"` o `""`, `new Date()` produce `Invalid Date`. Prisma recibe un objeto `Date` inválido y lanza un error genérico 500 que puede exponer el stack trace al cliente dependiendo del error handler configurado. El parámetro `slaHoras` (línea 179 de `metricasProcesos`) tiene el mismo problema con `Number()` que produce `NaN`.

```typescript
// Corrección para fechas:
if (desde && isNaN(new Date(desde).getTime())) {
  res.status(400).json({ error: "Parámetro 'desde' tiene formato de fecha inválido" });
  return;
}
if (hasta && isNaN(new Date(hasta).getTime())) {
  res.status(400).json({ error: "Parámetro 'hasta' tiene formato de fecha inválido" });
  return;
}

// Corrección para slaHoras:
const slaHorasRaw = Number(req.query.slaHoras ?? 24);
if (!Number.isFinite(slaHorasRaw) || slaHorasRaw <= 0) {
  res.status(400).json({ error: "El parámetro slaHoras debe ser un número positivo" });
  return;
}
```

---

## Informativos

### IN-01: `GESTOR_RECURSOS_MATERIALES` tiene `metricas.ver` en permisos pero no en la ruta

**Archivo:** `packages/shared/src/index.ts:542` y `apps/api/src/routes/metricas.routes.ts:12`

**Problema:** `PERMISOS_DEFAULT` otorga `"metricas.ver"` al rol `GESTOR_RECURSOS_MATERIALES`, pero `requireRol` en `metricas.routes.ts` no incluye ese rol. El gestor no puede acceder a `/api/metricas/solicitudes` pese a que su permiso declarado lo habilita. Es una inconsistencia entre el catálogo de permisos y la implementación real de las rutas.

```typescript
// metricas.routes.ts — corrección:
const rolesMetricas = requireRol(
  "ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
  "GESTOR_RECURSOS_MATERIALES",
);
```

---

### IN-02: `SUB_TIPO_EQUIPOS` y `SUBTIPO_EQUIPOS` — duplicación de constantes en shared

**Archivo:** `packages/shared/src/index.ts:320-329` y `424-433`

**Problema:** `SUB_TIPO_EQUIPOS` (array `{value, label}`, línea 320) y `SUBTIPO_EQUIPOS` (objeto `as const`, línea 424) cubren los mismos ocho valores pero con distinta estructura. Si se agrega un subtipo a uno pero no al otro, el formulario del frontend y la lógica del backend quedan desincronizados silenciosamente.

Este hallazgo fue reportado como IN-02 en la revisión anterior y no fue corregido.

**Sugerencia:** Eliminar `SUB_TIPO_EQUIPOS` y derivarlo de `SUBTIPO_EQUIPOS`:
```typescript
// SUBTIPO_EQUIPOS es la fuente de verdad
export const SUB_TIPO_EQUIPOS = Object.keys(SUBTIPO_EQUIPOS).map((value) => ({
  value,
  label: value, // reemplazar con LABEL_SUBTIPO_EQUIPOS[value] si se agrega ese mapa
}));
```

---

### IN-03: Paginación en `listarTickets` es incorrecta — se pagina antes de reordenar

**Archivo:** `apps/api/src/services/tickets.service.ts:92-132`

**Problema:** `skip` y `take` se aplican en la query de Prisma (línea 98-99) antes de que `computeAutoPriority` recalcule la prioridad de cada ticket en JS y se reordene el array. El usuario que pide la página 2 puede ver tickets que deberían estar en la página 1 según la prioridad calculada en runtime. El contador `total` devuelto es correcto, pero las ventanas paginadas son inconsistentes entre recargas (ya que `Date.now()` cambia).

**Sugerencia:** Si la paginación correcta es un requisito, persista el campo `prioridad` calculado en la BD y ordene desde Prisma, o elimine la paginación del lado del servidor y devuelva el set completo para ordenar en el cliente.

---

_Revisado: 2026-05-13_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidad: standard_
