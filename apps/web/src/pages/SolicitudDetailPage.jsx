import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Grid, Box, Card, CardContent, Typography, Chip, Divider,
  Button, TextField, CircularProgress, Alert, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel,
  Stepper, Step, StepLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getSolicitud, cambiarEstado, asignarSolicitud, agregarComentario, completarPaso, asignarPaso } from "../api/solicitudes.js";
import { getTecnicos, getDisponibilidadTecnico } from "../api/catalogos.js";
import { StatusChip } from "../components/common/StatusChip.jsx";
import { PriorityChip } from "../components/common/PriorityChip.jsx";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";
import { useAuthStore } from "../store/auth.js";
import { useNotifStore } from "../store/notificaciones.js";
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

// Pasos del stepper según categoría
const PASOS_TECNOLOGIAS_SERVICIOS = ["ABIERTO", "ASIGNADO", "EN_PROGRESO", "RESUELTO"];
const PASOS_RECURSOS = ["ABIERTO", "ASIGNADO", "EN_PROGRESO", "RESUELTO"];

const PASO_LABEL_TECNOLOGIAS = { ABIERTO: "Abierto", ASIGNADO: "Asignado", EN_PROGRESO: "En progreso", RESUELTO: "Resuelto" };
const PASO_LABEL_SERVICIOS   = { ABIERTO: "Abierto", ASIGNADO: "Asignado", EN_PROGRESO: "En progreso", RESUELTO: "Resuelto" };
const PASO_LABEL_RECURSOS    = { ABIERTO: "Abierto", ASIGNADO: "En gestión", EN_PROGRESO: "Procesando", RESUELTO: "Entregado" };

function getPasosYLabels(categoria) {
  if (categoria?.includes("RECURSOS")) return { pasos: PASOS_RECURSOS, labels: PASO_LABEL_RECURSOS };
  if (categoria?.includes("SERVICIOS")) return { pasos: PASOS_TECNOLOGIAS_SERVICIOS, labels: PASO_LABEL_SERVICIOS };
  return { pasos: PASOS_TECNOLOGIAS_SERVICIOS, labels: PASO_LABEL_TECNOLOGIAS };
}

function getActiveStep(estado, pasos) {
  const idx = pasos.indexOf(estado);
  return idx >= 0 ? idx : 0;
}

function getTransicionLabel(estadoActual, estadoSiguiente, categoria) {
  const categoria_ = categoria ?? "";

  if (estadoSiguiente === "CANCELADO") return "Cancelar solicitud";

  if (estadoActual === "ABIERTO" && estadoSiguiente === "ASIGNADO") return "Tomar solicitud";

  if (estadoActual === "ASIGNADO" && estadoSiguiente === "EN_PROGRESO") {
    if (categoria_.includes("TECNOLOGIAS")) return "Iniciar diagnóstico";
    if (categoria_.includes("SERVICIOS")) return "Iniciar servicio";
    if (categoria_.includes("RECURSOS")) return "Iniciar gestión";
    return "Iniciar atención";
  }

  if (estadoActual === "EN_PROGRESO" && estadoSiguiente === "RESUELTO") {
    if (categoria_.includes("TECNOLOGIAS")) return "Marcar como resuelta";
    if (categoria_.includes("SERVICIOS")) return "Servicio completado";
    if (categoria_.includes("RECURSOS")) return "Recursos entregados";
    return "Resolver solicitud";
  }

  return estadoSiguiente;
}

