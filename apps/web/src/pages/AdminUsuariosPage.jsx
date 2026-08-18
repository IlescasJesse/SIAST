import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  ListSubheader,
  FormControl,
  InputLabel,
  Chip,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  FormGroup,
  Checkbox,
  FormLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PersonIcon from "@mui/icons-material/Person";
import { getUsuarios, createUsuario, updateUsuario, desactivarUsuario } from "../api/admin.js";
import { LABEL_ROL, LABEL_PERMISO, PERMISOS_LIST, PERMISOS_DEFAULT } from "@stf/shared";

const ROL_GRUPOS = [
  { grupo: "General", roles: ["ADMIN", "MESA_AYUDA"] },
  { grupo: "Área TI", roles: ["RESPONSABLE_TI", "TECNICO_TI"] },
  { grupo: "Área Sistemas", roles: ["RESPONSABLE_SISTEMAS", "TECNICO_SISTEMAS"] },
  { grupo: "Área Redes", roles: ["RESPONSABLE_REDES", "TECNICO_REDES"] },
  {
    grupo: "Área Mantenimiento",
    roles: [
      "RESPONSABLE_MANTENIMIENTO",
      "TECNICO_ELECTRICISTA",
      "TECNICO_PLOMERO",
      "TECNICO_MOVILIDAD",
    ],
  },
  {
    grupo: "Área Recursos Materiales",
    roles: [
      "RESPONSABLE_RECURSOS_MATERIALES",
      "GESTOR_RECURSOS_MATERIALES",
      "GESTOR_SALAS_JUNTA",
      "GESTOR_RECURSOS",
      "GESTOR_INVENTARIO",
    ],
  },
];

const EMPTY_FORM = {
  nombre: "",
  apellidos: "",
  usuario: "",
  password: "",
  email: "",
  telefono: "",
  rol: "MESA_AYUDA",
  activo: true,
  permisos: [],
};

