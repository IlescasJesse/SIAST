import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Select, MenuItem, FormControl, InputLabel, Chip, Switch, FormControlLabel,
  IconButton, Tooltip, Alert, CircularProgress, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getProcesos, createProceso, updateProceso, toggleProceso } from "../api/admin.js";
import { LABEL_SUBCATEGORIA, LABEL_ROL, SubcategoriaTicketSchema } from "@stf/shared";

const SUBCATEGORIAS = [
  "SISTEMAS_INSTITUCIONALES", "EQUIPOS_DISPOSITIVOS", "RED_INTERNET",
  "CUENTAS_DOMINIO", "CORREO_OUTLOOK", "SANITARIOS", "ILUMINACION", "MOVILIDAD",
  "SALA_JUNTAS", "EQUIPO_AUDIOVISUAL", "PRESTAMO_EQUIPO", "MOBILIARIO", "PAPELERIA",
];

const ROLES_TECNICOS = [
  "TECNICO_TI", "TECNICO_REDES",
  "TECNICO_SERVICIOS", "GESTOR_RECURSOS_MATERIALES", "MESA_AYUDA",
];

const EMPTY_PASO = { tempId: null, nombre: "", rolRequerido: "TECNICO_TI", descripcion: "", registraUnidades: false, labelUnidades: "" };
const EMPTY_FORM = { subcategoria: "EQUIPOS_DISPOSITIVOS", subTipo: "", tipoFlujo: "DIRECTO", nombre: "", descripcion: "", activo: true, pasos: [] };

