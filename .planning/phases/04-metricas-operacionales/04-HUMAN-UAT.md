---
status: partial
phase: 04-metricas-operacionales
source: [04-VERIFICATION.md]
started: 2026-05-26T20:00:00Z
updated: 2026-05-26T20:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ADMIN ve 3 tabs con datos reales
expected: Sección 'Métricas Operacionales' visible con KPIs y gráficas Recharts pobladas
result: [pending]

### 2. RESPONSABLE_TI solo ve tab Por Responsable (su área)
expected: Tab Global ausente, tab Por Responsable muestra datos de su área únicamente, API retorna 403 si intenta tipo=area
result: [pending]

### 3. TECNICO_TI solo ve tab Por Técnico (sus propios datos)
expected: Tabs Global y Por Responsable ausentes, métricas son las del técnico autenticado
result: [pending]

### 4. DateRangeFilter dispara refetch al aplicar
expected: LinearProgress aparece brevemente, luego gráficas muestran datos del nuevo rango
result: [pending]

### 5. Completar ticket → métricas se refrescan por socket
expected: ticketsVersion se incrementa vía socket event, useEffect dispara nuevo getMetricas sin recargar página
result: [pending]

### 6. Print CSS muestra todos los panels simultáneamente
expected: CSS @media print oculta tabs y muestra todos los panels con datos
result: [pending]

### 7. Job diario MetricasHistorial ejecuta al arrancar API
expected: Log '[MetricasHistorial] Snapshot guardado — YYYY-MM-DD' aparece después de 30s del arranque (si no existe snapshot de hoy)
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