export const AdminUsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [permisosExpanded, setPermisosExpanded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsuarios();
      setUsuarios(data ?? []);
    } catch {
      setError("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setPermisosExpanded(false);
    setFieldErrors({});
    setError(null);
    setDialogOpen(true);
  };

  const abrirEditar = (u) => {
    setEditId(u.id);
    setForm({
      nombre: u.nombre,
      apellidos: u.apellidos,
      usuario: u.usuario,
      password: "",
      email: u.email ?? "",
      telefono: u.telefono ?? "",
      rol: u.rol,
      activo: u.activo,
      permisos: u.permisos ?? [],
    });
    setPermisosExpanded(false);
    setFieldErrors({});
    setError(null);
    setDialogOpen(true);
  };

  const handleRolChange = (newRol) => {
    setForm((f) => ({ ...f, rol: newRol, permisos: [] }));
  };

  const togglePermiso = (perm) => {
    setForm((f) => {
      const defaults = PERMISOS_DEFAULT[f.rol] ?? [];
      const isDefault = defaults.includes(perm);
      const extraPermisos = f.permisos ?? [];

      if (isDefault) {
        // Si está en defaults, el permiso ya está activo por rol — no se puede quitar desde aquí
        return f;
      }
      // Toggle en permisos extra
      return {
        ...f,
        permisos: extraPermisos.includes(perm)
          ? extraPermisos.filter((p) => p !== perm)
          : [...extraPermisos, perm],
      };
    });
  };

  const guardar = async () => {
    // Validar campos requeridos antes de submit
    const errors = {};
    if (!form.nombre.trim()) errors.nombre = "El nombre es obligatorio";
    if (!form.apellidos.trim()) errors.apellidos = "Los apellidos son obligatorios";
    if (!form.usuario.trim()) errors.usuario = "El usuario de login es obligatorio";
    if (!editId && !form.password.trim()) errors.password = "La contraseña es obligatoria";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const payload = { ...form };
      if (editId && !payload.password) delete payload.password;
      // Eliminar areaSoporteId si viniera en payload — el backend lo deriva del rol
      delete payload.areaSoporteId;
      if (editId) {
        await updateUsuario(editId, payload);
      } else {
        await createUsuario(payload);
      }
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      cargar();
    } catch (e) {
      const errMsg = e?.response?.data?.error ?? "Error al guardar";
      const campos = e?.response?.data?.campos ?? [];
      if (campos.length > 0) {
        const backendErrors = {};
        campos.forEach((c) => {
          backendErrors[c] = errMsg;
        });
        setFieldErrors(backendErrors);
      } else {
        setError(errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async (u) => {
    if (!window.confirm(`¿Desactivar a ${u.nombre} ${u.apellidos}?`)) return;
    try {
      await desactivarUsuario(u.id);
      cargar();
    } catch {
      setError("Error al desactivar usuario");
    }
  };

  const reactivar = async (u) => {
    try {
      await updateUsuario(u.id, { activo: true });
      cargar();
    } catch {
      setError("Error al reactivar usuario");
    }
  };

  const defaultsDelRol = PERMISOS_DEFAULT[form.rol] ?? [];
  const permisosExtra = form.permisos ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Usuarios del Sistema
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCrear}>
          Nuevo Usuario
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell>
                  <b>Nombre</b>
                </TableCell>
                <TableCell>
                  <b>Usuario</b>
                </TableCell>
                <TableCell>
                  <b>Rol</b>
                </TableCell>
                <TableCell>
                  <b>Estado</b>
                </TableCell>
                <TableCell>
                  <b>Permisos extra</b>
                </TableCell>
                <TableCell align="right">
                  <b>Acciones</b>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id} sx={{ opacity: u.activo ? 1 : 0.5 }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {u.nombre} {u.apellidos}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {u.usuario}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={LABEL_ROL[u.rol] ?? u.rol} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.activo ? "Activo" : "Inactivo"}
                      size="small"
                      color={u.activo ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {(u.permisos ?? []).length > 0
                        ? `+${(u.permisos ?? []).length} extra`
                        : "Solo defaults de rol"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => abrirEditar(u)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {u.activo ? (
                      <Tooltip title="Desactivar">
                        <IconButton size="small" color="error" onClick={() => desactivar(u)}>
                          <PersonOffIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Reactivar">
                        <IconButton size="small" color="success" onClick={() => reactivar(u)}>
                          <PersonIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Nombre"
                value={form.nombre}
                onChange={(e) => {
                  setForm((f) => ({ ...f, nombre: e.target.value }));
                  setFieldErrors((fe) => ({ ...fe, nombre: undefined }));
                }}
                size="small"
                fullWidth
                required
                error={Boolean(fieldErrors.nombre)}
                helperText={fieldErrors.nombre}
              />
              <TextField
                label="Apellidos"
                value={form.apellidos}
                onChange={(e) => {
                  setForm((f) => ({ ...f, apellidos: e.target.value }));
                  setFieldErrors((fe) => ({ ...fe, apellidos: undefined }));
                }}
                size="small"
                fullWidth
                required
                error={Boolean(fieldErrors.apellidos)}
                helperText={fieldErrors.apellidos}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Usuario"
                value={form.usuario}
                onChange={(e) => {
                  setForm((f) => ({ ...f, usuario: e.target.value }));
                  setFieldErrors((fe) => ({ ...fe, usuario: undefined }));
                }}
                size="small"
                fullWidth
                required
                error={Boolean(fieldErrors.usuario)}
                helperText={fieldErrors.usuario ?? "Ej: jilescas"}
              />
              <TextField
                label="Contraseña"
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }));
                  setFieldErrors((fe) => ({ ...fe, password: undefined }));
                }}
                size="small"
                fullWidth
                placeholder={editId ? "Dejar vacío para no cambiar" : ""}
                required={!editId}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                size="small"
                fullWidth
              />
              <TextField
                label="Teléfono"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                size="small"
                fullWidth
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={form.rol}
                  label="Rol"
                  onChange={(e) => handleRolChange(e.target.value)}
                >
                  {ROL_GRUPOS.flatMap(({ grupo, roles }) => [
                    <ListSubheader key={`h-${grupo}`}>{grupo}</ListSubheader>,
                    ...roles.map((r) => (
                      <MenuItem key={r} value={r}>
                        {LABEL_ROL[r] ?? r}
                      </MenuItem>
                    )),
                  ])}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  />
                }
                label="Activo"
              />
            </Box>

            <Divider />

            {/* Permisos */}
            <Box>
              <Button size="small" variant="text" onClick={() => setPermisosExpanded((v) => !v)}>
                {permisosExpanded ? "Ocultar permisos" : "Configurar permisos granulares"}
              </Button>
              {permisosExpanded && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: "grey.50", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Los permisos marcados en gris son los defaults del rol seleccionado (no se
                    pueden quitar aquí). Puedes agregar permisos adicionales marcando los
                    desmarcados.
                  </Typography>
                  <FormGroup>
                    {PERMISOS_LIST.map((perm) => {
                      const isDefault = defaultsDelRol.includes(perm);
                      const isExtra = permisosExtra.includes(perm);
                      return (
                        <FormControlLabel
                          key={perm}
                          control={
                            <Checkbox
                              size="small"
                              checked={isDefault || isExtra}
                              disabled={isDefault}
                              onChange={() => togglePermiso(perm)}
                            />
                          }
                          label={
                            <Typography
                              variant="body2"
                              color={isDefault ? "text.secondary" : "text.primary"}
                            >
                              {LABEL_PERMISO[perm]}
                              {isDefault && (
                                <Chip label="del rol" size="small" sx={{ ml: 1, fontSize: 10 }} />
                              )}
                            </Typography>
                          }
                        />
                      );
                    })}
                  </FormGroup>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : editId ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
