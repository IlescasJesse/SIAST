---
phase: 02-features-pendientes-procesos-y-flujos
reviewed: 2026-05-11T19:04:54Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/shared/src/index.ts
  - packages/database/prisma/seed.ts
  - apps/api/src/services/tickets.service.ts
  - apps/api/src/controllers/metricas.controller.ts
  - packages/database/prisma/seed_procesos.ts
findings:
  critical: 3
  warning: 6
  info: 2
  total: 11
status: issues_found
---

# Phase 02: Code Review Report — Procesos y Flujos

**Reviewed:** 2026-05-11T19:04:54Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Se revisaron los cinco archivos de la fase 2 que cubren: la migración del catálogo de procesos de constante en memoria a DB (`procesoDefinicion`), los guards D-08 a D-13 en `tickets.service.ts`, la remoción de `PROCESO_MAP` del paquete compartido, y las nuevas queries de métricas.

Los bugs críticos se concentran en dos áreas: (1) la autorización de `completarPaso` permite que cualquier técnico con el rol correcto complete pasos ajenos cuando no hay `tecnicoId` asignado aún, y (2) el parámetro `slaHoras` en métricas no tiene validación, permitiendo valores negativos o `NaN` que producen resultados silenciosamente incorrectos. Un tercer bug crítico es un folio potencialmente duplicado por race condition en `generarFolio`.

Las advertencias cubren: N+1 queries en el loop de métricas de procesos, un seed que borra pasos en producción sin transacción (riesgo de estado parcialmente roto si el proceso falla a mitad), y varios problemas de tipo TypeScript (`as never`) que ocultan errores en tiempo de compilación.

---

## Critical Issues

### CR-01: Guard D-09 incompleto — técnico sin asignar puede completar cualquier paso

**File:** `apps/api/src/services/tickets.service.ts:502`

**Issue:** El guard que verifica la identidad del técnico solo aplica cuando `paso.tecnicoId !== null`. Cuando un paso aún no tiene técnico asignado (`tecnicoId === null`), la condición `paso.tecnicoId !== null && paso.tecnicoId !== user.id` es `false`, por lo que cualquier técnico con el rol correcto puede completar ese paso. El guard de rol (línea 508) no suple esta brecha: todos los `TECNICO_TI` tienen el mismo rol.

```typescript
// Código actual — vulnerable cuando tecnicoId es null
if (paso.tecnicoId !== null && paso.tecnicoId !== user.id) {
  throw Object.assign(
    new Error("Solo el técnico asignado puede completar este paso"),
    { status: 403 },
  );
}
```

**Fix:** Rechazar explícitamente cuando el paso no tiene técnico asignado, o alternativamente permitirlo solo si el usuario tiene el permiso `pasos.completar_cualquiera`:

```typescript
// Opción A — bloquear hasta que el paso esté asignado
if (paso.tecnicoId === null) {
  throw Object.assign(
    new Error("El paso aún no tiene técnico asignado. Asigna un técnico primero."),
    { status: 400 },
  );
}
if (paso.tecnicoId !== user.id) {
  throw Object.assign(
    new Error("Solo el técnico asignado puede completar este paso"),
    { status: 403 },
  );
}
```

---

### CR-02: `slaHoras` sin validación — NaN y valores negativos silenciosamente incorrectos

**File:** `apps/api/src/controllers/metricas.controller.ts:179`

**Issue:** `Number(req.query.slaHoras ?? 24)` produce `NaN` si el cliente envía una cadena no numérica (p. ej. `?slaHoras=abc`). Con `NaN`, la comparación `diff <= slaMs` siempre es `false`, por lo que `resueltasATiempo` siempre resulta en 0 sin error visible. Con un valor negativo (`?slaHoras=-1`), `slaMs` es negativo y todos los tickets cuentan como fuera de SLA.

```typescript
// Actual
const slaHoras = Number(req.query.slaHoras ?? 24);
```

**Fix:**
```typescript
const slaHorasRaw = Number(req.query.slaHoras ?? 24);
if (!Number.isFinite(slaHorasRaw) || slaHorasRaw <= 0) {
  res.status(400).json({ error: "El parámetro slaHoras debe ser un número positivo" });
  return;
}
const slaHoras = slaHorasRaw;
const slaMs = slaHoras * 3600 * 1000;
```

---

### CR-03: Race condition en `generarFolio` — folios duplicados bajo carga concurrente

**File:** `apps/api/src/services/tickets.service.ts:21`

