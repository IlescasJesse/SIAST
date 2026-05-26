---
phase: 04-metricas-operacionales
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/database/prisma/schema.prisma
  - packages/shared/src/index.ts
  - apps/api/src/services/metricas.service.ts
  - apps/api/src/controllers/metricas.controller.ts
  - apps/api/src/routes/metricas.routes.ts
  - apps/api/src/services/auth.service.ts
  - apps/web/src/api/metricas.js
  - apps/web/src/components/metricas/SlaIndicator.jsx
  - apps/web/src/components/metricas/RechartsBarChart.jsx
  - apps/web/src/components/metricas/RechartsLineChart.jsx
  - apps/web/src/components/metricas/RechartsPieChart.jsx
  - apps/web/src/components/metricas/DateRangeFilter.jsx
  - apps/web/src/components/metricas/EficienciaTable.jsx
  - apps/web/src/components/metricas/RendimientoTecnicoTable.jsx
  - apps/web/src/components/metricas/MetricasTabGlobal.jsx
  - apps/web/src/components/metricas/MetricasTabResponsable.jsx
  - apps/web/src/components/metricas/MetricasTabTecnico.jsx
  - apps/web/src/components/metricas/MetricasOperacionalesSection.jsx
  - apps/web/src/pages/DashboardPage.jsx
  - apps/api/src/index.ts
findings:
  critical: 5
  warning: 8
  info: 3
  total: 16
status: issues_found
---

# Phase 04: Métricas Operacionales — Code Review Report

**Reviewed:** 2026-05-26
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This phase implements the operational metrics dashboard for the SIAST government system. The implementation covers a backend service with three data tabs (global, per-responsable, per-técnico), a unified parameterized API endpoint, and a full set of React/Recharts frontend components.

The security architecture is largely sound — JWT-based auth with session table verification, role scoping at the controller level, and parameterized queries in raw SQL. However, there are five critical defects that must be fixed before this ships: two authorization bypass paths where unprivileged users can read other users' data, a data-loss bug in the daily metrics snapshot, and two incorrect query predicates that silently produce wrong numbers. Eight additional warnings cover logic errors, race conditions, and missing edge-case handling.

---

## Critical Issues

### CR-01: TECNICO_* users can read any other technician's personal metrics

**File:** `apps/api/src/controllers/metricas.controller.ts:66-73`

**Issue:** When a technician role (`TECNICO_TI`, `TECNICO_REDES`, etc.) calls the endpoint with `tipo=proceso`, the controller forces `tecnicoIdEfectivo = user.id`. However, when the **same user** calls with `tipo=area` or `tipo=tecnico`, those branches at lines 77-84 apply **no role-scoping at all** — an authenticated `TECNICO_TI` can pass any `areaId` and receive the full `obtenerMetricasPorArea` response for any area, including the names, performance figures, and first-response-time metrics of every technician in that area. These are personal performance data of other employees. For a government system this is a data-exposure violation.

The route guard at `metricas.routes.ts:11-23` allows `TECNICO_*` roles through, meaning the gate is open. The scoping inside the controller only covers `tipo=proceso`.

**Fix:** Add explicit role restrictions per `tipo`. Technician roles must be blocked from `tipo=area` and `tipo=tecnico`. Only ADMIN, MESA_AYUDA, and RESPONSABLE_* should access those tabs:

```typescript
// After parsing params, before delegating to service:
const ROLES_SOLO_PROCESO = [
  "TECNICO_TI", "TECNICO_REDES", "TECNICO_ELECTRICISTA",
  "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
];
if (ROLES_SOLO_PROCESO.includes(user.rol) && tipo !== "proceso") {
  res.status(403).json({ error: "Técnicos solo pueden acceder a métricas tipo=proceso" });
  return;
}
```

---

### CR-02: RESPONSABLE_* can read global metrics (tipo=area) without restriction

**File:** `apps/api/src/controllers/metricas.controller.ts:57-63`

**Issue:** When a `RESPONSABLE_*` user calls with `tipo=area`, the controller overrides `areaId` with `user.areaSoporteId` (line 63) — but that override only matters for `tipo=tecnico` (line 80-83). For `tipo=area` the call goes to `obtenerMetricasGlobal()` which returns **all areas, all responsables, and aggregate data for the entire organization** without any filtering. A `RESPONSABLE_TI` can see the ticket counts, SLA percentages, and resolution times for every other department (Redes, Mantenimiento, Recursos Materiales), which is a horizontal privilege escalation across government departments.

