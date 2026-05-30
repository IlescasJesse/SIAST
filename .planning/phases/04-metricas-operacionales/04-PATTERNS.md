# Phase 4: Métricas Operacionales - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 17 (11 new, 6 modified)
**Analogs found:** 15 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/services/metricas.service.ts` | service | CRUD+aggregation | `apps/api/src/services/tickets.service.ts` | exact |
| `apps/api/src/controllers/metricas.controller.ts` | controller | request-response | `apps/api/src/controllers/metricas.controller.ts` (existing) | exact |
| `apps/api/src/routes/metricas.routes.ts` | route | request-response | `apps/api/src/routes/metricas.routes.ts` (existing) | exact |
| `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx` | component | request-response | `apps/web/src/pages/DashboardPage.jsx` | role-match |
| `apps/web/src/components/metricas/MetricasTabGlobal.jsx` | component | request-response | `apps/web/src/pages/DashboardPage.jsx` | role-match |
| `apps/web/src/components/metricas/MetricasTabResponsable.jsx` | component | request-response | `apps/web/src/pages/DashboardPage.jsx` | role-match |
| `apps/web/src/components/metricas/MetricasTabTecnico.jsx` | component | request-response | `apps/web/src/pages/DashboardPage.jsx` | role-match |
| `apps/web/src/components/metricas/DateRangeFilter.jsx` | component | UI | `apps/web/src/components/common/StatusChip.jsx` | role-match |
| `apps/web/src/components/metricas/SlaIndicator.jsx` | component | UI | `apps/web/src/components/common/StatusChip.jsx` | exact |
| `apps/web/src/components/metricas/RechartsBarChart.jsx` | component | visualization | No analog — new pattern | new |
| `apps/web/src/components/metricas/RechartsLineChart.jsx` | component | visualization | No analog — new pattern | new |
| `apps/web/src/components/metricas/RechartsPieChart.jsx` | component | visualization | No analog — new pattern | new |
| `apps/web/src/components/metricas/EficienciaTable.jsx` | component | UI | `apps/web/src/pages/DashboardPage.jsx` | role-match |
| `apps/web/src/components/metricas/RendimientoTecnicoTable.jsx` | component | UI | `apps/web/src/pages/DashboardPage.jsx` | role-match |
| `apps/web/src/api/metricas.js` | api-client | request-response | `apps/web/src/api/tickets.js` | exact |
| `apps/web/src/pages/DashboardPage.jsx` | page | request-response | (self) | N/A |
| `packages/database/prisma/schema.prisma` | schema | data-model | (self) | N/A |

---

## Pattern Assignments

### `apps/api/src/services/metricas.service.ts` (service, CRUD+aggregation)

**Analog:** `apps/api/src/services/tickets.service.ts`

**Imports pattern** (lines 1-7):
```typescript
import { prisma } from "../config/database.js";
import type { JwtPayload } from "../types/index.js";
import type { Usuario, Ticket } from "@prisma/client";
```

**Service function signature pattern** (lines 55-65):
```typescript
// Exported async functions called from controller
// Each function receives specific parameters and returns aggregated data
export const listarTickets = async (
  user: JwtPayload,
  query: {
    estado?: string;
    categoria?: string;
    tecnicoId?: string;
  },
) => {
  // Filter logic based on user role
  const where: Record<string, unknown> = { activo: true };
  
  if (user.rol === "EMPLEADO") {
    where.empleadoRfc = user.rfc;
  } else if (ROLES_RESPONSABLE.includes(user.rol as any)) {
    // RESPONSABLE_* filtering logic
  }
  
  return result;
};
```

**Aggregation with Prisma groupBy pattern** (lines 37-42):
```typescript
const porCategoriaRaw = await prisma.ticket.groupBy({
  by: ["categoria"],
  where,
  _count: { _all: true },
  orderBy: { _count: { categoria: "desc" } },
});
const porCategoria = porCategoriaRaw.map((r) => ({
  categoria: r.categoria as string,
  total: r._count._all,
}));
```

**Raw SQL for complex queries** (lines 50-59):
```typescript
type SubcatRow = { subcategoria: string; sub_tipo: string | null; total: bigint };
const porSubcategoriaRaw = await prisma.$queryRaw<SubcatRow[]>`
  SELECT subcategoria, sub_tipo, COUNT(*) AS total
  FROM tickets
  WHERE activo = true
    AND (${fechaFiltro?.gte ?? null} IS NULL OR created_at >= ${fechaFiltro?.gte ?? null})
    AND (${fechaFiltro?.lte ?? null} IS NULL OR created_at <= ${fechaFiltro?.lte ?? null})
  GROUP BY subcategoria, sub_tipo
  ORDER BY total DESC
`;
// CRITICAL: Convert bigint to Number before JSON response
const porSubcategoria = porSubcategoriaRaw.map((r) => ({
  subcategoria: r.subcategoria,
  subTipo: r.sub_tipo ?? null,
  total: Number(r.total),  // <-- bigint conversion
}));
```

---

### `apps/api/src/controllers/metricas.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/controllers/tickets.controller.ts`

**Imports pattern** (lines 1-4):
```typescript
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import * as ticketsService from "../services/tickets.service.js";
```

**Controller handler pattern** (lines 8-20):
```typescript
export const listar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Parse and normalize query params
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") query[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") query[k] = v[0];
    }
    // Delegate to service
    const result = await ticketsService.listarTickets(req.user!, query);
    res.json(result);
  } catch (err) {
    next(err);  // Error middleware handles
  }
};
```

**Error handling pattern** (all handlers follow try/catch with next(err)):
```typescript
export const crear = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.crearTicket(req.user!, req.body);
    res.status(201).json({ ticket, mensaje: "Solicitud creada exitosamente" });
  } catch (err) {
    next(err);  // Centralized error handler in middleware
  }
};
```

---

### `apps/api/src/routes/metricas.routes.ts` (route, request-response)

**Analog:** `apps/api/src/routes/metricas.routes.ts` (existing)

**Route structure pattern** (lines 1-22):
```typescript
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import * as ctrl from "../controllers/metricas.controller.js";

