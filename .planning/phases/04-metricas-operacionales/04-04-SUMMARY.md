---
phase: 04-metricas-operacionales
plan: "04"
subsystem: ui-integration
tags: [react, mui, recharts, metricas, dashboard, tabs, socket, print, historial, prisma]

# Dependency graph
requires:
  - phase: 04-metricas-operacionales
    plan: "03"
    provides: 8 componentes atómicos (RechartsBarChart, RechartsLineChart, RechartsPieChart, SlaIndicator, DateRangeFilter, EficienciaTable, RendimientoTecnicoTable) + getMetricas()
  - phase: 04-metricas-operacionales
    plan: "02"
    provides: GET /api/metricas con Zod validation y role scoping

provides:
  - MetricasTabGlobal en apps/web/src/components/metricas/MetricasTabGlobal.jsx
  - MetricasTabResponsable en apps/web/src/components/metricas/MetricasTabResponsable.jsx
  - MetricasTabTecnico en apps/web/src/components/metricas/MetricasTabTecnico.jsx
  - MetricasOperacionalesSection en apps/web/src/components/metricas/MetricasOperacionalesSection.jsx
  - DashboardPage con MetricasOperacionalesSection integrada
  - Job diario de snapshots en MetricasHistorial via setInterval en apps/api/src/index.ts

affects:
  - Phase 5 (Reportes Exportables) — puede consumir MetricasHistorial ya poblado por el job diario

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ticketsVersion de useNotifStore en deps del useEffect — refetch automático por eventos socket sin polling"
    - "Tab visibility por rol: showGlobal/showResponsable/showTecnico derivados del rol JWT (no URL params)"
    - "CSS @media print: tabs ocultos, todos los panels display:block — dashboard imprimible sin JS"
    - "Drill-down state: handleResponsableClick setSelectedAreaId + setActiveTab(1); handleTecnicoClick setSelectedTecnicoId + setActiveTab(2)"
    - "setInterval job con .unref() — no bloquea el cierre del proceso Node en Windows"
    - "upsert con @@unique([fecha, areaSoporteId]) — idempotente, corre daily sin duplicar filas"

key-files:
  created:
    - apps/web/src/components/metricas/MetricasTabGlobal.jsx
    - apps/web/src/components/metricas/MetricasTabResponsable.jsx
    - apps/web/src/components/metricas/MetricasTabTecnico.jsx
    - apps/web/src/components/metricas/MetricasOperacionalesSection.jsx
  modified:
    - apps/web/src/pages/DashboardPage.jsx
    - apps/api/src/index.ts

key-decisions:
  - "tipoFromTab: tab 0 → 'area' (Global), tab 1 → 'tecnico' (Por Responsable), tab 2 → 'proceso' (Por Técnico) — mapeo necesario por el nombre del tipo en backend"
  - "TECNICO_* con tab inicial forzado a 2, sin tab Por Responsable visible — D-15 del UI-SPEC"
  - "setInterval con .unref() para el job diario — mismo patrón que el SIRH sync ya presente en index.ts"
  - "userId pasado como fallback de tecnicoId en params cuando tipo=proceso y no hay selectedTecnicoId — permite que TECNICO_* vea sus propias métricas al cargar"

# Metrics
duration: 25min
completed: 2026-05-26
requirements-completed: [MET-01, MET-02, MET-03, MET-04]
---

# Phase 4 Plan 04: Ensamblaje Final de Métricas Operacionales Summary

**3 tabs de contenido (Global/Responsable/Técnico) + MetricasOperacionalesSection con ticketsVersion + refetch automático + CSS print-friendly + integración en DashboardPage por rol + job diario de snapshots MetricasHistorial con setInterval en API**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-26T18:05:00Z
- **Completed:** 2026-05-26T18:30:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Los 3 tabs de contenido creados: MetricasTabGlobal (4 KPIs + 3 charts + EficienciaTable), MetricasTabResponsable (4 KPIs + 3 charts + RendimientoTecnicoTable), MetricasTabTecnico (3 KPIs + 3 charts de productividad)
- MetricasOperacionalesSection: contenedor con visibilidad de tabs por rol, DateRangeFilter, refetch via ticketsVersion de useNotifStore, drill-down responsable→tab1 y tecnico→tab2, LinearProgress durante carga, CSS @media print con todos los panels visibles
- DashboardPage integrado con condicional `rol === "ADMIN" || rol === "MESA_AYUDA" || rol.startsWith("RESPONSABLE_") || rol.startsWith("TECNICO_")`
- Job diario `ejecutarSnapshotMetricas()` en apps/api/src/index.ts: upsert global + por área en MetricasHistorial, se ejecuta al arrancar y cada 24h via setInterval con .unref()
- Build frontend: 3223 modules, sin errores (warning de chunk size es pre-existente, no relacionado)
- TypeScript API: sin errores (npx tsc --noEmit pasa limpio)

