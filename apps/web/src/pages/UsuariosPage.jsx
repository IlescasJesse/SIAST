import { useEffect, useState } from "react";
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../api/usuarios.js";

const ROLES_STAFF = ["ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA"];

const ROL_COLOR = {
  ADMIN: "error",
  TECNICO_INFORMATICO: "primary",
  TECNICO_SERVICIOS: "info",
  MESA_AYUDA: "success",
};

const emptyForm = { nombre: "", apellidos: "", usuario: "", password: "", rol: "MESA_AYUDA", telefono: "", email: "" };

export const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // null | "crear" | {id, ...usuario}
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getUsuarios();
      setUsuarios(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCrear = () => {
    setForm(emptyForm);
    setError("");
    setDialog("crear");
  };

  const openEditar = (u) => {
    setForm({ nombre: u.nombre, apellidos: u.apellidos, usuario: u.usuario, password: "", rol: u.rol, telefono: u.telefono ?? "", email: u.email ?? "" });
    setError("");
    setDialog(u);
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
      if (dialog === "crear") {
        await createUsuario(form);
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
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

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Usuarios del Sistema</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCrear} size="small">
          Nuevo usuario
        </Button>
      </Box>

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
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField label="Nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} fullWidth required />
            <TextField label="Apellidos" value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} fullWidth required />
          </Box>
          <TextField label="Usuario (login)" value={form.usuario} onChange={(e) => set("usuario", e.target.value)} fullWidth required />
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
    </Box>
  );
};
