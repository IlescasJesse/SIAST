import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.jsx";
import {
  Box, Grid, Card, CardContent, Typography, TextField,
  Select, MenuItem, FormControl, InputLabel, Button,
  Alert, CircularProgress, Chip, Skeleton,
  FormGroup, FormControlLabel, Checkbox, Divider,
} from "@mui/material";
import { createTicket } from "../api/tickets.js";
import { getAreas } from "../api/catalogos.js";
import { useAuthStore } from "../store/auth.js";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";
import { SUBCATEGORIAS_POR_CATEGORIA, LABEL_SUBCATEGORIA, LABEL_PISO } from "@stf/shared";

// ── Opciones fijas por subcategoría ──────────────────────────────────────────

const EQUIPO_SALA_JUNTAS = [
  { key: "proyector", label: "Proyector / Cañón" },
  { key: "microfono", label: "Micrófono" },
  { key: "bocinas", label: "Bocinas" },
  { key: "papeleria", label: "Papelería / Material impreso" },
  { key: "pantalla", label: "Pantalla" },
];

const EQUIPO_PRESTAMO = [
  "Laptop",
  "Proyector",
  "Tableta",
  "Cámara",
  "Cable HDMI",
  "Mouse / Teclado",
  "Otro",
];

const ARTICULOS_PAPELERIA = [
  { key: "hojas", label: "Hojas blancas (resma)" },
  { key: "folders", label: "Folders" },
  { key: "boligrafos", label: "Bolígrafos" },
  { key: "postit", label: "Post-it" },
  { key: "grapas", label: "Grapas / Perforadora" },
  { key: "clips", label: "Clips" },
  { key: "otro", label: "Otro" },
];