**Fix:** Block RESPONSABLE_* from `tipo=area`. They should only be able to call `tipo=tecnico` (with forced `areaId`):

```typescript
const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI", "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
];
if (ROLES_RESPONSABLE.includes(user.rol) && tipo === "area") {
  res.status(403).json({ error: "Responsables no pueden acceder a métricas globales" });
  return;
}
```

---

### CR-03: Daily snapshot writes wrong `totalTickets` value — permanent data corruption

**File:** `apps/api/src/index.ts:150-151`

**Issue:** In the daily snapshot loop for per-area records, `totalTickets` is computed as:
```typescript
totalTickets: areaData.ticketsActivos + areaData.ticketsReabiertos,
```
`ticketsActivos` is the count of tickets currently in non-terminal states. `ticketsReabiertos` is a distinct count of tickets that were reopened. Adding these two together produces a number that is neither "total tickets" nor any meaningful KPI — a ticket can be both active and reopened, causing double-counting, and resolved/cancelled tickets are entirely excluded. The `MetricasHistorial` model's `totalTickets` field is documented as the total number of tickets for that snapshot period. This corruption silently poisons any historical trend analysis or audit drawn from the `metricas_historial` table.

**Fix:** Fetch the actual ticket count for the area in the snapshot job, or use a separate total that the service already computes:

```typescript
// Query the real total for the area instead of summing unrelated KPIs
const totalArea = await prisma.ticket.count({
  where: { activo: true, tecnico: { areaSoporteId: area.id } },
});
// ...
totalTickets: totalArea,
ticketsResueltos: await prisma.ticket.count({
  where: { activo: true, estado: "RESUELTO", tecnico: { areaSoporteId: area.id } },
}),
```

---

### CR-04: `calcularTendencia` JOIN excludes tickets with no technician assigned — KPI silently undercounts

**File:** `apps/api/src/services/metricas.service.ts:63-67`

**Issue:** When `areaId` is provided (Tab Por Responsable), the raw SQL uses:
```sql
JOIN usuarios u ON t.tecnico_id = u.id AND u.area_soporte_id = ${areaId}
```
This is an `INNER JOIN`. Tickets in `ABIERTO` or `ASIGNADO` states that have not yet been assigned a technician (`tecnico_id IS NULL`) are silently **excluded** from the daily trend chart. The "Creados" count in the trend line will be lower than the actual total for the area — it only shows tickets that have a technician from that area, missing all unassigned tickets that belong to the area's queue. This will cause management to underestimate workload, which is a decision-quality defect in a government reporting context.

The fix requires filtering on area via a different join strategy, or using the ticket's category/subcategoria to determine area ownership rather than the technician join:

```sql
-- Use LEFT JOIN and filter NULL separately, or join via the area's subcategoria mapping
LEFT JOIN usuarios u ON t.tecnico_id = u.id
WHERE t.activo = true
  AND t.created_at >= ${fechaInicio}
  AND t.created_at <= ${fechaFin}
  AND (u.area_soporte_id = ${areaId} OR (t.tecnico_id IS NULL AND <area_filter>))
```
The precise fix depends on domain: if the correct filter is "tickets assigned or pending for this area", this requires knowing which categories/subcategories map to which area, or storing the target area directly on the ticket.

---

### CR-05: `calcularSLA` uses `activo: true` filter — cancelled tickets incorrectly inflate SLA

**File:** `apps/api/src/services/metricas.service.ts:35-46`

**Issue:** The SLA calculation fetches tickets with `where: { ...where, estado: "RESUELTO", fechaResolucion: { not: null }, activo: true }`. The `estado: "RESUELTO"` combined with `activo: true` is correct, but the `where` spread at the start already contains `activo: true` from the caller. The deeper problem is that `where` is typed as `Record<string, unknown>` and is passed by callers with nested Prisma relations like `tecnico: { areaSoporteId: areaId }`. When this composite object is spread into the `findMany` where clause alongside `estado: "RESUELTO"`, the spread is **shallow** — `activo: true` appears twice (harmless) but the nested `tecnico` relation object merges correctly only if no conflicting keys exist.