export const SolicitudDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ticketsVersion = useNotifStore((s) => s.ticketsVersion);
  const [solicitud, setSolicitud] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comentario, setComentario] = useState("");
  const [dialogEstado, setDialogEstado] = useState(null);
  const [dialogTecnico, setDialogTecnico] = useState(false);
  const [tecnicoSel, setTecnicoSel] = useState("");
  const [saving, setSaving] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [disponibilidadLoading, setDisponibilidadLoading] = useState(false);
  const [dialogCompletarPaso, setDialogCompletarPaso] = useState(null);
  const [notasPaso, setNotasPaso] = useState("");
  const [cantidadPaso, setCantidadPaso] = useState("");
  const [dialogAsignarPaso, setDialogAsignarPaso] = useState(null);
  const [tecnicoSelPaso, setTecnicoSelPaso] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const s = await getSolicitud(id);
      setSolicitud(s);
      // Cargar técnicos filtrados por la categoría de la solicitud
      const tec = await getTecnicos(s.categoria);
      setTecnicos(tec.data ?? []);
    } catch { setError("Error al cargar la solicitud"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id, ticketsVersion]);

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
      await asignarSolicitud(id, tecnicoSel);
      setDialogTecnico(false);
      setDisponibilidad(null);
      load();
    } finally { setSaving(false); }
  };

  const handleSeleccionarTecnico = async (tecnicoId) => {
    setTecnicoSel(tecnicoId);
    setDisponibilidad(null);
    const tecnico = tecnicos.find((t) => t.id === tecnicoId);
    if (!tecnico?.esEmpleadoEstructura || !tecnico?.empleadoId) return;
    setDisponibilidadLoading(true);
    try {
      const res = await getDisponibilidadTecnico(tecnico.empleadoId);
      setDisponibilidad(res);
    } catch {
      // Si falla la consulta de disponibilidad, no bloquear
    } finally {
      setDisponibilidadLoading(false);
    }
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

  const handleAsignarPaso = async () => {
    if (!dialogAsignarPaso || !tecnicoSelPaso) return;
    setSaving(true);
    try {
      await asignarPaso(id, dialogAsignarPaso.id, tecnicoSelPaso);
      setDialogAsignarPaso(null);
      setTecnicoSelPaso("");
      load();
    } finally { setSaving(false); }
  };

  const handleCompletarPaso = async () => {
    if (!dialogCompletarPaso) return;
    if (dialogCompletarPaso.labelUnidades && !cantidadPaso) return;
    setSaving(true);
    try {
      await completarPaso(id, dialogCompletarPaso.id, {
        notas: notasPaso || undefined,
        cantidadUnidades: cantidadPaso ? Number(cantidadPaso) : undefined,
      });
      setDialogCompletarPaso(null);
      setNotasPaso("");
      setCantidadPaso("");
      load();
    } finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!solicitud) return null;

  const canActuar = ["ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS", "GESTOR_RECURSOS_MATERIALES"].includes(user?.rol);
  const canComentar = canActuar || user?.rol === "MESA_AYUDA";
  const esAdminOMesa = ["ADMIN", "MESA_AYUDA"].includes(user?.rol);
  const transiciones = TRANSICIONES[solicitud.estado] ?? [];
  const { pasos, labels } = getPasosYLabels(solicitud.categoria);
  const activeStep = getActiveStep(solicitud.estado, pasos);
  const tecnicosFiltradosPaso = dialogAsignarPaso
    ? tecnicos.filter((t) => t.rol === dialogAsignarPaso.rolRequerido)
    : [];

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
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="h6" color="primary" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                      {solicitud.folio ?? `#${solicitud.id}`}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">/ #{solicitud.id}</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700}>{solicitud.asunto}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <StatusChip estado={solicitud.estado} />
                  <PriorityChip prioridad={solicitud.prioridad} />
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, p: 1.5, bgcolor: "rgba(0,0,0,0.03)", borderRadius: 1 }}>
                {solicitud.descripcion}
              </Typography>

              <Grid container spacing={1} sx={{ mb: 2 }}>
                {[
                  ["Empleado", solicitud.empleado?.nombreCompleto ?? solicitud.empleadoRfc],
                  ["RFC", solicitud.empleadoRfc],
                  ["Área", solicitud.area?.label],
                  ["Piso", LABEL_PISO[solicitud.piso] ?? solicitud.piso],
                  ["Categoría", solicitud.subcategoria?.replace("_", " ")],
                  ["Técnico", solicitud.tecnico ? `${solicitud.tecnico.nombre} ${solicitud.tecnico.apellidos}` : "Sin asignar"],
                  ["Creado", format(new Date(solicitud.createdAt), "dd/MM/yyyy HH:mm", { locale: es })],
                  solicitud.fechaResolucion && ["Resuelto", format(new Date(solicitud.fechaResolucion), "dd/MM/yyyy HH:mm", { locale: es })],
                ].filter(Boolean).map(([k, v]) => (
                  <Grid item xs={6} key={k}>
                    <Typography variant="caption" color="text.secondary">{k}</Typography>
                    <Typography variant="body2">{v}</Typography>
                  </Grid>
                ))}
              </Grid>

              {/* Flujo de la solicitud */}
              {!["CANCELADO"].includes(solicitud.estado) && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 1, letterSpacing: 0.5 }}>
                    FLUJO DE LA SOLICITUD
                  </Typography>
                  <Stepper activeStep={activeStep} alternativeLabel>
                    {pasos.map((paso) => (
                      <Step key={paso}>
                        <StepLabel>{labels[paso]}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
              )}

              {/* Pasos del proceso (solo para tickets con flujo multi-paso) */}
              {solicitud.pasos?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={700}
                    display="block" sx={{ mb: 1.5, letterSpacing: 0.5 }}>
                    FLUJO DE ATENCIÓN
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {solicitud.pasos.map((paso) => {
                      const esActivo = paso.estado === "EN_PROGRESO";
                      const esCompletado = paso.estado === "COMPLETADO";
                      const esPendiente = paso.estado === "PENDIENTE";
                      const esMiPaso = esActivo && paso.tecnicoId === user?.id;

                      return (
                        <Box
                          key={paso.id}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: esActivo ? "primary.main"
                              : esCompletado ? "success.main"
                              : "divider",
                            bgcolor: esActivo ? "primary.50"
                              : esCompletado ? "success.50"
                              : "background.paper",
                            opacity: esPendiente ? 0.7 : 1,
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                            {/* Número de paso */}
                            <Box sx={{
                              width: 22, height: 22, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700,
                              bgcolor: esCompletado ? "success.main" : esActivo ? "primary.main" : "grey.300",
                              color: esCompletado || esActivo ? "white" : "text.secondary",
                              flexShrink: 0,
                            }}>
                              {esCompletado ? "✓" : paso.orden}
                            </Box>

                            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                              {paso.nombre ?? `Paso ${paso.orden}`}
                            </Typography>

                            {/* Chip de estado */}
                            <Chip
                              label={paso.estado === "EN_PROGRESO" ? "En progreso"
                                : paso.estado === "COMPLETADO" ? "Completado"
                                : "Pendiente"}
                              size="small"
                              color={paso.estado === "EN_PROGRESO" ? "primary"
                                : paso.estado === "COMPLETADO" ? "success"
                                : "default"}
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          </Box>

                          {/* Técnico asignado */}
                          {paso.tecnico && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Técnico: {paso.tecnico.nombre} {paso.tecnico.apellidos}
                            </Typography>
                          )}

                          {/* Fecha completado */}
                          {paso.completadoAt && (
                            <Typography variant="caption" color="text.disabled" display="block">
                              Completado: {format(new Date(paso.completadoAt), "dd/MM/yyyy HH:mm", { locale: es })}
                            </Typography>
                          )}

                          {/* Unidades atendidas */}
                          {paso.cantidadUnidades != null && paso.labelUnidades && (
                            <Chip
                              label={`${paso.cantidadUnidades} ${paso.labelUnidades}`}
                              size="small"
                              variant="outlined"
                              color="success"
                              sx={{ mt: 0.5, height: 20, fontSize: 10 }}
                            />
                          )}

                          {/* Botón completar paso — solo si es MI paso activo */}
                          {esMiPaso && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              sx={{ mt: 1 }}
                              onClick={() => setDialogCompletarPaso(paso)}
                            >
                              Completar paso
                            </Button>
                          )}

                          {/* Botón asignar técnico — Admin/Mesa para pasos PENDIENTE */}
                          {esAdminOMesa && paso.estado === "PENDIENTE" && !paso.tecnicoId && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ mt: 1 }}
                              onClick={() => { setDialogAsignarPaso(paso); setTecnicoSelPaso(""); }}
                            >
                              Asignar técnico
                            </Button>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

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
                      {getTransicionLabel(solicitud.estado, estado, solicitud.categoria)}
                    </Button>
                  ))}
                </Box>
              )}
              {user?.rol === "EMPLEADO" && solicitud.estado === "ABIERTO" && (
                <Button size="small" variant="outlined" color="error" onClick={() => setDialogEstado("CANCELADO")} sx={{ mb: 2 }}>
                  Cancelar solicitud
                </Button>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Historial */}
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Historial</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
                {(solicitud.historial ?? []).map((h) => (
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
                {(solicitud.comentarios ?? []).map((c) => (
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

              {canComentar && (
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
            autoHighlight={solicitud.areaId ? { floor: solicitud.area?.floor ?? 0, roomId: solicitud.areaId } : undefined}
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
      <Dialog
        open={dialogTecnico}
        onClose={() => { setDialogTecnico(false); setDisponibilidad(null); setTecnicoSel(""); }}
      >
        <DialogTitle>Asignar técnico</DialogTitle>
        <DialogContent sx={{ minWidth: 360 }}>
          {solicitud?.categoria && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Mostrando{" "}
              {solicitud.categoria === "TECNOLOGIAS"
                ? "técnicos informáticos"
                : solicitud.categoria === "SERVICIOS"
                  ? "técnicos de servicios"
                  : "gestores de recursos materiales"}{" "}
              para solicitudes de{" "}
              {solicitud.categoria === "TECNOLOGIAS"
                ? "Tecnologías"
                : solicitud.categoria === "SERVICIOS"
                  ? "Servicios"
                  : "Recursos Materiales"}.
            </Typography>
          )}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Técnico</InputLabel>
            <Select
              value={tecnicoSel}
              label="Técnico"
              onChange={(e) => handleSeleccionarTecnico(e.target.value)}
            >
              {tecnicos.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre} {t.apellidos} ({t.rol})</MenuItem>
              ))}
            </Select>
          </FormControl>
          {disponibilidadLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Verificando disponibilidad...</Typography>
            </Box>
          )}
          {!disponibilidadLoading && disponibilidad && !disponibilidad.disponible && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {disponibilidad.motivo}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogTecnico(false); setDisponibilidad(null); setTecnicoSel(""); }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleAsignar} disabled={!tecnicoSel || saving}>
            {saving ? <CircularProgress size={18} /> : "Asignar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog asignar técnico al paso */}
      <Dialog open={Boolean(dialogAsignarPaso)} onClose={() => { setDialogAsignarPaso(null); setTecnicoSelPaso(""); }}>
        <DialogTitle>
          Asignar técnico — {dialogAsignarPaso?.nombre ?? `Paso ${dialogAsignarPaso?.orden}`}
        </DialogTitle>
        <DialogContent sx={{ minWidth: 340 }}>
          {tecnicosFiltradosPaso.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No hay técnicos disponibles con el rol requerido ({dialogAsignarPaso?.rolRequerido}).
            </Typography>
          ) : (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Técnico</InputLabel>
              <Select
                value={tecnicoSelPaso}
                label="Técnico"
                onChange={(e) => setTecnicoSelPaso(e.target.value)}
              >
                {tecnicosFiltradosPaso.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.nombre} {t.apellidos}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogAsignarPaso(null); setTecnicoSelPaso(""); }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAsignarPaso}
            disabled={!tecnicoSelPaso || saving || tecnicosFiltradosPaso.length === 0}
          >
            {saving ? <CircularProgress size={18} /> : "Asignar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog completar paso */}
      <Dialog
        open={Boolean(dialogCompletarPaso)}
        onClose={() => { setDialogCompletarPaso(null); setNotasPaso(""); setCantidadPaso(""); }}
      >
        <DialogTitle>
          Completar: {dialogCompletarPaso?.nombre ?? `Paso ${dialogCompletarPaso?.orden}`}
        </DialogTitle>
        <DialogContent sx={{ minWidth: 340 }}>
          {dialogCompletarPaso?.labelUnidades && (
            <TextField
              label={dialogCompletarPaso.labelUnidades}
              type="number"
              value={cantidadPaso}
              onChange={(e) => setCantidadPaso(e.target.value)}
              fullWidth required
              inputProps={{ min: 1 }}
              sx={{ mt: 1, mb: 2 }}
              helperText="Campo obligatorio para este tipo de paso"
            />
          )}
          <TextField
            label="Notas (opcional)"
            value={notasPaso}
            onChange={(e) => setNotasPaso(e.target.value)}
            fullWidth multiline rows={3}
            sx={{ mt: dialogCompletarPaso?.labelUnidades ? 0 : 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogCompletarPaso(null); setNotasPaso(""); setCantidadPaso(""); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCompletarPaso}
            disabled={saving || (Boolean(dialogCompletarPaso?.labelUnidades) && !cantidadPaso)}
          >
            {saving ? <CircularProgress size={18} /> : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
