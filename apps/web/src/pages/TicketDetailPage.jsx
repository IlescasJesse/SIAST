import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Grid, Box, Card, CardContent, Typography, Chip, Divider,
  Button, TextField, CircularProgress, Alert, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getTicket, cambiarEstado, asignarTicket, agregarComentario } from "../api/tickets.js";
import { getTecnicos } from "../api/catalogos.js";
import { StatusChip } from "../components/common/StatusChip.jsx";
import { PriorityChip } from "../components/common/PriorityChip.jsx";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";
import { useAuthStore } from "../store/auth.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LABEL_PISO } from "@stf/shared";

const TRANSICIONES = {
  ABIERTO: ["ASIGNADO", "CANCELADO"],
  ASIGNADO: ["EN_PROGRESO", "CANCELADO"],
  EN_PROGRESO: ["RESUELTO", "CANCELADO"],
  RESUELTO: [],
  CANCELADO: [],
};

const ESTADO_LABEL = { ABIERTO: "Abierto", ASIGNADO: "Asignado", EN_PROGRESO: "En Progreso", RESUELTO: "Resuelto", CANCELADO: "Cancelado" };

export const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comentario, setComentario] = useState("");
  const [dialogEstado, setDialogEstado] = useState(null);
  const [dialogTecnico, setDialogTecnico] = useState(false);
  const [tecnicoSel, setTecnicoSel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, tec] = await Promise.all([getTicket(id), getTecnicos()]);
      setTicket(t);
      setTecnicos(tec.data ?? []);
    } catch { setError("Error al cargar el ticket"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleEstado = async () => {
    setSaving(true);
    try {
      await cambiarEstado(id, dialogEstado, comentario || undefined);
      setDialogEstado(null);
      setComentario("");
      load();
    } finally { setSaving(false); }
  };

  const handleAsignar = async () => {
    if (!tecnicoSel) return;
    setSaving(true);
    try {
      await asignarTicket(id, tecnicoSel);
      setDialogTecnico(false);
      load();
    } finally { setSaving(false); }
  };

  const handleComentario = async (e) => {
    e.preventDefault();
    if (!comentario.trim()) return;
    setSaving(true);
    try {
      await agregarComentario(id, comentario);
      setComentario("");
      load();
    } finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!ticket) return null;

  const canActuar = ["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS"].includes(user?.rol);
  const transiciones = TRANSICIONES[ticket.estado] ?? [];

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Volver
      </Button>

      <Grid container spacing={2} sx={{ height: "calc(100vh - 140px)" }}>
        {/* Panel izquierdo */}
        <Grid item xs={12} md={6} sx={{ overflowY: "auto", height: "100%" }}>
          <Card>
            <CardContent>
              {/* Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">TICKET #{ticket.id}</Typography>
                  <Typography variant="h6" fontWeight={700}>{ticket.asunto}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <StatusChip estado={ticket.estado} />
                  <PriorityChip prioridad={ticket.prioridad} />
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, p: 1.5, bgcolor: "rgba(0,0,0,0.03)", borderRadius: 1 }}>
                {ticket.descripcion}
              </Typography>

              <Grid container spacing={1} sx={{ mb: 2 }}>
                {[
                  ["Empleado", ticket.empleado?.nombreCompleto ?? ticket.empleadoRfc],
                  ["RFC", ticket.empleadoRfc],
                  ["Área", ticket.area?.label],
                  ["Piso", LABEL_PISO[ticket.piso] ?? ticket.piso],
                  ["Categoría", ticket.subcategoria?.replace("_", " ")],
                  ["Técnico", ticket.tecnico ? `${ticket.tecnico.nombre} ${ticket.tecnico.apellidos}` : "Sin asignar"],
                  ["Creado", format(new Date(ticket.createdAt), "dd/MM/yyyy HH:mm", { locale: es })],
                  ticket.fechaResolucion && ["Resuelto", format(new Date(ticket.fechaResolucion), "dd/MM/yyyy HH:mm", { locale: es })],
                ].filter(Boolean).map(([k, v]) => (
                  <Grid item xs={6} key={k}>
                    <Typography variant="caption" color="text.secondary">{k}</Typography>
                    <Typography variant="body2">{v}</Typography>
                  </Grid>
                ))}
              </Grid>

              {/* Acciones */}
              {canActuar && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                  {user?.rol === "ADMIN" && (
                    <Button size="small" variant="outlined" onClick={() => setDialogTecnico(true)}>
                      Asignar técnico
                    </Button>
                  )}
                  {transiciones.map((estado) => (
                    <Button
                      key={estado}
                      size="small"
                      variant={estado === "CANCELADO" ? "outlined" : "contained"}
                      color={estado === "CANCELADO" ? "error" : "primary"}
                      onClick={() => setDialogEstado(estado)}
                    >
                      {ESTADO_LABEL[estado]}
                    </Button>
                  ))}
                </Box>
              )}
              {user?.rol === "EMPLEADO" && ticket.estado === "ABIERTO" && (
                <Button size="small" variant="outlined" color="error" onClick={() => setDialogEstado("CANCELADO")} sx={{ mb: 2 }}>
                  Cancelar ticket
                </Button>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Historial */}
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Historial</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
                {(ticket.historial ?? []).map((h) => (
                  <Box key={h.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main", mt: 0.7, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="body2">
                        <strong>{ESTADO_LABEL[h.estadoNuevo]}</strong>
                        {h.estadoAnterior && ` (antes: ${ESTADO_LABEL[h.estadoAnterior]})`}
                      </Typography>
                      {h.comentario && <Typography variant="caption" color="text.secondary">{h.comentario}</Typography>}
                      <Typography variant="caption" color="text.disabled" display="block">
                        {format(new Date(h.createdAt), "dd/MM HH:mm", { locale: es })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Comentarios */}
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Comentarios</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                {(ticket.comentarios ?? []).map((c) => (
                  <Box key={c.id} sx={{ display: "flex", gap: 1.5 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: "primary.dark" }}>
                      {(c.usuario?.nombre?.[0] ?? "U").toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <Typography variant="caption" fontWeight={600}>{c.usuario?.nombre}</Typography>
                        {c.esInterno && <Chip label="Interno" size="small" sx={{ height: 14, fontSize: 10 }} />}
                        <Typography variant="caption" color="text.disabled">
                          {format(new Date(c.createdAt), "dd/MM HH:mm", { locale: es })}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{c.texto}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {canActuar && (
                <Box component="form" onSubmit={handleComentario} sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Agregar comentario..."
                    size="small" fullWidth multiline maxRows={3}
                  />
                  <Button type="submit" variant="contained" disabled={!comentario.trim() || saving} sx={{ alignSelf: "flex-end" }}>
                    Enviar
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Panel 3D */}
        <Grid item xs={12} md={6} sx={{ height: "100%" }}>
          <BuildingViewer
            autoHighlight={ticket.areaId ? { floor: ticket.area?.floor ?? 0, roomId: ticket.areaId } : undefined}
            sx={{ height: "100%" }}
          />
        </Grid>
      </Grid>

      {/* Dialog cambio de estado */}
      <Dialog open={Boolean(dialogEstado)} onClose={() => setDialogEstado(null)}>
        <DialogTitle>Cambiar estado a: {ESTADO_LABEL[dialogEstado]}</DialogTitle>
        <DialogContent>
          <TextField
            label="Comentario (opcional)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            fullWidth multiline rows={3} sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogEstado(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEstado} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog asignar técnico */}
      <Dialog open={dialogTecnico} onClose={() => setDialogTecnico(false)}>
        <DialogTitle>Asignar técnico</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Técnico</InputLabel>
            <Select value={tecnicoSel} label="Técnico" onChange={(e) => setTecnicoSel(e.target.value)}>
              {tecnicos.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre} {t.apellidos} ({t.rol})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogTecnico(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAsignar} disabled={!tecnicoSel || saving}>
            {saving ? <CircularProgress size={18} /> : "Asignar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
