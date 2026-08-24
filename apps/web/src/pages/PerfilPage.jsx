import { useState, useEffect } from "react";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.jsx";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Avatar,
  Divider,
  Grid,
  Switch,
  FormControlLabel,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { useAuthStore } from "../store/auth.js";
import { updatePassword, updateNotificacionesWhatsapp, getPerfil } from "../api/usuarios.js";

const TEL_REGEX = /^\d{10}$/;

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

  // ── Notificaciones por WhatsApp (solo empleados) ────────────────────────
  // El "user" del store viene del login y no trae telefono/notificacionesWhatsapp
  // (payload curado del JWT) — se consulta aparte via GET /api/auth/me.
  const [perfil, setPerfil] = useState(null);
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [notifMsg, setNotifMsg] = useState(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [telForm, setTelForm] = useState(null); // null = cerrado; { paso: 1|2, tel1, tel2 }

  useEffect(() => {
    if (!isEmpleado) return;
    setPerfilLoading(true);
    getPerfil()
      .then(setPerfil)
      .catch(() => {})
      .finally(() => setPerfilLoading(false));
  }, [isEmpleado]);

  const aplicarNotificaciones = async (enabled, telefono) => {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const res = await updateNotificacionesWhatsapp({ enabled, telefono });
      setPerfil((p) => ({
        ...p,
        telefono: res.telefono,
        notificacionesWhatsapp: res.notificacionesWhatsapp,
      }));
      setTelForm(null);
      setNotifMsg({
        type: "success",
        text: enabled
          ? "Notificaciones por WhatsApp activadas"
          : "Notificaciones por WhatsApp desactivadas",
      });
    } catch (err) {
      setNotifMsg({
        type: "error",
        text: err.response?.data?.error ?? "Error al actualizar la preferencia",
      });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleToggleNotif = (e) => {
    const checked = e.target.checked;
    setNotifMsg(null);
    if (!checked) {
      aplicarNotificaciones(false);
      return;
    }
    if (perfil?.telefono) {
      // Ya hay número confirmado — activar directo, sin repetir el formulario
      aplicarNotificaciones(true);
      return;
    }
    // Sin número: abrir formulario de captura + confirmación
    setTelForm({ paso: 1, tel1: "", tel2: "" });
  };

  const handleTelContinuar = () => {
    if (!TEL_REGEX.test(telForm.tel1)) return;
    setTelForm({ paso: 2, tel1: telForm.tel1, tel2: "" });
  };

  const handleTelConfirmar = () => {
    if (telForm.tel2 !== telForm.tel1) {
      setNotifMsg({ type: "error", text: "Los números no coinciden — vuelve a escribirlo" });
      setTelForm({ ...telForm, tel2: "" });
      return;
    }
    aplicarNotificaciones(true, telForm.tel1);
  };

  // Hay cambios si el usuario comenzó a escribir en el formulario de contraseña
  const isDirty =
    passwordForm.actual.length > 0 ||
    passwordForm.nueva.length > 0 ||
    passwordForm.confirmar.length > 0;
  const { ConfirmDialog } = useUnsavedChanges(isDirty && !isEmpleado);

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Mi Perfil
      </Typography>

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
                {{
                  ADMIN: "Administrador",
                  TECNICO_TI: "Técnico TI",
                  TECNICO_SERVICIOS: "Técnico en Servicios",
                  MESA_AYUDA: "Mesa de Ayuda",
                  GESTOR_RECURSOS_MATERIALES: "Gestor de Recursos Materiales",
                  EMPLEADO: "Empleado",
                }[user?.rol] ?? user?.rol?.replace(/_/g, " ")}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            {isEmpleado ? (
              <>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    RFC
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {user?.rfc}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Área
                  </Typography>
                  <Typography variant="body2">{user?.area ?? "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Piso
                  </Typography>
                  <Typography variant="body2">{user?.piso ?? "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Solicitudes activas
                  </Typography>
                  <Typography variant="body2">{user?.ticketsActivos ?? 0} / 2</Typography>
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Usuario
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {user?.usuario}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Rol
                  </Typography>
                  <Typography variant="body2">{user?.rol?.replace(/_/g, " ")}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Notificaciones por WhatsApp — solo empleados */}
      {isEmpleado && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Notificaciones
            </Typography>

            {perfilLoading ? (
              <CircularProgress size={20} />
            ) : (
              <>
                {notifMsg && (
                  <Alert severity={notifMsg.type} sx={{ mb: 2 }}>
                    {notifMsg.text}
                  </Alert>
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={perfil?.notificacionesWhatsapp ?? false}
                      onChange={handleToggleNotif}
                      disabled={notifSaving || Boolean(telForm)}
                    />
                  }
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <WhatsAppIcon fontSize="small" sx={{ color: "#25D366" }} />
                      <Typography variant="body2">
                        Recibir notificaciones de mis solicitudes por WhatsApp
                      </Typography>
                    </Box>
                  }
                />

                {perfil?.telefono && !telForm && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5, ml: 6 }}
                  >
                    Número registrado: ******{perfil.telefono.slice(-4)}{" "}
                    <Button
                      size="small"
                      onClick={() => setTelForm({ paso: 1, tel1: "", tel2: "" })}
                    >
                      Cambiar número
                    </Button>
                  </Typography>
                )}

                {/* Formulario de captura + confirmación de teléfono */}
                {telForm && (
                  <Box
                    sx={{
                      mt: 2,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                      maxWidth: 320,
                    }}
                  >
                    {telForm.paso === 1 ? (
                      <>
                        <TextField
                          label="Número de celular"
                          value={telForm.tel1}
                          onChange={(e) =>
                            setTelForm({
                              ...telForm,
                              tel1: e.target.value.replace(/\D/g, "").slice(0, 10),
                            })
                          }
                          fullWidth
                          autoFocus
                          inputProps={{ maxLength: 10, inputMode: "numeric" }}
                          helperText="10 dígitos — Ej: 9512345678"
                        />
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            variant="contained"
                            onClick={handleTelContinuar}
                            disabled={!TEL_REGEX.test(telForm.tel1)}
                          >
                            Continuar
                          </Button>
                          <Button variant="text" onClick={() => setTelForm(null)}>
                            Cancelar
                          </Button>
                        </Box>
                      </>
                    ) : (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          Confirma tu número — vuelve a escribirlo (sin pegar) para evitar errores
                        </Typography>
                        <TextField
                          label="Confirmar número de celular"
                          value={telForm.tel2}
                          onChange={(e) =>
                            setTelForm({
                              ...telForm,
                              tel2: e.target.value.replace(/\D/g, "").slice(0, 10),
                            })
                          }
                          onPaste={(e) => e.preventDefault()}
                          fullWidth
                          autoFocus
                          inputProps={{ maxLength: 10, inputMode: "numeric" }}
                        />
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            variant="contained"
                            onClick={handleTelConfirmar}
                            disabled={notifSaving || !TEL_REGEX.test(telForm.tel2)}
                          >
                            {notifSaving ? (
                              <CircularProgress size={20} color="inherit" />
                            ) : (
                              "Guardar"
                            )}
                          </Button>
                          <Button
                            variant="text"
                            onClick={() => setTelForm(null)}
                            disabled={notifSaving}
                          >
                            Cancelar
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cambio de contraseña — solo staff */}
      {!isEmpleado && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Cambiar contraseña
            </Typography>
            <Box
              component="form"
              onSubmit={handlePassword}
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
            >
              {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
              <TextField
                label="Contraseña actual"
                type="password"
                value={passwordForm.actual}
                onChange={(e) => set("actual", e.target.value)}
                fullWidth
                required
                autoComplete="current-password"
              />
              <TextField
                label="Nueva contraseña"
                type="password"
                value={passwordForm.nueva}
                onChange={(e) => set("nueva", e.target.value)}
                fullWidth
                required
                autoComplete="new-password"
                helperText="Mínimo 8 caracteres"
              />
              <TextField
                label="Confirmar nueva contraseña"
                type="password"
                value={passwordForm.confirmar}
                onChange={(e) => set("confirmar", e.target.value)}
                fullWidth
                required
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={
                  saving || !passwordForm.actual || !passwordForm.nueva || !passwordForm.confirmar
                }
              >
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