const router = Router();

// Middleware application order: auth first, then role guard
router.use(authMiddleware);

// Define roles allowed for all metrics endpoints
// NOTE: Must include all RESPONSABLE_* and TECNICO_* roles from Phase 3+
const rolesMetricas = requireRol(
  "ADMIN",
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
  "TECNICO_TI",
  "TECNICO_REDES",
  "TECNICO_ELECTRICISTA",
  "TECNICO_PLOMERO",
  "TECNICO_MOVILIDAD",
  "MESA_AYUDA"
);

// Endpoint definitions
router.get("/", rolesMetricas, ctrl.obtener);

export default router;
```

---

### `apps/web/src/api/metricas.js` (api-client, request-response)

**Analog:** `apps/web/src/api/tickets.js` (lines 1-12)

**API client pattern**:
```javascript
import { api } from "./client.js";

export const getTickets = (params) => api.get("/api/tickets", { params }).then((r) => r.data);
export const getTicket = (id) => api.get(`/api/tickets/${id}`).then((r) => r.data);
export const createTicket = (body) => api.post("/api/tickets", body).then((r) => r.data);
```

**For metricas.js** (NEW FILE):
```javascript
import { api } from "./client.js";

export const getMetricas = (params) =>
  api.get("/api/metricas", { params }).then((r) => r.data);
```

**Client configuration** (from `apps/web/src/api/client.js` lines 1-6):
```javascript
import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:5101`;

export const api = axios.create({ baseURL: API_BASE });
```

---

### `apps/web/src/components/metricas/MetricasOperacionalesSection.jsx` (component, request-response)

**Analog:** `apps/web/src/pages/DashboardPage.jsx`

**Component structure pattern** (lines 1-47):
```jsx
import { useEffect, useState } from "react";
import { Grid, Card, CardContent, Typography, Box, Chip } from "@mui/material";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import { getMetricas } from "../api/metricas.js";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

export function MetricasOperacionalesSection({ rol, areaSoporteId }) {
  // ── State Management ──────────────────────────────────────────────────────
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),  // Default: last 30 days
    end: new Date(),
  });
  const [activeTab, setActiveTab] = useState(0);

  // ── Effects ───────────────────────────────────────────────────────────────
  // CRITICAL: ticketsVersion in dependencies to trigger refetch on socket events
  useEffect(() => {
    setLoading(true);
    getMetricas({
      tipo: tabToTipo(activeTab),
      fechaInicio: format(dateRange.start, "yyyy-MM-dd"),
      fechaFin: format(dateRange.end, "yyyy-MM-dd"),
      areaId: areaSoporteId,  // Auto-scoped for RESPONSABLE_*
    })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticketsVersion, dateRange, activeTab]);  // <-- Critical deps array
}
```

---

### `apps/web/src/components/metricas/SlaIndicator.jsx` (component, UI)