export const TicketNewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(null);

  // Estado para campos adicionales por subcategoría
  const [salaJuntasEquipo, setSalaJuntasEquipo] = useState({});
  const [salaJuntasAsistentes, setSalaJuntasAsistentes] = useState("");
  const [prestamoEquipo, setPrestamoEquipo] = useState("");
  const [prestamoDescripcion, setPrestamoDescripcion] = useState("");
  const [papeleriaItems, setPapeleriaItems] = useState({});
  const [papeleriaCantidades, setPapeleriaCantidades] = useState({});

  const [form, setForm] = useState({
    asunto: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    prioridad: "MEDIA",
    ubicacionAreaId: user?.areaId ?? "",
    rfcSolicitante: "",
  });

  useEffect(() => {
    setLoadingAreas(true);
    getAreas()
      .then((r) => setAreas(r.data ?? []))
      .finally(() => setLoadingAreas(false));
    // Mostrar ubicación del empleado en el mapa al cargar
    if (user?.areaId) {
      setHighlight({ floor: user.floor ?? 0, roomId: user.areaId });
    }
  }, []);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  // Al cambiar subcategoría, limpiar los campos adicionales
  const handleSubcategoriaChange = (val) => {
    set("subcategoria", val);
    setSalaJuntasEquipo({});
    setSalaJuntasAsistentes("");
    setPrestamoEquipo("");
    setPrestamoDescripcion("");
    setPapeleriaItems({});
    setPapeleriaCantidades({});
  };

  // Hay cambios si el usuario escribió algo en los campos principales
  const isDirty =
    form.asunto.trim().length > 0 ||
    form.descripcion.trim().length > 0 ||
    form.categoria !== "" ||
    form.subcategoria !== "";
  const { ConfirmDialog } = useUnsavedChanges(isDirty);

  const subcategorias = form.categoria ? SUBCATEGORIAS_POR_CATEGORIA[form.categoria] ?? [] : [];

  const puedeCrear = user?.rol !== "EMPLEADO" || (user?.ticketsActivos ?? 0) < 2;

  // Serializar campos adicionales a JSON
  const buildRecursosAdicionales = () => {
    const sub = form.subcategoria;
    if (sub === "SALA_JUNTAS") {
      const equipoSeleccionado = EQUIPO_SALA_JUNTAS.filter((e) => salaJuntasEquipo[e.key]).map(
        (e) => e.label,
      );
      if (equipoSeleccionado.length === 0 && !salaJuntasAsistentes) return null;
      return JSON.stringify({
        tipo: "SALA_JUNTAS",
        equipo: equipoSeleccionado,
        asistentes: salaJuntasAsistentes || null,
      });
    }
    if (sub === "PRESTAMO_EQUIPO") {
      if (!prestamoEquipo) return null;
      return JSON.stringify({
        tipo: "PRESTAMO_EQUIPO",
        equipoPreferido: prestamoEquipo,
        descripcion: prestamoDescripcion || null,
      });
    }
    if (sub === "PAPELERIA") {
      const articulos = ARTICULOS_PAPELERIA.filter((a) => papeleriaItems[a.key]).map((a) => ({
        articulo: a.label,
        cantidad: papeleriaCantidades[a.key] || "",
      }));
      if (articulos.length === 0) return null;
      return JSON.stringify({ tipo: "PAPELERIA", articulos });
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.asunto.trim() || !form.descripcion.trim() || !form.categoria || !form.subcategoria || !form.ubicacionAreaId) {
      setError("Completa todos los campos obligatorios, incluyendo la ubicación");
      return;
    }
    if (user?.rol !== "EMPLEADO" && !form.rfcSolicitante.trim()) {
      setError("Ingresa el RFC del empleado solicitante");
      return;
    }
    setLoading(true);
    try {
      const recursosAdicionales = buildRecursosAdicionales();
      const ticket = await createTicket({ ...form, recursosAdicionales });
      navigate(`/tickets/${ticket.ticket?.id ?? ticket.id}`);
    } catch (err) {
      setError(err.response?.data?.error ?? "Error al crear el ticket");
    } finally {
      setLoading(false);
    }
  };

  const onAreaChange = (areaId) => {
    set("ubicacionAreaId", areaId);
    const area = areas.find((a) => a.id === areaId);
    if (area) {
      setHighlight({ floor: area.floor, roomId: area.id });
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Crear Ticket</Typography>

      <Grid container spacing={2} sx={{ height: "calc(100vh - 140px)" }}>
        {/* Formulario */}
        <Grid item xs={12} md={6} sx={{ overflowY: "auto", height: "100%" }}>
          {/* Info del empleado */}
          {user?.rol === "EMPLEADO" && (
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ py: "12px !important" }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  SOLICITANTE
                </Typography>
                <Typography fontWeight={600}>{user.nombreCompleto}</Typography>
                <Typography variant="body2" color="text.secondary">
                  RFC: {user.rfc}
                </Typography>
                {user.puesto && (
                  <Typography variant="body2" color="text.secondary">
                    Puesto: {user.puesto}
                  </Typography>
                )}
                {(user.adscripcion || user.departamento) && (
                  <Typography variant="body2" color="text.secondary">
                    Adscripción: {user.adscripcion ?? user.departamento}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Ubicación: {user.area} · {LABEL_PISO[user.piso] ?? user.piso}
                </Typography>
                {user.ticketsActivos >= 2 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Tienes 2 tickets activos. Solo puedes crear uno nuevo cuando alguno sea resuelto.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <Card component="form" onSubmit={handleSubmit}>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {error && <Alert severity="error">{error}</Alert>}

              {user?.rol !== "EMPLEADO" && (
                <TextField
                  label="RFC del solicitante"
                  value={form.rfcSolicitante}
                  onChange={(e) => set("rfcSolicitante", e.target.value.toUpperCase())}
                  fullWidth required
                  inputProps={{ maxLength: 13 }}
                  helperText="RFC del empleado para quien se crea el ticket"
                />
              )}

              <FormControl fullWidth required>
                <InputLabel>Categoría</InputLabel>
                <Select value={form.categoria} label="Categoría" onChange={(e) => { set("categoria", e.target.value); set("subcategoria", ""); }}>
                  <MenuItem value="TECNOLOGIAS">Tecnologías</MenuItem>
                  <MenuItem value="SERVICIOS">Servicios</MenuItem>
                  <MenuItem value="RECURSOS_MATERIALES">Recursos Materiales</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth required disabled={!form.categoria}>
                <InputLabel>Subcategoría</InputLabel>
                <Select value={form.subcategoria} label="Subcategoría" onChange={(e) => handleSubcategoriaChange(e.target.value)}>
                  {subcategorias.map((s) => (
                    <MenuItem key={s} value={s}>{LABEL_SUBCATEGORIA[s]}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Asunto"
                value={form.asunto}
                onChange={(e) => set("asunto", e.target.value)}
                fullWidth required
                inputProps={{ maxLength: 100 }}
                helperText={`${form.asunto.length}/100`}
              />

              <TextField
                label="Descripción"
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
                fullWidth required multiline rows={3}
                inputProps={{ maxLength: 500 }}
                helperText={`${form.descripcion.length}/500`}
              />

              <FormControl fullWidth required>
                <InputLabel>Prioridad</InputLabel>
                <Select value={form.prioridad} label="Prioridad" onChange={(e) => set("prioridad", e.target.value)}>
                  {["BAJA", "MEDIA", "ALTA", "URGENTE"].map((p) => (
                    <MenuItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* ── Campos adicionales para SALA_JUNTAS ── */}
              {form.subcategoria === "SALA_JUNTAS" && (
                <Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                    EQUIPAMIENTO ADICIONAL PARA LA SALA
                  </Typography>
                  <FormGroup row sx={{ gap: 0.5, flexWrap: "wrap" }}>
                    {EQUIPO_SALA_JUNTAS.map((item) => (
                      <FormControlLabel
                        key={item.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={!!salaJuntasEquipo[item.key]}
                            onChange={(e) =>
                              setSalaJuntasEquipo((prev) => ({ ...prev, [item.key]: e.target.checked }))
                            }
                          />
                        }
                        label={<Typography variant="body2">{item.label}</Typography>}
                        sx={{ mr: 0 }}
                      />
                    ))}
                  </FormGroup>
                  <TextField
                    label="Número de asistentes"
                    type="number"
                    value={salaJuntasAsistentes}
                    onChange={(e) => setSalaJuntasAsistentes(e.target.value)}
                    size="small"
                    sx={{ mt: 1.5 }}
                    inputProps={{ min: 1 }}
                    placeholder="Ej: 15"
                  />
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              )}

              {/* ── Campos adicionales para PRESTAMO_EQUIPO ── */}
              {form.subcategoria === "PRESTAMO_EQUIPO" && (
                <Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                    EQUIPO SOLICITADO
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo de equipo</InputLabel>
                    <Select
                      value={prestamoEquipo}
                      label="Tipo de equipo"
                      onChange={(e) => setPrestamoEquipo(e.target.value)}
                    >
                      {EQUIPO_PRESTAMO.map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Descripción adicional"
                    value={prestamoDescripcion}
                    onChange={(e) => setPrestamoDescripcion(e.target.value)}
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    sx={{ mt: 1.5 }}
                    placeholder="Modelo, características especiales, uso previsto…"
                  />
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              )}

              {/* ── Campos adicionales para PAPELERIA ── */}
              {form.subcategoria === "PAPELERIA" && (
                <Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                    ARTÍCULOS SOLICITADOS
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {ARTICULOS_PAPELERIA.map((art) => (
                      <Box key={art.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={!!papeleriaItems[art.key]}
                              onChange={(e) =>
                                setPapeleriaItems((prev) => ({ ...prev, [art.key]: e.target.checked }))
                              }
                            />
                          }
                          label={<Typography variant="body2">{art.label}</Typography>}
                          sx={{ mr: 0, flex: 1 }}
                        />
                        {papeleriaItems[art.key] && (
                          <TextField
                            placeholder="Cantidad / detalle"
                            size="small"
                            value={papeleriaCantidades[art.key] ?? ""}
                            onChange={(e) =>
                              setPapeleriaCantidades((prev) => ({ ...prev, [art.key]: e.target.value }))
                            }
                            sx={{ width: 160 }}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              )}

              {loadingAreas ? (
                <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              ) : (
                <FormControl fullWidth required>
                  <InputLabel>Ubicación</InputLabel>
                  <Select value={form.ubicacionAreaId} label="Ubicación" onChange={(e) => onAreaChange(e.target.value)}>
                    {areas.map((a) => (
                      <MenuItem key={a.id} value={a.id}>{a.label} — {LABEL_PISO[a.piso] ?? a.piso}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading || !puedeCrear}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Crear Ticket"}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Mapa 3D */}
        <Grid item xs={12} md={6} sx={{ height: "100%", position: "relative" }}>
          <BuildingViewer
            autoHighlight={highlight}
            sx={{ height: "100%", borderRadius: 2 }}
          />
          {user?.areaId && (
            <Chip
              label={`📍 ${user.nombreCompleto ?? user.nombre} — ${user.area}`}
              sx={{ position: "absolute", bottom: 16, left: 16, bgcolor: "primary.dark" }}
            />
          )}
        </Grid>
      </Grid>

      {/* Confirmación de cambios sin guardar */}
      <ConfirmDialog />
    </Box>
  );
};
