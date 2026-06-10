---
phase: 04-metricas-operacionales
plan: "03"
subsystem: ui
tags: [react, recharts, mui, date-fns, vite, metricas, charts, sla]

# Dependency graph
requires:
  - phase: 04-metricas-operacionales
    plan: "02"
    provides: Endpoint GET /api/metricas con Zod validation y role scoping — consumido por getMetricas()

provides:
  - getMetricas() en apps/web/src/api/metricas.js — cliente axios para GET /api/metricas
  - RechartsBarChart, RechartsLineChart, RechartsPieChart — wrappers Recharts con Box height explícito y Tooltip-before-Legend
  - SlaIndicator — Chip con colores success/warning/error por pct >= 90 / 70-89 / <70
  - DateRangeFilter — Popover con DatePicker Desde/Hasta (AdapterDateFns), TuneIcon, Aplicar/Cancelar, Badge dot
  - EficienciaTable — tabla responsables con SlaIndicator, drill-down onRowClick
  - RendimientoTecnicoTable — tabla técnicos con ratio resueltos/cancelados, drill-down onRowClick

affects:
  - 04-04 (MetricasOperacionalesSection ensambla estos átomos en DashboardPage)

# Tech tracking
tech-stack:
  added:
    - recharts ^3.8.1 (hoisted en monorepo root via npm workspaces)
  patterns:
    - "Box padre con height explícito antes de ResponsiveContainer — previene colapso a 0px (Pitfall 2 Recharts)"
    - "Tooltip antes de Legend en JSX — z-order SVG Recharts 3.x (Pitfall 7)"
    - "AdapterDateFns (no AdapterDayjs) para MUI x-date-pickers (consistente con UI-SPEC nota 4)"
    - "Componentes atómicos en apps/web/src/components/metricas/ — listos para ensamblaje en 04-04"

key-files:
  created:
    - apps/web/src/api/metricas.js
    - apps/web/src/components/metricas/SlaIndicator.jsx
    - apps/web/src/components/metricas/RechartsBarChart.jsx
    - apps/web/src/components/metricas/RechartsLineChart.jsx
    - apps/web/src/components/metricas/RechartsPieChart.jsx
    - apps/web/src/components/metricas/DateRangeFilter.jsx
    - apps/web/src/components/metricas/EficienciaTable.jsx
    - apps/web/src/components/metricas/RendimientoTecnicoTable.jsx
  modified:
    - apps/web/package.json (recharts agregado)
    - package-lock.json

key-decisions:
  - "recharts hoisted al monorepo root por npm workspaces — importable desde apps/web sin instalación en subdirectorio"
  - "AdapterDateFns confirmado sobre AdapterDayjs — UI-SPEC nota 4, consistente con date-fns ya en dependencias"
  - "Box height=260 para BarChart/LineChart, height=220 para PieChart — valores fijos del UI-SPEC"
  - "Tooltip antes de Legend en los 3 wrappers — regla obligatoria Recharts 3.x z-order SVG"

patterns-established:
  - "Chart wrappers: Box(height explícito) → ResponsiveContainer(100%/100%) → Chart → Tooltip → Legend → Series"
  - "SlaIndicator: pct >= 90 success, pct >= 70 warning, pct < 70 error — thresholds del plan"
  - "DateRangeFilter: Badge invisible si rango es default (últimos 30 días), setDraft en open para no contaminar value"
  - "Tablas con drill-down: onRowClick en TableRow, Tooltip con nombre completo, empty state con Typography secundario"

requirements-completed: [MET-01, MET-02, MET-03, MET-04]

# Metrics
duration: 20min
completed: 2026-05-26
---

# Phase 4 Plan 03: Componentes Atómicos de Métricas Summary

