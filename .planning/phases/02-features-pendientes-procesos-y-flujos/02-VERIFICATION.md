---
phase: 02-features-pendientes-procesos-y-flujos
verified: 2026-05-11T18:00:00Z
status: gaps_found
score: 12/14 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Escalamiento Recursos Materiales desde MANTENIMIENTO_CORRECTIVO vinculado (PRO-04)"
    status: failed
    reason: "PRO-04 marcado como DIFERIDO en plan 02-04. La ROADMAP Phase 2 lo lista como deliverable y UAT. No existe en ninguna fase posterior del roadmap."
    artifacts:
      - path: "apps/api/src/services/tickets.service.ts"
        issue: "No hay lógica de escalamiento RM. MANTENIMIENTO_CORRECTIVO sigue con flujo DIRECTO simple sin vínculo a paso SIAST."
    missing:
      - "Lógica de escalamiento en tickets.service.ts o paso_procesos que vincule MANTENIMIENTO_CORRECTIVO → paso SIAST"
      - "PRO-04 asignado a una fase concreta del roadmap, o decisión documentada de moverlo al backlog"
  - truth: "historialTicket registra la asignación de técnico a un paso (NOT-02 — audit trail en asignación de recursos)"
    status: failed
    reason: "asignarPaso() en tickets.service.ts no crea entrada en historialTicket. Solo actualiza pasoTicket y emite Socket.IO. El audit trail de la asignación de paso no queda registrado en la tabla historial."
    artifacts:
      - path: "apps/api/src/services/tickets.service.ts"
        issue: "asignarPaso (líneas 577-639) omite prisma.historialTicket.create. El cambio de estado del ticket a EN_PROGRESO sí genera historial en cambiarEstado, pero la asignación específica de un técnico a un paso no queda auditada."
    missing:
      - "prisma.historialTicket.create en asignarPaso con comentario que registre qué técnico fue asignado a qué paso"
---

# Phase 02: Features Pendientes — Procesos y Flujos — Reporte de Verificación

**Phase Goal:** Implementar features pendientes de procesos y flujos — DB como fuente de verdad para ProcesoDefinicion, bug fixes en flujo multi-técnico, y limpieza de código legado.
**Verificado:** 2026-05-11T18:00:00Z
**Estado:** gaps_found
**Re-verificación:** No — verificación inicial

---

## Logro del Objetivo

### Verdades Observables

| # | Verdad | Estado | Evidencia |
|---|--------|--------|-----------|
| 1 | `crearTicket` lee proceso desde ProcesoDefinicion DB — nunca llama `getProcesoInfo()` | VERIFICADO | `tickets.service.ts` línea 248: `prisma.procesoDefinicion.findFirst(...)` con `activo: true`; sin referencias a `getProcesoInfo` |
| 2 | `completarPaso` no resuelve prematuramente si el siguiente paso ya está EN_PROGRESO | VERIFICADO | Línea 527: `orden: { gt: paso.orden }, estado: { not: "COMPLETADO" }` — busca cualquier paso no completado en orden superior, no el siguiente exacto con estado PENDIENTE |
| 3 | `completarPaso` valida que el usuario sea el técnico asignado al paso | VERIFICADO | Línea 502: `if (paso.tecnicoId !== null && paso.tecnicoId !== user.id)` → throw 403 |
| 4 | `cambiarEstado` a RESUELTO falla con 400 si el ticket tiene pasos no completados | VERIFICADO | Líneas 413-423: guard D-10 implementado con mensaje exacto |
| 5 | `listarTickets` para técnicos excluye tickets RESUELTO y CANCELADO por defecto | VERIFICADO | Línea 80: `where.estado = { notIn: ["RESUELTO", "CANCELADO"] }` — override existe en línea 87 si se pasa `?estado=` explícito |
| 6 | `asignarTicket` rechaza tickets que usan flujo de pasos | VERIFICADO | Líneas 334-340: guard D-12 con mensaje exacto |
| 7 | `historialTicket` usa el estado real del ticket como `estadoAnterior` (no hardcodeado) | VERIFICADO | Líneas 534-556: `ticketPreResolve.estado` leído; `estadoAnteriorReal` usado en ambas llamadas |
| 8 | Socket.IO emite `ticket:paso_asignado` y `ticket:paso_listo` en los flujos correctos | VERIFICADO | `notificaciones.service.ts` líneas 143 y 179; wired en `tickets.service.ts` líneas 565 y 616 |
| 9 | La tabla ProcesoDefinicion contiene entradas SIRH y SIAST con tipoFlujo DIRECTO | VERIFICADO | `seed_procesos.ts` líneas 153-180: entradas DIRECTO con 1 paso TECNICO_TI; seed reportó UPDATED SIRH y SIAST |
| 10 | El seed es idempotente — ejecutar dos veces no duplica ni rompe datos | VERIFICADO | `seed_procesos.ts` usa `findFirst + update/create + deleteMany(pasos) + create`. Lógica preservada. |
| 11 | PROCESO_MAP, getProcesoKey y getProcesoInfo eliminados de packages/shared/src/index.ts | VERIFICADO | grep en `packages/shared/src/index.ts` retorna 0 resultados. Archivo termina en línea ~518 con PERMISOS_DEFAULT. |
| 12 | `seed_procesos.ts` no importa PROCESO_MAP — usa PROCESO_SEED_MAP local | VERIFICADO | Línea 1: `import { PrismaClient, SubcategoriaTicket } from "@prisma/client"` — sin import de @stf/shared; PROCESO_SEED_MAP definido línea 25 |
| 13 | Escalamiento RM desde MANTENIMIENTO_CORRECTIVO vinculado a paso SIAST (PRO-04) | FALLIDO | No implementado. Plan 02-04 lo marca como DIFERIDO pero no existe fase posterior en el roadmap que lo cubra. |
| 14 | historialTicket registra asignación de técnico a paso (NOT-02 audit trail) | FALLIDO | `asignarPaso()` no crea entrada en historialTicket. La asignación de técnico a paso no queda auditada. |