**Issue:** La generación del folio hace `COUNT` y luego `create` en dos operaciones separadas sin transacción ni bloqueo. Si dos requests concurrentes crean tickets de la misma subcategoría simultáneamente, ambas pueden leer el mismo `count`, produciendo el mismo folio. Esto viola la unicidad del folio como identificador de negocio.

```typescript
async function generarFolio(categoria: string, subcategoria: string): Promise<string> {
  const key = `${categoria}-${subcategoria}`;
  const prefix = FOLIO_PREFIX[key] ?? "TIC";
  const count = await prisma.ticket.count({          // ← lee N
    where: { folio: { startsWith: prefix } },
  });
  const num = String(count + 1).padStart(4, "0");    // ← calcula N+1
  return `${prefix}-${num}`;                         // ← otro request puede leer el mismo N
}
```

**Fix:** Usar una columna `autoincrement` por prefijo en DB, o agregar una restricción `UNIQUE` sobre `folio` en el schema de Prisma y reintentar ante conflicto. Solución mínima: envolver la lectura + escritura del ticket en una transacción serializable (`prisma.$transaction([...], { isolationLevel: 'Serializable' })`). La opción más robusta es un contador dedicado por prefijo con bloqueo.

---

## Warnings

### WR-01: N+1 queries en `metricasProcesos` — una query por grupo por iteración

**File:** `apps/api/src/controllers/metricas.controller.ts:192`

**Issue:** El loop sobre `grupos` ejecuta 3 queries adicionales por iteración: `procesoDefinicion.findFirst`, `ticket.findMany` (resueltos), y `pasoTicket.aggregate`. Con 15 subcategorías/sub-tipos activos esto ya son 45 queries; si crece el catálogo o hay muchos sub-tipos el tiempo de respuesta se degradará linealmente. Aunque el rendimiento está fuera de scope v1, estas queries dentro de un loop son también un problema de **corrección bajo carga**: si una query falla a mitad del loop, el array `resultado` devuelto es parcial y la respuesta llega con datos incompletos sin error HTTP.

**Fix:** Mover las queries de `ticket.findMany` resueltos y `pasoTicket.aggregate` a joins o sub-queries raw de SQL fuera del loop para obtener todos los datos en 2–3 queries totales. Para el error parcial, envolver el loop en la misma `try/catch` general (ya está) pero agregar un check de `resultado.length === grupos.length` antes de responder.

---

### WR-02: `seed.ts` — `deleteMany` sin transacción, estado parcial si el seed falla

**File:** `packages/database/prisma/seed.ts:15`

**Issue:** Las líneas 15–19 eliminan datos transaccionales en secuencia sin transacción. Si el proceso muere entre dos `deleteMany` (p. ej. al eliminar `pasoTicket` pero antes de eliminar `ticket`), la base de datos queda en estado inconsistente con referencias huérfanas. El efecto es más grave porque el seed también llama a `deleteMany({})` en producción si se ejecuta accidentalmente.

```typescript
await prisma.notificacion.deleteMany({});
await prisma.comentario.deleteMany({});
await prisma.historialTicket.deleteMany({});
await prisma.pasoTicket.deleteMany({});
await prisma.ticket.deleteMany({});
await prisma.usuario.deleteMany({});
```

**Fix:** Envolver en `prisma.$transaction`:
```typescript
await prisma.$transaction([
  prisma.notificacion.deleteMany({}),
  prisma.comentario.deleteMany({}),
  prisma.historialTicket.deleteMany({}),
  prisma.pasoTicket.deleteMany({}),
  prisma.ticket.deleteMany({}),
  prisma.usuario.deleteMany({}),
]);
```

---

### WR-03: `seed_procesos.ts` — `deleteMany` + re-creación de pasos sin transacción

**File:** `packages/database/prisma/seed_procesos.ts:224`

**Issue:** Al actualizar un proceso existente, el seed borra todos sus `PasoDefinicion` (línea 224) y luego los re-crea en un loop (líneas 241–253). Si el proceso falla después del `deleteMany` pero antes de que todos los pasos sean recreados, el proceso queda sin pasos en DB. Los tickets futuros de esa subcategoría se crearán sin pasos de flujo (la condición `proceso.pasos.length > 0` en `tickets.service.ts:252` lo omite silenciosamente).

**Fix:** Envolver la secuencia `update + deleteMany + createMany` en una transacción por proceso:
```typescript
await prisma.$transaction(async (tx) => {
  await tx.procesoDefinicion.update({ where: { id: existing.id }, data: { ... } });
  await tx.pasoDefinicion.deleteMany({ where: { procesoId } });
  for (const paso of procesoInfo.pasos) {
    await tx.pasoDefinicion.create({ data: { ... } });
  }
});
```

