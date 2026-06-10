---
phase: 04-metricas-operacionales
verified: 2026-05-26T20:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "ADMIN abre DashboardPage y ve 3 tabs: Global, Por Responsable, Por Técnico con datos reales de DB (no ceros)"
    expected: "Sección 'Métricas Operacionales' visible con KPIs y gráficas Recharts pobladas"
    why_human: "Requiere servidor con MySQL activo, usuario autenticado y datos en DB"
  - test: "RESPONSABLE_TI abre DashboardPage — solo ve tab 'Por Responsable' filtrado a su área, no puede ver métricas de otras áreas"
    expected: "Tab Global ausente, tab Por Responsable muestra datos de su área únicamente, API retorna 403 si intenta tipo=area"
    why_human: "Requiere JWT con areaSoporteId real y servidor corriendo"
  - test: "TECNICO_TI abre DashboardPage — solo ve tab 'Por Técnico' con sus propios datos, API retorna 403 para tipo=area y tipo=tecnico"
    expected: "Tabs Global y Por Responsable ausentes, métricas son las del técnico autenticado"
    why_human: "Requiere JWT con rol TECNICO_TI y servidor corriendo"
  - test: "Cambiar DateRangeFilter (Desde/Hasta) y presionar Aplicar dispara refetch y las gráficas se actualizan"
    expected: "LinearProgress aparece brevemente, luego gráficas muestran datos del nuevo rango"
    why_human: "Comportamiento de UX/interacción que no puede verificarse con grep"
  - test: "Completar un ticket en el sistema — las métricas en DashboardPage se refrescan automáticamente sin recargar página"
    expected: "ticketsVersion se incrementa vía socket event, useEffect dispara nuevo getMetricas"
    why_human: "Requiere flujo de socket en tiempo real entre API y cliente"
  - test: "Ctrl+P en DashboardPage con rol ADMIN muestra todos los tabs visibles simultáneamente en la vista de impresión"
    expected: "CSS @media print oculta tabs y muestra todos los panels con datos"
    why_human: "Comportamiento de impresión requiere verificación visual en navegador"
  - test: "Arrancar apps/api y verificar en consola que el job diario de MetricasHistorial se ejecuta (o encontrar snapshot existente en DB)"
    expected: "Log '[MetricasHistorial] Snapshot guardado — YYYY-MM-DD' aparece después de 30s del arranque (si no existe snapshot de hoy)"
    why_human: "Requiere servidor corriendo y acceso a la DB/consola"
---

# Phase 4: Métricas Operacionales — Verification Report

**Phase Goal:** Dashboard de métricas operacionales con datos reales de DB — 3 vistas por rol (ADMIN/RESPONSABLE/TECNICO), endpoint unificado /api/metricas, gráficas Recharts, filtrado por fecha, refetch por socket events.
**Verified:** 2026-05-26T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | La tabla metricas_historial existe en MySQL con columnas tipadas y constraint UNIQUE(fecha, areaSoporteId) | VERIFIED | Migration `20260526164227_add_metricas_historial/migration.sql` existe; schema.prisma línea 608 contiene `model MetricasHistorial` |
| 2 | El tipo MetricasResponse existe en @stf/shared exportando los 3 shapes del endpoint unificado | VERIFIED | `packages/shared/src/index.ts` exporta `MetricasGlobalResponse` (l.648), `MetricasPorAreaResponse` (l.665), `MetricasPorTecnicoResponse` (l.683), `MetricasResponse` union (l.699-701) |
| 3 | Prisma client regenerado reconoce el modelo MetricasHistorial | VERIFIED | Migration aplicada según SUMMARY-01; `prisma.metricasHistorial` usado en `apps/api/src/index.ts` (l.119, 155, 188) sin error de compilación TS |
| 4 | GET /api/metricas?tipo=area retorna MetricasGlobalResponse con datos reales de DB | VERIFIED | `metricas.service.ts` implementa `obtenerMetricasGlobal` con queries Prisma reales (l.124); controlador enruta correctamente; ningún return estático detectado |
| 5 | GET /api/metricas?tipo=tecnico con RESPONSABLE_* siempre usa areaSoporteId del JWT | VERIFIED | Controller `metricas.controller.ts` l.87-93: ROLES_RESPONSABLE → `areaId = user.areaSoporteId`, ignora query param. CR-02 fix también bloquea tipo=area con 403 (l.81-84) |
| 6 | GET /api/metricas?tipo=proceso con TECNICO_* fuerza tecnicoId = user.id | VERIFIED | Controller l.75-78: TECNICO_* bloqueado de tipo=area y tipo=tecnico con 403. L.96: `tecnicoIdEfectivo = user.id` para TECNICO_* en tipo=proceso |
| 7 | Fechas malformadas retornan 400 antes de llegar a Prisma | VERIFIED | Zod `QuerySchema` l.10-19: `new Date(s)` + `isNaN()` check → lanza Error → `safeParse` retorna false → `res.status(400)` |
| 8 | bigint de $queryRaw nunca llega a JSON.stringify (siempre convertido a Number) | VERIFIED | `metricas.service.ts`: 9 ocurrencias de `Number(r.` en raw query results; `calcularTendencia`, `comparativoPorArea`, `reabiertosRow` todos convierten |
| 9 | Refetch automático ocurre cuando ticketsVersion cambia (socket events) | VERIFIED (code) | `MetricasOperacionalesSection.jsx` l.51: `ticketsVersion = useNotifStore(s => s.ticketsVersion)`, l.104: incluido en deps de useEffect. Comportamiento runtime requiere verificación humana |

