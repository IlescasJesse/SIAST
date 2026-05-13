---
phase: 02-features-pendientes-procesos-y-flujos
verified: 2026-05-13T17:10:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 12/14
  gaps_closed:
    - "PRO-04 aparece en ROADMAP.md Backlog con nota de diferimiento explícita y ya no figura en Deliverables/UAT de Phase 2"
    - "asignarPaso() crea entrada en historialTicket registrando el técnico asignado al paso (NOT-02)"
  gaps_remaining: []
  regressions: []
---

# Phase 02: Features Pendientes — Procesos y Flujos — Reporte de Verificación

**Phase Goal:** ProcesoDefinicion DB operativa; flujos SIRH/SIAST activos; audit trail completo en pasos.
**Verificado:** 2026-05-13T17:10:00Z
**Estado:** passed
**Re-verificación:** Sí — tras cierre de gaps por plan 02-05

---

## Logro del Objetivo

### Verdades Observables

| # | Verdad | Estado | Evidencia |
|---|--------|--------|-----------|
| 1 | `crearTicket` lee proceso desde ProcesoDefinicion DB — nunca llama `getProcesoInfo()` | VERIFICADO | `tickets.service.ts` línea 248: `prisma.procesoDefinicion.findFirst(...)` con `activo: true`; sin referencias a `getProcesoInfo` |
| 2 | `completarPaso` no resuelve prematuramente si el siguiente paso ya está EN_PROGRESO | VERIFICADO | Línea 527: `orden: { gt: paso.orden }, estado: { not: "COMPLETADO" }` — busca cualquier paso no completado en orden superior |
| 3 | `completarPaso` valida que el usuario sea el técnico asignado al paso | VERIFICADO | Línea 502: `if (paso.tecnicoId !== null && paso.tecnicoId !== user.id)` → throw 403 |
| 4 | `cambiarEstado` a RESUELTO falla con 400 si el ticket tiene pasos no completados | VERIFICADO | Líneas 413-423: guard D-10 implementado con mensaje exacto |
| 5 | `listarTickets` para técnicos excluye tickets RESUELTO y CANCELADO por defecto | VERIFICADO | Línea 80: `where.estado = { notIn: ["RESUELTO", "CANCELADO"] }` — override en línea 87 si se pasa `?estado=` explícito |
| 6 | `asignarTicket` rechaza tickets que usan flujo de pasos | VERIFICADO | Líneas 334-340: guard D-12 con mensaje exacto |
| 7 | `historialTicket` usa el estado real del ticket como `estadoAnterior` (no hardcodeado) | VERIFICADO | Líneas 534-556: `ticketPreResolve.estado` leído; `estadoAnteriorReal` usado en ambas llamadas |
| 8 | Socket.IO emite `ticket:paso_asignado` y `ticket:paso_listo` en los flujos correctos | VERIFICADO | `notificaciones.service.ts` líneas 143 y 179; wired en `tickets.service.ts` líneas 565 y 616+ |
| 9 | La tabla ProcesoDefinicion contiene entradas SIRH y SIAST con tipoFlujo DIRECTO | VERIFICADO | `seed_procesos.ts` líneas 153-180: entradas DIRECTO con 1 paso TECNICO_TI; seed reportó UPDATED SIRH y SIAST |
| 10 | El seed es idempotente — ejecutar dos veces no duplica ni rompe datos | VERIFICADO | `seed_procesos.ts` usa `findFirst + update/create + deleteMany(pasos) + create`. Lógica preservada. |
| 11 | PROCESO_MAP, getProcesoKey y getProcesoInfo eliminados de packages/shared/src/index.ts | VERIFICADO | grep en `packages/shared/src/index.ts` retorna 0 resultados. |
| 12 | `seed_procesos.ts` no importa PROCESO_MAP — usa PROCESO_SEED_MAP local | VERIFICADO | Línea 1: `import { PrismaClient, SubcategoriaTicket } from "@prisma/client"` — sin import de @stf/shared; PROCESO_SEED_MAP definido en línea 25 |
| 13 | PRO-04 en Backlog de ROADMAP.md con nota de diferimiento; ya no figura en Deliverables/UAT de Phase 2 | VERIFICADO | ROADMAP.md línea 111: entrada `PRO-04 (diferido)` en Backlog con razón explícita; Phase 2 Deliverables y UAT no contienen referencias a escalamiento RM |
| 14 | `asignarPaso()` crea entrada en historialTicket registrando el técnico asignado al paso (NOT-02) | VERIFICADO | `tickets.service.ts` líneas 615-624: `prisma.historialTicket.create` con `comentario` de paso y técnico, insertado entre `prisma.ticket.update` y `notif.emitirPasoAsignado` |

**Puntaje: 14/14 verdades verificadas**

---

### Artefactos Requeridos