**Puntaje: 12/14 verdades verificadas**

---

### Artefactos Requeridos

| Artefacto | Descripción | Estado | Detalles |
|-----------|-------------|--------|---------|
| `packages/database/prisma/seed_procesos.ts` | Definiciones SIRH y SIAST en PROCESO_SEED_MAP local | VERIFICADO | PROCESO_SEED_MAP local, sin import de @stf/shared, SIRH/SIAST con tipoFlujo DIRECTO |
| `apps/api/src/services/tickets.service.ts` | Servicio central con DB como fuente de verdad para procesos | VERIFICADO | `procesoDefinicion.findFirst` en línea 248; 6 guards D-08 a D-13 presentes |
| `apps/api/src/controllers/metricas.controller.ts` | Métricas de procesos usando DB como fuente de verdad | VERIFICADO | `procesoDefinicion.findFirst` en línea 199; sin referencias a PROCESO_MAP ni getProcesoKey |
| `packages/shared/src/index.ts` | Módulo shared sin PROCESO_MAP | VERIFICADO | FOLIO_PREFIX en línea 400, SUBTIPO_SISTEMAS en línea 448; PROCESO_MAP, getProcesoKey, getProcesoInfo ausentes |

---

### Verificación de Vínculos Clave (Key Links)

| Desde | Hacia | Vía | Estado | Detalles |
|-------|-------|-----|--------|---------|
| `tickets.service.ts crearTicket` | `prisma.procesoDefinicion` | `findFirst({ subcategoria, subTipo, activo: true })` | WIRED | Línea 248-251 — incluye pasos en order `asc` |
| `tickets.service.ts completarPaso` | `pasoTicket siguiente` | `findFirst({ orden: { gt: paso.orden }, estado: { not: 'COMPLETADO' } })` | WIRED | Línea 526-529 — fix D-08 aplicado correctamente |
| `metricas.controller.ts metricasProcesos` | `prisma.procesoDefinicion` | `findFirst({ subcategoria, subTipo })` | WIRED | Líneas 199-205 — dentro del loop; fallback a `key` si no existe en DB |
| `packages/shared/src/index.ts` | consumers (tickets.service, metricas.controller) | imports de @stf/shared sin PROCESO_MAP | WIRED | Solo comentarios residuales en metricas.controller.ts (`// reemplaza getProcesoKey — D-03`); sin imports activos |
| `seed_procesos.ts` | `prisma.procesoDefinicion` | `seedProcesos(prisma)` llamado desde seed.ts | WIRED | `seed.ts` llama `await seedProcesos(prisma)` |

---

### Rastreo de Datos (Level 4)

| Artefacto | Variable de datos | Fuente | Produce datos reales | Estado |
|-----------|------------------|--------|----------------------|--------|
| `tickets.service.ts crearTicket` | `proceso.pasos` | `prisma.procesoDefinicion.findFirst(...)` con `include: { pasos }` | Sí — query real a DB | FLOWING |
| `metricas.controller.ts metricasProcesos` | `procesoDb?.nombre` | `prisma.procesoDefinicion.findFirst(...)` por subcategoria/subTipo | Sí — query real a DB; fallback a key si null | FLOWING |

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
| `asignarPaso` crea historialTicket entry | grep en asignarPaso (líneas 577-639) | 0 resultados — ausente | FAIL |

