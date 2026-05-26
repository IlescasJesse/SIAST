import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  LinearProgress,
  Alert,
  Button,
  Divider,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import { subDays, format } from "date-fns";
import { useNotifStore } from "../../store/notificaciones.js";
import { getMetricas } from "../../api/metricas.js";
import { DateRangeFilter } from "./DateRangeFilter.jsx";
import { MetricasTabGlobal } from "./MetricasTabGlobal.jsx";
import { MetricasTabResponsable } from "./MetricasTabResponsable.jsx";
import { MetricasTabTecnico } from "./MetricasTabTecnico.jsx";
import PropTypes from "prop-types";

const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
];
const ROLES_TECNICO = [
  "TECNICO_TI",
  "TECNICO_REDES",
  "TECNICO_ELECTRICISTA",
  "TECNICO_PLOMERO",
  "TECNICO_MOVILIDAD",
];

/**
 * Mapea el tab activo al tipo de métrica esperado por el backend.
 * tab 0 → "area" (Global), tab 1 → "tecnico" (Por Responsable), tab 2 → "proceso" (Por Técnico)
 */
function tipoFromTab(tab) {
  if (tab === 0) return "area";
  if (tab === 1) return "tecnico";
  return "proceso";
}

/**
 * Sección de métricas operacionales dentro de DashboardPage.
 * Gestiona el estado de tabs, filtro de fechas, y refetch por ticketsVersion.
 */
export function MetricasOperacionalesSection({ rol, areaSoporteId, userId }) {
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  // Determinar tab inicial según rol
  const initialTab = useMemo(() => {
    if (ROLES_RESPONSABLE.includes(rol)) return 1;
    if (ROLES_TECNICO.includes(rol)) return 2;
    return 0; // ADMIN / MESA_AYUDA
  }, [rol]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedAreaId, setSelectedAreaId] = useState(areaSoporteId ?? null);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState(null);

  // Determinar visibilidad de tabs según rol
  const showGlobal = rol === "ADMIN" || rol === "MESA_AYUDA";
  const showResponsable = showGlobal || ROLES_RESPONSABLE.includes(rol);
  const showTecnico = showGlobal || ROLES_TECNICO.includes(rol);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const tipo = tipoFromTab(activeTab);
    const params = {
      tipo,
      fechaInicio: format(dateRange.start, "yyyy-MM-dd"),
      fechaFin: format(dateRange.end, "yyyy-MM-dd"),
      ...(tipo === "tecnico" && selectedAreaId ? { areaId: selectedAreaId } : {}),
      ...(tipo === "proceso" && selectedTecnicoId
        ? { tecnicoId: selectedTecnicoId }
        : tipo === "proceso" && userId
          ? { tecnicoId: userId }
          : {}),
    };

    getMetricas(params, controller.signal)
      .then(setData)
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        setError(err?.response?.data?.error ?? "Error al cargar métricas");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ticketsVersion, dateRange.start, dateRange.end, activeTab, selectedAreaId, selectedTecnicoId, userId]);

  // Drill-down: click en responsable desde Tab Global → Tab Por Responsable
  const handleResponsableClick = (row) => {
    setSelectedAreaId(row.areaSoporteId);
    setActiveTab(1);
  };

  // Drill-down: click en técnico desde Tab Por Responsable → Tab Por Técnico
  const handleTecnicoClick = (row) => {
    setSelectedTecnicoId(row.id);
    setActiveTab(2);
  };

  return (
    <Box sx={{ mt: 4 }}>
      {/* Divisor */}
      <Divider sx={{ mb: 3 }} />

      {/* Encabezado de sección */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          "@media print": { mb: 1 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <BarChartIcon sx={{ color: "primary.main" }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Métricas Operacionales
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Últimos 30 días · actualización en tiempo real
            </Typography>
          </Box>
        </Box>
        <Box sx={{ "@media print": { display: "none" } }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </Box>
      </Box>

      {/* LinearProgress durante refetch (D-16 UI-SPEC) */}
      <Box sx={{ height: 2, mb: 1 }}>
        {loading && <LinearProgress sx={{ height: 2 }} />}
      </Box>

      {/* Tabs (ocultos en print — todos los panels se muestran) */}
      <Box
        sx={{ borderBottom: 1, borderColor: "divider", "@media print": { display: "none" } }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
        >
          {showGlobal && <Tab label="Global" value={0} />}
          {showResponsable && <Tab label="Por Responsable" value={1} />}
          {showTecnico && <Tab label="Por Técnico" value={2} />}
        </Tabs>
      </Box>

      {/* Error state */}
      {error && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button size="small" onClick={() => setError(null)}>
              Reintentar
            </Button>
          }
        >
          <Typography variant="body2" fontWeight={600}>
            No se pudieron cargar las métricas
          </Typography>
          <Typography variant="caption">{error}</Typography>
        </Alert>
      )}

      {/* Tab panels */}
      {!error && (
        <Box sx={{ mt: 3 }}>
          {/* Tab Global — solo ADMIN/MESA_AYUDA */}
          {showGlobal && (
            <Box
              sx={{
                display: activeTab === 0 ? "block" : "none",
                "@media print": { display: "block" },
              }}
            >
              <MetricasTabGlobal
                data={data?.tipo === "area" ? data : null}
                loading={loading && activeTab === 0}
                onResponsableClick={handleResponsableClick}
              />
            </Box>
          )}

          {/* Tab Por Responsable */}
          {showResponsable && (
            <Box
              sx={{
                display: activeTab === 1 ? "block" : "none",
                "@media print": { display: "block", mt: 4 },
              }}
            >
              <MetricasTabResponsable
                data={data?.tipo === "tecnico" ? data : null}
                loading={loading && activeTab === 1}
                onTecnicoClick={handleTecnicoClick}
              />
            </Box>
          )}

          {/* Tab Por Técnico */}
          {showTecnico && (
            <Box
              sx={{
                display: activeTab === 2 ? "block" : "none",
                "@media print": { display: "block", mt: 4 },
              }}
            >
              <MetricasTabTecnico
                data={data?.tipo === "proceso" ? data : null}
                loading={loading && activeTab === 2}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Print: mostrar rango de fechas como texto */}
      <Box sx={{ display: "none", "@media print": { display: "block", mt: 2 } }}>
        <Typography variant="caption" color="text.secondary">
          Período: {format(dateRange.start, "dd/MM/yyyy")} — {format(dateRange.end, "dd/MM/yyyy")}
        </Typography>
      </Box>
    </Box>
  );
}

MetricasOperacionalesSection.propTypes = {
  rol: PropTypes.string.isRequired,
  areaSoporteId: PropTypes.number,
  userId: PropTypes.number,
};
