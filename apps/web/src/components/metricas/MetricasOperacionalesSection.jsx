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
  TextField,
  InputAdornment,
  Chip,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";
import { subDays, format, differenceInCalendarDays, startOfDay, isEqual } from "date-fns";
import { es } from "date-fns/locale";
import { useNotifStore } from "../../store/notificaciones.js";
import { getMetricas } from "../../api/metricas.js";
import { getAreasSoporte, getUsuarios } from "../../api/admin.js";
import { DateRangeFilter } from "./DateRangeFilter.jsx";
import { MetricasTabGlobal } from "./MetricasTabGlobal.jsx";
import { MetricasTabResponsable } from "./MetricasTabResponsable.jsx";
import { MetricasTabTecnico } from "./MetricasTabTecnico.jsx";
import { formatLabel } from "./utils.js";
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

// Orden de sub-tabs de área: TI primero
const AREA_PRIORITY = ["TI", "TECNOLOG", "REDES", "MANTENIMIENTO", "RECURSOS"];

function sortAreas(areas) {
  return [...areas].sort((a, b) => {
    const upper = (s) => s.toUpperCase();
    const rank = (nombre) => {
      const idx = AREA_PRIORITY.findIndex((k) => upper(nombre).includes(k));
      return idx === -1 ? 99 : idx;
    };
    return rank(a.nombre) - rank(b.nombre);
  });
}

function tipoFromTab(tab) {
  if (tab === 0) return "area";
  if (tab === 1) return "tecnico";
  return "proceso";
}

