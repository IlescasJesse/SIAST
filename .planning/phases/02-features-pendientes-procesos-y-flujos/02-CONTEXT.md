# Phase 2: Features Pendientes — Procesos y Flujos - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Conectar `ProcesoDefinicion` DB como fuente de verdad para el flujo de tickets; activar los flujos `SISTEMAS_INSTITUCIONALES:SIRH` y `:SIAST` con pasos reales; corregir bugs críticos en el sistema de pasos multi-técnico; emitir Socket.IO correctamente en todos los flujos.

**Sin escalamiento a Recursos Materiales — eliminado de scope.**
**Sin cambios de UI nueva** — el frontend existente ya consume los endpoints de pasos.

Deliverables concretos:
- Tickets leen proceso desde DB (`ProcesoDefinicion`) en lugar de `PROCESO_MAP` hardcodeado
- Admin edita proceso en DB → próximo ticket usa definición actualizada inmediatamente
- Flujo `SISTEMAS_INSTITUCIONALES:SIRH`: 1 paso TECNICO_TI, nombre "Atención por Soporte TI"
- Flujo `SISTEMAS_INSTITUCIONALES:SIAST`: 1 paso TECNICO_TI, nombre "Atención por Soporte TI"
- Bug fix: `completarPaso` no resuelve ticket prematuramente cuando siguiente paso ya fue asignado
- Bug fix: `completarPaso` valida identidad del técnico, no solo el rol
- Bug fix: `cambiarEstado` a RESUELTO bloqueado si hay pasos pendientes
- Bug fix: `listarTickets` excluye RESUELTO/CANCELADO del listado activo del técnico
- Bug fix: `asignarTicket` bloqueado en tickets que tienen pasos definidos
- Bug fix: `historialTicket` usa estado real del ticket como `estadoAnterior`
- Socket.IO events emitidos correctamente en todos los flujos

</domain>

<decisions>
## Implementation Decisions

### PRO-01: Migración PROCESO_MAP → ProcesoDefinicion DB

- **D-01:** `crearTicket` en `apps/api/src/services/tickets.service.ts` (línea 247) cambia de `getProcesoInfo()` (PROCESO_MAP in-memory) a query directa: `prisma.procesoDefinicion.findFirst({ where: { subcategoria, subTipo, activo: true }, include: { pasos: { orderBy: { orden: 'asc' } } } })`. DB es la única fuente de verdad — sin fallback a PROCESO_MAP.
- **D-02:** Seed (`packages/database/prisma/seed.ts`) se actualiza para poblar `ProcesoDefinicion` + `PasoDefinicion` con todos los procesos que actualmente viven en `PROCESO_MAP`. El seed usa upsert por `{ subcategoria_subTipo: { subcategoria, subTipo } }` (unique constraint en schema) — idempotente.
- **D-03:** `metricas.controller.ts` también migra a leer `ProcesoDefinicion` de DB. Consistencia total: una fuente de verdad.
- **D-04:** `PROCESO_MAP`, `getProcesoKey()` y `getProcesoInfo()` se eliminan de `packages/shared/src/index.ts` (líneas ~472-621). También eliminar todos los imports de esas funciones en cualquier archivo que las use.

### PRO-02/03: Flujos SISTEMAS_INSTITUCIONALES:SIRH y :SIAST

- **D-05:** Ambos flujos son `DIRECTO` con 1 paso: `rolRequerido: "TECNICO_TI"`, `nombre: "Atención por Soporte TI"`. Misma estructura para ambos, diferenciados por `subTipo`.
- **D-06:** Los tickets de `SISTEMAS_INSTITUCIONALES` usan el bloque existente `if (categoriaVal === "TECNOLOGIAS")` en `crearTicket`. No se necesita manejo especial — `SISTEMAS_INSTITUCIONALES` ya es subcategoría de `TECNOLOGIAS`.
- **D-07:** El seed incluye estos dos procesos con `tipoFlujo: "DIRECTO"` y `pasos: [{ orden: 1, rolRequerido: "TECNICO_TI", nombre: "Atención por Soporte TI" }]`. Reemplaza las entradas con `tipoFlujo: "PENDIENTE"` del PROCESO_MAP actual.