**Analog:** `apps/web/src/components/common/StatusChip.jsx` (lines 1-23)

**Chip component pattern**:
```jsx
import { Chip } from "@mui/material";

const LABELS = {
  ABIERTO: "Abierto",
  ASIGNADO: "Asignado",
  EN_PROGRESO: "En Progreso",
  RESUELTO: "Resuelto",
  CANCELADO: "Cancelado",
};

export const StatusChip = ({ estado, size = "small" }) => (
  <Chip
    label={LABELS[estado] ?? estado}
    size={size}
    sx={{
      bgcolor: `${TICKET_ESTADO_COLOR[estado] ?? "#666"}22`,
      color: TICKET_ESTADO_COLOR[estado] ?? "#666",
      border: `1px solid ${TICKET_ESTADO_COLOR[estado] ?? "#666"}55`,
      fontWeight: 600,
    }}
  />
);
```

**For SlaIndicator** (NEW FILE):
```jsx
import { Chip } from "@mui/material";

export function SlaIndicator({ pct }) {
  const config =
    pct >= 90  ? { label: "SLA OK",    color: "success" } :
    pct >= 70  ? { label: "En riesgo", color: "warning" } :
                 { label: "Incumplido", color: "error"   };
  return <Chip label={`${config.label} ${pct}%`} color={config.color} size="small" />;
}
```

---

### `apps/web/src/components/metricas/RechartsBarChart.jsx` (component, visualization)

**No direct analog** — Recharts is a new dependency. Reference RESEARCH.md Pattern 1 (Pattern 5-7).

**Critical pattern from RESEARCH.md**:
```jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Box } from "@mui/material";

export function RechartsBarChart({ data, xKey, bars }) {
  return (
    <Box sx={{ width: "100%", height: 260 }}>  {/* CRITICAL: explicit height */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey={xKey} tick={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          <YAxis tick={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 4 }}
          />
          <Legend wrapperStyle={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
```

**CRITICAL PITFALL (RESEARCH.md Pitfall 2):** ResponsiveContainer requires explicit height on parent Box. Without it, chart collapses to height 0.

---

### `apps/web/src/components/metricas/DateRangeFilter.jsx` (component, UI)

**Analog:** `apps/web/src/pages/DashboardPage.jsx` (uses MUI components)

**MUI DatePicker pattern** (from RESEARCH.md):
```jsx
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Box, Button, Popover, IconButton } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";

export function DateRangeFilter({ dateRange, onDateRangeChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
        <SettingsIcon />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        <Box sx={{ p: 2 }}>
          <DatePicker
            label="Desde"
            value={dateRange.start}
            onChange={(v) => onDateRangeChange({ ...dateRange, start: v })}
          />
          <DatePicker
            label="Hasta"
            value={dateRange.end}
            onChange={(v) => onDateRangeChange({ ...dateRange, end: v })}
          />
        </Box>
      </Popover>
    </LocalizationProvider>
  );
}
```

---

### `apps/web/src/pages/DashboardPage.jsx` (page, request-response)

**Pattern:** Integrate MetricasOperacionalesSection as a new section. Existing structure uses Grid + Card + Components.

**Insertion point** (after existing sections):
```jsx
import { MetricasOperacionalesSection } from "../components/metricas/MetricasOperacionalesSection.jsx";

export default function DashboardPage() {
  // ... existing code ...
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Existing dashboard sections */}
      
      {/* NEW: Métricas section (all roles see this, but tab visibility varies) */}
      {(rol === "ADMIN" || rol.startsWith("RESPONSABLE_") || rol.startsWith("TECNICO_")) && (
        <MetricasOperacionalesSection rol={rol} areaSoporteId={areaSoporteId} />
      )}
    </Box>
  );
}
```

---

### `packages/database/prisma/schema.prisma` (schema, data-model)

**Pattern:** Add new model for daily metrics snapshots.

**Analog:** Existing models Ticket, Usuario, AreaSoporte (lines 110-162)

**New model to add**:
```prisma
// ============================================================
// MÉTRICAS HISTORIAL (Phase 4)
// ============================================================

model MetricasHistorial {
  id                    Int      @id @default(autoincrement())
  fecha                 DateTime @db.Date           // snapshot date
  areaSoporteId         Int?     @map("area_soporte_id")
  totalTickets          Int      @map("total_tickets")
  ticketsResueltos      Int      @map("tickets_resueltos")
  ticketsActivos        Int      @map("tickets_activos")
  slaGlobal             Float    @map("sla_global")   // percentage 0-100
  tiempoPromedioHoras   Float?   @map("tiempo_promedio_horas")
  extras                Json?    // additional data (per category, trends, etc.)
  createdAt             DateTime @default(now()) @map("created_at")

  @@unique([fecha, areaSoporteId])
  @@index([fecha])
  @@map("metricas_historial")
}
```

