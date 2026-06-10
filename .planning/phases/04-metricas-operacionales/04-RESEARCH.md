# Phase 4: Métricas Operacionales - Research

**Researched:** 2026-05-25
**Domain:** Dashboard analytics — Prisma aggregation queries + Recharts visualizations + MUI v6 tabs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Recharts — mejor dinamismo/animaciones para datos en tiempo real, componentes 100% React, responsive container nativo.
- **D-02:** SLA hardcodeado en backend: TECNOLOGIAS=24h, SERVICIOS=48h, RECURSOS_MATERIALES=72h. Sin campo en DB.
- **D-03:** Índice de solvencia a 3 niveles (ADMIN / RESPONSABLE_* / TECNICO).
- **D-04:** Métrica adicional: tiempo de primera respuesta (asignación → primera acción técnico).
- **D-05:** Default 30 días, comparativa día contra día simple.
- **D-06:** Print-friendly en Phase 4; PDF export diferido a Phase 5.
- **D-07:** Tab Global (ADMIN): tarjetas + barras por área + líneas tendencia + pastel categoría + tabla eficiencia responsables.
- **D-08:** Tab Por Responsable: tarjetas + barras carga técnicos + líneas creados vs resueltos + pastel subcategorías + tabla rendimiento técnicos.
- **D-09:** Tab Por Técnico: tarjetas + barras completados vs promedio área + pastel resueltos/cancelados + línea productividad.
- **D-10:** Endpoint único: `GET /api/metricas?tipo=area|tecnico|proceso&fechaInicio=&fechaFin=&areaId=&tecnicoId=`
- **D-11:** Backend aggregation via Prisma — frontend solo renderiza.
- **D-12:** RESPONSABLE_* autenticado filtra automáticamente por `areaSoporteId` del token JWT.
- **D-13:** Sección "Métricas" dentro de DashboardPage (no nueva ruta). Tabs: Global | Por Responsable | Por Técnico.
- **D-14:** ADMIN ve 3 tabs. Click responsable → tab "Por Responsable". Click técnico → tab "Por Técnico".
- **D-15:** RESPONSABLE_* ve solo tab "Por Responsable" filtrado a su área. TECNICO_* ve solo "Por Técnico".
- **D-16:** Date range filter como settings dropdown (icono expande DatePicker de MUI). Aplica a todos los tabs.
- **D-17:** Responsive: 1-column mobile, 3-column desktop para tarjetas. Charts apilados en mobile, lado a lado en desktop.
- **D-18:** Reuse ticketsVersion pattern de useNotifStore para refetch automático.
- **D-19:** Sin polling interval. Sin socket dedicado para métricas.
- **D-20:** Daily snapshots en tabla `MetricasHistorial` (nuevo modelo Prisma). Job diario calcula y persiste.

### Claude's Discretion

- Diseño visual charts (colores, tamaños, animaciones) — seguir MUI + Recharts defaults.
- Implementación concreta de MetricasHistorial schema: JSON vs columnas tipadas.
- Orden y espaciado de elementos dentro de cada tab.

### Deferred Ideas (OUT OF SCOPE)

- Encuesta interactiva post-resolución.
- PDF export de métricas (Phase 5).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MET-01 | Dashboard de métricas por área (tiempo de resolución, volumen, SLA) | Prisma groupBy + raw SQL para SLA; Tab Global + Por Responsable cubren esto |
| MET-02 | Métricas por técnico (carga de trabajo, eficiencia) | Tab Por Técnico + tabla rendimiento en Por Responsable; queries por tecnicoId |
| MET-03 | Métricas por proceso/tipo (distribución de categorías, tiempos por subcategoría) | groupBy categoria/subcategoria ya existe en controlador actual; extender para SLA fijo |
| MET-04 | Indicadores en tiempo real (solicitudes activas, colas por área) | ticketsVersion pattern + KPIs "activos ahora" sin filtro de fecha; activos = estado NOT IN (RESUELTO, CANCELADO) |
</phase_requirements>

---

## Summary

Phase 4 construye un dashboard de métricas operacionales sobre la infraestructura ya existente de SIAST. El controlador `metricas.controller.ts` actual tiene tres endpoints separados con mock-style aggregation; debe ser reemplazado por un único endpoint paramétrico con aggregation real vía Prisma. El frontend añade una nueva sección con tabs (Global / Por Responsable / Por Técnico) dentro de `DashboardPage.jsx`, consumiendo los datos via `ticketsVersion` pattern del Zustand store ya en uso.