### Bugs de Flujo de Pasos

- **D-08 (Bug 1 — completarPaso prematura):** `tickets.service.ts:493` — la búsqueda de `siguientePaso` cambia de `{ orden: paso.orden + 1, estado: "PENDIENTE" }` a buscar **cualquier paso con `orden > paso.orden` que no sea `COMPLETADO`** (`estado: { not: "COMPLETADO" }`). Si existe → emitir `paso_listo`. Si no existe → resolver ticket. Esto corrige el crash silencioso cuando el admin pre-asigna el paso siguiente (estado `EN_PROGRESO`) antes de que el técnico complete el actual.

- **D-09 (Bug 2 — identidad técnico):** `tickets.service.ts:475` — agregar validación `if (paso.tecnicoId !== user.id) → 403 "Solo el técnico asignado puede completar este paso"`. La validación de rol se mantiene como guard adicional.

- **D-10 (Bug 3 — bypass estado con pasos):** `cambiarEstado` — si `body.estado === "RESUELTO"`, verificar que no existan `PasoTicket` con `{ ticketId: id, estado: { not: "COMPLETADO" } }`. Si existen → 400 `"El ticket tiene pasos pendientes. Completa todos los pasos para resolver."`.

- **D-11 (Bug 4 — técnico ve tickets resueltos):** `listarTickets` para técnicos (línea 79) — agregar al `where`: `estado: { notIn: ["RESUELTO", "CANCELADO"] }`. Técnico solo ve sus tickets activos. Si necesita historial, puede usar el filtro `?estado=RESUELTO` explícito.

- **D-12 (Bug 5 — asignarTicket en ticket con pasos):** `asignarTicket` — al inicio, verificar si el ticket tiene `PasoTicket` registrados. Si tiene pasos → 400 `"Este ticket usa flujo de pasos. Asignar técnico desde el panel de pasos."`.

- **D-13 (Bug 6 — estadoAnterior hardcodeado):** `completarPaso:505` — leer `ticket.estado` con `prisma.ticket.findUnique` antes de hacer el update a RESUELTO, y usar ese valor como `estadoAnterior` en `historialTicket`. No hardcodear `"EN_PROGRESO"`.

### NOT-01/02: Socket.IO y Audit Trail

- **D-14:** `ticket:paso_asignado` — emitir cuando admin/MESA_AYUDA asigna técnico a un paso (flujo manual). Se emite a `user:{tecnicoId}`. Flujos SIRH/SIAST siguen este mismo patrón.
- **D-15:** `ticket:paso_listo` — emitir a `admins` cuando hay un paso siguiente pendiente después de que el técnico completa su paso. Ya existe en `completarPaso`, verificar que el fix de D-08 no rompa esta emisión.
- **D-16:** Historial en flujos nuevos: comentario en `historialTicket` al resolver via `completarPaso` → `"Todos los pasos completados"` (ya existente, mantener).

### Claude's Discretion

- Si `paso.tecnicoId` es `null` al momento de `completarPaso` (paso asignado por rol pero no a persona específica), decidir si 403 o permitir que cualquier tech con el rol correcto lo complete. Rechazar con 403 + mensaje claro es más seguro.
- Orden de validaciones en `asignarTicket` (pasos check antes o después de encontrar el ticket).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y Roadmap
- `.planning/REQUIREMENTS.md` — PRO-01 a PRO-03, NOT-01 a NOT-02 (PRO-04 eliminado de scope)
- `.planning/ROADMAP.md` §Phase 2 — deliverables y UAT criteria