**Migration command**:
```bash
# From packages/database directory
npm run db:migrate
# Name suggestion: add_metricas_historial
```

---

## Shared Patterns

### Authentication & Authorization

**Source:** `apps/api/src/middleware/auth.middleware.ts` (lines 1-30)
**Apply to:** All new controller endpoints

```typescript
// Pattern: authMiddleware handles JWT verification
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

router.use(authMiddleware);

// Then apply role guard
const rolesMetricas = requireRol(
  "ADMIN",
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  // ... all new roles from Phase 3
);
router.get("/", rolesMetricas, ctrl.obtener);
```

**Critical for RESPONSABLE_*:** Backend MUST override areaSoporteId if user.rol.startsWith("RESPONSABLE_")

```typescript
// In service function — D-12 from CONTEXT.md
const efectiveAreaId =
  user.rol.startsWith("RESPONSABLE_") ? String(user.areaSoporteId) : areaId;
```

---

### Role Constants

**Source:** `apps/api/src/middleware/roles.middleware.ts` (lines 6-11)
**Apply to:** metricas.service.ts for role-based filtering

```typescript
export const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
] as const;
```

---

### Zustand Store Pattern (Real-time Refresh)

**Source:** `apps/web/src/store/notificaciones.js` (lines 39-79)
**Apply to:** All frontend metric components for real-time updates

```javascript
// Pattern: Component listens to ticketsVersion counter
const ticketsVersion = useNotifStore((s) => s.ticketsVersion);

useEffect(() => {
  // Refetch metrics when ticketsVersion changes
  getMetricas({ /* params */ })
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, [ticketsVersion, dateRange, activeTab]);  // ticketsVersion in deps
```

**How it works:** When any ticket event fires (created, assigned, resolved), `useNotifStore` increments `ticketsVersion`, which triggers all useEffect hooks listening to it.

---

### API Client Pattern with Auth Interceptor

**Source:** `apps/web/src/api/client.js` (lines 1-97)
**Apply to:** All frontend API calls

```javascript
// All API calls automatically inject JWT token
// AND handle 401 with automatic refresh + retry
export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("siast_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    // 401? Try to refresh token and retry
    // If refresh fails, logout
  },
);
```

---

### Date Formatting Convention

**Source:** `apps/web/src/pages/DashboardPage.jsx` (lines 25-26)
**Apply to:** All date display in metrics components

```javascript
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

// Format dates for display
format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });

// Arithmetic for date ranges
const thirtyDaysAgo = subDays(new Date(), 30);
```

**For API queries:** Use `yyyy-MM-dd` format
```javascript
format(dateRange.start, "yyyy-MM-dd")  // Output: "2026-05-26"
```

---

### MUI Theme & Colors

**Source:** `apps/web/src/pages/DashboardPage.jsx` (lines 28-37)
**Apply to:** All metric cards, chips, progress bars

```javascript
import { TICKET_ESTADO_COLOR, TICKET_PRIORIDAD_COLOR } from "../theme/index.js";

// Color usage pattern
<Box sx={{ bgcolor: `${TICKET_ESTADO_COLOR[estado]}22`, color: TICKET_ESTADO_COLOR[estado] }}>
  {icon}
</Box>

// For SlaIndicator: use MUI color props
<Chip label={`SLA OK ${pct}%`} color="success" size="small" />
<Chip label={`En riesgo ${pct}%`} color="warning" size="small" />
<Chip label={`Incumplido ${pct}%`} color="error" size="small" />
```

---

### Error Handling (Controller → Service → DB)

**Source:** `apps/api/src/controllers/tickets.controller.ts` (lines 8-20, all handlers)
**Apply to:** All metricas controllers and services

```typescript
// Three-tier pattern: try/catch at controller, service handles logic, DB errors bubble up

// CONTROLLER
export const obtener = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await metricasService.obtener(/* params */);
    res.json(result);
  } catch (err) {
    next(err);  // Pass to centralized error middleware
  }
};

// SERVICE (handles business logic + DB queries)
export const obtener = async (params) => {
  // If this throws, controller catches and delegates to error middleware
  const tickets = await prisma.ticket.findMany({ /* where */ });
  return computeMetrics(tickets);
};
```