More critically: when called from `obtenerMetricasGlobal` at line 141, `baseWhere` contains `activo: true` and the date filter. `calcularSLA(baseWhere)` then further adds `estado: "RESUELTO"` inside. This is fine for the global case. But when called from `eficienciaResponsables` map at line 216, `areaWhere` is `{ activo: true, ...dateWhere, tecnico: { areaSoporteId: r.areaSoporteId! } }`. Spreading this then adding `estado: "RESUELTO"` inside `calcularSLA` works, **but** the `where` type `Record<string, unknown>` loses TypeScript type safety and will silently accept incorrect values. More specifically, if a future caller passes `estado: "CANCELADO"` in `where`, the inner override `estado: "RESUELTO"` will **win** only because it comes later in the spread — `{ ...where, estado: "RESUELTO" }`. This is a time-bomb for maintainability and correctness.

The immediate concrete bug: `calcularSLA` includes a guard for zero length but `resueltos.length === 0` returns `0` (0% SLA compliance). A department with zero resolved tickets in the period shows as 0% SLA, which may be misread as failure. It should return `null` to distinguish "no data" from "all failed":

```typescript
if (resueltos.length === 0) return null; // null = sin datos, 0 = todos incumplidos
```

The return type must change from `Promise<number>` to `Promise<number | null>` in callers.

---

## Warnings

### WR-01: `areaId` query param accepts non-numeric strings silently as `NaN`

**File:** `apps/api/src/controllers/metricas.controller.ts:28-29`

**Issue:** The Zod transform `(s) => (s ? Number(s) : undefined)` passes for `areaId` and `tecnicoId`. If the caller sends `?areaId=abc`, `Number("abc")` is `NaN`. `NaN` passes Zod validation (no `.refine()` check), and `NaN` is passed to `obtenerMetricasPorArea(NaN, ...)`. Prisma will throw an error (eventually caught by the global error handler), but with no clear 400 validation message to the client.

**Fix:**
```typescript
areaId: z.string().optional().transform((s) => {
  if (!s) return undefined;
  const n = Number(s);
  if (isNaN(n) || !Number.isInteger(n) || n <= 0) throw new Error("areaId debe ser un entero positivo");
  return n;
}),
// Same pattern for tecnicoId
```

---

### WR-02: Race condition — `setLoading(false)` can be called on unmounted component

**File:** `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx:78-99`

**Issue:** The `useEffect` fires a `getMetricas` promise and updates state in `.then()`, `.catch()`, and `.finally()`. There is no cleanup / abort mechanism. If the component unmounts while a request is in flight (e.g., user navigates away), all three callbacks will call `setData`, `setError`, and `setLoading` on an unmounted component. In React 18 strict mode this produces a warning; in earlier versions it can cause memory leaks or state corruption if the component remounts quickly.

**Fix:** Use an `AbortController` and cancel the request on cleanup:
```javascript
useEffect(() => {
  const controller = new AbortController();
  setLoading(true);
  setError(null);
  // pass { signal: controller.signal } to the axios call in getMetricas
  getMetricas(params, controller.signal)
    .then(setData)
    .catch((err) => {
      if (err?.code === "ERR_CANCELED") return;
      setError(err?.response?.data?.error ?? "Error al cargar métricas");
    })
    .finally(() => setLoading(false));
  return () => controller.abort();
}, [...deps]);
```
This requires `getMetricas` and `api.get` to accept an abort signal.

---

### WR-03: `initialTab` computed with `useMemo` but `activeTab` initialized from stale `initialTab` value

**File:** `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx:63-69`

**Issue:**
```javascript
const initialTab = useMemo(() => { ... }, [rol]);
const [activeTab, setActiveTab] = useState(initialTab);
```
`useState` only uses its argument on the **first render**. If `rol` changes (e.g., user session updates), `initialTab` recomputes but `activeTab` stays at the old value. While `rol` is unlikely to change post-login, the `useMemo` dependency on `rol` creates a misleading expectation that the tab will re-sync. This also means the derived visibility flags (`showGlobal`, `showResponsable`, `showTecnico`) could conflict with `activeTab` — a `TECNICO_TI` starts at tab 2 (correct) but `showGlobal=false` and `showResponsable=false` means tabs 0 and 1 are not rendered, yet the Tabs component still uses `value={activeTab}`. If `activeTab` is `2` but the rendered tabs only have `value={2}` available (one tab), MUI Tabs handles this gracefully — but if `activeTab` defaults to `0` for some edge case role, the content for tab 0 would not be rendered (`showGlobal=false`) while the progress indicator fires a global fetch.