// ── Fila sortable de paso ─────────────────────────────────────────────────────
const PasoSortable = ({ paso, index, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: paso.tempId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1.5, mb: 1, bgcolor: "grey.50", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Box {...attributes} {...listeners} sx={{ cursor: "grab", mt: 1, color: "text.disabled" }}>
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Chip label={index + 1} size="small" sx={{ mt: 1, minWidth: 28 }} />
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small" label="Nombre del paso" value={paso.nombre} fullWidth
            onChange={(e) => onChange(paso.tempId, "nombre", e.target.value)}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Rol requerido</InputLabel>
            <Select value={paso.rolRequerido} label="Rol requerido" onChange={(e) => onChange(paso.tempId, "rolRequerido", e.target.value)}>
              {ROLES_TECNICOS.map((r) => <MenuItem key={r} value={r}>{LABEL_ROL[r] ?? r}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField size="small" label="Descripción (opcional)" value={paso.descripcion} fullWidth onChange={(e) => onChange(paso.tempId, "descripcion", e.target.value)} />
          <FormControlLabel
            control={<Switch size="small" checked={paso.registraUnidades} onChange={(e) => onChange(paso.tempId, "registraUnidades", e.target.checked)} />}
            label={<Typography variant="caption">Registra unidades</Typography>}
            sx={{ whiteSpace: "nowrap" }}
          />
        </Box>
        {paso.registraUnidades && (
          <TextField size="small" label='Etiqueta de unidades (ej: "PCs atendidas")' value={paso.labelUnidades} onChange={(e) => onChange(paso.tempId, "labelUnidades", e.target.value)} />
        )}
      </Box>
      <Tooltip title="Eliminar paso">
        <IconButton size="small" color="error" onClick={() => onRemove(paso.tempId)} sx={{ mt: 0.5 }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────
export const AdminProcesosPage = () => {
  const [procesos, setProcesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await getProcesos();
      setProcesos(data ?? []);
    } catch { setError("Error al cargar procesos"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirCrear = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const abrirEditar = (p) => {
    setEditId(p.id);
    setForm({
      subcategoria: p.subcategoria, subTipo: p.subTipo ?? "", tipoFlujo: p.tipoFlujo,
      nombre: p.nombre, descripcion: p.descripcion ?? "", activo: p.activo,
      pasos: p.pasos.map((paso, i) => ({
        tempId: `paso-${i}-${Date.now()}`,
        nombre: paso.nombre, rolRequerido: paso.rolRequerido,
        descripcion: paso.descripcion ?? "",
        registraUnidades: paso.registraUnidades ?? false,
        labelUnidades: paso.labelUnidades ?? "",
      })),
    });
    setDialogOpen(true);
  };

  const agregarPaso = () => {
    setForm((f) => ({
      ...f,
      pasos: [...f.pasos, { ...EMPTY_PASO, tempId: `nuevo-${Date.now()}` }],
    }));
  };

  const cambiarPaso = (tempId, campo, valor) => {
    setForm((f) => ({
      ...f,
      pasos: f.pasos.map((p) => p.tempId === tempId ? { ...p, [campo]: valor } : p),
    }));
  };

  const eliminarPaso = (tempId) => {
    setForm((f) => ({ ...f, pasos: f.pasos.filter((p) => p.tempId !== tempId) }));
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setForm((f) => {
      const ids = f.pasos.map((p) => p.tempId);
      const oldIdx = ids.indexOf(active.id);
      const newIdx = ids.indexOf(over.id);
      return { ...f, pasos: arrayMove(f.pasos, oldIdx, newIdx) };
    });
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        subTipo: form.subTipo.trim() || null,
        pasos: form.pasos.map((p, i) => ({
          orden: i + 1,
          nombre: p.nombre,
          rolRequerido: p.rolRequerido,
          descripcion: p.descripcion || null,
          registraUnidades: p.registraUnidades,
          labelUnidades: p.labelUnidades || null,
        })),
      };
      if (editId) { await updateProceso(editId, payload); }
      else { await createProceso(payload); }
      setDialogOpen(false);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.error ?? "Error al guardar proceso");
    } finally { setSaving(false); }
  };

  const handleToggle = async (p) => {
    try { await toggleProceso(p.id); cargar(); }
    catch { setError("Error al cambiar estado del proceso"); }
  };

  const CHIP_FLUJO = { DIRECTO: "primary", SECUENCIAL: "secondary", PENDIENTE: "warning" };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Procesos de Atención</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCrear}>
          Nuevo Proceso
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "grey.50" }}>
                <TableCell><b>Nombre del proceso</b></TableCell>
                <TableCell><b>Subcategoría</b></TableCell>
                <TableCell><b>Subtipo</b></TableCell>
                <TableCell><b>Flujo</b></TableCell>
                <TableCell><b>Pasos</b></TableCell>
                <TableCell><b>Estado</b></TableCell>
                <TableCell align="right"><b>Acciones</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {procesos.map((p) => (
                <TableRow key={p.id} sx={{ opacity: p.activo ? 1 : 0.5 }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{p.nombre}</Typography>
                    {p.descripcion && <Typography variant="caption" color="text.secondary">{p.descripcion}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{LABEL_SUBCATEGORIA[p.subcategoria] ?? p.subcategoria}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize={12}>{p.subTipo ?? "—"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={p.tipoFlujo} size="small" color={CHIP_FLUJO[p.tipoFlujo] ?? "default"} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{p.pasos.length} paso(s)</Typography>
                  </TableCell>
                  <TableCell>
                    <Switch size="small" checked={p.activo} onChange={() => handleToggle(p)} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => abrirEditar(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Dialog crear/editar proceso */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? "Editar Proceso" : "Nuevo Proceso"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>

            {/* Info general */}
            <TextField label="Nombre del proceso" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} size="small" fullWidth required />
            <TextField label="Descripción (opcional)" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} size="small" fullWidth multiline rows={2} />

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Subcategoría</InputLabel>
                <Select value={form.subcategoria} label="Subcategoría" onChange={(e) => setForm((f) => ({ ...f, subcategoria: e.target.value }))}>
                  {SUBCATEGORIAS.map((s) => <MenuItem key={s} value={s}>{LABEL_SUBCATEGORIA[s] ?? s}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Subtipo (texto libre, opcional)"
                value={form.subTipo}
                onChange={(e) => setForm((f) => ({ ...f, subTipo: e.target.value }))}
                size="small" fullWidth
                helperText="Ej: EQUIPO_NUEVO_CON_RED — deja vacío para usar la subcategoría completa"
              />
            </Box>

            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Tipo de flujo</InputLabel>
                <Select value={form.tipoFlujo} label="Tipo de flujo" onChange={(e) => setForm((f) => ({ ...f, tipoFlujo: e.target.value }))}>
                  <MenuItem value="DIRECTO">DIRECTO — un solo paso</MenuItem>
                  <MenuItem value="SECUENCIAL">SECUENCIAL — varios pasos en orden</MenuItem>
                  <MenuItem value="PENDIENTE">PENDIENTE — sin proceso definido aún</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Switch checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />}
                label="Activo"
              />
            </Box>

            <Divider />

            {/* Pasos */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>Pasos del proceso</Typography>
                <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={agregarPaso}>
                  Agregar paso
                </Button>
              </Box>

              {form.pasos.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                  Sin pasos — flujo PENDIENTE o proceso sin configurar
                </Typography>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={form.pasos.map((p) => p.tempId)} strategy={verticalListSortingStrategy}>
                  {form.pasos.map((paso, i) => (
                    <PasoSortable
                      key={paso.tempId}
                      paso={paso}
                      index={i}
                      onChange={cambiarPaso}
                      onRemove={eliminarPaso}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : (editId ? "Guardar cambios" : "Crear proceso")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