La principal complejidad técnica son las Prisma queries: calcular SLA (% resueltos dentro de meta por categoría), tiempo promedio de resolución, tiempo de primera respuesta (requiere join con `HistorialTicket` o `Comentario` para la primera acción del técnico), y tendencia diaria (groupBy fecha). Estas queries requieren raw SQL para agrupaciones por fecha y para los nullable `subTipo`; las demás pueden usar `groupBy` de Prisma con `_count`/`_avg`.

Recharts 3.8.1 (versión actual en npm) es compatible con React 18. La única diferencia crítica vs 2.x relevante para este proyecto: `ResponsiveContainer` requiere un padre con altura explícita (no `height: auto`). La UI-SPEC ya contempla esto con `Box height={260}` wrapper.

**Primary recommendation:** Implementar en 4 planes secuenciales: (1) schema + migración MetricasHistorial, (2) servicio de metricas backend con endpoint único y aggregations reales, (3) componentes frontend Recharts + tabs en DashboardPage, (4) job diario de snapshots.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KPI aggregation (SLA, tiempos, volumen) | API / Backend | — | Toda la computación en backend (D-11); frontend solo renderiza |
| Date range filtering | API / Backend | Browser / Client | Query params llegan al backend; frontend mantiene estado del filtro |
| Role-based data scoping (RESPONSABLE_* por área) | API / Backend | — | areaSoporteId en JWT payload; backend filtra automáticamente (D-12) |
| Recharts visualizations | Browser / Client | — | Componentes React puros en frontend |
| Tab navigation + drill-down | Browser / Client | — | Estado local de tabs en React; no requiere route change |
| Real-time update trigger | Browser / Client | — | ticketsVersion en Zustand; frontend reacciona sin lógica backend extra |
| Daily snapshots (MetricasHistorial) | API / Backend | Database / Storage | Job programado en Node.js + tabla Prisma nueva |
| Print-friendly CSS | Browser / Client | — | @media print via MUI GlobalStyles |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | Charts: Bar, Line, Pie, ResponsiveContainer | Decisión D-01 bloqueada; React nativo, MIT, sin deps externas de red |
| @mui/material | ^6.3.0 | Tabs, IconButton, Popover, Skeleton, Badge | Ya instalado; todo el UI de la app |
| @mui/x-date-pickers | ^9.0.2 | DatePicker para filtro de fechas | Ya instalado |
| date-fns | ^4.1.0 | Cálculo de rangos de fechas, formateo | Ya instalado; usar sobre dayjs para consistencia en esta sección |
| Prisma (API) | 5.22.0 | Queries de aggregation en MySQL | ORM oficial del proyecto |

[VERIFIED: npm registry — recharts@3.8.1 publicado 2025]
[VERIFIED: apps/web/package.json — todas las demás ya instaladas]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-cron o setInterval | Built-in / ^3.x | Job diario MetricasHistorial | Para el snapshot diario; node-cron si ya disponible |
| date-fns/locale/es | incluido en date-fns | Formateo de fechas en español en el frontend | Solo para display de fechas en charts |

**Instalación requerida (solo recharts):**
```bash
cd apps/web && npm install recharts
```

[VERIFIED: apps/web/package.json — recharts NO está instalado actualmente]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | Chart.js / Victory | recharts es decisión D-01 bloqueada |
| date-fns (en DatePicker) | dayjs | SolicitudNewPage usa dayjs; UI-SPEC indica usar date-fns en esta sección para evitar conflictos de adapter. Si hay problema, mantener dayjs. |
| node-cron | setInterval con setTimeout inicial | setInterval más simple, menos dependencias; cron mejor para horarios específicos |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (DashboardPage.jsx)
  │
  ├── MetricasOperacionalesSection
  │     ├── DateRangeFilter (estado local)
  │     ├── Tabs [Global | Por Responsable | Por Técnico]
  │     └── useEffect([ticketsVersion, dateRange, activeTab])
  │           │
  │           └── GET /api/metricas?tipo=&fechaInicio=&fechaFin=&areaId=&tecnicoId=
  │                       │
  │                       ▼
  │             API Express (metricas.routes.ts)
  │               authMiddleware → requireRol([ADMIN, RESPONSABLE_*, TECNICO_*])
  │                       │
  │                       ▼
  │             metricas.controller.ts (nuevo — endpoint único)
  │                       │
  │                       ▼
  │             metricas.service.ts (NUEVO)
  │               ├── obtenerMetricasGlobal(fechaInicio, fechaFin)
  │               ├── obtenerMetricasPorArea(areaId, fechaInicio, fechaFin)
  │               └── obtenerMetricasPorTecnico(tecnicoId, fechaInicio, fechaFin)
  │                       │
  │                       ▼
  │             Prisma → MySQL (tickets, usuarios, historial_tickets,
  │                             areas_soporte, metricas_historial)
  │
