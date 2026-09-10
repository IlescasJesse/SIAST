import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import { getAreas } from "../api/catalogos.js";
import { getHonorarios, createHonorarios } from "../api/empleados.js";
import { avisar } from "../store/dialogs.js";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORM_VACIO = {
  rfc: "",
  nombre: "",
  apellidos: "",
  telefono: "",
  emailPersonal: "",
  areaId: null,
};

// Registro de personal por honorarios (invitados) — feedback staff P4-12.
// Solo ADMIN y Mesa de Ayuda. El honorario se autentica por RFC e interactúa
// igual que un empleado normal (máx. 2 tickets activos).
export const HonorariosPage = () => {
  const [areas, setAreas] = useState([]);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);

  const cargar = () => {
    setLoading(true);
    Promise.all([getAreas(), getHonorarios()])
      .then(([resAreas, resLista]) => {
        setAreas(resAreas.data ?? resAreas ?? []);
        setLista(resLista ?? []);
      })
      .catch(() => avisar({ mensaje: "No se pudo cargar la información", severidad: "error" }))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const rfcUp = form.rfc.trim().toUpperCase();
  const telOk = !form.telefono.trim() || /^\d{10}$/.test(form.telefono.trim());
  const emailOk = !form.emailPersonal.trim() || EMAIL_REGEX.test(form.emailPersonal.trim());
  const puedeGuardar =
    RFC_REGEX.test(rfcUp) &&
    form.nombre.trim() &&
    form.apellidos.trim() &&
    form.areaId &&
    (form.telefono.trim() || form.emailPersonal.trim()) &&
    telOk &&
    emailOk;

  const areaSel = useMemo(
    () => areas.find((a) => a.id === form.areaId) ?? null,
    [areas, form.areaId],
  );

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await createHonorarios({
        rfc: rfcUp,
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        telefono: form.telefono.trim() || undefined,
        emailPersonal: form.emailPersonal.trim() || undefined,
        areaId: form.areaId,
      });
      avisar({
        mensaje: "Honorario registrado. Ya puede acceder con su RFC.",
        severidad: "success",
      });
      setForm(FORM_VACIO);
      cargar();
    } catch (err) {
      avisar({
        mensaje: err.response?.data?.error ?? "Error al registrar",
        severidad: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Personal por honorarios
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Registra personal por honorarios (invitados) que no proviene del SIRH. Accede con su RFC
        (código por WhatsApp o correo) y opera igual que un empleado: máximo 2 solicitudes activas.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Registrar nuevo
          </Typography>
          <Box component="form" onSubmit={handleGuardar}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="RFC"
                  value={form.rfc}
                  onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                  error={Boolean(form.rfc.trim()) && !RFC_REGEX.test(rfcUp)}
                  helperText={
                    Boolean(form.rfc.trim()) && !RFC_REGEX.test(rfcUp) ? "RFC inválido" : " "
                  }
                  fullWidth
                />
                <Autocomplete
                  options={areas}
                  value={areaSel}
                  onChange={(_e, v) => set("areaId", v?.id ?? null)}
                  getOptionLabel={(a) => a.label ?? ""}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  sx={{ width: "100%" }}
                  renderInput={(params) => (
                    <TextField {...params} label="Ubicación en el edificio" helperText=" " />
                  )}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Nombre(s)"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Apellidos"
                  value={form.apellidos}
                  onChange={(e) => set("apellidos", e.target.value)}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Teléfono (WhatsApp)"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  error={!telOk}
                  helperText={!telOk ? "10 dígitos" : "Para el código de acceso"}
                  fullWidth
                />
                <TextField
                  label="Correo (alterno)"
                  type="email"
                  value={form.emailPersonal}
                  onChange={(e) => set("emailPersonal", e.target.value)}
                  error={!emailOk}
                  helperText={!emailOk ? "Correo inválido" : "Requerido si no hay teléfono"}
                  fullWidth
                />
              </Stack>
              <Box>
                <Button type="submit" variant="contained" disabled={!puedeGuardar || saving}>
                  {saving ? <CircularProgress size={20} color="inherit" /> : "Registrar honorario"}
                </Button>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Registrados ({lista.length})
          </Typography>
          <Divider sx={{ mb: 1 }} />
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : lista.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Aún no hay personal por honorarios registrado.
            </Typography>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>RFC</TableCell>
                    <TableCell>Contacto</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lista.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.nombreCompleto}</TableCell>
                      <TableCell>{h.rfc}</TableCell>
                      <TableCell>
                        {h.telefono || h.emailPersonal || h.correoInstitucional || "—"}
                      </TableCell>
                      <TableCell>{h.area}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={h.perfilCompleto ? "Perfil completo" : "Primer acceso pendiente"}
                          color={h.perfilCompleto ? "success" : "default"}
                          variant={h.perfilCompleto ? "filled" : "outlined"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
