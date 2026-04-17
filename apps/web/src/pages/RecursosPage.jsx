import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Skeleton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Card,
  CardContent,
  CardActions,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import InventoryIcon from "@mui/icons-material/Inventory2";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PrintIcon from "@mui/icons-material/Print";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AssignmentIcon from "@mui/icons-material/Assignment";
import LaptopIcon from "@mui/icons-material/Laptop";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import HandshakeIcon from "@mui/icons-material/Handshake";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { useAuthStore } from "../store/auth.js";
import {
  getCatalogos,
  getCatalogo,
  createCatalogo,
  updateCatalogo,
  deleteCatalogo,
  getUnidades,
  createUnidad,
  updateUnidad,
  deleteUnidad,
  buscarPorSerie,
  getAsignaciones,
  createAsignacion,
  updateAsignacion,
  getOrdenSalida,
} from "../api/recursos.js";
import { getTickets } from "../api/tickets.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarcodeScanner } from "../components/BarcodeScanner.jsx";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPO_LABEL = { TECNOLOGICO: "Tecnológico", INMOBILIARIO: "Inmobiliario" };

const PISO_LABELS = {
  PB: "Planta Baja",
  NIVEL_1: "Nivel 1",
  NIVEL_2: "Nivel 2",
  NIVEL_3: "Nivel 3",
};

const ESTADO_ASIG_LABEL = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  DEVUELTA: "Devuelta",
};

const ESTADO_ASIG_COLOR = {
  PENDIENTE: "warning",
  APROBADA: "success",
  RECHAZADA: "error",
  DEVUELTA: "default",
};

const SUBCATEGORIA_LABEL = {
  SALA_JUNTAS: "Sala de Juntas",
  EQUIPO_AUDIOVISUAL: "Equipo Audiovisual",
  PRESTAMO_EQUIPO: "Préstamo de Equipo",
  MOBILIARIO: "Mobiliario",
};

const emptyAsignacion = {
  empleadoRfc: "",
  fechaInicio: "",
  fechaFin: "",
  saleDEdificio: false,
  propositoSalida: "",
  comentario: "",
};

const emptyPrestamo = {
  empleadoRfc: "",
  fechaInicio: "",
  fechaFin: "",
  motivo: "",
  saleDEdificio: false,
  propositoSalida: "",
};

function fmtFecha(iso) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

// ── CatalogoCard (componente externo para evitar re-render) ───────────────────