Zustand useNotifStore
  └── ticketsVersion (increments on socket events)
        └── triggers refetch in MetricasOperacionalesSection
```

### Recommended Project Structure

```
apps/api/src/
  controllers/
    metricas.controller.ts     # REEMPLAZAR (nuevo endpoint único)
  services/
    metricas.service.ts        # NUEVO — toda la aggregation logic
  routes/
    metricas.routes.ts         # MODIFICAR — nuevo endpoint, nuevos roles

apps/web/src/
  components/
    metricas/
      MetricasOperacionalesSection.jsx  # contenedor principal
      MetricasTabGlobal.jsx             # tab ADMIN
      MetricasTabResponsable.jsx        # tab RESPONSABLE_*
      MetricasTabTecnico.jsx            # tab TECNICO_*
      DateRangeFilter.jsx               # popover con DatePicker
      SlaIndicator.jsx                  # Chip SLA OK/En riesgo/Incumplido
      RechartsBarChart.jsx              # wrapper reutilizable
      RechartsLineChart.jsx             # wrapper reutilizable
      RechartsPieChart.jsx              # wrapper reutilizable
      EficienciaTable.jsx               # tabla responsables
      RendimientoTecnicoTable.jsx       # tabla técnicos
  api/
    metricas.js                         # NUEVO — getMetricas(params)
  pages/
    DashboardPage.jsx                   # MODIFICAR — agregar MetricasOperacionalesSection

packages/database/prisma/
  schema.prisma                         # MODIFICAR — agregar MetricasHistorial
  migrations/                           # nueva migración