| Artefacto | Descripción | Estado | Detalles |
|-----------|-------------|--------|---------|
| `packages/database/prisma/seed_procesos.ts` | Definiciones SIRH y SIAST en PROCESO_SEED_MAP local | VERIFICADO | PROCESO_SEED_MAP local, sin import de @stf/shared, SIRH/SIAST con tipoFlujo DIRECTO |
| `apps/api/src/services/tickets.service.ts` | Servicio central con DB como fuente de verdad para procesos y audit trail completo | VERIFICADO | `procesoDefinicion.findFirst` en línea 248; 6 guards D-08 a D-13 presentes; `historialTicket.create` en `asignarPaso` (línea 616) |
| `apps/api/src/controllers/metricas.controller.ts` | Métricas de procesos usando DB como fuente de verdad | VERIFICADO | `procesoDefinicion.findFirst` en línea 199; sin referencias a PROCESO_MAP ni getProcesoKey |
| `packages/shared/src/index.ts` | Módulo shared sin PROCESO_MAP | VERIFICADO | PROCESO_MAP, getProcesoKey, getProcesoInfo ausentes |
| `.planning/ROADMAP.md` | PRO-04 en Backlog con nota de diferimiento; Phase 2 sin escalamiento RM | VERIFICADO | Línea 111: entrada PRO-04 en Backlog; Phase 2 Deliverables/UAT limpios |
| `.planning/REQUIREMENTS.md` | PRO-04 marcado como backlog/fase TBD; traceability separada | VERIFICADO | Línea 29: `_(backlog / fase TBD)_` con nota; Traceability: fila PRO-04 | Backlog | Diferido |

---

### Verificación de Vínculos Clave (Key Links)

| Desde | Hacia | Vía | Estado | Detalles |
|-------|-------|-----|--------|---------|
| `tickets.service.ts crearTicket` | `prisma.procesoDefinicion` | `findFirst({ subcategoria, subTipo, activo: true })` | WIRED | Línea 248-251 — incluye pasos en order `asc` |
| `tickets.service.ts completarPaso` | `pasoTicket siguiente` | `findFirst({ orden: { gt: paso.orden }, estado: { not: 'COMPLETADO' } })` | WIRED | Línea 526-529 — fix D-08 aplicado correctamente |
| `metricas.controller.ts metricasProcesos` | `prisma.procesoDefinicion` | `findFirst({ subcategoria, subTipo })` | WIRED | Líneas 199-205 — dentro del loop; fallback a `key` si no existe en DB |
| `asignarPaso()` | `prisma.historialTicket` | `historialTicket.create` con comentario de asignación de paso | WIRED | Líneas 615-624: insertado entre `prisma.ticket.update` y `notif.emitirPasoAsignado` |
| `seed_procesos.ts` | `prisma.procesoDefinicion` | `seedProcesos(prisma)` llamado desde seed.ts | WIRED | `seed.ts` llama `await seedProcesos(prisma)` |

---

### Rastreo de Datos (Level 4)

| Artefacto | Variable de datos | Fuente | Produce datos reales | Estado |
|-----------|------------------|--------|----------------------|--------|
| `tickets.service.ts crearTicket` | `proceso.pasos` | `prisma.procesoDefinicion.findFirst(...)` con `include: { pasos }` | Sí — query real a DB | FLOWING |
| `metricas.controller.ts metricasProcesos` | `procesoDb?.nombre` | `prisma.procesoDefinicion.findFirst(...)` por subcategoria/subTipo | Sí — query real a DB; fallback a key si null | FLOWING |
| `tickets.service.ts asignarPaso (historial)` | `comentario` | `paso.orden`, `paso.nombre`, `tecnico.nombre`, `tecnico.apellidos` — obtenidos de DB en el mismo service | Sí — datos de DB, no input de usuario | FLOWING |

---

### Checks de Comportamiento (Spot-Checks)

| Comportamiento | Verificación | Resultado | Estado |
|---------------|--------------|-----------|--------|
| `getProcesoInfo` eliminado de `tickets.service.ts` | grep en el archivo | 0 resultados | PASS |
| `procesoDefinicion.findFirst` presente en `tickets.service.ts` | grep en el archivo | línea 248 | PASS |
| `notIn: ["RESUELTO", "CANCELADO"]` en listarTickets (técnico) | grep en el archivo | línea 80 | PASS |
| Guard D-12 "flujo de pasos" en asignarTicket | grep en el archivo | línea 337 | PASS |
| Guard D-10 "pasos pendientes" en cambiarEstado | grep en el archivo | línea 419 | PASS |
| Guard D-09 "técnico asignado" en completarPaso | grep en el archivo | línea 504 | PASS |
| D-08 query siguiente paso con `not: "COMPLETADO"` | grep en el archivo | línea 527 | PASS |
| D-13 `estadoAnteriorReal` en completarPaso (sin hardcode EN_PROGRESO) | grep en el archivo | líneas 538, 548, 556 | PASS |
| PROCESO_MAP ausente en `packages/shared/src/index.ts` | grep | 0 resultados | PASS |
| PROCESO_SEED_MAP presente en `seed_procesos.ts` | grep | línea 25 | PASS |
| `metricas.controller.ts` sin imports de PROCESO_MAP/getProcesoKey | grep en imports | solo comentarios residuales | PASS |
| `ticket:paso_asignado` emitido en notificaciones.service.ts | grep | línea 143 | PASS |
| `ticket:paso_listo` emitido en notificaciones.service.ts | grep | línea 179 | PASS |
| `asignarPaso` crea historialTicket entry (NOT-02) | grep en asignarPaso | línea 616 — presente | PASS |
| ROADMAP.md Phase 2 sin "Escalamiento de mantenimiento correctivo" | grep | 0 coincidencias en Deliverables/UAT | PASS |
| ROADMAP.md Backlog contiene PRO-04 con nota de diferimiento | grep | línea 111 — presente | PASS |
| REQUIREMENTS.md PRO-04 con etiqueta backlog/fase TBD | grep | línea 29 — presente | PASS |