**Score:** 9/9 truths verified at code level

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/database/prisma/schema.prisma` | Modelo MetricasHistorial con columnas tipadas | VERIFIED | `model MetricasHistorial` en l.608, UNIQUE([fecha, areaSoporteId]), @@map("metricas_historial") |
| `packages/database/prisma/migrations/` | Migración add_metricas_historial | VERIFIED | Directorio `20260526164227_add_metricas_historial/migration.sql` existe |
| `packages/shared/src/index.ts` | MetricasGlobalResponse y tipos Phase 4 | VERIFIED | 10 tipos exportados: MetricasGlobalResponse, MetricasPorAreaResponse, MetricasPorTecnicoResponse, MetricasResponse, TendenciaDia, EficienciaResponsable, RendimientoTecnico, DistribucionCategoria, MetricasQueryParams, MetricasDateRange |
| `apps/api/src/services/metricas.service.ts` | Aggregation logic con Prisma — SLA, tiempos, tendencia, carga | VERIFIED | 461+ líneas; exporta `obtenerMetricasGlobal`, `obtenerMetricasPorArea`, `obtenerMetricasPorTecnico`; 4 helpers privados |
| `apps/api/src/controllers/metricas.controller.ts` | Endpoint único GET /api/metricas con Zod validation y role scoping | VERIFIED | Un único export `obtener`; Zod QuerySchema; role scoping para RESPONSABLE_* y TECNICO_*; CR-01 y CR-02 fixes aplicados |
| `apps/api/src/routes/metricas.routes.ts` | Ruta única con todos los roles Phase 3+ | VERIFIED | `router.get("/", rolesMetricas, ctrl.obtener)`; RESPONSABLE_TI y TECNICO_ELECTRICISTA presentes |
| `apps/web/src/api/metricas.js` | Función getMetricas para consumir endpoint unificado | VERIFIED | `export const getMetricas = (params, signal) => api.get("/api/metricas", ...).then(r => r.data)` |
| `apps/web/src/components/metricas/RechartsBarChart.jsx` | Wrapper BarChart con Box height explícito | VERIFIED | `Box sx={{ width: "100%", height: 260 }}`, Tooltip antes de Legend, ResponsiveContainer |
| `apps/web/src/components/metricas/RechartsLineChart.jsx` | Wrapper LineChart con Box height explícito | VERIFIED | `height: 260`, Tooltip antes de Legend |
| `apps/web/src/components/metricas/RechartsPieChart.jsx` | Wrapper PieChart donut | VERIFIED | `height: 220`, Tooltip antes de Legend |
| `apps/web/src/components/metricas/SlaIndicator.jsx` | Chip con colores SLA OK/En riesgo/Incumplido | VERIFIED | `pct >= 90` → success, `pct >= 70` → warning, else → error |
| `apps/web/src/components/metricas/DateRangeFilter.jsx` | Popover con DatePicker Desde/Hasta y botón Aplicar | VERIFIED | AdapterDateFns, TuneIcon, botones Aplicar/Cancelar, Badge dot |
| `apps/web/src/components/metricas/EficienciaTable.jsx` | Tabla responsables con drill-down | VERIFIED | `onRowClick` en TableRow, SlaIndicator importado |
| `apps/web/src/components/metricas/RendimientoTecnicoTable.jsx` | Tabla técnicos con drill-down | VERIFIED | `onRowClick` en TableRow |
| `apps/web/src/components/metricas/MetricasTabGlobal.jsx` | Tab Global ADMIN: KPIs + 3 charts + tabla | VERIFIED | Archivo existe con KPIs, RechartsBarChart, RechartsLineChart, RechartsPieChart, EficienciaTable |
| `apps/web/src/components/metricas/MetricasTabResponsable.jsx` | Tab Por Responsable: KPIs + 3 charts + tabla | VERIFIED | Archivo existe con KPIs, 3 charts, RendimientoTecnicoTable |
| `apps/web/src/components/metricas/MetricasTabTecnico.jsx` | Tab Por Técnico: KPIs + 3 charts | VERIFIED | Archivo existe con 3 KPIs, 3 charts de productividad |
| `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx` | Contenedor principal con tabs, DateRangeFilter, refetch por ticketsVersion | VERIFIED | ticketsVersion en deps useEffect; AbortController implementado; @media print; drill-down handlers; LinearProgress |
| `apps/web/src/pages/DashboardPage.jsx` | DashboardPage con MetricasOperacionalesSection insertada | VERIFIED | Import en l.20; render condicional en l.587-596 con `rol`, `user?.areaSoporteId`, `user?.id` |
| `apps/api/src/index.ts` | Job diario de snapshots en MetricasHistorial | VERIFIED | `ejecutarSnapshotMetricas()` con upsert global + por área; `setInterval(... 24h).unref()`; check de snapshot existente antes de primera ejecución |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `metricas.routes.ts` | `metricas.controller.ts` | `router.get('/', rolesMetricas, ctrl.obtener)` | WIRED | l.26 routes → ctrl.obtener confirmado |
| `metricas.controller.ts` | `metricas.service.ts` | `metricasService.obtenerMetricasGlobal/PorArea/PorTecnico` | WIRED | Controller importa `* as metricasService` y llama las 3 funciones |
| `metricas.service.ts` | `prisma.ticket / prisma.$queryRaw` | Prisma aggregation queries | WIRED | 9 ocurrencias de `Number(r.` en raw queries; `prisma.ticket.count`, `groupBy`, `findMany` usados |
| `MetricasOperacionalesSection.jsx` | `notificaciones.js` | `useNotifStore(s => s.ticketsVersion)` | WIRED | l.51 import y uso confirmados; l.104 en deps de useEffect |
| `MetricasOperacionalesSection.jsx` | `api/metricas.js` | `getMetricas(params)` | WIRED | l.15 import; l.95 llamada con params y signal |
| `DashboardPage.jsx` | `MetricasOperacionalesSection.jsx` | import + render condicional por rol | WIRED | l.20 import, l.587-596 uso condicional con props rol/areaSoporteId/userId |
| `apps/api/src/index.ts` | `metricas.service.ts` | `setInterval` job que llama `obtenerMetricasGlobal` y escribe en `MetricasHistorial` | WIRED | l.17 import `* as metricasService`; l.118 `metricasService.obtenerMetricasGlobal()`; l.119 `prisma.metricasHistorial.upsert` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `MetricasTabGlobal.jsx` | `data` prop | `MetricasOperacionalesSection` → `getMetricas()` → `GET /api/metricas?tipo=area` → `obtenerMetricasGlobal()` | Yes — Prisma queries reales con `prisma.ticket.count`, `groupBy`, `$queryRaw` | FLOWING |
| `MetricasTabResponsable.jsx` | `data` prop | mismo flujo con `tipo=tecnico` → `obtenerMetricasPorArea()` | Yes — Prisma real | FLOWING |
| `MetricasTabTecnico.jsx` | `data` prop | mismo flujo con `tipo=proceso` → `obtenerMetricasPorTecnico()` | Yes — Prisma real | FLOWING |
| `EficienciaTable.jsx` | `rows` prop | `data.eficienciaResponsables` de `MetricasGlobalResponse` | Yes — computed desde `prisma.usuario.findMany` + `calcularSLA` + `calcularTiempoPromedio` per responsable | FLOWING |
| `RendimientoTecnicoTable.jsx` | `rows` prop | `data.rendimientoTecnicos` de `MetricasPorAreaResponse` | Yes — computed con queries individuales por técnico | FLOWING |

---

### Behavioral Spot-Checks

Step 7b SKIPPED — requiere servidor MySQL activo. No hay entry points ejecutables sin infraestructura de DB.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MET-01 | 04-01, 04-02, 04-03, 04-04 | Dashboard de métricas por área (tiempo de resolución, volumen, SLA) | SATISFIED | Tab Global con KPIs de área, Tab Por Responsable con SLA y tiempos; datos reales de Prisma |
| MET-02 | 04-02, 04-04 | Métricas por técnico (carga de trabajo, eficiencia) | SATISFIED | Tab Por Responsable incluye cargaTecnicos y rendimientoTecnicos; Tab Por Técnico con KPIs individuales |
| MET-03 | 04-02, 04-03, 04-04 | Métricas por proceso/tipo (distribución categorías, tiempos por subcategoría) | SATISFIED | `distribucionCategoria` en Tab Global, `distribucionSubcategoria` en Tab Por Responsable; endpoint tipo=proceso |
| MET-04 | 04-04 | Indicadores en tiempo real (solicitudes activas, colas por área) | SATISFIED | `ticketsActivos` en KPIs; `ticketsVersion` de useNotifStore en deps de useEffect para refetch en tiempo real |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/index.ts` | 120 | `null as any` cast en upsert where | INFO | Circunventa type safety de Prisma para compound unique con nullable. No afecta runtime. Reportado en REVIEW como IN-01, dejado como tech debt |
| `apps/web/src/components/metricas/RechartsPieChart.jsx` | ~37 | `key={i}` (array index) para Cell elements | INFO | Puede causar anomalías de animación cuando los datos cambian de orden. Reportado como IN-02. No bloquea funcionalidad |
| `apps/api/src/services/metricas.service.ts` | 71 | LEFT JOIN `OR t.tecnico_id IS NULL` sin filtro de área en tickets sin técnico | WARNING | Tickets sin técnico asignado se incluyen en la tendencia de TODAS las áreas simultáneamente. Requiere modelo de dominio claro sobre "pertenencia de ticket a área" para tickets no asignados |

---

### Human Verification Required

#### 1. Dashboard ADMIN con datos reales

**Test:** Autenticarse como ADMIN, abrir DashboardPage, verificar que aparece la sección "Métricas Operacionales" con 3 tabs (Global, Por Responsable, Por Técnico). Seleccionar cada tab y confirmar que los KPIs muestran números reales (no todos ceros).
**Expected:** KPIs numéricos reales, gráficas Recharts renderizadas con datos, tabla EficienciaTable con filas de responsables.
**Why human:** Requiere servidor MySQL + API + Web corriendo con datos en DB.

#### 2. Scoping de rol RESPONSABLE_*

**Test:** Autenticarse como RESPONSABLE_TI. Verificar: (a) solo tab "Por Responsable" visible; (b) los datos corresponden a su área TI; (c) intentar llamar GET /api/metricas?tipo=area con su JWT retorna 403.
**Expected:** Un solo tab, datos filtrados a área TI, 403 en intento de tipo=area.
**Why human:** Requiere JWT real con areaSoporteId y servidor corriendo.

#### 3. Scoping de rol TECNICO_*

**Test:** Autenticarse como TECNICO_TI. Verificar: (a) solo tab "Por Técnico" visible con sus propias métricas; (b) datos cargados automáticamente (userId como fallback para tecnicoId); (c) intentar GET /api/metricas?tipo=tecnico retorna 403.
**Expected:** Un solo tab con métricas del técnico autenticado, carga automática sin drill-down previo.
**Why human:** Requiere JWT real con rol TECNICO_TI.

#### 4. Refetch por socket event (ticketsVersion)

**Test:** Con ADMIN autenticado, completar (resolver) un ticket en otra pestaña/sesión. Sin recargar la página del dashboard, verificar que las métricas se actualizan en ~1-2 segundos.
**Expected:** LinearProgress aparece brevemente, luego KPIs y gráficas reflejan el nuevo estado del ticket.
**Why human:** Requiere flujo completo de Socket.IO entre API y cliente en tiempo real.

#### 5. Filtrado por DateRangeFilter

**Test:** Abrir DateRangeFilter, seleccionar un rango de fechas diferente al default (últimos 30 días) — por ejemplo, la última semana. Presionar Aplicar.
**Expected:** LinearProgress durante refetch, gráficas actualizadas con datos del nuevo rango; Badge dot aparece indicando filtro activo.
**Why human:** Comportamiento de UX e interacción no verificable con análisis estático.

#### 6. CSS print-friendly

**Test:** Como ADMIN con los 3 tabs, ejecutar Ctrl+P (o abrir vista de impresión del navegador).
**Expected:** Los botones de tabs desaparecen; los 3 panels de contenido (Global, Por Responsable, Por Técnico) aparecen apilados verticalmente; el DateRangeFilter button desaparece; el rango de fechas se muestra como texto.
**Why human:** Comportamiento de @media print requiere verificación visual en navegador.

#### 7. Job diario de MetricasHistorial

**Test:** Reiniciar apps/api (o arrancar por primera vez hoy). Verificar en consola del servidor después de 30 segundos.
**Expected:** Log `[MetricasHistorial] Snapshot guardado — YYYY-MM-DD` aparece si no existe snapshot del día. Verificar en DB: `SELECT * FROM metricas_historial WHERE fecha = CURDATE()` retorna filas.
**Why human:** Requiere arranque del servidor y acceso a logs de consola/DB.

---

### Gaps Summary

No se encontraron gaps bloqueantes. Todos los must-haves están implementados y verificados a nivel de código.

**Observación sobre WARNING de anti-patrón:** El LEFT JOIN en `calcularTendencia` incluye tickets sin técnico asignado (`OR t.tecnico_id IS NULL`) en la tendencia de un área sin verificar si el ticket pertenece a esa área. En la implementación actual, la pertenencia de un ticket a un área se determina exclusivamente por el técnico asignado — tickets en estado ABIERTO sin técnico se contarían para todas las áreas simultáneamente. Este es un defecto de lógica de dominio que puede producir números inflados en la tendencia diaria del Tab Por Responsable cuando hay tickets sin asignar. No bloquea el funcionamiento del dashboard (los datos se muestran) pero puede generar KPIs incorrectos. Decisión sobre corrección queda al equipo de desarrollo.

**Estado del Code Review:** El REVIEW marcó `status: fixed` en el frontmatter. Verificación del código confirma que los 5 Critical Issues fueron resueltos en el código real:
- CR-01: Bloqueado — TECNICO_* recibe 403 para tipo=area y tipo=tecnico (controller l.75-78)
- CR-02: Bloqueado — RESPONSABLE_* recibe 403 para tipo=area (controller l.81-84)
- CR-03: Corregido — snapshot por área usa `prisma.ticket.count` real (index.ts l.147-154)
- CR-04: Parcialmente corregido — cambiado a LEFT JOIN, pero el OR IS NULL puede inflar counts para áreas (ver WARNING arriba)
- CR-05: Corregido — `calcularSLA` retorna `null` cuando resueltos.length === 0 (service l.39)

---

_Verified: 2026-05-26T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
