---
phase: 04-metricas-operacionales
plan: "01"
subsystem: database
tags: [prisma, mysql, typescript, metricas, schema, migration]

# Dependency graph
requires:
  - phase: 03-roles-y-areas-de-soporte
    provides: Modelo AreaSoporte con areaSoporteId en Usuario — referencia para areaSoporteId en MetricasHistorial
provides:
  - Modelo Prisma MetricasHistorial con columnas tipadas en MySQL (tabla metricas_historial)
  - Migración SQL 20260526164227_add_metricas_historial aplicada a la DB
  - Tipos TypeScript del endpoint unificado exportados desde @stf/shared (MetricasGlobalResponse, MetricasPorAreaResponse, MetricasPorTecnicoResponse, MetricasResponse)
  - Tipos de soporte: TendenciaDia, EficienciaResponsable, RendimientoTecnico, DistribucionCategoria, MetricasQueryParams, MetricasDateRange
affects:
  - 04-02 (backend metricas service importa tipos de @stf/shared y usa prisma.metricasHistorial)
  - 04-03 (frontend metricas usa MetricasGlobalResponse, MetricasPorAreaResponse, MetricasPorTecnicoResponse para props)
  - 04-04 (daily snapshot job usa prisma.metricasHistorial para escribir snapshots)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MetricasHistorial con areaSoporteId nullable como referencia suelta (snapshots se conservan aunque se elimine un área)"
    - "UNIQUE([fecha, areaSoporteId]) para prevenir duplicados en daily snapshots"
    - "Tipos TypeScript de fase 4 agregados al final de @stf/shared sin romper exports legacy"

key-files:
  created:
    - packages/database/prisma/migrations/20260526164227_add_metricas_historial/migration.sql
  modified:
    - packages/database/prisma/schema.prisma
    - packages/shared/src/index.ts

key-decisions:
  - "areaSoporteId en MetricasHistorial es nullable sin relación Prisma — snapshots se preservan si el área es eliminada (soft delete no aplica a histórico)"
  - "Columnas tipadas en lugar de JSON monolítico para MetricasHistorial — permite queries eficientes por campo en Plan 02"
  - "Tipos legacy MetricasSolicitudesResponse, MetricaTecnico, MetricaProceso conservados en @stf/shared para retrocompatibilidad con controlador viejo hasta Plan 02"

patterns-established:
  - "MetricasHistorial: referencia suelta (areaSoporteId nullable sin @relation) para preservar integridad histórica"

requirements-completed: [MET-01, MET-02, MET-03, MET-04]

# Metrics
duration: 15min
completed: 2026-05-26
---

# Phase 4 Plan 01: Schema y Tipos de Métricas Operacionales Summary

**Modelo Prisma MetricasHistorial con UNIQUE(fecha, areaSoporteId) en MySQL y 10 tipos TypeScript del endpoint unificado exportados desde @stf/shared**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-26T16:40:00Z
- **Completed:** 2026-05-26T16:55:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Modelo MetricasHistorial con 9 columnas tipadas y constraint UNIQUE([fecha, areaSoporteId]) aplicado en MySQL via migración Prisma
- Cliente Prisma regenerado con `prisma.metricasHistorial` disponible para Plan 02
- 10 tipos TypeScript nuevos exportados desde `@stf/shared` (MetricasGlobalResponse, MetricasPorAreaResponse, MetricasPorTecnicoResponse, MetricasResponse, TendenciaDia, EficienciaResponsable, RendimientoTecnico, DistribucionCategoria, MetricasQueryParams, MetricasDateRange)
- Tipos legacy conservados para retrocompatibilidad con controlador existente

## Task Commits

Cada tarea fue commiteada atómicamente:

1. **Tarea 1: Agregar modelo MetricasHistorial al schema Prisma y ejecutar migración** - `623a58d` (feat)
2. **Tarea 2: Definir tipos TypeScript del endpoint unificado en @stf/shared** - `1c82a59` (feat)

**Plan metadata:** pendiente (docs commit)

## Files Created/Modified
- `packages/database/prisma/schema.prisma` - Modelo MetricasHistorial agregado al final del schema
- `packages/database/prisma/migrations/20260526164227_add_metricas_historial/migration.sql` - SQL generado por Prisma migrate dev
- `packages/shared/src/index.ts` - 10 tipos Phase 4 agregados al final, legacy conservados

## Decisions Made
- `areaSoporteId` en MetricasHistorial es nullable sin `@relation` de Prisma: los daily snapshots se preservan aunque se elimine un AreaSoporte, garantizando integridad histórica
- Columnas tipadas en lugar de JSON monolítico: permite queries eficientes (`WHERE slaGlobal < 80`) en el servicio de Plan 02
- Tipos legacy `MetricasSolicitudesResponse`, `MetricaTecnico`, `MetricaProceso` conservados: el controlador viejo `metricas.controller.ts` los sigue usando hasta que Plan 02 lo reemplace por completo

## Deviations from Plan

Ninguna. Plan ejecutado exactamente como especificado.

El error EPERM de `npm run db:generate` al intentar reemplazar la DLL en Windows es un problema de sistema operativo (DLL en uso), no un error de Prisma. El cliente ya fue generado durante `prisma migrate dev` y se verificó con `node -e "prisma.metricasHistorial in p"` retornando OK.

## Issues Encountered
- **EPERM en db:generate (Windows):** Al ejecutar `npm run db:generate` separado, Windows no permite reemplazar `query_engine-windows.dll.node` mientras otro proceso lo tiene bloqueado. El cliente ya estaba actualizado desde `prisma migrate dev`. Verificado con Node directamente — `prisma.metricasHistorial` disponible.

## User Setup Required
Ninguno — no se requiere configuración externa.

## Next Phase Readiness
- `prisma.metricasHistorial` disponible para Plan 02 (backend metricas service)
- `MetricasGlobalResponse`, `MetricasPorAreaResponse`, `MetricasPorTecnicoResponse` exportados desde `@stf/shared` para Plans 02, 03 y 04
- Tabla `metricas_historial` en MySQL lista para que el job diario de Plan 04 escriba snapshots

---
*Phase: 04-metricas-operacionales*
*Completed: 2026-05-26*