**Error middleware** (`apps/api/src/middleware/error.middleware.ts`) — handles HTTP response

---

### Input Validation (Query Params)

**Source:** `apps/api/src/controllers/tickets.controller.ts` (lines 13-14)
**Apply to:** metricas.controller.ts for query param parsing

```typescript
export const listar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") query[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") query[k] = v[0];
    }
    // Only single string values allowed (Express can return array)
    const result = await service.listar(req.user!, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

**For metricas endpoint:** Validate date params are YYYY-MM-DD
```typescript
const { tipo, fechaInicio, fechaFin, areaId, tecnicoId } = req.query as {
  tipo?: "area" | "tecnico" | "proceso";
  fechaInicio?: string;  // Should be YYYY-MM-DD
  fechaFin?: string;     // Should be YYYY-MM-DD
  areaId?: string;
  tecnicoId?: string;
};
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/components/metricas/RechartsBarChart.jsx` | component | visualization | No existing Recharts components — first charts in this codebase |
| `apps/web/src/components/metricas/RechartsLineChart.jsx` | component | visualization | Same: Recharts new dependency |
| `apps/web/src/components/metricas/RechartsPieChart.jsx` | component | visualization | Same: Recharts new dependency |

**For these three files:** Use code examples from RESEARCH.md §Code Examples (lines 480-537)

---

## Metadata

**Analog search scope:** 
- `apps/api/src/services/*.ts` — 8 files searched
- `apps/api/src/controllers/*.ts` — 12 files searched
- `apps/api/src/routes/*.ts` — 5 files searched
- `apps/web/src/api/*.js` — 7 files searched
- `apps/web/src/pages/*.jsx` — 6 files searched
- `apps/web/src/components/**/*.jsx` — 6 directories searched
- `apps/web/src/store/*.js` — 3 files searched
- `packages/database/prisma/schema.prisma` — 1 file

**Files scanned:** 50+
**Pattern extraction date:** 2026-05-26

---

## Key Implementation Notes

### BigInt Serialization (CRITICAL)

**Source:** `apps/api/src/controllers/metricas.controller.ts` (lines 49-64)

When using `prisma.$queryRaw`, COUNT/SUM return `bigint`. **Must convert before JSON response:**

```typescript
const rows = await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) as total FROM tickets`;
return rows.map(r => ({ total: Number(r.total) }));  // <-- Critical conversion
```

**Without this:** `TypeError: Do not know how to serialize a BigInt`

---

### ResponsiveContainer Height (CRITICAL)

**Source:** RESEARCH.md Pitfall 2 + Pattern 6

Recharts `ResponsiveContainer` reads parent element's height via ResizeObserver. **Must wrap with explicit height:**

```jsx
// CORRECT
<Box sx={{ width: "100%", height: 260 }}>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart>...</BarChart>
  </ResponsiveContainer>
</Box>

// INCORRECT — chart collapses to 0 height
<ResponsiveContainer width="100%" height={260}>
  <BarChart>...</BarChart>
</ResponsiveContainer>
```

---

### Tooltip Z-Order in Recharts 3.x (CRITICAL)

**Source:** RESEARCH.md Pitfall 7

In Recharts 3.x, JSX order determines SVG z-order. **Tooltip MUST come before Legend:**

```jsx
// CORRECT
<Tooltip contentStyle={{ /* ... */ }} />
<Legend wrapperStyle={{ /* ... */ }} />

// INCORRECT — tooltip appears behind legend
<Legend wrapperStyle={{ /* ... */ }} />
<Tooltip contentStyle={{ /* ... */ }} />
```

---

### Date Format for API

**Source:** DashboardPage.jsx + RESEARCH.md

Frontend → Backend: Use ISO format `YYYY-MM-DD`
```javascript
format(dateRange.start, "yyyy-MM-dd")  // "2026-05-26"
```

Backend → Frontend: Return as `string` (API handles serialization)
```typescript
res.json({ data: rows });  // rows already have string dates from SQL
```

---

## Migration Checklist

Before running implementation plans:

1. ✓ **Phase 3 complete:** Verify `areaSoporteId` in Usuario JWT payload
2. ✓ **Recharts installed:** `cd apps/web && npm install recharts`
3. ✓ **New roles in routes:** All RESPONSABLE_* and new TECNICO_* added to requireRol
4. ✓ **MetricasHistorial migration:** Created and applied to MySQL
5. ✓ **node-cron decision:** Use setInterval or add node-cron (see RESEARCH.md A3)

