import { useState } from "react";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.jsx";
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Alert, CircularProgress, Avatar, Divider, Grid,
} from "@mui/material";
import { useAuthStore } from "../store/auth.js";
import { updatePassword } from "../api/usuarios.js";

export const PerfilPage = () => {
  const { user } = useAuthStore();
  const [passwordForm, setPasswordForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}

  const handlePassword = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (passwordForm.nueva !== passwordForm.confirmar) {
      setMsg({ type: "error", text: "Las contraseñas nuevas no coinciden" });
      return;
    }
    if (passwordForm.nueva.length < 8) {
      setMsg({ type: "error", text: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }
    setSaving(true);
    try {
      await updatePassword({ actual: passwordForm.actual, nueva: passwordForm.nueva });
      setMsg({ type: "success", text: "Contraseña actualizada correctamente" });
      setPasswordForm({ actual: "", nueva: "", confirmar: "" });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error ?? "Error al cambiar contraseña" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setPasswordForm((p) => ({ ...p, [k]: v }));

  const isEmpleado = user?.rol === "EMPLEADO";

  // Hay cambios si el usuario comenzó a escribir en el formulario de contraseña
  const isDirty =
    passwordForm.actual.length > 0 ||
    passwordForm.nueva.length > 0 ||
    passwordForm.confirmar.length > 0;
  const { ConfirmDialog } = useUnsavedChanges(isDirty && !isEmpleado);

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Mi Perfil</Typography>

      {/* Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.dark", fontSize: 22 }}>
              {((user?.nombre ?? user?.nombreCompleto)?.[0] ?? "U").toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {user?.nombreCompleto ?? `${user?.nombre ?? ""} ${user?.apellidos ?? ""}`.trim()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {({
                  ADMIN: "Administrador",
                  TECNICO_TI: "Técnico TI",
                  TECNICO_SERVICIOS: "Técnico en Servicios",
                  MESA_AYUDA: "Mesa de Ayuda",
                  GESTOR_RECURSOS_MATERIALES: "Gestor de Recursos Materiales",
                  EMPLEADO: "Empleado",
                })[user?.rol] ?? user?.rol?.replace(/_/g, " ")}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            {isEmpleado ? (
              <>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">RFC</Typography>
                  <Typography variant="body2" fontFamily="monospace">{user?.rfc}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Área</Typography>
                  <Typography variant="body2">{user?.area ?? "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Piso</Typography>
                  <Typography variant="body2">{user?.piso ?? "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Solicitudes activas</Typography>
                  <Typography variant="body2">{user?.ticketsActivos ?? 0} / 2</Typography>
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Usuario</Typography>
                  <Typography variant="body2" fontFamily="monospace">{user?.usuario}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Rol</Typography>
                  <Typography variant="body2">{user?.rol?.replace(/_/g, " ")}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Cambio de contraseña — solo staff */}
      {!isEmpleado && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Cambiar contraseña</Typography>
            <Box component="form" onSubmit={handlePassword} sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
              <TextField
                label="Contraseña actual"
                type="password"
                value={passwordForm.actual}
                onChange={(e) => set("actual", e.target.value)}
                fullWidth required
                autoComplete="current-password"
              />
              <TextField
                label="Nueva contraseña"
                type="password"
                value={passwordForm.nueva}
                onChange={(e) => set("nueva", e.target.value)}
                fullWidth required
                autoComplete="new-password"
                helperText="Mínimo 8 caracteres"
              />
              <TextField
                label="Confirmar nueva contraseña"
                type="password"
                value={passwordForm.confirmar}
                onChange={(e) => set("confirmar", e.target.value)}
                fullWidth required
                autoComplete="new-password"
              />
              <Button type="submit" variant="contained" disabled={saving || !passwordForm.actual || !passwordForm.nueva || !passwordForm.confirmar}>
                {saving ? <CircularProgress size={20} color="inherit" /> : "Actualizar contraseña"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Confirmación de cambios sin guardar */}
      <ConfirmDialog />
    </Box>
  );
};
