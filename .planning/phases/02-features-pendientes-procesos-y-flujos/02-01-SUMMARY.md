---
phase: 02-features-pendientes-procesos-y-flujos
plan: "01"
subsystem: shared/database
tags: [proceso-definicion, seed, sirh, siast, directo]
dependency_graph:
  requires: []
  provides: [PROCESO_MAP_SIRH_DIRECTO, PROCESO_MAP_SIAST_DIRECTO, DB_SIRH_SIAST_SEEDED]
  affects: [packages/shared, packages/database, ProcesoDefinicion tabla]
tech_stack:
  added: []
  patterns: [upsert-idempotente, seedProcesos-from-PROCESO_MAP]
key_files:
  created: []
  modified:
    - packages/shared/src/index.ts
    - packages/database/prisma/seed.ts
decisions:
  - "SIRH y SIAST definidos con tipoFlujo DIRECTO + 1 paso TECNICO_TI (D-05, D-07)"
  - "Seed es idempotente — usa findFirst+update/create, no falla al ejecutar dos veces"
metrics:
  duration: "~8 minutos"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 02 Plan 01: Seed ProcesoDefinicion SIRH y SIAST Summary

Activación de flujos DIRECTO para SISTEMAS_INSTITUCIONALES:SIRH y SISTEMAS_INSTITUCIONALES:SIAST en PROCESO_MAP y DB mediante seed idempotente.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Actualizar PROCESO_MAP SIRH/SIAST a DIRECTO | 45f7c0e | packages/shared/src/index.ts |
| 2 | Ejecutar seed — poblar ProcesoDefinicion en DB | 468face | packages/database/prisma/seed.ts |

## Decisions Made

- **SIRH y SIAST como DIRECTO**: Ambas subcategorías tienen 1 paso con `rolRequerido: "TECNICO_TI"` y `nombre: "Atención por Soporte TI"`. Esto habilita que plan 02-02 pueda reemplazar `getProcesoInfo()` por query DB y crear pasos al abrir ticket.
- **PROCESO_MAP y helpers preservados**: `getProcesoKey` y `getProcesoInfo` no se tocan — son responsabilidad del plan 02-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FK constraint en seed.ts — PasoTicket no eliminado antes de Ticket**
- **Found during:** Tarea 2 (ejecución de seed)
- **Issue:** `prisma.ticket.deleteMany()` fallaba con error P2003 porque `PasoTicket.ticket_id` referencia `Ticket`. El seed no eliminaba `PasoTicket` antes de `Ticket`.
- **Fix:** Agregada línea `await prisma.pasoTicket.deleteMany({});` entre `historialTicket.deleteMany` y `ticket.deleteMany`.
- **Files modified:** `packages/database/prisma/seed.ts`
- **Commit:** 468face

## Seed Output Verification

```
[UPDATED] SISTEMAS_INSTITUCIONALES:SIRH — "Soporte SIRH" (1 paso(s))
[UPDATED] SISTEMAS_INSTITUCIONALES:SIAST — "Soporte SIAST" (1 paso(s))
Procesos sembrados: 17 proceso(s) listos.
Seed completado exitosamente
```

## Known Stubs

Ninguno — las entradas SIRH y SIAST están completamente definidas con paso real.

## Threat Flags

Ninguno — seed solo corre con acceso directo a DB, no expuesto vía HTTP.

## Self-Check: PASSED

- packages/shared/src/index.ts modificado con DIRECTO: CONFIRMED (commit 45f7c0e)
- packages/database/prisma/seed.ts modificado con pasoTicket fix: CONFIRMED (commit 468face)
- Seed ejecutado con UPDATED SIRH y SIAST: CONFIRMED (output verificado)
- ProcesoDefinicion en DB tiene SIRH y SIAST con tipoFlujo DIRECTO y 1 PasoDefinicion TECNICO_TI: CONFIRMED