```

### Pattern 1: Endpoint único paramétrico (D-10)

**What:** Un solo `GET /api/metricas` con `tipo` query param determina el shape de respuesta.
**When to use:** Siempre — es la decisión D-10 bloqueada.

```typescript
// Source: CONTEXT.md D-10 + patrón existente en metricas.controller.ts
// apps/api/src/controllers/metricas.controller.ts (nuevo)
export const obtener = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tipo, fechaInicio, fechaFin, areaId, tecnicoId } = req.query as {
      tipo?: "area" | "tecnico" | "proceso";
      fechaInicio?: string;
      fechaFin?: string;
      areaId?: string;
      tecnicoId?: string;
    };

    const user = req.user!;
    const dateRange = { desde: fechaInicio, hasta: fechaFin };

    // RESPONSABLE_* → filtrar automáticamente por su área (D-12)
    const efectiveAreaId =
      user.rol.startsWith("RESPONSABLE_") ? String(user.areaSoporteId) : areaId;

    const data = await metricasService.obtener({
      tipo: tipo ?? "area",
      dateRange,
      areaId: efectiveAreaId,
      tecnicoId: tecnicoId ? Number(tecnicoId) : undefined,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
};
```

### Pattern 2: SLA computation en backend (D-02)

**What:** Calcular % tickets resueltos dentro de la meta por categoría. Metas hardcodeadas.
**When to use:** En `metricas.service.ts`, función `calcularSLA`.

```typescript
// Source: CONTEXT.md D-02
// apps/api/src/services/metricas.service.ts
const SLA_HORAS: Record<string, number> = {
  TECNOLOGIAS: 24,
  SERVICIOS: 48,
  RECURSOS_MATERIALES: 72,
};

async function calcularSLA(where: PrismaTicketWhere): Promise<number> {
  const resueltos = await prisma.ticket.findMany({
    where: { ...where, estado: "RESUELTO", fechaResolucion: { not: null }, activo: true },
    select: { categoria: true, createdAt: true, fechaResolucion: true },
  });

  if (resueltos.length === 0) return 0;

  let cumplieron = 0;
  for (const t of resueltos) {
    const metaMs = (SLA_HORAS[t.categoria] ?? 24) * 3600_000;
    const diff = t.fechaResolucion!.getTime() - t.createdAt.getTime();
    if (diff <= metaMs) cumplieron++;
  }
  return Math.round((cumplieron / resueltos.length) * 100);
}
```

### Pattern 3: Tiempo de primera respuesta (D-04)

**What:** AVG(primera acción del técnico – fecha asignación del ticket).
**When to use:** En `obtenerMetricasPorTecnico` y en resumen de área.

La primera acción del técnico = primer registro en `HistorialTicket` donde `usuarioId = tecnicoId` y `estadoNuevo = "EN_PROGRESO"` o primer `Comentario` del técnico, lo que ocurra primero. Usar `fechaAsignacion` del Ticket y el `createdAt` del primer `HistorialTicket` con `estadoNuevo = "EN_PROGRESO"`.

```typescript
// Source: schema.prisma — Ticket.fechaAsignacion, HistorialTicket.createdAt
// Enfoque pragmático: primera transición a EN_PROGRESO como proxy de primera respuesta
async function calcularTiemprimeraRespuesta(tecnicoId: number, where: object): Promise<number | null> {
  const tickets = await prisma.ticket.findMany({
    where: { ...where, tecnicoId, fechaAsignacion: { not: null }, activo: true },
    select: {
      id: true,
      fechaAsignacion: true,
      historial: {
        where: { estadoNuevo: "EN_PROGRESO", usuarioId: tecnicoId },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const tiempos = tickets
    .filter((t) => t.historial.length > 0)
    .map((t) => t.historial[0].createdAt.getTime() - t.fechaAsignacion!.getTime());

  if (tiempos.length === 0) return null;
  const avgMs = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  return Math.round(avgMs / 3_600_000 * 100) / 100; // horas con 2 decimales
}
```

### Pattern 4: Tendencia diaria via raw SQL

**What:** COUNT de tickets creados/resueltos agrupados por día en el rango.
**When to use:** Para charts de línea de tendencia.

```typescript
// Source: patrón ya establecido en metricas.controller.ts existente con $queryRaw
// apps/api/src/services/metricas.service.ts
type DayRow = { dia: string; creados: bigint; resueltos: bigint };
const tendencia = await prisma.$queryRaw<DayRow[]>`
  SELECT
    DATE(created_at) AS dia,
    COUNT(*) AS creados,
    SUM(CASE WHEN estado = 'RESUELTO' THEN 1 ELSE 0 END) AS resueltos
  FROM tickets
  WHERE activo = true
    AND created_at >= ${fechaInicio}
    AND created_at <= ${fechaFin}
    ${areaId ? Prisma.sql`AND area_soporte_id = ${Number(areaId)}` : Prisma.empty}
  GROUP BY DATE(created_at)
  ORDER BY dia ASC
`;
// Convertir bigint a number antes de responder JSON
```

### Pattern 5: ticketsVersion refetch (D-18)

**What:** MetricasOperacionalesSection escucha `ticketsVersion` de Zustand.
**When to use:** En el componente raíz de la sección de métricas.

```jsx
// Source: apps/web/src/store/notificaciones.js + CONTEXT.md D-18
// apps/web/src/components/metricas/MetricasOperacionalesSection.jsx
import { useNotifStore } from "../../store/notificaciones.js";
import { getMetricas } from "../../api/metricas.js";

export function MetricasOperacionalesSection({ rol, areaSoporteId }) {
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),  // date-fns
    end: new Date(),
  });
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    setLoading(true);
    getMetricas({ tipo: tabToTipo(activeTab), fechaInicio: dateRange.start, fechaFin: dateRange.end })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticketsVersion, dateRange, activeTab]);  // <-- ticketsVersion en deps
  // ...
}
```

### Pattern 6: ResponsiveContainer con height explícito en padre (pitfall crítico)

**What:** Recharts `ResponsiveContainer` colapsa a height 0 si el padre no tiene altura explícita.
**When to use:** Siempre que se use `ResponsiveContainer`.

```jsx
// Source: UI-SPEC Implementation Notes #5; verificado en recharts GitHub issues
// CORRECTO:
<Box sx={{ width: "100%", height: 260 }}>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>...</BarChart>
  </ResponsiveContainer>
</Box>

// INCORRECTO — chart colapsa a 0 height:
<ResponsiveContainer width="100%" height={260}>
  <BarChart data={data}>...</BarChart>