export function MetricasOperacionalesSection({ rol, areaSoporteId, userId }) {
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [dateFilterActive, setDateFilterActive] = useState(false);

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setDateFilterActive(true);
  };

  const initialTab = useMemo(() => {
    if (ROLES_RESPONSABLE.includes(rol)) return 1;
    if (ROLES_TECNICO.includes(rol)) return 2;
    return 0;
  }, [rol]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedAreaId, setSelectedAreaId] = useState(areaSoporteId ?? null);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState(
    ROLES_TECNICO.includes(rol) ? userId : null,
  );
  const [areasSoporte, setAreasSoporte] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [searchTecnico, setSearchTecnico] = useState("");

  const showGlobal = rol === "ADMIN" || rol === "MESA_AYUDA";
  const showResponsable = showGlobal || ROLES_RESPONSABLE.includes(rol);
  const showTecnico = showGlobal || ROLES_TECNICO.includes(rol);
  const esTecnicoRol = ROLES_TECNICO.includes(rol);

  const sortedAreas = useMemo(() => sortAreas(areasSoporte), [areasSoporte]);

  // Cargar áreas y técnicos para ADMIN/MESA_AYUDA
  useEffect(() => {
    if (!showGlobal) return;
    getAreasSoporte()
      .then((areas) => {
        setAreasSoporte(areas);
        // Auto-seleccionar primera área (TI) si aún no hay selección
        if (!areaSoporteId && areas.length > 0) {
          const sorted = sortAreas(areas);
          setSelectedAreaId(sorted[0].id);
        }
      })
      .catch(() => {});
    getUsuarios()
      .then((all) =>
        setTecnicos(all.filter((u) => ROLES_TECNICO.includes(u.rol) && u.activo)),
      )
      .catch(() => {});
  }, [showGlobal, areaSoporteId]);

  // Fetch métricas
  useEffect(() => {
    const controller = new AbortController();
    const tipo = tipoFromTab(activeTab);
    const tecnicoIdFinal = esTecnicoRol ? userId : selectedTecnicoId;

    if (tipo === "tecnico" && !selectedAreaId) {
      setData(null);
      setLoading(false);
      return;
    }
    if (tipo === "proceso" && !tecnicoIdFinal) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = {
      tipo,
      ...(dateFilterActive
        ? {
            fechaInicio: format(dateRange.start, "yyyy-MM-dd"),
            fechaFin: format(dateRange.end, "yyyy-MM-dd"),
          }
        : {}),
      ...(tipo === "tecnico" ? { areaId: selectedAreaId } : {}),
      ...(tipo === "proceso" ? { tecnicoId: tecnicoIdFinal } : {}),
    };

    getMetricas(params, controller.signal)
      .then(setData)
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        setError(err?.response?.data?.error ?? "Error al cargar métricas");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    ticketsVersion,
    dateFilterActive,
    dateRange.start,
    dateRange.end,
    activeTab,
    selectedAreaId,
    selectedTecnicoId,
    userId,
    rol,
    esTecnicoRol,
  ]);

  const handleResponsableClick = (row) => {
    setSelectedAreaId(row.areaSoporteId);
    setActiveTab(1);
  };

  const handleTecnicoClick = (row) => {
    setSelectedTecnicoId(row.id);
    setActiveTab(2);
  };

  const subtitleText = useMemo(() => {
    if (!dateFilterActive) return "Todos los datos · actualización en tiempo real";

    const days = differenceInCalendarDays(dateRange.end, dateRange.start);
    const isToday = days === 0;
    const is7 = days === 7;
    const is30 = days === 30;
    const defStart = subDays(new Date(), 30);
    const defEnd = new Date();
    const isDefault =
      differenceInCalendarDays(dateRange.start, defStart) === 0 &&
      differenceInCalendarDays(dateRange.end, defEnd) === 0;

    if (isToday) return "Hoy · actualización en tiempo real";
    if (is7) return "Últimos 7 días · actualización en tiempo real";
    if (isDefault || is30) return "Últimos 30 días · actualización en tiempo real";

    return `Del ${format(dateRange.start, "d MMM", { locale: es })} al ${format(dateRange.end, "d MMM, yyyy", { locale: es })} · actualización en tiempo real`;
  }, [dateRange, dateFilterActive]);

  const tecnicosFiltrados = useMemo(() => {
    if (!searchTecnico.trim()) return tecnicos;
    const q = searchTecnico.toLowerCase();
    return tecnicos.filter((t) =>
      `${t.nombre} ${t.apellidos}`.toLowerCase().includes(q),
    );
  }, [tecnicos, searchTecnico]);

  return (
    <Box sx={{ mt: 1 }}>
      {/* Encabezado */}
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
              {subtitleText}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ "@media print": { display: "none" } }}>
          <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
        </Box>
      </Box>

      <Box sx={{ height: 2, mb: 1 }}>
        {loading && <LinearProgress sx={{ height: 2 }} />}
      </Box>

      {/* Tabs principales */}
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
          {showResponsable && <Tab label="Por Área" value={1} />}
          {showTecnico && <Tab label="Por Técnico" value={2} />}
        </Tabs>
      </Box>

      {/* Error */}
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
      <Box sx={{ mt: 3 }}>
          {/* ── Tab 0: Global ─────────────────────────────────────────────── */}
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

          {/* ── Tab 1: Por Área ─────────────────── */}
          {showResponsable && (
            <Box
              sx={{
                display: activeTab === 1 ? "block" : "none",
                "@media print": { display: "block", mt: 4 },
              }}
            >
              {/* Sub-tabs de área (solo ADMIN/MESA_AYUDA ven selector) */}
              {showGlobal && sortedAreas.length > 0 && (
                <Box
                  sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    mb: 3,
                    "@media print": { display: "none" },
                  }}
                >
                  <Tabs
                    value={selectedAreaId ?? false}
                    onChange={(_, v) => setSelectedAreaId(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    indicatorColor="secondary"
                    textColor="secondary"
                    sx={{ minHeight: 40 }}
                  >
                    {sortedAreas.map((a) => (
                      <Tab
                        key={a.id}
                        label={formatLabel(a.nombre)}
                        value={a.id}
                        sx={{ fontSize: 12, minHeight: 40, py: 0.5 }}
                      />
                    ))}
                  </Tabs>
                </Box>
              )}

              <MetricasTabResponsable
                data={data?.tipo === "tecnico" ? data : null}
                loading={loading && activeTab === 1}
                onTecnicoClick={handleTecnicoClick}
              />
            </Box>
          )}

          {/* ── Tab 2: Por Técnico ─────────────────────────────────────────── */}
          {showTecnico && (
            <Box
              sx={{
                display: activeTab === 2 ? "block" : "none",
                "@media print": { display: "block", mt: 4 },
              }}
            >
              {/* Selector de técnico — solo ADMIN/MESA_AYUDA */}
              {showGlobal && (
                <Box sx={{ mb: 3 }}>
                  <TextField
                    size="small"
                    placeholder="Buscar técnico por nombre…"
                    value={searchTecnico}
                    onChange={(e) => setSearchTecnico(e.target.value)}
                    sx={{ mb: 1.5, maxWidth: 360 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {tecnicosFiltrados.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Sin técnicos encontrados
                      </Typography>
                    ) : (
                      tecnicosFiltrados.map((t) => (
                        <Chip
                          key={t.id}
                          label={`${t.nombre} ${t.apellidos}`}
                          onClick={() => setSelectedTecnicoId(t.id)}
                          color={selectedTecnicoId === t.id ? "primary" : "default"}
                          variant={selectedTecnicoId === t.id ? "filled" : "outlined"}
                          size="small"
                          sx={{ cursor: "pointer" }}
                        />
                      ))
                    )}
                  </Box>
                  {selectedTecnicoId && (
                    <Divider sx={{ mt: 2, mb: 0 }} />
                  )}
                </Box>
              )}

              {/* Métricas del técnico seleccionado */}
              {(esTecnicoRol || selectedTecnicoId) ? (
                <MetricasTabTecnico
                  data={data?.tipo === "proceso" ? data : null}
                  loading={loading && activeTab === 2}
                />
              ) : (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Selecciona un técnico para ver sus métricas.
                </Typography>
              )}
            </Box>
          )}
        </Box>

      {/* Print: rango de fechas */}
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
