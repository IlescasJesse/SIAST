import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import { useAuthStore } from "../store/auth.js";
import { completarPerfil } from "../api/usuarios.js";
import { getAreasSugeridas } from "../api/catalogos.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formulario obligatorio de primer acceso (feedback staff P3-9, 2026-08-31):
// correo institucional o personal (al menos uno), extensión y confirmar
// ubicación en el edificio — sugerida por similitud con la adscripción SIRH.
export const CompletarPerfilPage = () => {
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState({
    correoInstitucional: "",
    emailPersonal: "",
    extension: "",
    areaId: null,
  });
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    getAreasSugeridas()
      .then((res) => {
        setAreas(res.data ?? []);
        if (res.actual) setForm((f) => ({ ...f, areaId: res.actual }));
      })
      .catch(() => {})
      .finally(() => setAreasLoading(false));
  }, []);

  const areaSeleccionada = useMemo(
    () => areas.find((a) => a.id === form.areaId) ?? null,
    [areas, form.areaId],
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const correoValido = (v) => !v || EMAIL_REGEX.test(v);
  const puedeGuardar =
    (form.correoInstitucional.trim() || form.emailPersonal.trim()) &&
    correoValido(form.correoInstitucional.trim()) &&
    correoValido(form.emailPersonal.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setSaving(true);
    setErr(null);
    try {
      const empleado = await completarPerfil({
        correoInstitucional: form.correoInstitucional.trim() || null,
        emailPersonal: form.emailPersonal.trim() || null,
        extension: form.extension.trim() || null,
        areaId: form.areaId || undefined,
      });
      updateUser({
        perfilCompleto: true,
        areaId: empleado.areaId,
        area: empleado.area?.label,
        piso: empleado.piso,
      });
    } catch (error) {
      setErr(error.response?.data?.error ?? "Error al guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: "auto", mt: { xs: 2, sm: 6 } }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Completa tu perfil
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Hola {user?.nombre ?? ""}, antes de continuar necesitamos algunos datos de contacto y tu
            ubicación en el edificio.
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {err && <Alert severity="error">{err}</Alert>}

            <TextField
              label="Correo institucional"
              type="email"
              value={form.correoInstitucional}
              onChange={(e) => set("correoInstitucional", e.target.value)}
              error={!correoValido(form.correoInstitucional.trim())}
              helperText="Si no tienes uno asignado, captura tu correo personal abajo"
              fullWidth
            />
            <TextField
              label="Correo personal"
              type="email"
              value={form.emailPersonal}
              onChange={(e) => set("emailPersonal", e.target.value)}
              error={!correoValido(form.emailPersonal.trim())}
              helperText="Requerido solo si no tienes correo institucional"
              fullWidth
            />
            <TextField
              label="Extensión telefónica"
              value={form.extension}
              onChange={(e) => set("extension", e.target.value.replace(/\D/g, "").slice(0, 10))}
              fullWidth
            />

            <Autocomplete
              options={areas}
              loading={areasLoading}
              value={areaSeleccionada}
              onChange={(_e, val) => set("areaId", val?.id ?? null)}
              getOptionLabel={(a) => a.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, a) => (
                <li {...props} key={a.id}>
                  {a.label}
                  {a.score > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (sugerida)
                    </Typography>
                  )}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tu ubicación en el edificio"
                  helperText="Sugerida según tu adscripción — confírmala o cámbiala si no es correcta"
                />
              )}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!puedeGuardar || saving}
              sx={{ mt: 1 }}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : "Guardar y continuar"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