## Task Commits

1. **Tarea 1: 3 tabs + MetricasOperacionalesSection** — `b9a461c` (feat)
2. **Tarea 2: DashboardPage + job diario API** — `3e2e4fd` (feat)

## Files Created/Modified

- `apps/web/src/components/metricas/MetricasTabGlobal.jsx` — Tab ADMIN: 4 KPIs, barras por área, líneas tendencia, pastel categorías, EficienciaTable
- `apps/web/src/components/metricas/MetricasTabResponsable.jsx` — Tab Responsable: 4 KPIs, barras carga técnicos, líneas tendencia, pastel subcategorías, RendimientoTecnicoTable
- `apps/web/src/components/metricas/MetricasTabTecnico.jsx` — Tab Técnico: 3 KPIs, línea productividad, pastel resueltos/cancelados, barras comparativa vs área
- `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx` — Contenedor principal con toda la lógica de estado
- `apps/web/src/pages/DashboardPage.jsx` — import + render condicional MetricasOperacionalesSection
- `apps/api/src/index.ts` — imports metricas.service + prisma, función ejecutarSnapshotMetricas, setInterval 24h

## Decisions Made

- **tipoFromTab mapping:** el backend distingue los responses por el campo `tipo` (area/tecnico/proceso). El contenedor filtra `data?.tipo === "area"` para pasar al tab correcto evitando datos cruzados entre tabs.
- **userId como fallback tecnicoId:** cuando un TECNICO_* carga el dashboard por primera vez, selectedTecnicoId es null. Se pasa `userId` como `tecnicoId` en params para que sus métricas se carguen sin necesidad de drill-down previo.
- **setInterval con .unref():** consistente con el patrón SIRH ya presente. Permite que el proceso cierre limpiamente con SIGINT/SIGTERM sin que el interval lo bloquee.

## Deviations from Plan

### Auto-añadidos (Rule 2 — funcionalidad crítica faltante)

**1. [Rule 2 - Missing Feature] userId como fallback para TECNICO_* en tab Por Técnico**
- **Found during:** Tarea 1 — implementación de MetricasOperacionalesSection
- **Issue:** El plan especificaba `tecnicoId: selectedTecnicoId` en params para tipo="proceso", pero selectedTecnicoId empieza en null. Un TECNICO_* que abre el dashboard no tiene selectedTecnicoId definido hasta hacer drill-down; la pantalla quedaría en estado de carga vacía perpetuamente.
- **Fix:** Agregado fallback `|| (tipo === "proceso" && userId ? { tecnicoId: userId } : {})` en la construcción de params. El prop `userId` es pasado desde DashboardPage como `user?.id`.
- **Files modified:** MetricasOperacionalesSection.jsx
- **Impacto:** TECNICO_* ve sus propias métricas al cargar el dashboard sin necesidad de drill-down previo.

## Known Stubs

Ninguno. Los datos vienen del endpoint GET /api/metricas (Plan 02) con datos reales de la DB. El job de snapshots también escribe datos reales.

## Threat Flags

Ninguno adicional. Las mitigaciones del threat model del plan fueron implementadas:
- T-04-04-01: showGlobal/showResponsable/showTecnico controlados por rol del JWT (useAuthStore)
- T-04-04-02: condicional de visibilidad en DashboardPage es guard UI; backend (Plan 02) ya protege el scope
- T-04-04-03: catch explícito en ejecutarSnapshotMetricas — error no bloquea el servidor
- T-04-04-04: print mode opera sobre datos ya cargados y autenticados

## Self-Check: PASSED

Archivos verificados:
- FOUND: apps/web/src/components/metricas/MetricasTabGlobal.jsx
- FOUND: apps/web/src/components/metricas/MetricasTabResponsable.jsx
- FOUND: apps/web/src/components/metricas/MetricasTabTecnico.jsx
- FOUND: apps/web/src/components/metricas/MetricasOperacionalesSection.jsx
- FOUND: apps/web/src/pages/DashboardPage.jsx (modificado)
- FOUND: apps/api/src/index.ts (modificado)

Commits verificados:
- b9a461c: feat(04-04): crear tabs de metricas y MetricasOperacionalesSection
- 3e2e4fd: feat(04-04): integrar MetricasOperacionalesSection en DashboardPage y job diario de snapshots

Build frontend: exitoso (3223 modules transformed)
TypeScript API: sin errores

---
*Phase: 04-metricas-operacionales*
*Completed: 2026-05-26*
