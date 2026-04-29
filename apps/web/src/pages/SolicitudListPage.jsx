import { useEffect, useState } from "react";
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Tooltip, FormControl, InputLabel,
  Select, MenuItem, TextField, InputAdornment, CircularProgress, Chip,
  Button,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useNavigate } from "react-router-dom";
import { getSolicitudes } from "../api/solicitudes.js";
import { StatusChip } from "../components/common/StatusChip.jsx";
import { PriorityChip } from "../components/common/PriorityChip.jsx";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import { LABEL_SUBCATEGORIA } from "@stf/shared";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ESTADO_LABEL = {
  ABIERTO: "Abierto", ASIGNADO: "Asignado", EN_PROGRESO: "En Progreso",
  RESUELTO: "Resuelto", CANCELADO: "Cancelado",
};

const ESTADOS = ["ABIERTO", "ASIGNADO", "EN_PROGRESO", "RESUELTO", "CANCELADO"];
const PRIORIDADES = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

export const SolicitudListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await getSolicitudes({
        limit: 100,
        estado: filtroEstado || undefined,
      });
      setSolicitudes(res.tickets ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filtroEstado, filtroPrioridad, ticketsVersion]);

  const ESTADOS_FINALES = ["RESUELTO", "CANCELADO"];

  const filtrados = solicitudes.filter((t) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      t.asunto?.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      t.folio?.toLowerCase().includes(q) ||
      t.empleadoRfc?.toLowerCase().includes(q) ||
      t.empleado?.nombreCompleto?.toLowerCase().includes(q)
    );
  });

  const filtradosConPrioridad = filtroPrioridad
    ? filtrados.filter((t) => t.prioridad === filtroPrioridad)
    : filtrados;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Solicitudes</Typography>
        {["ADMIN", "MESA_AYUDA"].includes(user?.rol) || user?.rol === "EMPLEADO" ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/solicitudes/nueva")} size="small">
            Nueva Solicitud
          </Button>
        ) : null}
      </Box>

      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Buscar por asunto, folio, RFC..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={filtroEstado} label="Estado" onChange={(e) => setFiltroEstado(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {ESTADOS.map((e) => <MenuItem key={e} value={e}>{ESTADO_LABEL[e] ?? e}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Prioridad</InputLabel>
          <Select value={filtroPrioridad} label="Prioridad" onChange={(e) => setFiltroPrioridad(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {PRIORIDADES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>
        {(filtroEstado || filtroPrioridad || busqueda) && (
          <Button size="small" onClick={() => { setFiltroEstado(""); setFiltroPrioridad(""); setBusqueda(""); }}>
            Limpiar filtros
          </Button>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        {filtradosConPrioridad.length} solicitud{filtradosConPrioridad.length !== 1 ? "es" : ""}
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Asunto</TableCell>
                <TableCell>Categoría</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Prioridad</TableCell>
                {user?.rol !== "EMPLEADO" && <TableCell>Empleado</TableCell>}
                {["ADMIN", "MESA_AYUDA"].includes(user?.rol) && <TableCell>Técnico</TableCell>}
                <TableCell>Fecha</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtradosConPrioridad.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No hay solicitudes que coincidan
                  </TableCell>
                </TableRow>
              ) : (() => {
                const primerFinalIdx = filtradosConPrioridad.findIndex((t) =>
                  ESTADOS_FINALES.includes(t.estado)
                );
                return filtradosConPrioridad.map((solicitud, idx) => {
                  const esFinal = ESTADOS_FINALES.includes(solicitud.estado);
                  const esPrimerFinal = idx === primerFinalIdx;
                  return [
                    esPrimerFinal && (
                      <TableRow key="separator-finales">
                        <TableCell
                          colSpan={99}
                          sx={{ bgcolor: "grey.50", py: 0.5, borderTop: "2px solid", borderColor: "divider" }}
                        >
                          <Typography variant="caption" color="text.disabled" fontWeight={700} letterSpacing={1}>
                            RESUELTAS / CANCELADAS
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ),
                    <TableRow
                      key={solicitud.id}
                      hover
                      sx={{ cursor: "pointer", opacity: esFinal ? 0.75 : 1 }}
                      onClick={() => navigate(`/solicitudes/${solicitud.id}`)}
                    >
                      <TableCell>
                        <Chip
                          label={solicitud.folio ?? "—"}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" noWrap>{solicitud.asunto}</Typography>
                        <Typography variant="caption" color="text.secondary">{solicitud.area?.label}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{LABEL_SUBCATEGORIA[solicitud.subcategoria] ?? solicitud.subcategoria}</Typography>
                      </TableCell>
                      <TableCell><StatusChip estado={solicitud.estado} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <PriorityChip prioridad={solicitud.prioridad} />
                          {solicitud.prioridad === "URGENTE" && (
                            <Tooltip title="Escalada por tiempo sin atención">
                              <AccessTimeIcon fontSize="small" sx={{ color: "error.main" }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      {user?.rol !== "EMPLEADO" && (
                        <TableCell>
                          <Typography variant="caption">{solicitud.empleado?.nombreCompleto ?? solicitud.empleadoRfc}</Typography>
                        </TableCell>
                      )}
                      {["ADMIN", "MESA_AYUDA"].includes(user?.rol) && (
                        <TableCell>
                          <Typography variant="caption" color={solicitud.tecnico ? "text.primary" : "text.disabled"}>
                            {solicitud.tecnico ? `${solicitud.tecnico.nombre} ${solicitud.tecnico.apellidos}` : "Sin asignar"}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell sx={{ color: "text.secondary", fontSize: 12, whiteSpace: "nowrap" }}>
                        {format(new Date(solicitud.createdAt), "dd MMM HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={() => navigate(`/solicitudes/${solicitud.id}`)}>
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>,
                  ];
                });
              })()}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
