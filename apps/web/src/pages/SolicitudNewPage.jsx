import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.jsx";
import {
  Box, Grid, Card, CardContent, Typography, TextField,
  Select, MenuItem, FormControl, InputLabel, Button,
  Alert, CircularProgress, Chip, Skeleton, Autocomplete,
  FormGroup, FormControlLabel, Checkbox, Divider, Paper,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/es";
import StorageIcon from "@mui/icons-material/Storage";
import LaptopIcon from "@mui/icons-material/Laptop";
import WifiIcon from "@mui/icons-material/Wifi";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import EmailIcon from "@mui/icons-material/Email";
import PlumbingIcon from "@mui/icons-material/Plumbing";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import ElevatorIcon from "@mui/icons-material/Elevator";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import VideocamIcon from "@mui/icons-material/Videocam";
import DevicesIcon from "@mui/icons-material/Devices";
import ChairIcon from "@mui/icons-material/Chair";
import DescriptionIcon from "@mui/icons-material/Description";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { createSolicitud } from "../api/solicitudes.js";
import { getAreas } from "../api/catalogos.js";
import { useAuthStore } from "../store/auth.js";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";
import { SUBCATEGORIAS_POR_CATEGORIA, LABEL_SUBCATEGORIA, LABEL_CATEGORIA, DESCRIPCION_SUBCATEGORIA, LABEL_PISO, SUB_TIPO_EQUIPOS } from "@stf/shared";

const CATEGORIA_STYLE = {
  "Tecnologías de la Información": { border: "#1565c0", bg: "#e3f0fd" },
  "Servicios Generales":           { border: "#2e7d32", bg: "#e6f4ea" },
  "Recursos Materiales":           { border: "#e65100", bg: "#fef3e2" },
};

const SUBCATEGORIA_ICON = {
  SISTEMAS_INSTITUCIONALES: <StorageIcon fontSize="small" />,
  EQUIPOS_DISPOSITIVOS:     <LaptopIcon fontSize="small" />,
  RED_INTERNET:             <WifiIcon fontSize="small" />,
  CUENTAS_DOMINIO:          <ManageAccountsIcon fontSize="small" />,
  CORREO_OUTLOOK:           <EmailIcon fontSize="small" />,
  SANITARIOS:               <PlumbingIcon fontSize="small" />,
  ILUMINACION:              <LightbulbIcon fontSize="small" />,
  MOVILIDAD:                <ElevatorIcon fontSize="small" />,
  SALA_JUNTAS:              <MeetingRoomIcon fontSize="small" />,
  EQUIPO_AUDIOVISUAL:       <VideocamIcon fontSize="small" />,
  PRESTAMO_EQUIPO:          <DevicesIcon fontSize="small" />,
  MOBILIARIO:               <ChairIcon fontSize="small" />,
  PAPELERIA:                <DescriptionIcon fontSize="small" />,
};

// Lista plana de todas las opciones para el Autocomplete
const OPCIONES_SUBCATEGORIA = Object.entries(SUBCATEGORIAS_POR_CATEGORIA).flatMap(
  ([cat, subs]) => subs.map((sub) => ({
    categoria: cat,
    subcategoria: sub,
    labelCategoria: LABEL_CATEGORIA[cat] ?? cat,
    label: LABEL_SUBCATEGORIA[sub] ?? sub,
    descripcion: DESCRIPCION_SUBCATEGORIA[sub] ?? "",
  }))
);

// Normaliza texto para comparación (quita acentos, minúsculas)
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const filtrarOpciones = (options, { inputValue }) => {
  if (!inputValue.trim()) return options;
  const palabras = norm(inputValue).split(/\s+/).filter(Boolean);
  return options.filter((o) => {
    const texto = norm(`${o.label} ${o.descripcion} ${o.labelCategoria}`);
    return palabras.every((p) => texto.includes(p));
  });
};

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

export const SolicitudNewPage = () => {
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
  // Fecha y hora de uso (compartidos para SALA_JUNTAS y MOBILIARIO)
  const [fechaUso, setFechaUso] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  const [form, setForm] = useState({
    asunto: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    subTipo: "",
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
    setForm((prev) => ({ ...prev, subcategoria: val, subTipo: "" }));
    setSalaJuntasEquipo({});
    setSalaJuntasAsistentes("");
    setPrestamoEquipo("");
    setPrestamoDescripcion("");
    setPapeleriaItems({});
    setPapeleriaCantidades({});
    setFechaUso("");
    setHoraInicio("");
    setHoraFin("");
  };

  // Hay cambios si el usuario escribió algo en los campos principales
  const isDirty =
    form.asunto.trim().length > 0 ||
    form.descripcion.trim().length > 0 ||
    form.categoria !== "" ||
    form.subcategoria !== "";
  const { ConfirmDialog } = useUnsavedChanges(isDirty);

  const puedeCrear = user?.rol !== "EMPLEADO" || (user?.ticketsActivos ?? 0) < 2;

  // Serializar campos adicionales a JSON
  const buildRecursosAdicionales = () => {
    const sub = form.subcategoria;
    if (sub === "SALA_JUNTAS") {
      const equipoSeleccionado = EQUIPO_SALA_JUNTAS.filter((e) => salaJuntasEquipo[e.key]).map(
        (e) => e.label,
      );
      return JSON.stringify({
        tipo: "SALA_JUNTAS",
        equipo: equipoSeleccionado,
        asistentes: salaJuntasAsistentes || null,
        fechaUso: fechaUso || null,
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,
      });
    }
    if (sub === "MOBILIARIO") {
      return JSON.stringify({
        tipo: "MOBILIARIO",
        fechaUso: fechaUso || null,
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,
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
    if (form.subcategoria === "EQUIPOS_DISPOSITIVOS" && !form.subTipo) {
      setError("Selecciona el tipo de solicitud de equipos");
      return;
    }
    if ((form.subcategoria === "SALA_JUNTAS" || form.subcategoria === "MOBILIARIO") && (!fechaUso || !horaInicio || !horaFin)) {
      setError("Indica la fecha y hora de uso para esta solicitud");
      return;
    }
    if (user?.rol !== "EMPLEADO" && !form.rfcSolicitante.trim()) {
      setError("Ingresa el RFC del empleado solicitante");
      return;
    }
    setLoading(true);
    try {
      const recursosAdicionales = buildRecursosAdicionales();
      const result = await createSolicitud({
        ...form,
        recursosAdicionales,
        subTipo: form.subTipo || undefined,
      });
      navigate(`/solicitudes/${result.ticket?.id ?? result.id}`);
    } catch (err) {
      setError(err.response?.data?.error ?? "Error al crear la solicitud");
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
      <Typography variant="h5" fontWeight={700} gutterBottom>Nueva Solicitud</Typography>

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
                    Tienes 2 solicitudes activas. Solo puedes crear una nueva cuando alguna sea resuelta.
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
                  helperText="RFC del empleado para quien se crea la solicitud"
                />
              )}

              <Autocomplete
                options={OPCIONES_SUBCATEGORIA}
                groupBy={(o) => o.labelCategoria}
                getOptionLabel={(o) => o.label}
                filterOptions={filtrarOpciones}
                isOptionEqualToValue={(a, b) => a.subcategoria === b.subcategoria}
                value={form.subcategoria ? OPCIONES_SUBCATEGORIA.find((o) => o.subcategoria === form.subcategoria) ?? null : null}
                onChange={(_, val) => {
                  if (val) {
                    set("categoria", val.categoria);
                    handleSubcategoriaChange(val.subcategoria);
                  } else {
                    set("categoria", "");
                    handleSubcategoriaChange("");
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label="¿Qué necesitas?"
                    placeholder='Escribe una palabra clave, ej: "correo", "impresora", "sala"'
                    InputProps={{ ...params.InputProps, startAdornment: <SearchIcon sx={{ color: "text.disabled", mr: 1, fontSize: 20 }} /> }}
                  />
                )}
                renderOption={(props, o) => (
                  <Box component="li" {...props} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1 }}>
                    <Box sx={{ color: "primary.main", mt: 0.3 }}>{SUBCATEGORIA_ICON[o.subcategoria]}</Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{o.label}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                        {o.descripcion}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderGroup={(params) => {
                  const style = CATEGORIA_STYLE[params.group] ?? { border: "#9e9e9e", bg: "#f5f5f5" };
                  return (
                    <Box key={params.key}>
                      <Box sx={{
                        px: 2, py: 0.75,
                        bgcolor: style.bg,
                        borderLeft: `4px solid ${style.border}`,
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: style.border, textTransform: "uppercase", letterSpacing: 0.9 }}>
                          {params.group}
                        </Typography>
                      </Box>
                      {params.children}
                    </Box>
                  );
                }}
                PaperComponent={(props) => <Paper elevation={4} {...props} />}
                noOptionsText="Sin resultados. Intenta con otras palabras."
                fullWidth
              />

              {form.subcategoria && DESCRIPCION_SUBCATEGORIA[form.subcategoria] && (
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 1 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16, color: "info.main", mt: 0.3, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">
                    {DESCRIPCION_SUBCATEGORIA[form.subcategoria]}
                  </Typography>
                </Box>
              )}

              {form.subcategoria === "EQUIPOS_DISPOSITIVOS" && (
                <FormControl fullWidth required>
                  <InputLabel>Tipo de solicitud</InputLabel>
                  <Select
                    value={form.subTipo}
                    label="Tipo de solicitud"
                    onChange={(e) => set("subTipo", e.target.value)}
                  >
                    {SUB_TIPO_EQUIPOS.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

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
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mt: 2, mb: 0.5 }}>
                    FECHA Y HORA DE USO *
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                      <DatePicker
                        label="Fecha de uso"
                        value={fechaUso ? dayjs(fechaUso) : null}
                        onChange={(v) => setFechaUso(v ? v.format("YYYY-MM-DD") : "")}
                        minDate={dayjs()}
                        slotProps={{ textField: { size: "small", required: true, sx: { flex: 1, minWidth: 160 } } }}
                      />
                      <TimePicker
                        label="Hora inicio"
                        value={horaInicio ? dayjs(`2000-01-01T${horaInicio}`) : null}
                        onChange={(v) => setHoraInicio(v ? v.format("HH:mm") : "")}
                        ampm={false}
                        slotProps={{ textField: { size: "small", required: true, sx: { flex: 1, minWidth: 130 } } }}
                      />
                      <TimePicker
                        label="Hora fin"
                        value={horaFin ? dayjs(`2000-01-01T${horaFin}`) : null}
                        onChange={(v) => setHoraFin(v ? v.format("HH:mm") : "")}
                        ampm={false}
                        slotProps={{ textField: { size: "small", required: true, sx: { flex: 1, minWidth: 130 } } }}
                      />
                    </Box>
                  </LocalizationProvider>
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

              {/* ── Campos adicionales para MOBILIARIO ── */}
              {form.subcategoria === "MOBILIARIO" && (
                <Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                    FECHA Y HORA DE USO *
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                      <DatePicker
                        label="Fecha de uso"
                        value={fechaUso ? dayjs(fechaUso) : null}
                        onChange={(v) => setFechaUso(v ? v.format("YYYY-MM-DD") : "")}
                        minDate={dayjs()}
                        slotProps={{ textField: { size: "small", required: true, sx: { flex: 1, minWidth: 160 } } }}
                      />
                      <TimePicker
                        label="Hora inicio"
                        value={horaInicio ? dayjs(`2000-01-01T${horaInicio}`) : null}
                        onChange={(v) => setHoraInicio(v ? v.format("HH:mm") : "")}
                        ampm={false}
                        slotProps={{ textField: { size: "small", required: true, sx: { flex: 1, minWidth: 130 } } }}
                      />
                      <TimePicker
                        label="Hora fin"
                        value={horaFin ? dayjs(`2000-01-01T${horaFin}`) : null}
                        onChange={(v) => setHoraFin(v ? v.format("HH:mm") : "")}
                        ampm={false}
                        slotProps={{ textField: { size: "small", required: true, sx: { flex: 1, minWidth: 130 } } }}
                      />
                    </Box>
                  </LocalizationProvider>
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
                {loading ? <CircularProgress size={22} color="inherit" /> : "Crear Solicitud"}
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