### Archivos a Modificar (ubicaciones exactas)
- `apps/api/src/services/tickets.service.ts` — archivo central de esta fase:
  - Línea 6: eliminar import `getProcesoInfo` de `@stf/shared`
  - Línea 247: `crearTicket` — cambiar `getProcesoInfo()` → query Prisma `procesoDefinicion`
  - Línea 383: `cambiarEstado` — agregar guard de pasos pendientes antes de RESUELTO (D-10)
  - Línea 325: `asignarTicket` — agregar guard si ticket tiene pasos (D-12)
  - Línea 462: `completarPaso` — fix búsqueda siguientePaso (D-08), fix identidad técnico (D-09), fix estadoAnterior (D-13)
  - Línea 79: `listarTickets` — excluir RESUELTO/CANCELADO para técnicos (D-11)
- `apps/api/src/controllers/metricas.controller.ts` — líneas 5/195: reemplazar `PROCESO_MAP` por query DB
- `packages/shared/src/index.ts` — eliminar `PROCESO_MAP`, `getProcesoKey()`, `getProcesoInfo()` (líneas ~472-621)
- `packages/database/prisma/seed.ts` — agregar upsert de `ProcesoDefinicion` + `PasoDefinicion`

### Schema y Modelos
- `packages/database/prisma/schema.prisma` §ProcesoDefinicion + §PasoDefinicion (líneas ~544-572)
- `apps/api/src/controllers/admin-procesos.controller.ts` — CRUD existente, patrón a seguir para queries

### Arquitectura Real-Time
- `.planning/codebase/ARCHITECTURE.md` §Real-time Architecture — tabla de eventos Socket.IO, rooms, patrón de emisión

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma.procesoDefinicion.findFirst({ where: { subcategoria, subTipo, activo: true }, include: { pasos: { orderBy: { orden: 'asc' } } } })` — query directa que reemplaza `getProcesoInfo()`
- `prisma.$transaction()` — patrón en `admin-procesos.controller.ts` para seed atómico
- `notif.emitirPasoListo` + `notif.emitirPasoAsignado` — ya existen en `notificaciones.service.ts`
- `Object.assign(new Error(msg), { status: N })` — patrón de error para guards nuevos

### Established Patterns
- Soft delete en ProcesoDefinicion: filtrar `activo: true` en la query (ya en schema)
- Socket.IO emission: siempre via `notificaciones.service.ts`, nunca desde controllers directamente
- Seed idempotente: upsert con `where: { subcategoria_subTipo: { subcategoria, subTipo } }`
- `ticketInclude` object en tickets.service.ts — ya incluye `pasos` con técnico anidado

### Integration Points
- `apps/api/src/services/tickets.service.ts` — todos los fixes van aquí, archivo central
- `apps/api/src/routes/tickets.routes.ts` — no requiere cambios de rutas (no hay endpoints nuevos)
- `packages/database/prisma/seed.ts` — poblar `ProcesoDefinicion` antes del switch en `crearTicket`

</code_context>

<specifics>
## Specific Ideas

- **Proceso SIRH y SIAST:** Ambos `tipoFlujo: "DIRECTO"`, 1 paso `TECNICO_TI`, nombre "Atención por Soporte TI". Admin puede editar desde el panel una vez en producción.
- **Fix Bug 1 crítico:** La búsqueda de siguientePaso debe ser `{ ticketId, orden: { gt: paso.orden }, estado: { not: "COMPLETADO" } }` ordenado por `orden asc`, tomando el primero.
- **Eliminación de PROCESO_MAP:** Solo después de que seed popule DB y `crearTicket` + `metricas` lean de DB. Orden importa en el plan.
- **Sin endpoints nuevos:** Todos los fixes son internos a `tickets.service.ts`. No hay rutas nuevas.

</specifics>

<deferred>
## Deferred Ideas

- **Escalamiento Recursos Materiales:** Eliminado de scope de Phase 2.
- **Panel UI admin para CRUD de procesos:** API existe (`admin-procesos.controller.ts`), no hay frontend. Fase Admin avanzado.
- **Auto-asignación de técnico al crear ticket:** Fuera de scope Phase 2.

</deferred>

---

*Phase: 2-Features Pendientes — Procesos y Flujos*
*Context gathered: 2026-05-08 (actualizado: eliminado RM, agregados bug fixes de flujo)*
