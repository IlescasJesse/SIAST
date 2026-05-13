# Phase 4: Métricas Operacionales - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard de métricas en tiempo real para administradores y responsables de área. Endpoint único con agregación backend, visualizaciones Recharts en DashboardPage (3 tabs: Global / Por Responsable / Por Técnico), filtro de fechas y actualización vía ticketsVersion pattern. Sin cambios a flujos de tickets existentes.

Deliverables concretos:
- Endpoint `GET /api/metricas?tipo=area|tecnico|proceso&fechaInicio=&fechaFin=&areaId=&tecnicoId=` con agregación backend
- Sección "Métricas" dentro de DashboardPage con tabs (Global, Por Responsable, Por Técnico)
- ADMIN: 3 tabs con KPIs completos + tabla eficiencia responsables
- RESPONSABLE_*: tab "Por Responsable" filtrado a su AreaSoporte
- TÉCNICO: al click en técnico desde ADMIN → ver estadísticas individuales
- Filtro de rango de fechas (settings dropdown) en todas las vistas
- Actualización en tiempo real via ticketsVersion (useNotifStore)
- SLA fijo por categoría: TECNOLOGIAS=24h, SERVICIOS=48h, RECURSOS_MATERIALES=72h
- Daily snapshots de métricas en tabla MetricasHistorial para tendencias históricas
- Print-friendly dashboard (no PDF — eso va en Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Charting Library
- **D-01:** Recharts — mejor dinamismo/animaciones para datos en tiempo real, componentes 100% React, responsive container nativo. Sin dependencia adicional de UI framework.

### SLA, Indicadores y KPIs
- **D-02:** SLA = % de tickets resueltos dentro de meta fija por categoría. Metas: TECNOLOGIAS=24h, SERVICIOS=48h, RECURSOS_MATERIALES=72h. Hardcodeado en backend (sin campo en DB).
- **D-03:** Índice de solvencia a 3 niveles:
  - ADMIN: eficiencia comparativa de RESPONSABLE_* (quién resuelve más rápido, volumen por área)
  - RESPONSABLE_*: métricas de su área (carga de técnicos, tickets activos, SLA%)
  - TÉCNICO: capacidad de resolución vs cancelación + comparativa vs promedio del área
- **D-04:** Métrica adicional: tiempo de primera respuesta (desde asignación del ticket hasta primera acción/comentario del técnico)
- **D-05:** Default 30 días con comparativa día contra día simple (no abrumadora)
- **D-06:** Print-friendly dashboard en Phase 4; PDF export con métricas y gráficas diferido a Phase 5

### KPIs por Tab
- **D-07 — Tab Global (ADMIN):** Tarjetas: Total tickets (30d), Activos ahora, Resueltos (30d), SLA cumplimiento %. Charts: Barras comparativo por área, Líneas tendencia diaria (30d), Pastel distribución por categoría. Tabla: eficiencia de cada RESPONSABLE_* (nombre, tickets resueltos, tiempo promedio, SLA%).
- **D-08 — Tab Por Responsable:** Tarjetas: Tickets activos, Tiempo promedio resolución, SLA%, Tickets reabiertos. Charts: Barras carga de técnicos, Líneas creados vs resueltos (30d), Pastel distribución subcategorías. Tabla: rendimiento de cada técnico (nombre, completados, tiempo promedio, ratio resuelto/cancelado).
- **D-09 — Tab Por Técnico:** Tarjetas: Tickets completados (30d), Tiempo promedio resolución, Ratio resuelto/cancelado. Charts: Barras completados vs promedio del área, Pastel resueltos vs cancelados, Línea tendencia productividad (30d).

### API Design
- **D-10:** Endpoint único: `GET /api/metricas?tipo=area|tecnico|proceso&fechaInicio=&fechaFin=&areaId=&tecnicoId=`
- **D-11:** Backend aggregation — Prisma queries agregan datos y retornan métricas pre-computadas. Frontend solo renderiza.
- **D-12:** RESPONSABLE_* autenticado: filtrar automáticamente por su `areaSoporteId` (no necesita enviar parámetro)

### Dashboard Layout
- **D-13:** Sección "Métricas" dentro de DashboardPage (no nueva ruta). Tabs: Global | Por Responsable | Por Técnico.
- **D-14:** ADMIN ve 3 tabs completos. Click en responsable → ver su tab "Por Responsable". Click en técnico → ver su "Por Técnico".
- **D-15:** RESPONSABLE_* ve solo tab "Por Responsable" con métricas filtradas a su área. No ve tabs Global ni Por Técnico.
- **D-16:** Date range filter como settings dropdown (icono expande DatePicker de MUI). Aplica a todos los tabs.
- **D-17:** Responsive: 1-column en mobile, 3-column en desktop para tarjetas. Charts apilados verticalmente en mobile, lado a lado en desktop.

### Real-time Strategy
- **D-18:** Reuse ticketsVersion pattern existente — MetricsPage escucha `ticketsVersion` de `useNotifStore`, cuando cambia → refetch metrics API.
- **D-19:** Sin polling interval. Sin eventos socket dedicados para métricas.

### Historial de Métricas
- **D-20:** Daily snapshots almacenados en tabla `MetricasHistorial` (nuevo modelo Prisma). Job que calcula y persiste métricas una vez al día. Permite tendencias mensuales/anuales sin recalcular desde tickets históricos.

### Claude's Discretion
- Diseño visual de las charts (colores, tamaños, animaciones) — seguir convenciones de MUI + Recharts defaults
- Implementación concreta de `MetricasHistorial` schema: decidir estructura de columnas (JSON vs columnas tipadas)
- Orden y espaciado de elementos dentro de cada tab — sentido común con grid MUI

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap y Requisitos
- `.planning/ROADMAP.md` §Phase 4 — deliverables y UAT criteria
- `.planning/REQUIREMENTS.md` §Milestone 3 (MET-01 a MET-04) — requirements locked
- `.planning/phases/03-roles-y-areas-de-soporte/03-CONTEXT.md` — AreaSoporte, areaSoporteId en Usuario, scoping de RESPONSABLE_*

### Arquitectura y Patrones
- `.planning/codebase/ARCHITECTURE.md` §Real-time Architecture — ticketsVersion pattern, Socket.IO rooms, DashboardPage routing
- `.planning/codebase/INTEGRATIONS.md` §Real-Time — socket eventos existentes

### Implementación Existente
- `apps/api/src/services/notificaciones.service.ts` — setIo() singleton, emisión de eventos socket
- `apps/web/src/store/notificaciones.js` — useNotifStore con ticketsVersion counter
- `apps/web/src/pages/DashboardPage.jsx` — punto de inserción para sección métricas
- `apps/api/src/metricas/metricas.controller.ts` — controlador existente (migrar a DB + AreaSoporte)
- `packages/database/prisma/schema.prisma` — modelos existentes Ticket, Usuario, AreaSoporte

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useNotifStore.ticketsVersion` — patrón existente de Zustand + useEffect para refetch automático
- `DashboardPage.jsx` — layout MUI existente con Grid, Paper, Typography. Ampliable con sección de tabs
- `metricas.controller.ts` — estructura base del controlador (migrar de mock data a DB real)
- `tickets.service.ts` — queries de tickets con filtros por estado, fechas, técnico, área
- MUI `DatePicker` / `LocalizationProvider` — ya disponible para filtro de fechas

### Established Patterns
- Backend aggregation en servicios (services computan, controllers responden)
- Soft delete: todos los queries de tickets filtran `activo: true`
- JWT payload: `{ id, rol, areaSoporteId? }` — RESPONSABLE_* tienen areaSoporteId en token
- Role-based guards via `requireRol()` + `requireResponsableDeArea()`

### Integration Points
- DashboardPage.jsx: agregar sección de tabs después del contenido existente (o reemplazar según rol)
- metricas.controller.ts: refactorizar para usar Prisma queries con filtros reales
- Socket.IO: no se modifican eventos — solo se consume ticketsVersion existente

</code_context>

<specifics>
## Specific Ideas

- **Encuesta post-resolución** mencionada por el usuario — diferida a fase futura (requiere modelos DB, endpoints, UI nuevos)
- **PDF con métricas y gráficas** para imprimir — se implementa en Phase 5 (Reportes Exportables)
- Dashboard con tabs replicando jerarquía: ADMIN → Responsable → Técnico (drill-down por click)
- Comparativa día contra día simple en las gráficas de línea (no abrumar)

</specifics>

<deferred>
## Deferred Ideas

- **Encuesta interactiva post-resolución**: Al finalizar un ticket, mostrar encuesta al empleado sobre calidad de resolución, trato, eficiencia. Requiere: modelos DB (Survey, SurveyResponse), endpoints, UI en detalle de ticket. Fase futura.
- **PDF export de métricas**: Descargar dashboard actual como PDF con gráficas incluidas. Se implementa en Phase 5 (Reportes Exportables) como parte de los reportes.

</deferred>

---

*Phase: 4-Métricas Operacionales*
*Context gathered: 2026-05-13*