**recharts instalado + 3 chart wrappers (Box height explícito, Tooltip-before-Legend) + SlaIndicator + DateRangeFilter (AdapterDateFns) + EficienciaTable + RendimientoTecnicoTable con drill-down, todos en apps/web/src/components/metricas/**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-26T17:40:00Z
- **Completed:** 2026-05-26T18:00:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- recharts ^3.8.1 instalado (hoisted monorepo root) y 3 wrappers creados con los dos pitfalls críticos resueltos: Box height explícito antes de ResponsiveContainer y Tooltip antes de Legend en JSX
- Cliente API `getMetricas()` creado siguiendo el mismo patrón de `tickets.js` (import { api } from "./client.js" + .then((r) => r.data))
- SlaIndicator con 3 rangos semánticos (success/warning/error) y DateRangeFilter con AdapterDateFns, Popover, Badge dot y botones Aplicar/Cancelar
- EficienciaTable y RendimientoTecnicoTable con filas clickeables drill-down (onRowClick), empty states y SlaIndicator integrado
- Build de apps/web pasa sin errores (2501 modules transformed, ✓ built in 7.27s)

## Task Commits

Cada tarea fue commiteada atómicamente:

1. **Tarea 1: Instalar recharts + cliente API + componentes chart base** - `c66750a` (feat)
2. **Tarea 2: DateRangeFilter + EficienciaTable + RendimientoTecnicoTable** - `9b01ff0` (feat)

**Plan metadata:** pendiente (docs commit)

## Files Created/Modified
- `apps/web/src/api/metricas.js` — getMetricas(params) → GET /api/metricas
- `apps/web/src/components/metricas/SlaIndicator.jsx` — Chip success/warning/error por pct
- `apps/web/src/components/metricas/RechartsBarChart.jsx` — BarChart wrapper con Box height=260
- `apps/web/src/components/metricas/RechartsLineChart.jsx` — LineChart wrapper con Box height=260
- `apps/web/src/components/metricas/RechartsPieChart.jsx` — PieChart/Donut wrapper con Box height=220
- `apps/web/src/components/metricas/DateRangeFilter.jsx` — Popover + AdapterDateFns + Badge dot
- `apps/web/src/components/metricas/EficienciaTable.jsx` — Tabla responsables con SlaIndicator + drill-down
- `apps/web/src/components/metricas/RendimientoTecnicoTable.jsx` — Tabla técnicos con ratio + drill-down
- `apps/web/package.json` — recharts ^3.8.1 agregado
- `package-lock.json` — lock actualizado

## Decisions Made
- recharts instalado desde apps/web pero hoisted por npm workspaces al root del monorepo — comportamiento esperado, importable sin problema desde el contexto de Vite
- AdapterDateFns mantenido sobre AdapterDayjs según UI-SPEC nota 4 — date-fns ya era dependencia del proyecto (^4.1.0)
- Heights fijos del UI-SPEC: 260px para Bar/Line, 220px para Pie — valores definidos en la investigación de recharts del plan

## Deviations from Plan

Ninguna — plan ejecutado exactamente como especificado.

## Issues Encountered
- recharts no se instaló en `apps/web/node_modules/recharts/` sino en la raíz del monorepo (`node_modules/recharts/`) por el hoisting de npm workspaces. Esto es comportamiento correcto — Vite puede resolver el módulo igualmente. Sin impacto en compilación (build exitoso).

## Known Stubs
Ninguno — los componentes son átomos de presentación puros. No tienen fuente de datos propia; los datos se los pasa el padre (MetricasOperacionalesSection en Plan 04-04).

## Threat Flags
Ninguno — las superficies identificadas en el threat model del plan (T-04-03-01, T-04-03-02, T-04-03-03) fueron todas de disposición `accept` y no requieren mitigación adicional en el frontend.

## User Setup Required
Ninguno — recharts no requiere configuración externa. AdapterDateFns ya estaba cubierto por date-fns en dependencies.

## Next Phase Readiness
- 8 componentes atómicos listos en `apps/web/src/components/metricas/`
- `getMetricas()` disponible para consumo del endpoint backend (Plan 02)
- Plan 04-04 puede importar directamente: `import { RechartsBarChart } from '../metricas/RechartsBarChart.jsx'` etc.
- Build de apps/web verificado sin errores

---
*Phase: 04-metricas-operacionales*
*Completed: 2026-05-26*
