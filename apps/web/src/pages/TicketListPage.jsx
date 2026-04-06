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
import { useNavigate } from "react-router-dom";
import { getTickets } from "../api/tickets.js";
import { StatusChip } from "../components/common/StatusChip.jsx";
import { PriorityChip } from "../components/common/PriorityChip.jsx";
import { useAuthStore } from "../store/auth.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ESTADOS = ["ABIERTO", "ASIGNADO", "EN_PROGRESO", "RESUELTO", "CANCELADO"];
const PRIORIDADES = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

export const TicketListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTickets({
        limit: 100,
        estado: filtroEstado || undefined,
        prioridad: filtroPrioridad || undefined,
      });
      setTickets(res.tickets ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filtroEstado, filtroPrioridad]);

  const filtrados = tickets.filter((t) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      t.asunto?.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      t.empleadoRfc?.toLowerCase().includes(q) ||
      t.empleado?.nombreCompleto?.toLowerCase().includes(q)
    );
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Tickets</Typography>
        {["ADMIN", "MESA_AYUDA"].includes(user?.rol) || user?.rol === "EMPLEADO" ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/tickets/nuevo")} size="small">
            Nuevo Ticket
          </Button>
        ) : null}
      </Box>

      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Buscar por asunto, RFC, #ID..."
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
            {ESTADOS.map((e) => <MenuItem key={e} value={e}>{e.replace("_", " ")}</MenuItem>)}
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
        {filtrados.length} ticket{filtrados.length !== 1 ? "s" : ""}
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
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
                {user?.rol !== "EMPLEADO" && <TableCell>Empleado</TableCell>}
                {["ADMIN", "MESA_AYUDA"].includes(user?.rol) && <TableCell>Técnico</TableCell>}
                <TableCell>Fecha</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No hay tickets que coincidan
                  </TableCell>
                </TableRow>
              ) : filtrados.map((ticket) => (
                <TableRow key={ticket.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace" }}>#{ticket.id}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography variant="body2" noWrap>{ticket.asunto}</Typography>
                    <Typography variant="caption" color="text.secondary">{ticket.area?.label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{ticket.subcategoria?.replace("_", " ")}</Typography>
                  </TableCell>
                  <TableCell><StatusChip estado={ticket.estado} /></TableCell>
                  <TableCell><PriorityChip prioridad={ticket.prioridad} /></TableCell>
                  {user?.rol !== "EMPLEADO" && (
                    <TableCell>
                      <Typography variant="caption">{ticket.empleado?.nombreCompleto ?? ticket.empleadoRfc}</Typography>
                    </TableCell>
                  )}
                  {["ADMIN", "MESA_AYUDA"].includes(user?.rol) && (
                    <TableCell>
                      <Typography variant="caption" color={ticket.tecnico ? "text.primary" : "text.disabled"}>
                        {ticket.tecnico ? `${ticket.tecnico.nombre} ${ticket.tecnico.apellidos}` : "Sin asignar"}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell sx={{ color: "text.secondary", fontSize: 12, whiteSpace: "nowrap" }}>
                    {format(new Date(ticket.createdAt), "dd MMM HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