---

### WR-04: `asignarPaso` — no valida que el técnico esté activo

**File:** `apps/api/src/services/tickets.service.ts:586`

**Issue:** `asignarPaso` busca el técnico con `findUnique` sin filtrar `activo: true`. Un usuario desactivado puede ser asignado a un paso.

```typescript
const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
```

Comparar con `asignarTicket` (línea 343) que sí filtra `activo: true`.

**Fix:**
```typescript
const tecnico = await prisma.usuario.findFirst({ where: { id: tecnicoId, activo: true } });
```

---

### WR-05: `cambiarEstado` — empleados pueden cancelar tickets de otros empleados

**File:** `apps/api/src/services/tickets.service.ts:396`

**Issue:** La ruta `PATCH /:id/estado` permite `EMPLEADO` (ver `tickets.routes.ts:23`). La función `cambiarEstado` no valida que `user.rfc === ticket.empleadoRfc` antes de proceder. Un empleado autenticado puede cancelar el ticket de cualquier otro empleado si conoce su ID. El guard de rol de `routes` no restringe por ownership.

**Fix:** Agregar verificación de ownership para empleados:
```typescript
if (user.rol === "EMPLEADO" && ticket.empleadoRfc !== user.rfc) {
  throw Object.assign(new Error("Sin permisos para modificar esta solicitud"), { status: 403 });
}
```

---

### WR-06: `completarPaso` — ticket puede resolverse aunque esté en estado `CANCELADO`

**File:** `apps/api/src/services/tickets.service.ts:531`

**Issue:** Cuando se completa el último paso, el código lee el estado actual del ticket (D-13, línea 534) pero aun así actualiza incondicionalmente a `RESUELTO` (línea 542). Si el ticket fue cancelado mientras el técnico completaba el último paso, se sobre-escribe el estado `CANCELADO` con `RESUELTO`.

```typescript
// Lee estado pero no lo verifica
const ticketPreResolve = await prisma.ticket.findUnique({ ... select: { estado: true } });
const estadoAnteriorReal = ticketPreResolve?.estado ?? "EN_PROGRESO";
// Actualiza sin importar el estado leído
const ticket = await prisma.ticket.update({
  data: { estado: "RESUELTO", ... },
});
```

**Fix:**
```typescript
if (ticketPreResolve?.estado === "CANCELADO") {
  throw Object.assign(
    new Error("El ticket fue cancelado — no se puede resolver"),
    { status: 409 },
  );
}
```

---

## Info

### IN-01: Uso excesivo de `as never` para eludir tipos de Prisma

**File:** `apps/api/src/services/tickets.service.ts:233-235, 249, 431`

**Issue:** Se usa `as never` para asignar campos enum de Prisma (`categoria`, `subcategoria`, `prioridad`, `estado`). Esto silencia errores de TypeScript que podrían detectar inconsistencias entre los valores del schema y los validados en el servicio. El proyecto tiene TypeScript estricto por convención (CLAUDE.md).

**Fix:** Importar los tipos enum directamente desde `@prisma/client` y hacer cast a ellos:
```typescript
import { CategoriaTicket, SubcategoriaTicket, PrioridadTicket } from "@prisma/client";
// ...
categoria: categoriaVal as CategoriaTicket,
subcategoria: subcategoriaVal as SubcategoriaTicket,
```

---

### IN-02: Duplicación de constantes `SUB_TIPO_EQUIPOS` / `SUBTIPO_EQUIPOS` en `shared/index.ts`

**File:** `packages/shared/src/index.ts:320-434`

**Issue:** Existen dos definiciones para los subtipos de equipos: `SUB_TIPO_EQUIPOS` (línea 320, array de objetos `{value, label}`) y `SUBTIPO_EQUIPOS` (línea 424, objeto constante). Tienen los mismos valores pero distinta estructura. La coexistencia de dos variantes para el mismo dominio genera riesgo de divergencia futura si se agrega un subtipo a una pero no a la otra.

**Fix:** Eliminar `SUB_TIPO_EQUIPOS` (el array) y derivarlo de `SUBTIPO_EQUIPOS` donde se necesite el label, usando `LABEL_SUBCATEGORIA` o una constante nueva `LABEL_SUBTIPO_EQUIPOS`. Revisar todos los consumidores antes de eliminar.

---

_Reviewed: 2026-05-11T19:04:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
