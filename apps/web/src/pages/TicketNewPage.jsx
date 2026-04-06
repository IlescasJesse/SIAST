import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Grid, Card, CardContent, Typography, TextField,
  Select, MenuItem, FormControl, InputLabel, Button,
  Alert, CircularProgress, Chip, Divider,
} from "@mui/material";
import { createTicket } from "../api/tickets.js";
import { getAreas } from "../api/catalogos.js";
import { useAuthStore } from "../store/auth.js";
import { BuildingViewer } from "../components/Building3D/BuildingViewer.jsx";
import { SUBCATEGORIAS_POR_CATEGORIA, LABEL_SUBCATEGORIA, LABEL_PISO } from "@stf/shared";

export const TicketNewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(null);

  const [form, setForm] = useState({
    asunto: "",
    descripcion: "",
    categoria: "",
    subcategoria: "",
    prioridad: "MEDIA",
    ubicacionAreaId: user?.areaId ?? "",
    piso: user?.piso ?? "",
  });

  useEffect(() => {
    getAreas().then((r) => setAreas(r.data ?? []));
    // Mostrar ubicación del empleado en el mapa al cargar
    if (user?.areaId) {
      setHighlight({ floor: user.floor ?? 0, roomId: user.areaId });
    }
  }, []);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const subcategorias = form.categoria ? SUBCATEGORIAS_POR_CATEGORIA[form.categoria] ?? [] : [];

  const puedeCrear = user?.rol !== "EMPLEADO" || (user?.ticketsActivos ?? 0) < 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.asunto.trim() || !form.descripcion.trim() || !form.categoria || !form.subcategoria) {
      setError("Completa todos los campos obligatorios");
      return;
    }
    setLoading(true);
    try {
      const ticket = await createTicket({
        ...form,
        empleadoRfc: user?.rfc,
      });
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
      set("piso", area.piso);
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
                  RFC: {user.rfc} · {user.area} · {LABEL_PISO[user.piso] ?? user.piso}
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

              <FormControl fullWidth required>
                <InputLabel>Categoría</InputLabel>
                <Select value={form.categoria} label="Categoría" onChange={(e) => { set("categoria", e.target.value); set("subcategoria", ""); }}>
                  <MenuItem value="TECNOLOGIAS">Tecnologías</MenuItem>
                  <MenuItem value="SERVICIOS">Servicios</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth required disabled={!form.categoria}>
                <InputLabel>Subcategoría</InputLabel>
                <Select value={form.subcategoria} label="Subcategoría" onChange={(e) => set("subcategoria", e.target.value)}>
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

              <FormControl fullWidth required>
                <InputLabel>Ubicación</InputLabel>
                <Select value={form.ubicacionAreaId} label="Ubicación" onChange={(e) => onAreaChange(e.target.value)}>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.label} — {LABEL_PISO[a.piso] ?? a.piso}</MenuItem>
                  ))}
                </Select>
              </FormControl>

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
    </Box>
  );
};