</ResponsiveContainer>
// (sin Box padre con altura definida puede causar undefined height en SSR/flex)
```

### Pattern 7: MetricasHistorial schema (D-20, Claude's Discretion)

**What:** Daily snapshot con columnas tipadas (recomendado sobre JSON).
**When to use:** Decisión de implementación — columnas tipadas dan mejor query performance y son más mantenibles.

```prisma
// Recomendación: columnas tipadas para KPIs críticos, JSON para datos extras
model MetricasHistorial {
  id                  Int      @id @default(autoincrement())
  fecha               DateTime @db.Date           // snapshot del día
  areaSoporteId       Int?     @map("area_soporte_id")
  totalTickets        Int      @map("total_tickets")
  ticketsResueltos    Int      @map("tickets_resueltos")
  ticketsActivos      Int      @map("tickets_activos")
  slaGlobal           Float    @map("sla_global")   // porcentaje 0-100
  tiempoPromedioHoras Float?   @map("tiempo_promedio_horas")
  extras              Json?    // datos adicionales (por categoría, tendencias, etc.)
  createdAt           DateTime @default(now()) @map("created_at")

  @@unique([fecha, areaSoporteId])
  @@index([fecha])
  @@map("metricas_historial")
}
```

### Anti-Patterns to Avoid

- **N+1 queries en aggregation:** El controlador actual itera técnicos con una query por técnico. Usar `groupBy` con `_count` y `_avg` en una sola query donde sea posible.
- **Fetch de todos los tickets en frontend:** DashboardPage.jsx actual hace `getSolicitudes({ limit: 200 })` para calcular métricas en frontend. El nuevo endpoint backend elimina esto para la sección de métricas (los datos ya vienen computados).
- **bigint en respuesta JSON:** Los resultados de `$queryRaw` retornan `bigint`; JSON.stringify falla con bigint. Siempre convertir con `Number(row.total)` antes de responder.
- **Recharts Tooltip debajo de Legend en JSX:** En Recharts 3.x, el orden JSX determina el z-order en SVG. Tooltip DEBE ir antes de Legend para que aparezca por encima.
- **areaSoporteId undefined para ADMIN:** ADMIN no tiene `areaSoporteId` en JWT. El servicio debe tratar `undefined` como "sin filtro de área" (ver todas las áreas).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Barras, líneas, tortas interactivas | Componentes SVG custom | Recharts BarChart/LineChart/PieChart | Tooltip, animaciones, responsive, legend — todo incluido |
| Date range arithmetic | Custom date math | date-fns: subDays, format, startOfDay | Edge cases de meses, años bisiestos, timezones |
| Responsive chart width | CSS tricks | ResponsiveContainer de Recharts | Usa ResizeObserver internamente, maneja SSR |
| Aggregation SQL | Loops en frontend sobre todos los tickets | Prisma groupBy + $queryRaw | Performance: N tickets vs 1 query |
| SLA color coding | Custom lógica de colores | SlaIndicator component (nuevo) | Reutilizable en cards y tables; centraliza los thresholds |
| Print layout | JS print libraries | CSS @media print con MUI GlobalStyles | Más simple, nativo, sin dependencias extra |

**Key insight:** La mayor trampa en dashboards de métricas es calcular en frontend lo que debería calcularse en backend. Con ~200 tickets se puede salir con la de frontend, pero con miles de tickets (crecimiento del sistema gubernamental) la app colapsaría. Mantener toda aggregation en backend desde el inicio.

---

## Common Pitfalls

### Pitfall 1: bigint en respuestas de $queryRaw
**What goes wrong:** `JSON.stringify` lanza `TypeError: Do not know how to serialize a BigInt`.
**Why it happens:** MySQL COUNT/SUM retornan `bigint` en Prisma `$queryRaw`.
**How to avoid:** Siempre mapear: `total: Number(row.total)` antes de `res.json()`.
**Warning signs:** Error 500 en el endpoint aunque la query MySQL funciona.

### Pitfall 2: ResponsiveContainer sin altura de padre explícita
**What goes wrong:** El chart se renderiza con height 0 o colapsa.
**Why it happens:** `ResponsiveContainer` lee el tamaño del padre con ResizeObserver; `height: auto` del padre da 0.
**How to avoid:** Siempre envolver con `<Box sx={{ height: 260 }}>` antes del ResponsiveContainer.
**Warning signs:** El chart no aparece en pantalla aunque no hay errores en consola.

### Pitfall 3: Infinite height loop con márgenes en contenedor padre
**What goes wrong:** El chart crece infinitamente si el padre tiene `margin` aplicado.
**Why it happens:** Bug conocido de Recharts: ResizeObserver y márgenes interactúan mal.
**How to avoid:** Usar `padding` en lugar de `margin` en el contenedor padre del chart; o usar `Box sx={{ width: "calc(100% - Npx)" }}` para compensar.
**Warning signs:** El chart aumenta su altura visiblemente al renderizar.

### Pitfall 4: Tab visibility con roles RESPONSABLE_*
**What goes wrong:** Un `RESPONSABLE_TI` puede acceder a datos de otra área si el frontend no filtra correctamente.
**Why it happens:** Si el endpoint no valida el `areaSoporteId` del JWT y confía solo en el parámetro de URL.
**How to avoid:** Backend siempre hace override: si `user.rol.startsWith("RESPONSABLE_")`, usar `user.areaSoporteId` del token, ignorar el query param `areaId`. Validado en D-12.
**Warning signs:** Tests manuales: loguearse como RESPONSABLE_TI y cambiar query param `areaId` a otra área.

### Pitfall 5: ticketsVersion vs dateRange en useEffect deps
**What goes wrong:** Cambiar el rango de fechas no dispara un refetch, o los datos son stale.
**Why it happens:** Olvidar incluir `dateRange` en el array de dependencias del `useEffect`.
**How to avoid:** Dependencies array: `[ticketsVersion, dateRange.start, dateRange.end, activeTab, selectedTecnicoId]`.
**Warning signs:** Cambiar fechas en el DatePicker no actualiza los datos de las gráficas.

### Pitfall 6: Roles expandidos — RESPONSABLE_* y TECNICO_* nuevos
**What goes wrong:** La ruta de métricas solo permitía ADMIN, TECNICO_TI, TECNICO_REDES (ver metricas.routes.ts actual).
**Why it happens:** La route fue creada antes de Phase 3 que añadió 7 nuevos roles.
**How to avoid:** Actualizar `requireRol` en la nueva ruta para incluir todos los nuevos roles: RESPONSABLE_TI, RESPONSABLE_REDES, RESPONSABLE_MANTENIMIENTO, RESPONSABLE_RECURSOS_MATERIALES, TECNICO_ELECTRICISTA, TECNICO_PLOMERO, TECNICO_MOVILIDAD, más ADMIN, MESA_AYUDA.
**Warning signs:** 403 Forbidden para usuarios RESPONSABLE_* al acceder al dashboard.

### Pitfall 7: Recharts Tooltip z-order (v3.x)
**What goes wrong:** El tooltip queda debajo de la leyenda y no se ve.
**Why it happens:** En SVG no hay z-index; el orden de render en JSX determina qué aparece al frente. Recharts 3.x cambia este comportamiento vs 2.x.
**How to avoid:** Siempre poner `<Tooltip>` antes de `<Legend>` en el JSX del chart.
**Warning signs:** El tooltip aparece pero la leyenda lo tapa al hacer hover cerca.

---

## Code Examples

### Recharts BarChart (wrapper reutilizable)

```jsx
// Source: Recharts 3.x docs + UI-SPEC interaction contracts
// apps/web/src/components/metricas/RechartsBarChart.jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Box } from "@mui/material";