function CatalogoCard({ catalogo, puedeGestionar, onVerUnidades, onEditar, onEliminar, onAgregarUnidad }) {
  const totalUnidades = catalogo._count?.unidades ?? 0;
  const disponibles = catalogo.unidades?.length ?? 0;
  const isSala = catalogo.tipo === "INMOBILIARIO";

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 3 },
      }}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: isSala ? "info.50" : "primary.50",
              color: isSala ? "info.main" : "primary.main",
              flexShrink: 0,
            }}
          >
            {isSala ? <MeetingRoomIcon fontSize="small" /> : <LaptopIcon fontSize="small" />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ lineHeight: 1.3, mb: 0.5, wordBreak: "break-word" }}
            >
              {catalogo.nombre}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              <Chip
                label={TIPO_LABEL[catalogo.tipo]}
                size="small"
                variant="outlined"
                color={isSala ? "info" : "primary"}
                sx={{ height: 20, fontSize: 11 }}
              />
              {catalogo.marca && (
                <Chip
                  label={catalogo.marca}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
            </Box>
          </Box>
        </Box>

        {catalogo.capacidad && (
          <Typography variant="caption" color="text.secondary">
            Aforo: {catalogo.capacidad} personas
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Chip
            label={`${disponibles} disponible${disponibles !== 1 ? "s" : ""}`}
            size="small"
            color={disponibles > 0 ? "success" : "error"}
            sx={{ height: 20, fontSize: 11 }}
          />
          <Chip
            label={`${totalUnidades} total`}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
        </Box>
      </CardContent>

      <Divider />

      <CardActions sx={{ px: 1.5, py: 0.75, justifyContent: "space-between" }}>
        <Tooltip title="Ver unidades">
          <IconButton size="small" onClick={onVerUnidades}>
            <AssignmentIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {puedeGestionar && (
            <>
              <Tooltip title="Agregar unidad">
                <IconButton size="small" color="primary" onClick={onAgregarUnidad}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Editar tipo">
                <IconButton size="small" onClick={onEditar}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Eliminar tipo">
                <IconButton size="small" color="error" onClick={onEliminar}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </CardActions>
    </Card>
  );
}

// ── RecursosPage ──────────────────────────────────────────────────────────────

export const RecursosPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isGestor = user?.rol === "GESTOR_RECURSOS_MATERIALES";
  const isAdmin = user?.rol === "ADMIN";
  const puedeGestionar = isGestor || isAdmin;

  const [tab, setTab] = useState(0);

  // ── Solicitudes (Tab 0) ───────────────────────────────────────────────────
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [errorTickets, setErrorTickets] = useState("");

  // ── Inventario (Tab 1) — Catálogos ────────────────────────────────────────
  const [catalogos, setCatalogos] = useState([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [errorCatalogos, setErrorCatalogos] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");

  // ── Dialog: Unidades de un catálogo ──────────────────────────────────────
  const [dialogUnidades, setDialogUnidades] = useState(null); // null | catalogo
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // ── Dialog: Historial asignaciones de una unidad ─────────────────────────
  const [dialogHistorial, setDialogHistorial] = useState(null); // null | unidad
  const [asignaciones, setAsignaciones] = useState([]);
  const [loadingAsig, setLoadingAsig] = useState(false);

  // ── Dialog: Nueva unidad ─────────────────────────────────────────────────
  const [dialogNuevaUnidad, setDialogNuevaUnidad] = useState(null); // null | catalogoId
  const [formUnidad, setFormUnidad] = useState({ numSerie: "", piso: "", areaId: "", disponible: true });
  const [savingUnidad, setSavingUnidad] = useState(false);
  const [errorUnidadForm, setErrorUnidadForm] = useState("");

  // ── Dialog: Nuevo / Editar catálogo ──────────────────────────────────────
  const [dialogCatalogo, setDialogCatalogo] = useState(null); // null | "nuevo" | catalogo
  const [formCatalogo, setFormCatalogo] = useState({
    nombre: "",
    tipo: "TECNOLOGICO",
    marca: "",
    descripcion: "",
    capacidad: "",
  });
  const [savingCatalogo, setSavingCatalogo] = useState(false);
  const [errorCatalogoForm, setErrorCatalogoForm] = useState("");

  // ── Dialog: Préstamo directo de una unidad ────────────────────────────────
  const [dialogPrestamoUnidad, setDialogPrestamoUnidad] = useState(null); // null | { unidad, catalogo }
  const [formPrestamo, setFormPrestamo] = useState(emptyPrestamo);
  const [savingPrestamo, setSavingPrestamo] = useState(false);
  const [errorPrestamoForm, setErrorPrestamoForm] = useState("");

  // ── Dialog: Gestionar solicitud (Aprobar / Rechazar) ─────────────────────
  const [dialogAsig, setDialogAsig] = useState(null);
  const [formAsig, setFormAsig] = useState(emptyAsignacion);
  const [catalogoSelId, setCatalogoSelId] = useState("");
  const [unidadSelId, setUnidadSelId] = useState("");
  const [savingAsig, setSavingAsig] = useState(false);
  const [errorAsigForm, setErrorAsigForm] = useState("");

  // ── Dialog: Orden de salida ───────────────────────────────────────────────
  const [ordenSalidaData, setOrdenSalidaData] = useState(null);
  const [dialogOrden, setDialogOrden] = useState(false);

  // ── Scanner de código de barras ───────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState("buscar"); // "buscar" | "nueva_unidad"

  // ── Carga de datos ────────────────────────────────────────────────────────

  const loadCatalogos = useCallback(async () => {
    setLoadingCatalogos(true);
    setErrorCatalogos("");
    try {
      const res = await getCatalogos();
      setCatalogos(res.data ?? []);
    } catch {
      setErrorCatalogos("Error al cargar el inventario");
    } finally {
      setLoadingCatalogos(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setErrorTickets("");
    try {
      const res = await getTickets({ categoria: "RECURSOS_MATERIALES" });
      setTickets(res.tickets ?? []);
    } catch {
      setErrorTickets("Error al cargar solicitudes");
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // Cargar catálogos siempre (necesarios en ambos tabs para el selector de asignación)
  useEffect(() => {
    loadCatalogos();
  }, [loadCatalogos]);

  useEffect(() => {
    if (tab === 0) loadTickets();
  }, [tab, loadTickets]);

  // ── CRUD Catálogo ─────────────────────────────────────────────────────────

  const handleGuardarCatalogo = async () => {
    if (!formCatalogo.nombre.trim()) {
      setErrorCatalogoForm("El nombre es requerido.");
      return;
    }
    setSavingCatalogo(true);
    setErrorCatalogoForm("");
    try {
      const payload = {
        nombre: formCatalogo.nombre,
        tipo: formCatalogo.tipo,
        descripcion: formCatalogo.descripcion || undefined,
        marca: formCatalogo.marca || undefined,
        capacidad: formCatalogo.capacidad ? Number(formCatalogo.capacidad) : undefined,
      };

      if (dialogCatalogo === "nuevo") {
        await createCatalogo(payload);
      } else {
        await updateCatalogo(dialogCatalogo.id, payload);
      }
      setDialogCatalogo(null);
      loadCatalogos();
    } catch (err) {
      setErrorCatalogoForm(err?.response?.data?.error ?? "Error al guardar.");
    } finally {
      setSavingCatalogo(false);
    }
  };

  const handleEliminarCatalogo = async (cat) => {
    if (!window.confirm(`¿Eliminar el tipo "${cat.nombre}" y todas sus unidades?`)) return;
    try {
      await deleteCatalogo(cat.id);
      loadCatalogos();
    } catch (err) {
      alert(err?.response?.data?.error ?? "Error al eliminar.");
    }
  };

  // ── Ver unidades de un catálogo ───────────────────────────────────────────

  const handleVerUnidades = useCallback(async (catalogo) => {
    setDialogUnidades(catalogo);
    setLoadingUnidades(true);
    try {
      const res = await getUnidades(catalogo.id);
      setUnidades(res.data ?? []);
    } catch {
      setUnidades([]);
    } finally {
      setLoadingUnidades(false);
    }
  }, []);

  // ── CRUD Unidad ───────────────────────────────────────────────────────────

  const handleGuardarUnidad = async () => {
    setSavingUnidad(true);
    setErrorUnidadForm("");
    try {
      const payload = {
        numSerie: formUnidad.numSerie || undefined,
        piso: formUnidad.piso || undefined,
        areaId: formUnidad.areaId || undefined,
        disponible: formUnidad.disponible,
      };
      await createUnidad(dialogNuevaUnidad, payload);
      setDialogNuevaUnidad(null);
      loadCatalogos();
      // Si el dialog de unidades está abierto, refrescar
      if (dialogUnidades?.id === dialogNuevaUnidad) {
        const res = await getUnidades(dialogNuevaUnidad);
        setUnidades(res.data ?? []);
      }
    } catch (err) {
      setErrorUnidadForm(err?.response?.data?.error ?? "Error al guardar la unidad.");
    } finally {
      setSavingUnidad(false);
    }
  };

  const handleEliminarUnidad = async (unidad) => {
    if (!window.confirm(`¿Eliminar la unidad${unidad.numSerie ? ` N/S: ${unidad.numSerie}` : ""} ?`)) return;
    try {
      await deleteUnidad(unidad.id);
      // Refrescar la lista de unidades en el dialog
      if (dialogUnidades) {
        const res = await getUnidades(dialogUnidades.id);
        setUnidades(res.data ?? []);
      }
      loadCatalogos();
    } catch (err) {
      alert(err?.response?.data?.error ?? "Error al eliminar la unidad.");
    }
  };

  // ── Historial de una unidad ───────────────────────────────────────────────

  const handleVerHistorialUnidad = async (unidad) => {
    setDialogHistorial(unidad);
    setLoadingAsig(true);
    try {
      const res = await getAsignaciones({ unidadId: unidad.id });
      setAsignaciones(res.data ?? []);
    } catch {
      setAsignaciones([]);
    } finally {
      setLoadingAsig(false);
    }
  };

  const handleDevolver = async (asignacion) => {
    if (!window.confirm("¿Marcar esta asignación como devuelta y liberar la unidad?")) return;
    try {
      await updateAsignacion(asignacion.id, { estado: "DEVUELTA" });
      const res = await getAsignaciones({ unidadId: dialogHistorial.id });
      setAsignaciones(res.data ?? []);
      loadCatalogos();
    } catch (err) {
      alert(err?.response?.data?.error ?? "Error al registrar la devolución.");
    }
  };

  // ── Préstamo directo de unidad ────────────────────────────────────────────

  const handleAbrirPrestamoUnidad = (unidad, catalogo) => {
    setFormPrestamo(emptyPrestamo);
    setErrorPrestamoForm("");
    setDialogPrestamoUnidad({ unidad, catalogo });
  };

  const handleConfirmarPrestamo = async () => {
    if (!formPrestamo.empleadoRfc.trim()) {
      setErrorPrestamoForm("El RFC del empleado es requerido.");
      return;
    }
    if (!formPrestamo.motivo.trim()) {
      setErrorPrestamoForm("El motivo es requerido para préstamos directos.");
      return;
    }
    if (formPrestamo.saleDEdificio && !formPrestamo.propositoSalida.trim()) {
      setErrorPrestamoForm("El propósito de salida es requerido.");
      return;
    }
    setSavingPrestamo(true);
    setErrorPrestamoForm("");
    try {
      const res = await createAsignacion({
        unidadId: dialogPrestamoUnidad.unidad.id,
        empleadoRfc: formPrestamo.empleadoRfc,
        fechaInicio: formPrestamo.fechaInicio || undefined,
        fechaFin: formPrestamo.fechaFin || undefined,
        saleDEdificio: formPrestamo.saleDEdificio,
        propositoSalida: formPrestamo.propositoSalida || undefined,
        comentario: formPrestamo.motivo,
      });

      const asigId = res.data?.id;
      const updated = await updateAsignacion(asigId, {
        estado: "APROBADA",
        saleDEdificio: formPrestamo.saleDEdificio,
        propositoSalida: formPrestamo.propositoSalida || undefined,
        fechaInicio: formPrestamo.fechaInicio || undefined,
        fechaFin: formPrestamo.fechaFin || undefined,
      });

      setDialogPrestamoUnidad(null);

      if (formPrestamo.saleDEdificio && updated.data?.ordenSalidaFolio) {
        const orden = await getOrdenSalida(asigId);
        setOrdenSalidaData(orden.data);
        setDialogOrden(true);
      }

      loadCatalogos();
      if (dialogUnidades) {
        const res2 = await getUnidades(dialogUnidades.id);
        setUnidades(res2.data ?? []);
      }
    } catch (err) {
      setErrorPrestamoForm(err?.response?.data?.error ?? "Error al registrar el préstamo.");
    } finally {
      setSavingPrestamo(false);
    }
  };

  // ── Gestión de solicitudes ────────────────────────────────────────────────

  const handleAbrirDialogAsig = (ticket) => {
    setFormAsig(emptyAsignacion);
    setCatalogoSelId("");
    setUnidadSelId("");
    setErrorAsigForm("");
    setDialogAsig(ticket);
  };

  const handleApprove = async () => {
    if (!unidadSelId) {
      setErrorAsigForm("Selecciona una unidad específica.");
      return;
    }
    if (formAsig.saleDEdificio && !formAsig.propositoSalida.trim()) {
      setErrorAsigForm("El propósito de salida es requerido cuando el equipo sale del edificio.");
      return;
    }
    setSavingAsig(true);
    setErrorAsigForm("");
    try {
      const res = await createAsignacion({
        unidadId: Number(unidadSelId),
        ticketId: dialogAsig.id,
        empleadoRfc: dialogAsig.empleadoRfc,
        fechaInicio: formAsig.fechaInicio || undefined,
        fechaFin: formAsig.fechaFin || undefined,
        saleDEdificio: formAsig.saleDEdificio,
        propositoSalida: formAsig.propositoSalida || undefined,
        comentario: formAsig.comentario || undefined,
      });

      const asigId = res.data?.id;
      const updated = await updateAsignacion(asigId, {
        estado: "APROBADA",
        saleDEdificio: formAsig.saleDEdificio,
        propositoSalida: formAsig.propositoSalida || undefined,
        fechaInicio: formAsig.fechaInicio || undefined,
        fechaFin: formAsig.fechaFin || undefined,
      });

      setDialogAsig(null);

      if (formAsig.saleDEdificio && updated.data?.ordenSalidaFolio) {
        const orden = await getOrdenSalida(asigId);
        setOrdenSalidaData(orden.data);
        setDialogOrden(true);
      }

      loadTickets();
      loadCatalogos();
    } catch (err) {
      setErrorAsigForm(err?.response?.data?.error ?? "Error al aprobar la solicitud.");
    } finally {
      setSavingAsig(false);
    }
  };

  const handleReject = async () => {
    if (!formAsig.comentario.trim()) {
      setErrorAsigForm("Escribe un comentario de rechazo.");
      return;
    }
    // Necesitamos una unidad para registrar el rechazo — usar la primera disponible si no se seleccionó
    const anyUnidad =
      Number(unidadSelId) ||
      catalogos.flatMap((c) => c.unidades ?? []).find((u) => u)?.id;
    if (!anyUnidad) {
      setErrorAsigForm("No hay unidades en el inventario para registrar el rechazo.");
      return;
    }
    setSavingAsig(true);
    setErrorAsigForm("");
    try {
      const res = await createAsignacion({
        unidadId: anyUnidad,
        ticketId: dialogAsig.id,
        empleadoRfc: dialogAsig.empleadoRfc,
        comentario: formAsig.comentario,
      });
      await updateAsignacion(res.data?.id, {
        estado: "RECHAZADA",
        comentario: formAsig.comentario,
      });
      setDialogAsig(null);
      loadTickets();
      loadCatalogos();
    } catch (err) {
      setErrorAsigForm(err?.response?.data?.error ?? "Error al rechazar la solicitud.");
    } finally {
      setSavingAsig(false);
    }
  };

  // ── Scanner ───────────────────────────────────────────────────────────────

  const handleScanned = useCallback(
    async (codigo) => {
      if (scannerMode === "nueva_unidad") {
        setFormUnidad((f) => ({ ...f, numSerie: codigo }));
        return;
      }
      // modo buscar: localizar unidad y abrir su catálogo
      try {
        const res = await buscarPorSerie(codigo);
        if (res.data) {
          handleVerUnidades(res.data.catalogo);
        }
      } catch {
        alert(`No se encontró ningún equipo con el número de serie: ${codigo}`);
      }
    },
    [scannerMode, handleVerUnidades],
  );

  // ── Filtrado de catálogos ─────────────────────────────────────────────────

  const catalogosFiltrados = useMemo(() => {
    let lista = catalogos;
    if (filtroTipo !== "TODOS") lista = lista.filter((c) => c.tipo === filtroTipo);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) || (c.marca ?? "").toLowerCase().includes(q),
      );
    }
    return lista;
  }, [catalogos, filtroTipo, busqueda]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <InventoryIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Recursos Materiales
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab
          label="Solicitudes"
          icon={<ConfirmationNumberIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          label="Inventario"
          icon={<AssignmentIcon fontSize="small" />}
          iconPosition="start"
        />
      </Tabs>

      {/* ── TAB 0: Solicitudes ─────────────────────────────────────────────── */}
      {tab === 0 && (
        <Paper sx={{ p: 0 }}>
          {loadingTickets ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Asunto</TableCell>
                    <TableCell>Subcategoría</TableCell>
                    <TableCell>Empleado</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Fecha</TableCell>
                    {puedeGestionar && <TableCell align="right">Acciones</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton variant="text" width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      <TableCell><Skeleton variant="text" width={140} /></TableCell>
                      <TableCell><Skeleton variant="text" width={70} /></TableCell>
                      <TableCell><Skeleton variant="text" width={110} /></TableCell>
                      {puedeGestionar && <TableCell><Skeleton variant="text" width={40} /></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : errorTickets ? (
            <Alert severity="error" sx={{ m: 2 }}>{errorTickets}</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Asunto</TableCell>
                    <TableCell>Subcategoría</TableCell>
                    <TableCell>Empleado</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Fecha</TableCell>
                    {puedeGestionar && <TableCell align="right">Acciones</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={puedeGestionar ? 7 : 6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No hay solicitudes de recursos materiales.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((t) => (
                      <TableRow
                        key={t.id}
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() => navigate(`/tickets/${t.id}`)}
                      >
                        <TableCell>
                          <Typography
                            variant="caption"
                            fontFamily="monospace"
                            fontWeight={700}
                            color="primary"
                          >
                            {t.folio ?? `#${t.id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>{t.asunto}</TableCell>
                        <TableCell>
                          {SUBCATEGORIA_LABEL[t.subcategoria] ?? t.subcategoria}
                        </TableCell>
                        <TableCell>{t.empleado?.nombreCompleto ?? t.empleadoRfc}</TableCell>
                        <TableCell>
                          <Chip
                            label={t.estado}
                            size="small"
                            color={
                              t.estado === "RESUELTO"
                                ? "success"
                                : t.estado === "CANCELADO"
                                  ? "default"
                                  : t.estado === "EN_PROGRESO"
                                    ? "secondary"
                                    : t.estado === "ASIGNADO"
                                      ? "warning"
                                      : "info"
                            }
                          />
                        </TableCell>
                        <TableCell>{fmtFecha(t.createdAt)}</TableCell>
                        {puedeGestionar && (
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            {["ABIERTO", "ASIGNADO"].includes(t.estado) && (
                              <Tooltip title="Gestionar solicitud">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleAbrirDialogAsig(t)}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ── TAB 1: Inventario (catálogos + unidades) ──────────────────────── */}
      {tab === 1 && (
        <Box>
          {/* Barra de herramientas */}
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              mb: 2,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <ToggleButtonGroup
              value={filtroTipo}
              exclusive
              onChange={(_, v) => v && setFiltroTipo(v)}
              size="small"
            >
              <ToggleButton value="TODOS">Todos</ToggleButton>
              <ToggleButton value="TECNOLOGICO">Tecnológico</ToggleButton>
              <ToggleButton value="INMOBILIARIO">Inmobiliario</ToggleButton>
            </ToggleButtonGroup>

            <TextField
              size="small"
              placeholder="Buscar catálogo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              sx={{ flex: 1, minWidth: 180 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Tooltip title="Buscar por código de barras (número de serie)">
              <IconButton
                onClick={() => {
                  setScannerMode("buscar");
                  setScannerOpen(true);
                }}
              >
                <QrCodeScannerIcon />
              </IconButton>
            </Tooltip>

            {puedeGestionar && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                size="small"
                onClick={() => {
                  setFormCatalogo({
                    nombre: "",
                    tipo: "TECNOLOGICO",
                    marca: "",
                    descripcion: "",
                    capacidad: "",
                  });
                  setErrorCatalogoForm("");
                  setDialogCatalogo("nuevo");
                }}
              >
                Nuevo tipo
              </Button>
            )}
          </Box>

          {/* Grid de catálogos */}
          {loadingCatalogos ? (
            <Grid container spacing={2}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                  <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          ) : errorCatalogos ? (
            <Alert severity="error">{errorCatalogos}</Alert>
          ) : catalogosFiltrados.length === 0 ? (
            <Paper sx={{ py: 6, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {busqueda || filtroTipo !== "TODOS"
                  ? "Sin resultados."
                  : "No hay tipos de recurso registrados."}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {catalogosFiltrados.map((cat) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={cat.id}>
                  <CatalogoCard
                    catalogo={cat}
                    puedeGestionar={puedeGestionar}
                    onVerUnidades={() => handleVerUnidades(cat)}
                    onEditar={() => {
                      setFormCatalogo({
                        nombre: cat.nombre,
                        tipo: cat.tipo,
                        marca: cat.marca ?? "",
                        descripcion: cat.descripcion ?? "",
                        capacidad: cat.capacidad ?? "",
                      });
                      setErrorCatalogoForm("");
                      setDialogCatalogo(cat);
                    }}
                    onEliminar={() => handleEliminarCatalogo(cat)}
                    onAgregarUnidad={() => {
                      setFormUnidad({ numSerie: "", piso: "", areaId: "", disponible: true });
                      setErrorUnidadForm("");
                      setDialogNuevaUnidad(cat.id);
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          <Typography variant="caption" color="text.disabled" sx={{ mt: 2, display: "block" }}>
            {catalogosFiltrados.length} tipo{catalogosFiltrados.length !== 1 ? "s" : ""} mostrado
            {catalogosFiltrados.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      )}

      {/* ── Dialog: Nuevo / Editar Catálogo ─────────────────────────────── */}
      <Dialog
        open={Boolean(dialogCatalogo)}
        onClose={() => setDialogCatalogo(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogCatalogo === "nuevo"
            ? "Registrar nuevo tipo de recurso"
            : `Editar — ${dialogCatalogo?.nombre}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {errorCatalogoForm && <Alert severity="error">{errorCatalogoForm}</Alert>}

            <TextField
              label="Nombre *"
              value={formCatalogo.nombre}
              onChange={(e) => setFormCatalogo((f) => ({ ...f, nombre: e.target.value }))}
              fullWidth
              size="small"
              placeholder="Ej: Laptop Dell Latitude 5520, Sala A de Juntas…"
            />

            <FormControl fullWidth size="small">
              <InputLabel>Tipo *</InputLabel>
              <Select
                value={formCatalogo.tipo}
                label="Tipo *"
                onChange={(e) =>
                  setFormCatalogo((f) => ({ ...f, tipo: e.target.value, capacidad: "", marca: "" }))
                }
              >
                <MenuItem value="TECNOLOGICO">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <LaptopIcon fontSize="small" /> Tecnológico
                  </Box>
                </MenuItem>
                <MenuItem value="INMOBILIARIO">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MeetingRoomIcon fontSize="small" /> Inmobiliario / Sala
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {formCatalogo.tipo === "TECNOLOGICO" && (
              <TextField
                label="Marca"
                value={formCatalogo.marca}
                onChange={(e) => setFormCatalogo((f) => ({ ...f, marca: e.target.value }))}
                fullWidth
                size="small"
                placeholder="Dell, HP, Epson…"
              />
            )}

            {formCatalogo.tipo === "INMOBILIARIO" && (
              <TextField
                label="Capacidad (aforo de personas)"
                type="number"
                value={formCatalogo.capacidad}
                onChange={(e) => setFormCatalogo((f) => ({ ...f, capacidad: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
              />
            )}

            <TextField
              label="Descripción"
              value={formCatalogo.descripcion}
              onChange={(e) => setFormCatalogo((f) => ({ ...f, descripcion: e.target.value }))}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogCatalogo(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarCatalogo} disabled={savingCatalogo}>
            {savingCatalogo ? <CircularProgress size={18} /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Unidades de un catálogo ─────────────────────────────── */}
      <Dialog
        open={Boolean(dialogUnidades)}
        onClose={() => setDialogUnidades(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="inherit">Unidades — {dialogUnidades?.nombre}</Typography>
            {puedeGestionar && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setFormUnidad({ numSerie: "", piso: "", areaId: "", disponible: true });
                  setErrorUnidadForm("");
                  setDialogNuevaUnidad(dialogUnidades?.id);
                }}
              >
                Agregar unidad
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingUnidades ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : unidades.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Sin unidades registradas. Usa "Agregar unidad" para dar de alta la primera.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>N/S</TableCell>
                    <TableCell>Disponible</TableCell>
                    <TableCell>Piso</TableCell>
                    <TableCell>Área</TableCell>
                    <TableCell>Asig. activas</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unidades.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {u.numSerie ?? `— (ID #${u.id})`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.disponible ? "Disponible" : "Ocupada"}
                          size="small"
                          color={u.disponible ? "success" : "warning"}
                        />
                      </TableCell>
                      <TableCell>{PISO_LABELS[u.piso] ?? "—"}</TableCell>
                      <TableCell>{u.areaId ?? "—"}</TableCell>
                      <TableCell>{u._count?.asignaciones ?? 0}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                          <Tooltip title="Historial de asignaciones">
                            <IconButton size="small" onClick={() => handleVerHistorialUnidad(u)}>
                              <AssignmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {u.disponible && puedeGestionar && (
                            <Tooltip title="Préstamo directo">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleAbrirPrestamoUnidad(u, dialogUnidades)}
                              >
                                <HandshakeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {puedeGestionar && (
                            <>
                              <Tooltip title="Eliminar unidad">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleEliminarUnidad(u)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogUnidades(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Nueva unidad ─────────────────────────────────────────── */}
      <Dialog
        open={Boolean(dialogNuevaUnidad)}
        onClose={() => setDialogNuevaUnidad(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Agregar unidad física</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {errorUnidadForm && <Alert severity="error">{errorUnidadForm}</Alert>}

            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Número de serie"
                value={formUnidad.numSerie}
                onChange={(e) => setFormUnidad((f) => ({ ...f, numSerie: e.target.value }))}
                fullWidth
                size="small"
                placeholder="Dejar vacío si no aplica"
              />
              <Tooltip title="Escanear código de barras">
                <IconButton
                  onClick={() => {
                    setScannerMode("nueva_unidad");
                    setScannerOpen(true);
                  }}
                >
                  <QrCodeScannerIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Piso</InputLabel>
              <Select
                value={formUnidad.piso}
                label="Piso"
                onChange={(e) => setFormUnidad((f) => ({ ...f, piso: e.target.value }))}
              >
                <MenuItem value="">Sin especificar</MenuItem>
                <MenuItem value="PB">Planta Baja</MenuItem>
                <MenuItem value="NIVEL_1">Nivel 1</MenuItem>
                <MenuItem value="NIVEL_2">Nivel 2</MenuItem>
                <MenuItem value="NIVEL_3">Nivel 3</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Área / Oficina"
              value={formUnidad.areaId}
              onChange={(e) => setFormUnidad((f) => ({ ...f, areaId: e.target.value }))}
              fullWidth
              size="small"
              placeholder="Ej: Dirección de TI, Oficina 201…"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formUnidad.disponible}
                  onChange={(e) => setFormUnidad((f) => ({ ...f, disponible: e.target.checked }))}
                />
              }
              label="Disponible para préstamo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogNuevaUnidad(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarUnidad} disabled={savingUnidad}>
            {savingUnidad ? <CircularProgress size={18} /> : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Historial asignaciones de una unidad ─────────────────── */}
      <Dialog
        open={Boolean(dialogHistorial)}
        onClose={() => setDialogHistorial(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Historial de asignaciones —{" "}
          {dialogHistorial?.numSerie ? `N/S: ${dialogHistorial.numSerie}` : `Unidad #${dialogHistorial?.id}`}
        </DialogTitle>
        <DialogContent>
          {loadingAsig ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : asignaciones.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Sin asignaciones registradas.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Estado</TableCell>
                    <TableCell>Empleado</TableCell>
                    <TableCell>Gestor</TableCell>
                    <TableCell>Periodo</TableCell>
                    <TableCell>Sale edificio</TableCell>
                    <TableCell>Folio OS</TableCell>
                    {puedeGestionar && <TableCell align="right">Acciones</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asignaciones.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Chip
                          label={ESTADO_ASIG_LABEL[a.estado]}
                          size="small"
                          color={ESTADO_ASIG_COLOR[a.estado] ?? "default"}
                        />
                      </TableCell>
                      <TableCell>{a.empleado?.nombreCompleto ?? a.empleadoRfc ?? "—"}</TableCell>
                      <TableCell>
                        {a.gestor ? `${a.gestor.nombre} ${a.gestor.apellidos}` : "—"}
                      </TableCell>
                      <TableCell>
                        {a.fechaInicio ? fmtFecha(a.fechaInicio) : "—"} →{" "}
                        {a.fechaFin ? fmtFecha(a.fechaFin) : "—"}
                      </TableCell>
                      <TableCell>{a.saleDEdificio ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {a.ordenSalidaFolio ?? "—"}
                        </Typography>
                      </TableCell>
                      {puedeGestionar && (
                        <TableCell align="right">
                          {a.estado === "APROBADA" && (
                            <Tooltip title="Registrar devolución">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => handleDevolver(a)}
                                sx={{ fontSize: 11, py: 0.25, px: 1 }}
                              >
                                Devolver
                              </Button>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogHistorial(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Gestionar solicitud (Aprobar / Rechazar) ────────────── */}
      <Dialog
        open={Boolean(dialogAsig)}
        onClose={() => setDialogAsig(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Gestionar solicitud — {dialogAsig?.folio ?? `#${dialogAsig?.id}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {errorAsigForm && <Alert severity="error">{errorAsigForm}</Alert>}

            <Typography variant="body2" color="text.secondary">
              <strong>Asunto:</strong> {dialogAsig?.asunto}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Subcategoría:</strong>{" "}
              {SUBCATEGORIA_LABEL[dialogAsig?.subcategoria] ?? dialogAsig?.subcategoria}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Empleado:</strong>{" "}
              {dialogAsig?.empleado?.nombreCompleto ?? dialogAsig?.empleadoRfc}
            </Typography>

            {/* recursosAdicionales del ticket */}
            {dialogAsig?.recursosAdicionales &&
              (() => {
                let parsed = null;
                try {
                  parsed = JSON.parse(dialogAsig.recursosAdicionales);
                } catch {
                  return null;
                }
                if (!parsed) return null;
                return (
                  <Box>
                    <Divider sx={{ mb: 1 }} />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={600}
                      display="block"
                      gutterBottom
                    >
                      EQUIPAMIENTO / MATERIALES SOLICITADOS
                    </Typography>
                    {parsed.tipo === "SALA_JUNTAS" && parsed.equipo?.length > 0 && (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {parsed.equipo.map((item) => (
                          <Chip key={item} label={item} size="small" variant="outlined" color="info" />
                        ))}
                      </Box>
                    )}
                    {parsed.tipo === "PRESTAMO_EQUIPO" && (
                      <Chip
                        label={parsed.equipoPreferido}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                );
              })()}

            <Divider />

            {/* Selector: tipo de recurso (catálogo) */}
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de recurso *</InputLabel>
              <Select
                value={catalogoSelId}
                label="Tipo de recurso *"
                onChange={(e) => {
                  setCatalogoSelId(e.target.value);
                  setUnidadSelId("");
                }}
              >
                {catalogos.filter((c) => (c.unidades?.length ?? 0) > 0).length === 0 && (
                  <MenuItem disabled value="">
                    No hay recursos disponibles
                  </MenuItem>
                )}
                {catalogos
                  .filter((c) => (c.unidades?.length ?? 0) > 0)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.nombre}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({c.unidades?.length} disponible{c.unidades?.length !== 1 ? "s" : ""})
                      </Typography>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {/* Selector: unidad específica */}
            {catalogoSelId && (
              <FormControl fullWidth size="small">
                <InputLabel>Unidad (número de serie) *</InputLabel>
                <Select
                  value={unidadSelId}
                  label="Unidad (número de serie) *"
                  onChange={(e) => setUnidadSelId(e.target.value)}
                >
                  {catalogos
                    .find((c) => c.id === Number(catalogoSelId))
                    ?.unidades?.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.numSerie ?? `Unidad #${u.id}`}
                        {u.piso && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            ({PISO_LABELS[u.piso]})
                          </Typography>
                        )}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}

            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField
                  label="Fecha inicio"
                  type="datetime-local"
                  value={formAsig.fechaInicio}
                  onChange={(e) => setFormAsig((f) => ({ ...f, fechaInicio: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Fecha fin"
                  type="datetime-local"
                  value={formAsig.fechaFin}
                  onChange={(e) => setFormAsig((f) => ({ ...f, fechaFin: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            {dialogAsig?.subcategoria === "PRESTAMO_EQUIPO" && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formAsig.saleDEdificio}
                    onChange={(e) =>
                      setFormAsig((f) => ({ ...f, saleDEdificio: e.target.checked }))
                    }
                  />
                }
                label="¿El equipo sale del edificio?"
              />
            )}

            {formAsig.saleDEdificio && (
              <TextField
                label="Propósito de salida *"
                value={formAsig.propositoSalida}
                onChange={(e) =>
                  setFormAsig((f) => ({ ...f, propositoSalida: e.target.value }))
                }
                fullWidth
                size="small"
                multiline
                rows={2}
              />
            )}

            <TextField
              label="Comentario"
              value={formAsig.comentario}
              onChange={(e) => setFormAsig((f) => ({ ...f, comentario: e.target.value }))}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="Motivo de aprobación o rechazo…"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            onClick={handleReject}
            disabled={savingAsig}
          >
            Rechazar
          </Button>
          <Button onClick={() => setDialogAsig(null)} disabled={savingAsig}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleApprove}
            disabled={savingAsig}
          >
            {savingAsig ? <CircularProgress size={18} /> : "Aprobar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Préstamo directo de unidad ──────────────────────────── */}
      <Dialog
        open={Boolean(dialogPrestamoUnidad)}
        onClose={() => setDialogPrestamoUnidad(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Préstamo directo —{" "}
          {dialogPrestamoUnidad?.unidad?.numSerie
            ? `N/S: ${dialogPrestamoUnidad.unidad.numSerie}`
            : dialogPrestamoUnidad?.catalogo?.nombre}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Alert severity="info" icon={<HandshakeIcon />}>
              Préstamo directo sin solicitud. Úsalo solo en casos justificados (urgencias,
              comisiones, etc.).
            </Alert>

            {errorPrestamoForm && <Alert severity="error">{errorPrestamoForm}</Alert>}

            <TextField
              label="RFC del empleado *"
              value={formPrestamo.empleadoRfc}
              onChange={(e) =>
                setFormPrestamo((f) => ({ ...f, empleadoRfc: e.target.value.toUpperCase() }))
              }
              fullWidth
              size="small"
              placeholder="XXXX000000XXX"
              inputProps={{ maxLength: 13 }}
            />

            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField
                  label="Fecha de inicio"
                  type="datetime-local"
                  value={formPrestamo.fechaInicio}
                  onChange={(e) =>
                    setFormPrestamo((f) => ({ ...f, fechaInicio: e.target.value }))
                  }
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Fecha de devolución"
                  type="datetime-local"
                  value={formPrestamo.fechaFin}
                  onChange={(e) =>
                    setFormPrestamo((f) => ({ ...f, fechaFin: e.target.value }))
                  }
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <TextField
              label="Motivo / justificación *"
              value={formPrestamo.motivo}
              onChange={(e) => setFormPrestamo((f) => ({ ...f, motivo: e.target.value }))}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="Comisión de servicio, urgencia operativa…"
              helperText="Requerido. Justifica por qué se procede sin solicitud formal."
            />

            {dialogPrestamoUnidad?.catalogo?.tipo === "TECNOLOGICO" && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formPrestamo.saleDEdificio}
                      onChange={(e) =>
                        setFormPrestamo((f) => ({ ...f, saleDEdificio: e.target.checked }))
                      }
                    />
                  }
                  label="¿El equipo sale del edificio?"
                />
                {formPrestamo.saleDEdificio && (
                  <TextField
                    label="Propósito de salida *"
                    value={formPrestamo.propositoSalida}
                    onChange={(e) =>
                      setFormPrestamo((f) => ({ ...f, propositoSalida: e.target.value }))
                    }
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                  />
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogPrestamoUnidad(null)} disabled={savingPrestamo}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmarPrestamo}
            disabled={savingPrestamo}
            startIcon={savingPrestamo ? <CircularProgress size={16} /> : <HandshakeIcon />}
          >
            {savingPrestamo ? "Procesando…" : "Confirmar préstamo"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Orden de Salida ──────────────────────────────────────── */}
      <Dialog
        open={dialogOrden}
        onClose={() => {
          setDialogOrden(false);
          setOrdenSalidaData(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          Orden de Salida
          <Tooltip title="Imprimir orden">
            <IconButton onClick={() => window.print()} size="small">
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent>
          {ordenSalidaData && (
            <Card variant="outlined" sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} fontFamily="monospace" gutterBottom>
                  Folio: {ordenSalidaData.folio}
                </Typography>
                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      RECURSO
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Nombre</Typography>
                    <Typography variant="body2">{ordenSalidaData.recurso?.nombre}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Marca</Typography>
                    <Typography variant="body2">{ordenSalidaData.recurso?.marca || "—"}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">No. de Serie</Typography>
                    <Typography variant="body2">{ordenSalidaData.recurso?.numSerie || "—"}</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 1 }}>
                      RESPONSABLE
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Nombre</Typography>
                    <Typography variant="body2">{ordenSalidaData.empleado?.nombre}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">RFC</Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {ordenSalidaData.empleado?.rfc}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Puesto</Typography>
                    <Typography variant="body2">{ordenSalidaData.empleado?.puesto || "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Área</Typography>
                    <Typography variant="body2">{ordenSalidaData.empleado?.area || "—"}</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 1 }}>
                      PERIODO
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Fecha inicio</Typography>
                    <Typography variant="body2">{fmtFecha(ordenSalidaData.fechaInicio)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Fecha fin</Typography>
                    <Typography variant="body2">{fmtFecha(ordenSalidaData.fechaFin)}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Propósito de salida</Typography>
                    <Typography variant="body2">{ordenSalidaData.propositoSalida || "—"}</Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">
                      Gestor que autoriza
                    </Typography>
                    <Typography variant="body2">{ordenSalidaData.gestor?.nombre}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Fecha de emisión</Typography>
                    <Typography variant="body2">{fmtFecha(ordenSalidaData.fechaEmision)}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.print()} startIcon={<PrintIcon />} variant="outlined">
            Imprimir
          </Button>
          <Button
            onClick={() => {
              setDialogOrden(false);
              setOrdenSalidaData(null);
            }}
            variant="contained"
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Scanner de código de barras ──────────────────────────────────── */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
        title={
          scannerMode === "nueva_unidad"
            ? "Escanear número de serie"
            : "Buscar equipo por código"
        }
      />
    </Box>
  );
};
