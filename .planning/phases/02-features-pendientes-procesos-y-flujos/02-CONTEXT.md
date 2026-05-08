# Phase 2: Features Pendientes — Procesos y Flujos - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Conectar `ProcesoDefinicion` DB como fuente de verdad para el flujo de tickets; activar los flujos `SISTEMAS_INSTITUCIONALES:SIRH` y `:SIAST` con pasos reales; vincular el escalamiento de Recursos Materiales desde `MANTENIMIENTO_CORRECTIVO`; emitir Socket.IO correctamente en todos los flujos nuevos.

**Sin cambios de UI funcional nueva** — el backend es el foco. El frontend existente ya consume los pasos via las APIs de tickets.

Deliverables (del ROADMAP):
- Tickets leen proceso desde DB (`ProcesoDefinicion`) en lugar de `PROCESO_MAP` hardcodeado
- Admin puede crear/editar procesos y los tickets los respetan inmediatamente
- Flujo `SISTEMAS_INSTITUCIONALES:SIRH`: 1 paso TECNICO_TI, nombre "Atención por Soporte TI"
- Flujo `SISTEMAS_INSTITUCIONALES:SIAST`: 1 paso TECNICO_TI, nombre "Atención por Soporte TI"
- Escalamiento RM desde `MANTENIMIENTO_CORRECTIVO` via `POST /tickets/:id/escalar-rm` → agrega PasoTicket con rol GESTOR_RECURSOS_MATERIALES
- Socket.IO events emitidos en todos los flujos nuevos

</domain>

<decisions>
## Implementation Decisions

### PRO-01: Migración PROCESO_MAP → ProcesoDefinicion DB

- **D-01:** `crearTicket` en `apps/api/src/services/tickets.service.ts` cambia de `getProcesoInfo()` (PROCESO_MAP in-memory) a query directa `prisma.procesoDefinicion.findFirst({ where: { subcategoria, subTipo, activo: true }, include: { pasos: { orderBy: { orden: 'asc' } } } })`. La DB es la única fuente de verdad — sin fallback a PROCESO_MAP.
- **D-02:** Seed (`packages/database/prisma/seed.ts`) se actualiza para poblar `ProcesoDefinicion` + `PasoDefinicion` con todos los procesos que actualmente vive en `PROCESO_MAP`. El seed es idempotente (upsert por `subcategoria + subTipo`).
- **D-03:** `metricas.controller.ts` también migra a leer `ProcesoDefinicion` de DB en lugar de `PROCESO_MAP`. Consistencia total: una fuente de verdad.
- **D-04:** `PROCESO_MAP`, `getProcesoKey()` y `getProcesoInfo()` de `packages/shared/src/index.ts` se eliminan completamente una vez que la migración está completa. También eliminar los imports de esas funciones en cualquier archivo que las use.

### PRO-02/03: Flujos SISTEMAS_INSTITUCIONALES:SIRH y :SIAST

- **D-05:** Ambos flujos son `DIRECTO` con 1 paso: `rolRequerido: "TECNICO_TI"`, `nombre: "Atención por Soporte TI"`. Misma definición para ambos (diferenciados por `subTipo`).
- **D-06:** Los tickets de `SISTEMAS_INSTITUCIONALES` usan el mismo bloque `if (categoriaVal === "TECNOLOGIAS")` en `crearTicket`. No se necesita manejo especial — `SISTEMAS_INSTITUCIONALES` ya es subcategoría de `TECNOLOGIAS`.
- **D-07:** El seed incluye estos dos procesos con `tipoFlujo: "DIRECTO"` y `pasos: [{ orden: 1, rolRequerido: "TECNICO_TI", nombre: "Atención por Soporte TI" }]`. Reemplaza las entradas con `tipoFlujo: "PENDIENTE"` que existen en PROCESO_MAP.

### PRO-04: Escalamiento Recursos Materiales

- **D-08:** Nuevo endpoint `POST /api/tickets/:id/escalar-rm`. Acceso: TECNICO_TI autenticado que tiene el paso activo del ticket.
- **D-09:** El endpoint valida que el ticket sea de `subcategoria: "EQUIPOS_DISPOSITIVOS"` y `subTipo: "MANTENIMIENTO_CORRECTIVO"`. Si no cumple → 400.
- **D-10:** El endpoint agrega un nuevo `PasoTicket` con `rolRequerido: "GESTOR_RECURSOS_MATERIALES"`, `nombre: "Asignación de recursos materiales"`, `orden: (último orden + 1)`, `estado: "PENDIENTE"`.
- **D-11:** El ticket mantiene su estado actual (`ASIGNADO` o `EN_PROGRESO`) — no cambia hasta que el gestor complete su paso. El escalamiento no altera la state machine del ticket.
- **D-12:** Al agregar el paso de RM, emitir `ticket:paso_listo` a la room `admins` para que admin/mesa de ayuda sepa que hay un paso nuevo pendiente de asignación.
- **D-13:** Se registra entrada en `historialTicket` con comentario genérico: `"Escalado a Recursos Materiales"`.

### NOT-01/02: Socket.IO y Audit Trail

- **D-14:** `ticket:paso_asignado` — se emite cuando admin/MESA_AYUDA asigna un técnico a un paso (flujo manual, igual que hoy). Se emite a `user:{tecnicoId}`. Los flujos SIRH/SIAST siguen este mismo patrón — pasos se crean PENDIENTE y admin los asigna manualmente.
- **D-15:** `ticket:paso_listo` — se emite a `admins` cuando hay un paso nuevo pendiente sin técnico asignado. Aplica al escalamiento RM (D-12).
- **D-16:** NOT-02 — cuando el gestor de RM completa su paso, el comentario en `historialTicket` es: `"Recurso asignado por gestor"`. Genérico y consistente con el estilo existente.

