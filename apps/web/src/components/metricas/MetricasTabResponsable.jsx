import { Grid, Card, CardContent, Typography, Box, Skeleton } from "@mui/material";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import UpdateIcon from "@mui/icons-material/Update";
import ReplayIcon from "@mui/icons-material/Replay";
import { RechartsBarChart } from "./RechartsBarChart.jsx";
import { RechartsLineChart } from "./RechartsLineChart.jsx";
import { RechartsPieChart } from "./RechartsPieChart.jsx";
import { SlaIndicator } from "./SlaIndicator.jsx";
import { RendimientoTecnicoTable } from "./RendimientoTecnicoTable.jsx";
import { formatLabel } from "./utils.js";
import PropTypes from "prop-types";

// Recharts palette para subcategorías (UI-SPEC)
const PALETTE = ["#9d2449", "#b56e85", "#742035", "#c8a0b0", "#a83e6a", "#1565c0", "#2e7d32", "#e65100"];

const ESTADO_COLORS = {
  ABIERTO: "#ea580c",
  ASIGNADO: "#1565c0",
  EN_PROGRESO: "#ca8a04",
  RESUELTO: "#2e7d32",
  CANCELADO: "#9e9e9e",
};

const StatCard = ({ icon, label, value, color }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent sx={{ display: "flex", alignItems: "flex-start", gap: 2, py: "16px !important" }}>
      <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}18`, color, mt: 0.3, flexShrink: 0 }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" fontWeight={700} lineHeight={1}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
          {label}
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  color: PropTypes.string.isRequired,
};

export function MetricasTabResponsable({ data, loading, onTecnicoClick }) {
  if (loading || !data) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={6} sm={4} key={i}>
            <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1 }} />
        </Grid>
      </Grid>
    );
  }

  const barCarga = data.cargaTecnicos.map((t) => ({
    tecnico: t.tecnicoNombre.split(" ")[0], // primer nombre para brevedad
    Activos: t.activos,
    Completados: t.completados,
  }));

  const lineData = data.tendenciaDiaria.map((d) => ({
    dia: d.dia.slice(5),
    Creados: d.creados,
    Resueltos: d.resueltos,
  }));

  const pieData = data.distribucionSubcategoria.map((c, i) => ({
    name: formatLabel(c.categoria),
    value: c.total,
    color: PALETTE[i % PALETTE.length],
  }));

  const estadoPieData = (data.distribucionEstado ?? []).map((c) => ({
    name: formatLabel(c.categoria),
    value: c.total,
    color: ESTADO_COLORS[c.categoria] ?? "#9e9e9e",
  }));

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ mb: 2 }}>
        {formatLabel(data.areaNombre)}
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<HourglassEmptyIcon />}
            label="Tickets activos"
            value={data.ticketsActivos}
            color="#ea580c"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<UpdateIcon />}
            label="Tiempo promedio resolución"
            value={data.tiempoPromedioHoras != null ? `${data.tiempoPromedioHoras}h` : "—"}
            color="#9d2449"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ py: "16px !important" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Cumplimiento SLA
              </Typography>
              <SlaIndicator pct={data.slaGlobal} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<ReplayIcon />}
            label="Tickets reabiertos"
            value={data.ticketsReabiertos}
            color="#ca8a04"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<HourglassEmptyIcon />}
            label="Sin asignar"
            value={data.ticketsSinAsignar ?? 0}
            color="#1565c0"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            CARGA DE TÉCNICOS
          </Typography>
          <RechartsBarChart
            data={barCarga}
            xKey="tecnico"
            bars={[
              { key: "Activos", label: "En curso", color: "#ea580c" },
              { key: "Completados", label: "Resueltos", color: "#2e7d32" },
            ]}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            TENDENCIA DIARIA (RECIBIDOS VS RESUELTOS)
          </Typography>
          <RechartsLineChart
            data={lineData}
            xKey="dia"
            lines={[
              { key: "Creados", label: "Recibidos", color: "#9d2449" },
              { key: "Resueltos", label: "Resueltos", color: "#2e7d32" },
            ]}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            DISTRIBUCIÓN SUBCATEGORÍAS
          </Typography>
          <RechartsPieChart data={pieData} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            DISTRIBUCIÓN POR ESTADO
          </Typography>
          <RechartsPieChart data={estadoPieData} />
        </Grid>
      </Grid>

      {/* Tabla rendimiento técnicos */}
      <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
        RENDIMIENTO DE TÉCNICOS
      </Typography>
      <RendimientoTecnicoTable rows={data.rendimientoTecnicos} onRowClick={onTecnicoClick} />
    </Box>
  );
}

MetricasTabResponsable.propTypes = {
  data: PropTypes.object,
  loading: PropTypes.bool.isRequired,
  onTecnicoClick: PropTypes.func.isRequired,
};
