import { useEffect, useState } from "react";
import {
  Grid, Card, CardContent, Typography, Box, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, MenuItem, Select, FormControl, InputLabel,
  CircularProgress,
} from "@mui/material";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";
import { getTickets } from "../api/tickets.js";
import { getTecnicos } from "../api/catalogos.js";
import { asignarTicket } from "../api/tickets.js";
import { StatusChip } from "../components/common/StatusChip.jsx";
import { PriorityChip } from "../components/common/PriorityChip.jsx";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const StatCard = ({ icon, label, value, color }) => (
  <Card>
    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: "16px !important" }}>
      <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${color}22`, color }}>{icon}</Box>
      <Box>
        <Typography variant="h4" fontWeight={700}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>
    </CardContent>
  </Card>
);

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);
  const [data, setData] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [ticketsRes, tecRes] = await Promise.all([
        getTickets({ limit: 50, estado: filtroEstado || undefined }),
        getTecnicos(),
      ]);
      setData(ticketsRes);
      setTecnicos(tecRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filtroEstado, ticketsVersion]);

  const stats = data
    ? {
        abiertos: data.tickets.filter((t) => t.estado === "ABIERTO").length,
        pendientes: data.tickets.filter((t) => ["ASIGNADO", "EN_PROGRESO"].includes(t.estado)).length,
        resueltos: data.tickets.filter((t) => t.estado === "RESUELTO").length,
        urgentes: data.tickets.filter((t) => t.prioridad === "URGENTE" && t.estado !== "RESUELTO" && t.estado !== "CANCELADO").length,
      }
    : null;

  const handleAsignar = async (ticketId, tecnicoId) => {
    try {
      await asignarTicket(ticketId, tecnicoId);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {user?.rol === "ADMIN" ? "Panel de Administración" : "Mis Tickets"}
      </Typography>

      {/* Stats */}
      {stats && user?.rol === "ADMIN" && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}><StatCard icon={<ConfirmationNumberIcon />} label="Abiertos" value={stats.abiertos} color="#1565c0" /></Grid>
          <Grid item xs={6} sm={3}><StatCard icon={<HourglassEmptyIcon />} label="En atención" value={stats.pendientes} color="#e65100" /></Grid>
          <Grid item xs={6} sm={3}><StatCard icon={<CheckCircleIcon />} label="Resueltos" value={stats.resueltos} color="#2e7d32" /></Grid>
          <Grid item xs={6} sm={3}><StatCard icon={<ReportProblemIcon />} label="Urgentes" value={stats.urgentes} color="#c62828" /></Grid>
        </Grid>
      )}

      {/* Filtro */}
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={filtroEstado} label="Estado" onChange={(e) => setFiltroEstado(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {["ABIERTO", "ASIGNADO", "EN_PROGRESO", "RESUELTO", "CANCELADO"].map((e) => (
              <MenuItem key={e} value={e}>{e}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Tabla */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Asunto</TableCell>
                <TableCell>Categoría</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Prioridad</TableCell>
                {user?.rol === "ADMIN" && <TableCell>Asignado a</TableCell>}
                <TableCell>Fecha</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.tickets ?? []).map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace" }}>#{ticket.id}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Typography variant="body2" noWrap>{ticket.asunto}</Typography>
                    <Typography variant="caption" color="text.secondary">{ticket.area?.label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{ticket.subcategoria?.replace("_", " ")}</Typography>
                  </TableCell>
                  <TableCell><StatusChip estado={ticket.estado} /></TableCell>
                  <TableCell><PriorityChip prioridad={ticket.prioridad} /></TableCell>
                  {user?.rol === "ADMIN" && (
                    <TableCell>
                      <Select
                        size="small"
                        value={ticket.tecnicoId ?? ""}
                        displayEmpty
                        onChange={(e) => handleAsignar(ticket.id, e.target.value)}
                        sx={{ fontSize: 12, minWidth: 130 }}
                      >
                        <MenuItem value=""><em>Sin asignar</em></MenuItem>
                        {tecnicos.map((t) => (
                          <MenuItem key={t.id} value={t.id}>{t.nombre} {t.apellidos}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  )}
                  <TableCell sx={{ color: "text.secondary", fontSize: 12, whiteSpace: "nowrap" }}>
                    {format(new Date(ticket.createdAt), "dd MMM HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Ver detalle">
                      <IconButton size="small" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