**Fix:** Initialize with a function form that doesn't depend on `useMemo`:
```javascript
const [activeTab, setActiveTab] = useState(() => {
  if (ROLES_RESPONSABLE.includes(rol)) return 1;
  if (ROLES_TECNICO.includes(rol)) return 2;
  return 0;
});
```

---

### WR-04: Snapshot job runs immediately on startup without any delay — doubles DB load at boot

**File:** `apps/api/src/index.ts:172`

**Issue:** `ejecutarSnapshotMetricas()` is called immediately inside the `listen` callback with no delay. The snapshot job calls `obtenerMetricasGlobal()` which triggers multiple N+1 database queries (one `calcularSLA` + `calcularTiempoPromedio` per responsable, plus one raw SQL per area). This runs concurrently with the startup `syncEmpleados()` call and any incoming traffic. At startup this creates a spike of potentially dozens of DB queries that did not exist before Phase 4.

**Fix:** Delay the first snapshot run to allow the server to stabilize, and also consider whether "on startup" semantics are correct — a server restart at 14:00 should not re-run the daily snapshot if it already ran at 00:05:
```typescript
// Only run if today's snapshot doesn't already exist
const hoyStr = new Date().toISOString().slice(0, 10);
const exists = await prisma.metricasHistorial.findFirst({ where: { fecha: new Date(hoyStr) } });
if (!exists) {
  setTimeout(ejecutarSnapshotMetricas, 30_000); // 30s after boot
}
```

---

### WR-05: `obtenerMetricasPorTecnico` does not validate that `tecnicoId` refers to a technician role

**File:** `apps/api/src/services/metricas.service.ts:383-461`

**Issue:** `obtenerMetricasPorTecnico(tecnicoId)` fetches the usuario by ID but does not verify that the user exists or that their role is a technician. If the controller passes an arbitrary integer (e.g., from `tecnicoId` query param when role is ADMIN), it will happily return metrics for an ADMIN user treated as a technician. The response would show the ADMIN's directly-assigned tickets (if any) and their name, leaking organizational information about admin accounts.

**Fix:** Add a role validation in the service:
```typescript
const tecnico = await prisma.usuario.findUnique({
  where: { id: tecnicoId },
  select: { nombre: true, apellidos: true, areaSoporteId: true, activo: true, rol: true },
});
if (!tecnico || !tecnico.activo) {
  throw Object.assign(new Error("Técnico no encontrado"), { status: 404 });
}
const ROLES_TECNICOS = ["TECNICO_TI", "TECNICO_REDES", "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD"];
if (!ROLES_TECNICOS.includes(tecnico.rol)) {
  throw Object.assign(new Error("El usuario no es un técnico"), { status: 400 });
}
```

---

### WR-06: `TECNICO_SERVICIOS` included in frontend role list but removed from backend routes — silent access failure

**File:** `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx:31`

**Issue:** The frontend `ROLES_TECNICO` array includes `"TECNICO_SERVICIOS"`:
```javascript
const ROLES_TECNICO = [
  "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS", ...
];
```
But `TECNICO_SERVICIOS` is marked as deprecated in `schema.prisma` (line 22: `// deprecated en Phase 3`) and is **absent** from the `rolesMetricas` allow-list in `metricas.routes.ts`. A user with `TECNICO_SERVICIOS` role will see the `MetricasOperacionalesSection` rendered (because `rol.startsWith("TECNICO_")` is true in `DashboardPage.jsx:584`), then receive a 403 from the API. The UI would show an error alert with no explanation.

Similarly, `DashboardPage.jsx` line 518: `esTecnico` uses `["TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS"]` — missing `TECNICO_ELECTRICISTA`, `TECNICO_PLOMERO`, `TECNICO_MOVILIDAD`.

