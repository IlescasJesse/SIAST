# Phase 4: Métricas Operacionales — Discussion Log

**Date:** 2026-05-13
**Mode:** Default (interactive)

## Areas Discussed

### 1. Charting Library
- Options: MUI X Charts, Recharts, Chart.js
- Decision: Recharts — best dynamism/animation for real-time data

### 2. SLA & Indicadores
- SLA: fixed targets per category (TECNOLOGIAS=24h, SERVICIOS=48h, RECURSOS_MATERIALES=72h)
- Solvencia: 3-level (ADMIN → eficiencia responsables, RESPONSABLE_* → área metrics, TÉCNICO → capacity)
- Extra metric: tiempo de primera respuesta
- 30-day default with day-to-day comparison
- PDF export deferred to Phase 5

### 3. API Design
- Single endpoint: GET /api/metricas?tipo=area|tecnico|proceso&fechaInicio=&fechaFin=&areaId=&tecnicoId=
- Backend aggregation

### 4. Dashboard Layout
- Tab section inside DashboardPage
- 3 tabs: Global (ADMIN), Por Responsable, Por Técnico
- Full KPI sets per tab
- Date filter as settings dropdown
- Responsive: 1-col mobile, 3-col desktop

### 5. Real-time Strategy
- Reuse ticketsVersion pattern
- No polling

### 6. Additional: KPIs, Responsive, Historial
- Full KPI sets confirmed per tab
- Daily snapshots in MetricasHistorial table
- Drill-down: click responsable → ver su tab, click técnico → ver estadísticas

## Deferred Ideas
- Encuesta post-resolución (future phase)
- PDF export (Phase 5)