### Claude's Discretion

- Orden de validaciones en el endpoint `escalar-rm` (verificar autenticación → verificar que el ticket pertenece al técnico → verificar subcategoría → agregar paso).
- Si ya existe un paso PENDIENTE de `GESTOR_RECURSOS_MATERIALES` en el ticket, decidir si rechazar el escalamiento duplicado o permitirlo. Rechazar con 409 es más seguro.
- Nombre exacto del paso de RM en `PasoDefinicion` del seed para MANTENIMIENTO_CORRECTIVO (si el Admin quiere configurarlo en DB, puede editarlo después).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y Roadmap
- `.planning/REQUIREMENTS.md` — PRO-01 a PRO-04, NOT-01 a NOT-02 (requisitos de esta fase)
- `.planning/ROADMAP.md` §Phase 2 — deliverables y UAT criteria

### Archivos a Modificar (ubicaciones exactas)
- `apps/api/src/services/tickets.service.ts` — `crearTicket()` línea 247: cambiar `getProcesoInfo()` → query Prisma a `ProcesoDefinicion`
- `apps/api/src/controllers/metricas.controller.ts` — línea 5/195: reemplazar `PROCESO_MAP` por query DB
- `packages/shared/src/index.ts` — eliminar `PROCESO_MAP`, `getProcesoKey()`, `getProcesoInfo()` (líneas ~472-621)
- `packages/database/prisma/seed.ts` — agregar upsert de `ProcesoDefinicion` + `PasoDefinicion`

### Archivos Nuevos a Crear
- `apps/api/src/controllers/tickets-escalamiento.controller.ts` (o agregar endpoint en `tickets.controller.ts`) — endpoint `POST /tickets/:id/escalar-rm`
- Agregar ruta en `apps/api/src/routes/tickets.routes.ts`

### Schema y Modelos
- `packages/database/prisma/schema.prisma` §ProcesoDefinicion, §PasoDefinicion (líneas ~544-572) — estructura exacta de la DB
- `apps/api/src/controllers/admin-procesos.controller.ts` — CRUD existente de ProcesoDefinicion, patrón a seguir

### Arquitectura Real-Time
- `.planning/codebase/ARCHITECTURE.md` §Real-time Architecture — tabla de eventos Socket.IO existentes, rooms, patrón de emisión
- `apps/api/src/services/notificaciones.service.ts` — funciones de emisión existentes (`emitirTicketNuevo`, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma.procesoDefinicion.findFirst({ where: { subcategoria, subTipo, activo: true }, include: { pasos: ... } })` — query directa reemplaza `getProcesoInfo()`
- `prisma.$transaction()` — patrón en `admin-procesos.controller.ts` para crear proceso + pasos; misma transacción puede usarse en seed
- `notif.emitirTicketNuevo/emitirPasoAsignado/emitirPasoListo` — funciones existentes en `notificaciones.service.ts`, llamar desde el nuevo endpoint de escalamiento
- `historialTicket.create` — patrón establecido en `tickets.service.ts` línea 262, seguir para registrar escalamiento

### Established Patterns
- Soft delete en ProcesoDefinicion: `activo: true` filter en la query (ya en el schema)
- Error pattern: `Object.assign(new Error(msg), { status: N })` — usar en endpoint `escalar-rm`
- Socket.IO emission: siempre via `notificaciones.service.ts`, nunca directamente desde controllers
- Seed idempotente: usar `upsert` con `where: { subcategoria_subTipo: { subcategoria, subTipo } }` (unique constraint en schema)

### Integration Points
- `apps/api/src/services/tickets.service.ts` `crearTicket()` — punto de cambio central (PRO-01)
- `apps/api/src/routes/tickets.routes.ts` — agregar ruta `POST /:id/escalar-rm` con `authMiddleware` + `requireRol("TECNICO_TI")`
- `packages/database/prisma/seed.ts` — poblar `ProcesoDefinicion` antes del switch en `crearTicket`

</code_context>

<specifics>
## Specific Ideas

- **Proceso SIRH y SIAST:** Ambos con `tipoFlujo: "DIRECTO"`, 1 paso `TECNICO_TI`, nombre genérico "Atención por Soporte TI". El Admin puede editarlo desde el panel admin una vez en producción.
- **Endpoint escalar-rm:** Si ya existe un paso PENDIENTE de `GESTOR_RECURSOS_MATERIALES`, rechazar con 409 para evitar escalamientos duplicados (decisión del agente).
- **Eliminación de PROCESO_MAP:** Solo después de que seed popule la DB y crearTicket + metricas lean de DB. Orden de implementación importa.

</specifics>

<deferred>
## Deferred Ideas

- **Panel UI para gestión de procesos por Admin:** Existe la API (`admin-procesos.controller.ts`), pero no hay frontend para CRUD de procesos. Pertenece a una fase de Admin avanzado.
- **Auto-asignación de técnico al crear ticket:** Buscar técnico con menos carga y asignar automáticamente. No está en scope de Phase 2 — asignación sigue siendo manual.

</deferred>

---

*Phase: 2-Features Pendientes — Procesos y Flujos*
*Context gathered: 2026-05-08*