---

### Cobertura de Requerimientos

| Requerimiento | Plan | Descripción | Estado | Evidencia |
|---------------|------|-------------|--------|-----------|
| PRO-01 | 02-02, 02-03, 02-04 | Tickets leen definición de proceso desde ProcesoDefinicion DB | SATISFECHO | `procesoDefinicion.findFirst` en crearTicket y metricasProcesos; PROCESO_MAP eliminado de shared |
| PRO-02 | 02-01 | Flujo SISTEMAS_INSTITUCIONALES:SIRH completado con pasos y técnicos asignables | SATISFECHO | Seed: SIRH tipoFlujo DIRECTO, 1 paso TECNICO_TI; flujo operativo |
| PRO-03 | 02-01 | Flujo SISTEMAS_INSTITUCIONALES:SIAST completado con pasos y técnicos asignables | SATISFECHO | Seed: SIAST tipoFlujo DIRECTO, 1 paso TECNICO_TI; flujo operativo |
| PRO-04 | 02-05 | Escalamiento Recursos Materiales — diferido explícitamente al Backlog | DIFERIDO (aceptado) | ROADMAP.md línea 111: Backlog con nota cross-sistema; REQUIREMENTS.md línea 29: `_(backlog / fase TBD)_`; Phase 2 Requirements actualizados a PRO-01 a PRO-03 |
| NOT-01 | 02-02 | `ticket:paso_asignado` y `ticket:paso_listo` emitidos en todos los flujos nuevos | SATISFECHO | `emitirPasoAsignado` emite `ticket:paso_asignado` (línea 143); `emitirPasoListo` emite `ticket:paso_listo` (línea 179); wired en tickets.service.ts |
| NOT-02 | 02-05 | Historia/audit trail actualizado en asignación de recursos | SATISFECHO | `historialTicket.create` en `asignarPaso()` (líneas 615-624): ticketId, estadoAnterior, estadoNuevo EN_PROGRESO, usuarioId, comentario con paso y técnico |

---

### Anti-Patrones Encontrados

| Archivo | Línea | Patrón | Severidad | Impacto |
|---------|-------|--------|-----------|---------|
| `apps/api/src/controllers/metricas.controller.ts` | 193, 198 | Comentarios residuales mencionando `getProcesoKey` y `PROCESO_MAP` | Info | Solo documentación; sin impacto funcional |

---

### Verificación Humana Requerida

No se requiere verificación humana. Todos los gaps identificados en la verificación anterior han sido cerrados con evidencia programáticamente verificable en el código.

---

## Resumen

Phase 2 alcanza 14/14 verdades verificadas tras el cierre de gaps por el plan 02-05.

**Gap 1 cerrado (PRO-04 documental):** ROADMAP.md Phase 2 Deliverables y UAT no contienen referencias a escalamiento RM. La entrada PRO-04 aparece en el Backlog (línea 111) con razón explícita de diferimiento y nota de diseño cross-sistema pendiente. REQUIREMENTS.md tiene la fila separada en Traceability con estado "Diferido (fase TBD)". La decisión de diferimiento queda documentada y trazable.

**Gap 2 cerrado (NOT-02 código):** `asignarPaso()` en `tickets.service.ts` ahora crea entrada en `historialTicket` (líneas 615-624) con comentario que identifica el paso por orden y nombre, y el técnico por nombre y apellidos. La inserción ocurre después de `prisma.ticket.update` y antes de `notif.emitirPasoAsignado`, preservando el orden causal correcto. El audit trail de asignación de técnico a paso queda completamente registrado.

El objetivo de la fase — ProcesoDefinicion DB operativa, flujos SIRH/SIAST activos, audit trail completo en pasos — está verificado.

---

_Verificado: 2026-05-13T17:10:00Z_
_Verificador: Claude (gsd-verifier)_