---

### Cobertura de Requerimientos

| Requerimiento | Plan | Descripción | Estado | Evidencia |
|---------------|------|-------------|--------|-----------|
| PRO-01 | 02-02, 02-03, 02-04 | Tickets leen definición de proceso desde ProcesoDefinicion DB | SATISFECHO | `procesoDefinicion.findFirst` en crearTicket y metricasProcesos; PROCESO_MAP eliminado de shared |
| PRO-02 | 02-01 | Flujo SISTEMAS_INSTITUCIONALES:SIRH completado con pasos y técnicos asignables | SATISFECHO | Seed: SIRH tipoFlujo DIRECTO, 1 paso TECNICO_TI; flujo operativo |
| PRO-03 | 02-01 | Flujo SISTEMAS_INSTITUCIONALES:SIAST completado con pasos y técnicos asignables | SATISFECHO | Seed: SIAST tipoFlujo DIRECTO, 1 paso TECNICO_TI; flujo operativo |
| PRO-04 | 02-04 | Escalamiento Recursos Materiales desde MANTENIMIENTO_CORRECTIVO vinculado | BLOQUEADO | Marcado como DIFERIDO en plan 02-04. No hay fase posterior en el roadmap que lo cubra. El ROADMAP Phase 2 lo lista como deliverable y UAT. |
| NOT-01 | 02-02 | `ticket:paso_asignado` y `ticket:paso_listo` emitidos en todos los flujos nuevos | SATISFECHO | `emitirPasoAsignado` emite `ticket:paso_asignado` (línea 143); `emitirPasoListo` emite `ticket:paso_listo` (línea 179); wired en tickets.service.ts |
| NOT-02 | 02-02 | Historia/audit trail actualizado en asignación de recursos | BLOQUEADO | `asignarPaso()` emite Socket.IO y crea notificación en BD, pero no registra entrada en `historialTicket`. La asignación de técnico a paso no queda en el audit trail del ticket. |

---

### Anti-Patrones Encontrados

| Archivo | Línea | Patrón | Severidad | Impacto |
|---------|-------|--------|-----------|---------|
| `apps/api/src/services/tickets.service.ts` | 577-639 | `asignarPaso` sin `historialTicket.create` | Advertencia | Audit trail incompleto — asignación de técnico a paso no rastreable |
| `apps/api/src/controllers/metricas.controller.ts` | 193, 198 | Comentarios residuales mencionando `getProcesoKey` y `PROCESO_MAP` | Info | Solo documentación; sin impacto funcional |

---

### Verificación Humana Requerida

No hay items de verificación humana necesarios para el código implementado. Los gaps identificados son verificables programáticamente.

---

## Resumen de Gaps

**2 gaps bloquean el logro completo del objetivo de la fase:**

**Gap 1 — PRO-04 no implementado (BLOQUEADOR):** El ROADMAP.md Phase 2 lista explícitamente "Escalamiento Recursos Materiales desde MANTENIMIENTO_CORRECTIVO vinculado a paso SIAST" como deliverable y UAT ("Escalamiento de mantenimiento correctivo genera paso en cola de SIAST"). El plan 02-04 lo marca como DIFERIDO por decisión en CONTEXT.md, pero PRO-04 no aparece en ninguna fase posterior del roadmap. Esto significa que la decisión de diferimiento no tiene una fase de aterrizaje — queda en el backlog sin asignar. Para cerrar el gap hay dos opciones: (a) asignar PRO-04 a una fase concreta del roadmap, o (b) moverlo explícitamente al backlog en ROADMAP.md y REQUIREMENTS.md, y aceptar que el ROADMAP Phase 2 goal quedó parcialmente incompleto.

**Gap 2 — NOT-02 historial incompleto (BLOQUEADOR):** `asignarPaso()` en `tickets.service.ts` no crea entrada en `historialTicket` cuando se asigna un técnico a un paso. El ticket cambia a EN_PROGRESO (lo cual sí genera historial en `cambiarEstado` si se llama directamente), pero la asignación específica de un técnico a un paso de un flujo multi-técnico no queda auditada. Para cumplir NOT-02 se requiere agregar `prisma.historialTicket.create` dentro de `asignarPaso` con un comentario como `"Paso {orden} — {nombre} asignado a {tecnico.nombre}"`.

---

_Verificado: 2026-05-11T18:00:00Z_
_Verificador: Claude (gsd-verifier)_
