---
phase: 02-features-pendientes-procesos-y-flujos
plan: "04"
subsystem: shared/seed
tags:
  - cleanup
  - proceso-map
  - dead-code
  - seed
dependency_graph:
  requires:
    - 02-02  # getProcesoInfo eliminado de tickets.service.ts
    - 02-03  # PROCESO_MAP eliminado de metricas.controller.ts
  provides:
    - shared-sin-proceso-map
    - seed-procesos-autonomo
  affects:
    - packages/shared/src/index.ts
    - packages/database/prisma/seed_procesos.ts
tech_stack:
  added: []
  patterns:
    - tipo local ProcesoSeedInfo — seed autonomo sin dependencia de @stf/shared
key_files:
  created: []
  modified:
    - packages/shared/src/index.ts
    - packages/database/prisma/seed_procesos.ts
decisions:
  - "PROCESO_MAP eliminado de @stf/shared: ningun consumer activo lo usaba tras 02-02 y 02-03"
  - "seed_procesos.ts define PROCESO_SEED_MAP local — misma logica, sin import de shared"
  - "PRO-04 (Escalamiento RM) confirmado como DIFERIDO — out of scope por decision en CONTEXT.md"
metrics:
  duration: "~10min"
  completed_date: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 02 Plan 04: Limpieza PROCESO_MAP — @stf/shared y seed_procesos autónomo Summary

**One-liner:** PROCESO_MAP, getProcesoKey y getProcesoInfo eliminados de @stf/shared; seed_procesos.ts redefinido con PROCESO_SEED_MAP local — monorepo compila sin errores.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verificar consumers y eliminar PROCESO_MAP de @stf/shared | ffd77ed | packages/shared/src/index.ts |
| 2 | Actualizar seed_procesos.ts para no depender de PROCESO_MAP eliminado | 79f5a0a | packages/database/prisma/seed_procesos.ts |

## Changes Applied

### Task 1 — Eliminar PROCESO_MAP de @stf/shared

Eliminados de `packages/shared/src/index.ts` (186 líneas removidas):
- `export type TipoFlujo`
- `export interface PasoDefinicionInfo`
- `export interface ProcesoInfo`
- `export const PROCESO_MAP` — bloque completo con 15 procesos
- `export function getProcesoKey`
- `export function getProcesoInfo`

Verificación pre-eliminación: grep en `apps/` confirmó que los únicos hits en metricas.controller.ts eran comentarios `// ... (reemplaza getProcesoKey — D-03)` — sin imports activos.

### Task 2 — seed_procesos.ts autónomo

Reescrito `packages/database/prisma/seed_procesos.ts`:
- Eliminado `import { PROCESO_MAP } from "@stf/shared"`
- Definido `type ProcesoSeedInfo` local (equivalente a ProcesoInfo eliminado)
- Definido `const PROCESO_SEED_MAP` local con los 15 procesos exactos del antiguo PROCESO_MAP
- Incluye `SISTEMAS_INSTITUCIONALES:SIRH` y `SISTEMAS_INSTITUCIONALES:SIAST` con `tipoFlujo: "DIRECTO"`
- Lógica `seedProcesos(prisma)` idéntica — solo cambia la fuente del mapa

## PRO-04 — Escalamiento Recursos Materiales

**DIFERIDO** — out of scope por decisión explícita en CONTEXT.md. No implementado en esta fase.
Aparece en `requirements` del plan únicamente para registrar la decisión de diferimiento.

## Deviations from Plan

Ninguna — plan ejecutado exactamente como escrito.

## Known Stubs

Ninguno — limpieza de código muerto, sin datos de presentación ni placeholders.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: mitigated T-02-04-01 | packages/shared/src/index.ts | Verificacion grep pre-eliminacion confirmo cero imports activos en apps/ |
| threat_flag: mitigated T-02-04-02 | packages/database/prisma/seed_procesos.ts | Logica idempotente findFirst+update conservada; SIRH/SIAST definidos explicitamente |

## Self-Check: PASSED

- [x] packages/shared/src/index.ts NO contiene PROCESO_MAP (grep count = 0)
- [x] packages/shared/src/index.ts NO contiene getProcesoKey ni getProcesoInfo (count = 0)
- [x] packages/shared/src/index.ts contiene FOLIO_PREFIX (linea 400) y SUBTIPO_SISTEMAS (linea 448)
- [x] apps/ — solo comentarios con texto "PROCESO_MAP" / "getProcesoKey", sin imports
- [x] seed_procesos.ts: import "@stf/shared" no existe (solo en JSDoc comments)
- [x] seed_procesos.ts contiene PROCESO_SEED_MAP (linea 25)
- [x] seed_procesos.ts contiene SISTEMAS_INSTITUCIONALES:SIRH tipoFlujo DIRECTO (linea 153)
- [x] seed_procesos.ts contiene SISTEMAS_INSTITUCIONALES:SIAST tipoFlujo DIRECTO (linea 167)
- [x] npx tsc --noEmit -p packages/shared/tsconfig.json — sin errores
- [x] npx tsc --noEmit -p packages/database/tsconfig.json — sin errores
- [x] npx tsc --noEmit -p apps/api/tsconfig.json — sin errores
- [x] Commit ffd77ed existe: refactor(02-04): eliminar PROCESO_MAP...
- [x] Commit 79f5a0a existe: refactor(02-04): seed_procesos.ts autonomo...
