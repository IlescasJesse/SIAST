---
phase: 02-features-pendientes-procesos-y-flujos
plan: "03"
subsystem: api/metricas
tags: [metricas, proceso-definicion, db-source-of-truth, refactor]
dependency_graph:
  requires: [PROCESO_MAP_SIRH_SIAST_SEEDED, DB_SIRH_SIAST_SEEDED]
  provides: [METRICAS_PROCESOS_FROM_DB]
  affects: [apps/api/src/controllers/metricas.controller.ts]
tech_stack:
  added: []
  patterns: [prisma-findFirst-in-loop, inline-key-construction]
key_files:
  created: []
  modified:
    - apps/api/src/controllers/metricas.controller.ts
decisions:
  - "getProcesoKey inlineado como expresion ternaria — sin nueva funcion helper"
  - "procesoDefinicion.findFirst sin filtro activo — nombre fallback es la clave si no existe en DB"
metrics:
  duration: "~5 minutos"
  completed: "2026-05-11"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 02 Plan 03: Migrar metricasProcesos a ProcesoDefinicion DB Summary

Eliminacion del PROCESO_MAP hardcodeado en `metricas.controller.ts`: el nombre del proceso ahora viene de `prisma.procesoDefinicion.findFirst` en cada iteracion del loop, garantizando consistencia con los datos de DB.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Reemplazar PROCESO_MAP con query DB en metricasProcesos | 0793d86 | apps/api/src/controllers/metricas.controller.ts |

## Decisions Made

- **getProcesoKey inlineado**: La logica `grupo.sub_tipo ? \`${subcategoria}:${sub_tipo}\` : subcategoria` reemplaza la llamada a `getProcesoKey` sin necesidad de importar el helper.
- **Fallback a clave**: Si `procesoDefinicion.findFirst` retorna null (proceso no en DB), el nombre mostrado es la clave compuesta — comportamiento identico al anterior con `PROCESO_MAP`.

## Deviations from Plan

Ninguna — plan ejecutado exactamente como escrito.

## Known Stubs

Ninguno — la query DB esta completamente implementada y wired.

## Threat Flags

Ninguno — sin nuevas superficies de red ni rutas de auth. El acceso a `metricasProcesos` sigue protegido por el middleware de auth existente (ADMIN/MESA_AYUDA).

## Self-Check: PASSED

- `apps/api/src/controllers/metricas.controller.ts` sin referencias a PROCESO_MAP ni getProcesoKey (solo comentarios): CONFIRMED
- `prisma.procesoDefinicion.findFirst` en el loop metricasProcesos: CONFIRMED (linea 199)
- `procesoDb?.nombre ?? key` en resultado.push: CONFIRMED (linea 247)
- `npx tsc --noEmit` sin errores: CONFIRMED (salida vacia = exito)
- Commit 0793d86: CONFIRMED
