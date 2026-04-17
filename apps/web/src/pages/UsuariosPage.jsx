import { useEffect, useState, useCallback } from "react";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.jsx";
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Chip,
  FormControlLabel, Switch, InputAdornment, Card, CardContent,
  Divider, LinearProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SearchIcon from "@mui/icons-material/Search";
import BadgeIcon from "@mui/icons-material/Badge";
import SyncIcon from "@mui/icons-material/Sync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PeopleIcon from "@mui/icons-material/People";
import WhatsAppIcon2 from "@mui/icons-material/WhatsApp";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../api/usuarios.js";
import { getSirhEmpleado, getSirhSyncStatus, postSirhSyncNow } from "../api/catalogos.js";

const ROLES_STAFF = ["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA", "GESTOR_RECURSOS_MATERIALES"];

const ROL_COLOR = {
  ADMIN: "error",
  TECNICO_INFORMATICO: "primary",
  TECNICO_SERVICIOS: "info",
  MESA_AYUDA: "success",
  GESTOR_RECURSOS_MATERIALES: "warning",
};

const emptyForm = {
  nombre: "", apellidos: "", usuario: "", password: "", rol: "MESA_AYUDA",
  telefono: "", email: "",
  esEmpleadoEstructura: false, empleadoId: "", rfc: "",
};