export function RechartsBarChart({ data, xKey, bars }) {
  return (
    <Box sx={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey={xKey} tick={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          <YAxis tick={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 4, fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }}
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

### Recharts PieChart (donut style)

```jsx
// Source: UI-SPEC interaction contracts — innerRadius/outerRadius donut
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Box } from "@mui/material";

export function RechartsPieChart({ data }) {
  return (
    <Box sx={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* Tooltip ANTES de Legend — z-order Recharts 3.x */}
          <Tooltip contentStyle={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontFamily: "'Inter', 'Roboto', sans-serif", fontSize: 12 }} />
          <Pie data={data} dataKey="value" nameKey="name"
            innerRadius={50} outerRadius={90} paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}
```

### SlaIndicator chip

```jsx
// Source: UI-SPEC color + interaction contracts
import { Chip } from "@mui/material";

export function SlaIndicator({ pct }) {
  const config =
    pct >= 90  ? { label: "SLA OK",    color: "success" } :
    pct >= 70  ? { label: "En riesgo", color: "warning" } :
                 { label: "Incumplido", color: "error"   };
  return <Chip label={`${config.label} ${pct}%`} color={config.color} size="small" />;
}
```

### getMetricas API call (frontend)

```javascript
// Source: CONTEXT.md D-10 + convención api/ en CONVENTIONS.md
// apps/web/src/api/metricas.js
import api from "./client.js";

export const getMetricas = (params) =>
  api.get("/api/metricas", { params }).then((r) => r.data);
```

### Migración Prisma MetricasHistorial

```bash
# Desde packages/database
npm run db:migrate
# Nombre sugerido: add_metricas_historial
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x (activeIndex prop) | Recharts 3.x (hooks internos) | recharts 3.0 | No usar activeIndex; usar useActiveTooltipLabel hook si se necesita |
| Recharts 2.x (accessibilityLayer=false por defecto) | 3.x (accessibilityLayer=true por defecto) | recharts 3.0 | Para dashboards admin sin requisito de a11y: puede desactivarse |
| Endpoints separados /metricas/solicitudes, /metricas/tecnicos | Endpoint único /api/metricas?tipo= | Este proyecto (D-10) | Controlador actual a reemplazar |
| Frontend aggregation (DashboardPage.jsx actual) | Backend aggregation vía Prisma | Este proyecto (D-11) | No mezclar; los componentes de métricas nuevos no hacen cómputo propio |

**Deprecado/obsoleto:**
- `metricas.controller.ts` actual (3 endpoints separados, mock-style): **reemplazar completo**. La lógica de aggregation se mueve a `metricas.service.ts` nuevo.
- `metricas.routes.ts` actual: reemplazar con ruta única + roles actualizados.
- `MetricasSolicitudesResponse`, `MetricaTecnico`, `MetricaProceso` en `@stf/shared`: los tipos actuales son para el schema viejo; definir tipos nuevos para el endpoint unificado.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Primera respuesta del técnico se mide como la primera transición a EN_PROGRESO en HistorialTicket | Pattern 3 | Si los técnicos no usan EN_PROGRESO consistentemente, la métrica será null para muchos tickets — necesita fallback a primera Comentario |
| A2 | `areaSoporteId` está disponible en el JWT payload para RESPONSABLE_* después de Phase 3 | Pattern 1, Pitfall 4 | Si el JWT generado en Phase 3 no incluye este campo, el filtro automático falla. Verificar auth.service.ts al implementar |
| A3 | Job diario de MetricasHistorial puede implementarse con setInterval/setTimeout o node-cron sin instalar dependencias adicionales | Standard Stack | Si se prefiere un cron schedule preciso (ej. medianoche), node-cron es más robusto — agregar `npm install node-cron` en apps/api |
| A4 | El Ticket.fechaResolucion se setea cuando el estado cambia a RESUELTO | Pattern 2 (SLA) | Si hay tickets RESUELTO con fechaResolucion null, se excluyen del SLA — verificar tickets.service.ts `cambiarEstado` |
| A5 | AreaSoporte.id coincide con areaSoporteId del JWT payload del RESPONSABLE_* | D-12 | Si Phase 3 guardó un campo diferente en el token, el filtro de backend requerirá ajuste |

---

## Open Questions (RESOLVED)

1. **¿Cómo se relaciona Ticket con AreaSoporte?** — **RESOLVED**
   - **Respuesta:** Join via `tickets.tecnico_id → usuarios.id → usuarios.area_soporte_id`. Verificado en `schema.prisma`: `Ticket` tiene campo `tecnicoId` (FK a `Usuario`), y `Usuario` tiene `areaSoporteId` (FK a `AreaSoporte`). No hay `areaSoporteId` directo en `Ticket`. El filtro para RESPONSABLE_* es: `WHERE tecnico.areaSoporteId = ${areaSoporteId}`. Tickets sin técnico asignado (sin tecnicoId) no se incluyen en métricas por área — es comportamiento esperado ya que no pertenecen a ningún área hasta asignación.

2. **¿node-cron ya está instalado en apps/api?** — **RESOLVED**
   - **Respuesta:** No está instalado. Se usa `setInterval` con delay inicial en `apps/api/src/index.ts` para el job diario de snapshots — sin dependencias adicionales. Si se necesita un horario exacto (ej. medianoche), añadir `node-cron` es trivial, pero setInterval es suficiente para Phase 4.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| recharts | Frontend charts | ✗ | — | — (decisión bloqueada D-01, instalar) |
| date-fns | Date arithmetic frontend | ✓ | ^4.1.0 | dayjs (ya instalado) |
| @mui/x-date-pickers | DateRangeFilter | ✓ | ^9.0.2 | — |
| MySQL (XAMPP) | Backend queries | ✓ (dev) | MariaDB/MySQL 8 | — |
| Prisma | ORM aggregation | ✓ | 5.22.0 | — |
| node-cron | Job diario snapshot | ✗ | — | setInterval/setTimeout en index.ts |

**Missing dependencies sin fallback:**
- `recharts` en `apps/web` — DEBE instalarse antes de implementar charts. Comando: `cd apps/web && npm install recharts`

**Missing dependencies con fallback:**
- `node-cron` — se puede usar `setInterval` en el startup de `apps/api/src/index.ts` para el job diario.

---

## Security Domain

> `security_enforcement: true` en config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | authMiddleware JWT (ya implementado) |
| V3 Session Management | yes | jti verification en sesiones (ya implementado) |
| V4 Access Control | yes | requireRol + scoping por areaSoporteId en token |
| V5 Input Validation | yes | Zod validation en query params (tipo, fechaInicio, fechaFin) |
| V6 Cryptography | no | No hay datos cifrados en métricas |

### Known Threat Patterns for Metrics Dashboard

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RESPONSABLE_* accede a datos de otra área via query param | Elevation of Privilege | Backend override: si rol es RESPONSABLE_*, forzar areaSoporteId del JWT (D-12) |
| TECNICO_* accede a métricas globales | Information Disclosure | requireRol excluye EMPLEADO del endpoint; tabs son solo frontend — el backend debe validar tipo+rol |
| Inyección en raw SQL ($queryRaw) | Tampering | Usar Prisma.sql tagged template literals para parametrizar valores, NUNCA string interpolation directa |
| Exposición de datos de otros técnicos a TECNICO_* | Information Disclosure | Para tipo=tecnico, si el solicitante es TECNICO_*, forzar tecnicoId = user.id en backend |
| Fechas malformadas en query params | Tampering | Validar con Zod `.coerce.date()` antes de pasar a Prisma; errores retornan 400 |

**Nota crítica sobre raw SQL:** El controlador actual ya usa `$queryRaw` con Prisma tagged templates (correcto). El nuevo servicio DEBE mantener este patrón. No concatenar strings de usuario directamente en SQL.

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/controllers/metricas.controller.ts` — controlador actual verificado en codebase
- `apps/web/src/store/notificaciones.js` — ticketsVersion pattern verificado
- `apps/web/src/pages/DashboardPage.jsx` — punto de inserción verificado
- `packages/database/prisma/schema.prisma` — modelos verificados (Ticket, HistorialTicket, AreaSoporte, Usuario)
- `apps/web/package.json` — recharts NO instalado (verificado)
- `.planning/phases/04-metricas-operacionales/04-UI-SPEC.md` — contrato visual verificado
- `.planning/codebase/CONVENTIONS.md` — convenciones verificadas
- npm registry — recharts@3.8.1 versión actual verificada [VERIFIED: npm view recharts version]

### Secondary (MEDIUM confidence)
- [Recharts 3.0 migration guide — GitHub Wiki](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — breaking changes v3.x verificados
- recharts peerDependencies React 18 compatible — verificado via npm view

### Tertiary (LOW confidence)
- Comportamiento de `areaSoporteId` en JWT payload de RESPONSABLE_* — [ASSUMED: basado en D-12 del CONTEXT y patrón Phase 3; verificar en auth.service.ts al implementar]
- Relación Ticket↔AreaSoporte para filtrado por área — [ASSUMED: join via tecnicoId → Usuario.areaSoporteId; confirmar en tickets.service.ts de Phase 3]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas las librerías verificadas en package.json o npm registry
- Architecture: HIGH — codebase existente verificado, patrones establecidos en CONVENTIONS.md
- Pitfalls: HIGH — recharts issues verificados en fuentes oficiales; pitfalls de roles verificados contra schema.prisma
- Queries Prisma: MEDIUM — patrones en controlador existente son prueba; join Ticket↔AreaSoporte requiere verificación al implementar

**Research date:** 2026-05-25
**Valid until:** 2026-07-01 (recharts 3.x estable; date-fns 4.x estable)