**Fix:** Remove `TECNICO_SERVICIOS` from all frontend role lists. Add the three missing technician roles to `esTecnico` in `DashboardPage.jsx`.

---

### WR-07: `calcularTiempoPromedio` and `calcularSLA` may produce misleading results when `fechaResolucion` predates `createdAt`

**File:** `apps/api/src/services/metricas.service.ts:82-93`

**Issue:** Both helpers compute `fechaResolucion!.getTime() - t.createdAt.getTime()`. There is no guard against negative differences. If a data migration or administrative correction results in `fechaResolucion < createdAt` (possible in a government system with manual record corrections), the average time will be reduced silently and the SLA calculation will count that ticket as "cumplió" since `diff <= metaMs` (negative <= positive is true). This silently inflates both SLA percentage and skews average resolution time downward.

**Fix:**
```typescript
const diff = t.fechaResolucion!.getTime() - t.createdAt.getTime();
if (diff < 0) continue; // skip corrupted records; log a warning
if (diff <= metaMs) cumplieron++;
```

---

### WR-08: `isDefault` check in `DateRangeFilter` uses `DEFAULT_START()` / `DEFAULT_END()` called at render time — drift over time

**File:** `apps/web/src/components/metricas/DateRangeFilter.jsx:25-27`

**Issue:**
```javascript
const DEFAULT_START = () => subDays(new Date(), 30);
const DEFAULT_END = () => new Date();
const isDefault =
  isEqual(startOfDay(value.start), startOfDay(DEFAULT_START())) &&
  isEqual(startOfDay(value.end), startOfDay(DEFAULT_END()));
```
`DEFAULT_START()` and `DEFAULT_END()` are called on every render, computing "30 days ago from now." The initial `dateRange` state in `MetricasOperacionalesSection` is also set at mount time with `subDays(new Date(), 30)`. Because both are computed relative to `new Date()`, the badge correctly shows "not default" if the user explicitly sets a custom range. However, after midnight, the "default" reference drifts by one day while the stored `dateRange.start` does not update. The badge will show as "active filter" even though the user never changed anything, creating a confusing UX and potentially prompting unnecessary filter changes.

This is a low-severity UX defect but it will occur for any user who keeps a browser tab open across midnight.

**Fix:** Stabilize the default reference dates at mount, or compute `isDefault` by checking if the range width is 30 days ending today:
```javascript
const isDefault =
  differenceInDays(value.end, value.start) === 30 &&
  isToday(value.end);
```

---

## Info

### IN-01: `null as any` cast in snapshot upsert — type safety circumvented

**File:** `apps/api/src/index.ts:120`

**Issue:**
```typescript
where: { fecha_areaSoporteId: { fecha: hoy, areaSoporteId: null as any } },
```
The `null as any` cast is needed because Prisma's generated type for a compound unique with a nullable field requires special handling. This silently bypasses TypeScript's type system. If the Prisma schema changes the compound unique, this cast will hide the resulting type error.

**Fix:** Use `Prisma.DbNull` or the correct Prisma type for nullable unique fields, or extract the upsert into the service layer with proper types.

---

### IN-02: `RechartsPieChart` uses array index as React `key` for `Cell` elements

**File:** `apps/web/src/components/metricas/RechartsPieChart.jsx:37`

**Issue:**
```jsx
{data.map((entry, i) => (
  <Cell key={i} fill={entry.color} />
))}
```
Using array index as `key` can cause animation and reconciliation issues when the data array changes order or length between renders. Recharts `Cell` keys should be stable identifiers.

**Fix:** Use `entry.name` as the key: `<Cell key={entry.name} fill={entry.color} />`

---

### IN-03: `DashboardPage` silently suppresses all errors from the ticket fetch

**File:** `apps/web/src/pages/DashboardPage.jsx:541`

**Issue:**
```javascript
} catch {
  // silent
}
```
If `getSolicitudes` fails (network error, 5xx, etc.), the dashboard renders with an empty tickets array and no error indication to the user. All the metric cards show zeros, which could be interpreted as "no tickets exist" rather than "data failed to load." For a government operations dashboard, silent failure is dangerous — a supervisor might assume no active incidents.

**Fix:** Add an error state and display an error alert when the primary data fetch fails, similar to the approach already used in `MetricasOperacionalesSection`.

---

_Reviewed: 2026-05-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
