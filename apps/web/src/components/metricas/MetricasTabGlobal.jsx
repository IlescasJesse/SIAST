import {
  Grid, Card, CardContent, Typography, Box, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { RechartsBarChart } from "./RechartsBarChart.jsx";
import { RechartsPieChart } from "./RechartsPieChart.jsx";
import { SlaIndicator } from "./SlaIndicator.jsx";
import { EficienciaTable } from "./EficienciaTable.jsx";
import { formatLabel } from "./utils.js";
import PropTypes from "prop-types";

// Colores por categoría (UI-SPEC)
const CAT_COLORS = {
  TECNOLOGIAS: "#1565c0",
  SERVICIOS: "#2e7d32",
  RECURSOS_MATERIALES: "#e65100",
};

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
    area: formatLabel(a.areaNombre),
    Total: a.total,
    Resueltos: a.resueltos,
    SinAsignar: a.sinAsignar,
  }));

  const totalAreaSum = barDataArea.reduce((s, r) => s + r.Total, 0);
  const totalResueltosSum = barDataArea.reduce((s, r) => s + r.Resueltos, 0);
  const totalSinAsignarSum = barDataArea.reduce((s, r) => s + r.SinAsignar, 0);

  const pieData = data.distribucionCategoria.map((c) => ({
    name: formatLabel(c.categoria),
    value: c.total,
    color: CAT_COLORS[c.categoria] ?? "#9e9e9e",
  }));

  const estadoPieData = data.distribucionEstado.map((c) => ({
    name: formatLabel(c.categoria),
    value: c.total,
    color: ESTADO_COLORS[c.categoria] ?? "#9e9e9e",
  }));

  return (
    <Box sx={{ "@media print": { "& .no-print": { display: "none" } } }}>
      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<ConfirmationNumberIcon />}
            label="Total solicitudes"
            value={data.totalTickets}
            color="#9d2449"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<HourglassEmptyIcon />}
            label="SIN ASIGNAR"
            value={data.ticketsSinAsignar}
            color="#1565c0"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<CheckCircleIcon />}
            label="Resueltos"
            value={data.ticketsResueltos}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            icon={<HourglassEmptyIcon />}
            label="Activos"
            value={data.ticketsActivos}
            color="#ea580c"
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
            SOLICITUDES POR ÁREA (TABLA)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  {["Área", "Total", "Resueltos", "Sin asignar", "Pendientes"].map((h) => (
                    <TableCell key={h} sx={{ color: "common.white", fontWeight: 700, fontSize: 12 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {barDataArea.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Sin datos para el período seleccionado
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {barDataArea.map((row) => (
                      <TableRow
                        key={row.area}
                        sx={{ "&:hover": { bgcolor: "primary.main", opacity: 0.04 }, "& td": { fontSize: 13 } }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {row.area}
                          </Typography>
                        </TableCell>
                        <TableCell>{row.Total}</TableCell>
                        <TableCell sx={{ color: "#2e7d32", fontWeight: 600 }}>{row.Resueltos}</TableCell>
                        <TableCell sx={{ color: "#1565c0", fontWeight: 600 }}>{row.SinAsignar}</TableCell>
                        <TableCell>{row.Total - row.Resueltos}</TableCell>
                      </TableRow>
                    ))}
                    {/* Fila: TOTAL */}
                    <TableRow sx={{ bgcolor: "grey.100", "& td": { fontSize: 13, fontWeight: 700 } }}>
                      <TableCell>TOTAL</TableCell>
                      <TableCell>{totalAreaSum}</TableCell>
                      <TableCell sx={{ color: "#2e7d32" }}>{totalResueltosSum}</TableCell>
                      <TableCell sx={{ color: "#1565c0" }}>{totalSinAsignarSum}</TableCell>
                      <TableCell>{totalAreaSum - totalResueltosSum}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
            DISTRIBUCIÓN POR CATEGORÍA
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
