import { Grid, Card, CardContent, Typography, Box, Skeleton } from "@mui/material";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { RechartsBarChart } from "./RechartsBarChart.jsx";
import { RechartsLineChart } from "./RechartsLineChart.jsx";
import { RechartsPieChart } from "./RechartsPieChart.jsx";
import { SlaIndicator } from "./SlaIndicator.jsx";
import { EficienciaTable } from "./EficienciaTable.jsx";
import PropTypes from "prop-types";

// Colores por categoría (UI-SPEC)
const CAT_COLORS = {
  TECNOLOGIAS: "#1565c0",
  SERVICIOS: "#2e7d32",
  RECURSOS_MATERIALES: "#e65100",
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

export function MetricasTabGlobal({ data, loading, onResponsableClick }) {
  if (loading || !data) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={6} sm={4} md={3} key={i}>
            <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1 }} />
        </Grid>
      </Grid>
    );
  }

  const barDataArea = data.comparativoPorArea.map((a) => ({
    area: a.areaNombre,
    Total: a.total,
    Resueltos: a.resueltos,
  }));

  const lineData = data.tendenciaDiaria.map((d) => ({
    dia: d.dia.slice(5), // MM-DD
    Creados: d.creados,
    Resueltos: d.resueltos,
  }));

  const pieData = data.distribucionCategoria.map((c) => ({
    name: c.categoria,
    value: c.total,
    color: CAT_COLORS[c.categoria] ?? "#9e9e9e",
  }));

  return (
    <Box sx={{ "@media print": { "& .no-print": { display: "none" } } }}>
      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            icon={<ConfirmationNumberIcon />}
            label="Total solicitudes"
            value={data.totalTickets}
            color="#9d2449"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            icon={<HourglassEmptyIcon />}
            label="Activos ahora"
            value={data.ticketsActivos}
            color="#ea580c"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            icon={<CheckCircleIcon />}
            label="Resueltos (período)"
            value={data.ticketsResueltos}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ py: "16px !important" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Cumplimiento SLA
              </Typography>
              <SlaIndicator pct={data.slaGlobal} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            SOLICITUDES POR ÁREA
          </Typography>
          <RechartsBarChart
            data={barDataArea}
            xKey="area"
            bars={[
              { key: "Total", label: "Total", color: "#9d2449" },
              { key: "Resueltos", label: "Resueltos", color: "#2e7d32" },
            ]}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            TENDENCIA DIARIA (CREADOS VS RESUELTOS)
          </Typography>
          <RechartsLineChart
            data={lineData}
            xKey="dia"
            lines={[
              { key: "Creados", label: "Creados", color: "#9d2449" },
              { key: "Resueltos", label: "Resueltos", color: "#2e7d32" },
            ]}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            DISTRIBUCIÓN POR CATEGORÍA
          </Typography>
          <RechartsPieChart data={pieData} />
        </Grid>
      </Grid>

      {/* Tabla eficiencia responsables */}
      <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
        EFICIENCIA DE RESPONSABLES
      </Typography>
      <EficienciaTable rows={data.eficienciaResponsables} onRowClick={onResponsableClick} />
    </Box>
  );
}

MetricasTabGlobal.propTypes = {
  data: PropTypes.object,
  loading: PropTypes.bool.isRequired,
  onResponsableClick: PropTypes.func.isRequired,
};
