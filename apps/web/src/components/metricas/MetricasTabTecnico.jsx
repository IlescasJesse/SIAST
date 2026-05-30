import { Grid, Card, CardContent, Typography, Box, Skeleton } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import UpdateIcon from "@mui/icons-material/Update";
import BalanceIcon from "@mui/icons-material/Balance";
import { RechartsBarChart } from "./RechartsBarChart.jsx";
import { RechartsLineChart } from "./RechartsLineChart.jsx";
import { RechartsPieChart } from "./RechartsPieChart.jsx";
import { formatLabel } from "./utils.js";
import PropTypes from "prop-types";

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

export function MetricasTabTecnico({ data, loading }) {
  if (loading || !data) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3].map((i) => (
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

  const lineData = data.tendenciaProductividad.map((d) => ({
    dia: d.dia.slice(5),
    Completados: d.resueltos,
  }));

  const estadoPieData = (data.distribucionEstado ?? []).map((c) => ({
    name: formatLabel(c.categoria),
    value: c.total,
    color: ESTADO_COLORS[c.categoria] ?? "#9e9e9e",
  }));

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ mb: 2 }}>
        {data.tecnicoNombre}
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4}>
          <StatCard
            icon={<CheckCircleIcon />}
            label="Completados"
            value={data.ticketsCompletados}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            icon={<UpdateIcon />}
            label="Tiempo promedio resolución"
            value={data.tiempoPromedioHoras != null ? `${data.tiempoPromedioHoras}h` : "—"}
            color="#9d2449"
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            icon={<BalanceIcon />}
            label="Ratio resuelto / cancelado"
            value={
              data.ratioResueltosCancelados != null
                ? `${Math.round(data.ratioResueltosCancelados * 100)}%`
                : "—"
            }
            color="#1565c0"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            TENDENCIA DE PRODUCTIVIDAD
          </Typography>
          <RechartsLineChart
            data={lineData}
            xKey="dia"
            lines={[{ key: "Completados", label: "Completados", color: "#9d2449" }]}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            DISTRIBUCIÓN POR ESTADO
          </Typography>
          <RechartsPieChart data={estadoPieData} />
        </Grid>
        {data.comparativaVsArea?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
              COMPARATIVA VS PROMEDIO ÁREA
            </Typography>
            <RechartsBarChart
              data={data.comparativaVsArea}
              xKey="label"
              bars={[
                { key: "tecnico", label: "Este técnico", color: "#9d2449" },
                { key: "promedioArea", label: "Promedio área", color: "#b56e85" },
              ]}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

MetricasTabTecnico.propTypes = {
  data: PropTypes.object,
  loading: PropTypes.bool.isRequired,
};