export const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // null | "crear" | {id, ...usuario}
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [rfcBuscando, setRfcBuscando] = useState(false);
  const [rfcBuscado, setRfcBuscado] = useState(null); // null | { nombre, apellidos } | "error"
  const [rfcManual, setRfcManual] = useState(false); // true cuando SIRH no encontró el RFC

  // ── Estado SIRH sync ──────────────────────────────────────────────────────
  const [syncData, setSyncData] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await getSirhSyncStatus();
      setSyncData(res.data);
    } catch { /* SIRH no disponible */ }
  }, []);

  const handleSyncNow = async () => {
    setSyncMsg("");
    setSyncLoading(true);
    try {
      await postSirhSyncNow();
      setSyncMsg("Sincronización iniciada. Puede tomar varios minutos...");
      // Recargar status cada 5 s mientras está en progreso
      const interval = setInterval(async () => {
        const res = await getSirhSyncStatus().catch(() => null);
        if (res?.data) {
          setSyncData(res.data);
          if (!res.data.enProgreso) {
            clearInterval(interval);
            setSyncLoading(false);
            setSyncMsg("¡Sincronización completada!");
          }
        }
      }, 5000);
    } catch (err) {
      setSyncMsg(err.response?.data?.error ?? "Error al iniciar la sincronización");
      setSyncLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await getUsuarios();
      setUsuarios(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadSyncStatus();
  }, [loadSyncStatus]);

  /** Genera sugerencia de usuario: primera letra del primer nombre + primer apellido, sin espacios, en minúsculas */
  const sugerirUsuario = (nombre, apellidos) => {
    const inicial = nombre.trim().split(/\s+/)[0]?.[0]?.toLowerCase() ?? "";
    const apellido = apellidos.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    return `${inicial}${apellido}`;
  };

  const openCrear = () => {
    setForm(emptyForm);
    setError("");
    setRfcBuscado(null);
    setRfcManual(false);
    setDialog("crear");
  };

  const openEditar = (u) => {
    setForm({
      nombre: u.nombre, apellidos: u.apellidos, usuario: u.usuario, password: "",
      rol: u.rol, telefono: u.telefono ?? "", email: u.email ?? "",
      esEmpleadoEstructura: u.esEmpleadoEstructura ?? false,
      empleadoId: u.empleadoId ?? "",
      rfc: u.rfc ?? "",
    });
    setError("");
    setRfcManual(false);
    setRfcBuscado(
      u.esEmpleadoEstructura && u.rfc
        ? { nombre: u.nombre, apellidos: u.apellidos }
        : null,
    );
    setDialog(u);
  };

  const handleBuscarRfc = async () => {
    const rfc = form.rfc.trim().toUpperCase();
    if (!rfc) return;
    setRfcBuscando(true);
    setRfcBuscado(null);
    setRfcManual(false);
    try {
      const res = await getSirhEmpleado(rfc);
      const emp = res.data;
      const nombreEmp = emp.nombre ?? "";
      const apellidosEmp = emp.apellidos ?? "";
      setForm((prev) => ({
        ...prev,
        nombre: nombreEmp,
        apellidos: apellidosEmp,
        empleadoId: emp._id,
        rfc: emp.rfc,
        email: prev.email || emp.email || "",
        usuario: prev.usuario.trim() || sugerirUsuario(nombreEmp, apellidosEmp),
      }));
      setRfcBuscado({ nombre: nombreEmp, apellidos: apellidosEmp });
    } catch {
      setRfcBuscado("error");
      setRfcManual(true); // Permitir captura manual
    } finally {
      setRfcBuscando(false);
    }
  };

  const handleGuardar = async () => {
    setError("");
    if (!form.nombre.trim() || !form.apellidos.trim() || !form.usuario.trim() || !form.rol) {
      setError("Nombre, apellidos, usuario y rol son obligatorios");
      return;
    }
    if (dialog === "crear" && !form.password.trim()) {
      setError("La contraseña es obligatoria al crear un usuario");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      // Limpiar empleadoId/rfc si no es empleado de estructura
      if (!payload.esEmpleadoEstructura) {
        payload.empleadoId = null;
        payload.rfc = null;
      }
      if (dialog === "crear") {
        await createUsuario(payload);
      } else {
        await updateUsuario(dialog.id, payload);
      }
      setDialog(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar este usuario?")) return;
    try {
      await deleteUsuario(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error ?? "Error al eliminar");
    }
  };

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  // Hay cambios si el dialog está abierto y el usuario modificó algún campo
  const isDirty =
    Boolean(dialog) &&
    (form.nombre.trim().length > 0 ||
      form.apellidos.trim().length > 0 ||
      form.usuario.trim().length > 0 ||
      form.password.trim().length > 0);
  const { ConfirmDialog } = useUnsavedChanges(isDirty);

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Usuarios del Sistema</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCrear} size="small">
          Nuevo usuario
        </Button>
      </Box>

      {/* ── Tarjeta de sincronización SIRH ── */}
      {syncData !== null && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ pb: "12px !important" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <SyncIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>Sincronización con SIRH</Typography>
              {syncData.enProgreso && (
                <Chip label="En progreso..." size="small" color="warning" icon={<SyncIcon />} />
              )}
              {!syncData.habilitado && (
                <Chip label="SIRH deshabilitado (SIRH_ENABLED=false)" size="small" color="default" />
              )}
            </Box>

            {syncData.enProgreso && <LinearProgress sx={{ mb: 1.5 }} />}

            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PeopleIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary">
                  Empleados en DB: <strong>{syncData.totalEmpleadosDB}</strong>
                  {" · "}sincronizados SIRH: <strong>{syncData.sincronizadosSIRH}</strong>
                </Typography>
              </Box>
            </Box>

            {syncData.ultimaSync && (
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Última sync: <strong>{fmt(syncData.ultimaSync)}</strong>
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 14, color: "success.main" }} />
                  <Typography variant="caption" color="text.secondary">
                    Creados: <strong>{syncData.creados}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <SyncIcon sx={{ fontSize: 14, color: "info.main" }} />
                  <Typography variant="caption" color="text.secondary">
                    Actualizados: <strong>{syncData.actualizados}</strong>
                  </Typography>
                </Box>
                {syncData.errores > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ErrorIcon sx={{ fontSize: 14, color: "error.main" }} />
                    <Typography variant="caption" color="error.main">
                      Errores: <strong>{syncData.errores}</strong>
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Estado WhatsApp */}
            {syncData.whatsapp && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <WhatsAppIcon2 sx={{ fontSize: 18, color: syncData.whatsapp.state === "ready" ? "#25D366" : syncData.whatsapp.state === "initializing" ? "warning.main" : "error.main" }} />
                <Typography variant="body2" color="text.secondary">
                  WhatsApp OTP:{" "}
                  {syncData.whatsapp.state === "ready" && <strong style={{ color: "#25D366" }}>Conectado ✓</strong>}
                  {syncData.whatsapp.state === "initializing" && <strong style={{ color: "orange" }}>Iniciando… (escanear QR en consola)</strong>}
                  {syncData.whatsapp.state === "failed" && (
                    <>
                      <strong style={{ color: "red" }}>Desconectado — modo consola activo</strong>
                      {syncData.whatsapp.reason && (
                        <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                          ({syncData.whatsapp.reason})
                        </Typography>
                      )}
                    </>
                  )}
                </Typography>
                {syncData.whatsapp.state === "failed" && (
                  <Chip
                    label="El código OTP aparece en consola de la API"
                    size="small"
                    color="warning"
                    variant="outlined"
                    icon={<HourglassEmptyIcon />}
                  />
                )}
              </Box>
            )}

            {syncMsg && (
              <Alert
                severity={syncMsg.includes("completada") ? "success" : syncMsg.includes("Error") ? "error" : "info"}
                sx={{ mb: 1.5 }}
                onClose={() => setSyncMsg("")}
              >
                {syncMsg}
              </Alert>
            )}

            <Divider sx={{ mb: 1.5 }} />

            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={syncLoading || syncData.enProgreso ? <CircularProgress size={14} /> : <SyncIcon />}
                onClick={handleSyncNow}
                disabled={syncLoading || syncData.enProgreso || !syncData.habilitado}
              >
                Sincronizar ahora
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={loadSyncStatus}
                disabled={syncLoading}
              >
                Actualizar estado
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                Sincronización automática cada 12 h · Reinicia la API para reconectar WhatsApp
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Teléfono WA</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace" }}>{u.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{u.nombre} {u.apellidos}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{u.usuario}</Typography>
                  </TableCell>
                  <TableCell>
                    {u.telefono ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <WhatsAppIcon sx={{ fontSize: 14, color: "#25D366" }} />
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{u.telefono}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={u.rol.replace("_", " ")} size="small" color={ROL_COLOR[u.rol] ?? "default"} />
                  </TableCell>
                  <TableCell>
                    <Chip label={u.activo ? "Activo" : "Inactivo"} size="small" color={u.activo ? "success" : "default"} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEditar(u)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => handleEliminar(u.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog === "crear" ? "Nuevo usuario" : "Editar usuario"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Switch empleado de estructura */}
          <FormControlLabel
            control={
              <Switch
                checked={form.esEmpleadoEstructura}
                onChange={(e) => {
                  set("esEmpleadoEstructura", e.target.checked);
                  if (!e.target.checked) {
                    set("empleadoId", "");
                    set("rfc", "");
                    set("nombre", "");
                    set("apellidos", "");
                    setRfcBuscado(null);
                    setRfcManual(false);
                  }
                }}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <BadgeIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2">Es empleado de estructura</Typography>
              </Box>
            }
          />

          {/* Búsqueda por RFC — solo si es empleado de estructura */}
          {form.esEmpleadoEstructura && (
            <Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField
                  label="RFC del empleado"
                  value={form.rfc}
                  onChange={(e) => {
                    set("rfc", e.target.value.toUpperCase());
                    setRfcBuscado(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscarRfc()}
                  fullWidth
                  inputProps={{ maxLength: 13, style: { textTransform: "uppercase", fontFamily: "monospace" } }}
                  helperText="13 caracteres — presiona Enter o Buscar"
                />
                <Button
                  variant="outlined"
                  onClick={handleBuscarRfc}
                  disabled={rfcBuscando || !form.rfc.trim()}
                  sx={{ mt: 0.5, minWidth: 90, height: 56 }}
                  startIcon={rfcBuscando ? <CircularProgress size={16} /> : <SearchIcon />}
                >
                  Buscar
                </Button>
              </Box>
              {rfcBuscado === "error" && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  RFC no encontrado en SIRH — puedes capturar nombre y apellidos manualmente.
                </Alert>
              )}
              {rfcBuscado && rfcBuscado !== "error" && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Empleado encontrado: <strong>{rfcBuscado.nombre} {rfcBuscado.apellidos}</strong>
                </Alert>
              )}
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Nombre(s)"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              onBlur={() => {
                if (!form.usuario.trim() && form.nombre && form.apellidos) {
                  set("usuario", sugerirUsuario(form.nombre, form.apellidos));
                }
              }}
              fullWidth required
              InputProps={{
                readOnly: form.esEmpleadoEstructura && Boolean(rfcBuscado && rfcBuscado !== "error") && !rfcManual,
              }}
            />
            <TextField
              label="Apellidos"
              value={form.apellidos}
              onChange={(e) => set("apellidos", e.target.value)}
              onBlur={() => {
                if (!form.usuario.trim() && form.nombre && form.apellidos) {
                  set("usuario", sugerirUsuario(form.nombre, form.apellidos));
                }
              }}
              fullWidth required
              InputProps={{
                readOnly: form.esEmpleadoEstructura && Boolean(rfcBuscado && rfcBuscado !== "error") && !rfcManual,
              }}
            />
          </Box>
          <TextField
            label="Usuario (login)"
            value={form.usuario}
            onChange={(e) => set("usuario", e.target.value)}
            fullWidth required
            helperText="Sugerencia: inicial del nombre + apellido paterno (ej: jilescas)"
            inputProps={{ style: { fontFamily: "monospace" } }}
          />
          <TextField
            label={dialog === "crear" ? "Contraseña" : "Nueva contraseña (dejar vacío para no cambiar)"}
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            fullWidth
            required={dialog === "crear"}
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Teléfono WhatsApp"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))}
              fullWidth
              inputProps={{ maxLength: 10, inputMode: "numeric" }}
              helperText="10 dígitos — para recibir notificaciones de tickets asignados"
              InputProps={{ startAdornment: <WhatsAppIcon sx={{ mr: 1, fontSize: 18, color: "#25D366" }} /> }}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              fullWidth
            />
          </Box>
          <FormControl fullWidth required>
            <InputLabel>Rol</InputLabel>
            <Select value={form.rol} label="Rol" onChange={(e) => set("rol", e.target.value)}>
              {ROLES_STAFF.map((r) => <MenuItem key={r} value={r}>{r.replace("_", " ")}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardar} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación de cambios sin guardar */}
      <ConfirmDialog />
    </Box>
  );
};
