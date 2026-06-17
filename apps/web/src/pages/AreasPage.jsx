/**
 * AreasPage — Editor de Áreas del Edificio
 *
 * Ruta: /admin/areas  (solo ADMIN)
 *
 * Layout:
 *   Header (título + controles)
 *   Toggle Vista completa | Por zonas
 *   Grid (izquierda 67%) + Panel lateral con visor 3D o editor (derecha 33%)
 *
 * Integración visor 3D (iframe en panel lateral):
 *   - ROOM_CLICKED  → selecciona el área en el editor y navega al piso correcto
 *   - Al seleccionar/editar un área → llama showArea(id) en el visor
 *   - Al cargar el iframe → envía SET_THEME con el tema actual (fijo "light")
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.jsx";
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  TextField,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  CircularProgress,
  Alert,
  IconButton,
  Switch,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tabs,
  Tab,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import SaveIcon from "@mui/icons-material/Save";
import ThreeDRotationIcon from "@mui/icons-material/ThreeDRotation";
import ChairIcon from "@mui/icons-material/Chair";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import GridViewIcon from "@mui/icons-material/GridView";
import {
  getAreas,
  createArea,
  updateArea,
  deleteArea,
  getSirhAdscripciones,
  getMueblesByArea,
  createMueble,
  createFilaMuebles,
  deleteMueble,
} from "../api/catalogos.js";
import { AreaGridEditor } from "../components/areas/AreaGridEditor.jsx";
import { dentroDelEdificio, seSolapan, validarGeometriaArea } from "@stf/shared";

/** AreaEdificio (gridX1..gridY2) → rect { x1, y1, x2, y2 } para la validación compartida */
const areaToRect = (a) => ({
  id: a.id,
  label: a.label,
  floor: a.floor,
  x1: a.gridX1,
  y1: a.gridY1,
  x2: a.gridX2,
  y2: a.gridY2,
});

// ── Constantes ────────────────────────────────────────────────────────────────

const PISOS = [
  { piso: "PB", floor: 0, label: "PB" },
  { piso: "NIVEL_1", floor: 1, label: "2" },
  { piso: "NIVEL_2", floor: 2, label: "3" },
  { piso: "NIVEL_3", floor: 3, label: "4" },
];

const PISO_LABELS = { PB: "PB", NIVEL_1: "2", NIVEL_2: "3", NIVEL_3: "4" };

// Zonas del edificio: Ala Izquierda | Conector | Ala Derecha
const ZONES = [
  { key: "izq", label: "ALA IZQUIERDA", colStart: 0, colCount: 14, color: "#3f51b5" },
  { key: "conector", label: "CONECTOR", colStart: 13, colCount: 6, color: "#7b1fa2" },
  { key: "der", label: "ALA DERECHA", colStart: 18, colCount: 14, color: "#0277bd" },
];

const defaultCoordsForZone = (zoneKey) => {
  if (zoneKey === "conector") return { gridX1: 14, gridY1: 14, gridX2: 18, gridY2: 22 };
  if (zoneKey === "der") return { gridX1: 20, gridY1: 10, gridX2: 25, gridY2: 15 };
  return { gridX1: 1, gridY1: 10, gridX2: 6, gridY2: 15 };
};

const DEFAULT_COORDS = { gridX1: 1, gridY1: 1, gridX2: 6, gridY2: 5 };

const EMPTY_NUEVA = {
  id: "",
  label: "",
  piso: "PB",
  floor: 0,
  gridX1: String(DEFAULT_COORDS.gridX1),
  gridY1: String(DEFAULT_COORDS.gridY1),
  gridX2: String(DEFAULT_COORDS.gridX2),
  gridY2: String(DEFAULT_COORDS.gridY2),
  esComun: false,
  tipoComun: "",
  nombrePropio: "",
};

const TIPO_AREA_COMUN_LABELS = {
  SALA_JUNTAS: "Sala de Juntas",
  SALA_CONFERENCIAS: "Sala de Conferencias",
  BANO: "Bano",
  LACTANCIA: "Lactancia",
  COPIADO: "Copiado / Impresion",
  COMEDOR: "Comedor",
  RECEPCION: "Recepcion",
  ARCHIVO: "Archivo",
  BODEGA: "Bodega",
  OTRO: "Otro",
};

// ── Helpers SIRH ──────────────────────────────────────────────────────────────

function inferirPadres(hijos, padres) {
  const hijoPadre = {};
  padres.forEach((padre) => {
    const obras = (padre.proyectos ?? []).flatMap((proy) => proy.obras_actividades ?? []);
    obras.forEach((obra) => {
      const ue = obra.unidad_ejecutora;
      if (ue && typeof ue === "string") hijoPadre[ue] = padre.nombre;
    });
  });
  return (nombre) => hijoPadre[nombre] ?? null;
}

// ── Componente principal ──────────────────────────────────────────────────────

export const AreasPage = () => {
  // ── Estado global ──────────────────────────────────────────────────────────
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // SIRH
  const [sirh, setSirh] = useState(null);
  const [sirhLoading, setSirhLoading] = useState(false);
  const [sirhError, setSirhError] = useState("");

  // Selección
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saveError, setSaveError] = useState("");

  // Navegación: zona + piso
  const [alaIdx, setAlaIdx] = useState(0);
  const [pisoIdx, setPisoIdx] = useState(0);

  // Vista completa vs por zonas
  const [viewMode, setViewMode] = useState("zones"); // "full" | "zones"

  // Dirección de la transición de slide (para animación direccional)
  const [slideDir, setSlideDir] = useState("right"); // "right" | "left" | "up" | "down"
  const prevAlaRef = useRef(0);
  const prevPisoRef = useRef(0);

  // Modal Nueva Área
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevaForm, setNuevaForm] = useState(EMPTY_NUEVA);
  const [nuevaAdscripcion, setNuevaAdscripcion] = useState(null);
  const [nuevaError, setNuevaError] = useState("");
  const [nuevaSaving, setNuevaSaving] = useState(false);

  const visor3DRef = useRef(null);
  const [mueblesPorArea, setMueblesPorArea] = useState({});

  // ── Helper: comandar el visor 3D ──────────────────────────────────────────
  // Se define aquí para que pueda ser invocado desde handleSelect (abajo).
  const visorShowArea = useCallback((areaId) => {
    const iframe = visor3DRef.current;
    if (!iframe) return;
    // Acceso directo vía contentWindow (mismo origen en desarrollo)
    try {
      if (iframe.contentWindow?.SIAST3D) {
        iframe.contentWindow.SIAST3D.showArea(areaId);
        return;
      }
    } catch {
      // cross-origin: caer en postMessage
    }
    iframe.contentWindow?.postMessage({ type: "HIGHLIGHT_ROOM", payload: { roomId: areaId } }, "*");
  }, []);

  // ── Cambios pendientes (batch save) ──────────────────────────────────────
  const [pendingChanges, setPendingChanges] = useState(() => {
    try {
      const raw = localStorage.getItem("siast:areas:pending");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllError, setSaveAllError] = useState("");

  const pendingCount = Object.keys(pendingChanges).length;

  const persistPending = (next) => {
    setPendingChanges(next);
    try {
      localStorage.setItem("siast:areas:pending", JSON.stringify(next));
    } catch {}
  };

  const prevEditFormRef = useRef(null);
  useEffect(() => {
    if (!editForm || !editForm._dirty) return;
    if (
      prevEditFormRef.current?.id === editForm.id &&
      JSON.stringify(prevEditFormRef.current) === JSON.stringify(editForm)
    )
      return;
    prevEditFormRef.current = editForm;
    persistPending({
      ...pendingChanges,
      [editForm.id]: {
        label: editForm.label,
        gridX1: Number(editForm.gridX1),
        gridY1: Number(editForm.gridY1),
        gridX2: Number(editForm.gridX2),
        gridY2: Number(editForm.gridY2),
        floor: editForm.floor,
        esSalaJuntas: editForm.esSalaJuntas ?? false,
        esComun: editForm.esComun ?? false,
        tipoComun: editForm.tipoComun ?? null,
        nombrePropio: editForm.nombrePropio ?? null,
      },
    });
  }, [editForm]);

  const { ConfirmDialog } = useUnsavedChanges(pendingCount > 0);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  const loadAreas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAreas();
      const fetched = res.data ?? [];
      setAreas(fetched);
      setPendingChanges((prev) => {
        const cleaned = { ...prev };
        let changed = false;
        fetched.forEach((area) => {
          const p = cleaned[area.id];
          if (!p) return;
          const matches =
            p.label === area.label &&
            p.gridX1 === area.gridX1 &&
            p.gridY1 === area.gridY1 &&
            p.gridX2 === area.gridX2 &&
            p.gridY2 === area.gridY2 &&
            p.floor === area.floor &&
            (p.esSalaJuntas ?? false) === (area.esSalaJuntas ?? false) &&
            (p.esComun ?? false) === (area.esComun ?? false) &&
            (p.tipoComun ?? null) === (area.tipoComun ?? null) &&
            (p.nombrePropio ?? null) === (area.nombrePropio ?? null);
          if (matches) {
            delete cleaned[area.id];
            changed = true;
          }
        });
        if (!changed) return prev;
        try {
          localStorage.setItem("siast:areas:pending", JSON.stringify(cleaned));
        } catch {}
        return cleaned;
      });
    } catch (err) {
      setError(err.response?.data?.error ?? "Error al cargar las áreas");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSirh = useCallback(async () => {
    setSirhLoading(true);
    setSirhError("");
    try {
      const res = await getSirhAdscripciones();
      setSirh(res.data ?? null);
    } catch (err) {
      setSirhError(err.response?.data?.error ?? "SIRH no disponible. Verifica la conexión.");
    } finally {
      setSirhLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAreas();
    loadSirh();
  }, []);

  // ── Cambio de zona con dirección ──────────────────────────────────────────

  const changeAla = useCallback((nextIdx) => {
    setSlideDir(nextIdx > prevAlaRef.current ? "right" : "left");
    prevAlaRef.current = nextIdx;
    setAlaIdx(nextIdx);
    setSelectedId(null);
    setEditForm(null);
  }, []);

  const changePiso = useCallback((nextIdx) => {
    setSlideDir(nextIdx > prevPisoRef.current ? "down" : "up");
    prevPisoRef.current = nextIdx;
    setPisoIdx(nextIdx);
    setSelectedId(null);
    setEditForm(null);
  }, []);

  // ── Selección en el grid ───────────────────────────────────────────────────

  const handleSelect = useCallback(
    (area) => {
      setSelectedId(area.id);
      setEditForm({
        ...area,
        esSalaJuntas: area.esSalaJuntas ?? false,
        esComun: area.esComun ?? false,
        tipoComun: area.tipoComun ?? null,
        nombrePropio: area.nombrePropio ?? null,
        _dirty: false,
      });
      setSaveError("");
      // Enfocar el área en el visor 3D
      visorShowArea(area.id);
    },
    [visorShowArea],
  );

  // ── Escuchar ROOM_CLICKED desde el visor ──────────────────────────────────
  // Se registra después de handleSelect para poder referenciarlo en las deps.
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type !== "ROOM_CLICKED") return;
      const { roomId, floor } = e.data.payload ?? {};
      if (!roomId) return;
      // Sincronizar piso en el editor 2D
      const pisoItemIdx = PISOS.findIndex((p) => p.floor === floor);
      if (pisoItemIdx >= 0) changePiso(pisoItemIdx);
      // Seleccionar el área — usamos setAreas para leer el estado fresco
      setAreas((prev) => {
        const area = prev.find((a) => a.id === roomId);
        if (area) {
          // handleSelect es estable (useCallback), seguro llamar dentro del setter
          handleSelect(area);
        }
        return prev;
      });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [changePiso, handleSelect]);

  // Rechaza coordenadas fuera de la huella del edificio: el rect se queda
  // "pegado" en la última posición válida durante el drag.
  const handleResize = useCallback((id, coords) => {
    if (
      !dentroDelEdificio({
        x1: coords.gridX1,
        y1: coords.gridY1,
        x2: coords.gridX2,
        y2: coords.gridY2,
      })
    )
      return;
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...coords } : a)));
    setEditForm((prev) => (prev && prev.id === id ? { ...prev, ...coords, _dirty: true } : prev));
  }, []);

  const handleMove = useCallback((id, coords) => {
    if (
      !dentroDelEdificio({
        x1: coords.gridX1,
        y1: coords.gridY1,
        x2: coords.gridX2,
        y2: coords.gridY2,
      })
    )
      return;
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...coords } : a)));
    setEditForm((prev) => (prev && prev.id === id ? { ...prev, ...coords, _dirty: true } : prev));
  }, []);

  // Áreas que se solapan con otra del mismo piso — feedback rojo en el editor
  // y bloqueo de "Guardar todo".
  const conflictIds = useMemo(() => {
    const ids = new Set();
    const conGeom = areas.filter((a) => a.activo !== false && a.gridX1 != null);
    for (let i = 0; i < conGeom.length; i++) {
      for (let j = i + 1; j < conGeom.length; j++) {
        if (conGeom[i].floor !== conGeom[j].floor) continue;
        if (seSolapan(areaToRect(conGeom[i]), areaToRect(conGeom[j]))) {
          ids.add(conGeom[i].id);
          ids.add(conGeom[j].id);
        }
      }
    }
    return ids;
  }, [areas]);

  // ── Guardar todo ───────────────────────────────────────────────────────────

  const handleGuardarTodo = async () => {
    const ids = Object.keys(pendingChanges);
    if (ids.length === 0) return;

    // Pre-validación: huella del edificio + solapes sobre el estado proyectado
    // (las mismas reglas que aplica el backend, para fallar con mensaje claro).
    const proyectadas = areas
      .filter((a) => a.activo !== false)
      .map((a) => (pendingChanges[a.id] ? { ...a, ...pendingChanges[a.id] } : a))
      .filter((a) => a.gridX1 != null && a.gridY1 != null && a.gridX2 != null && a.gridY2 != null)
      .map(areaToRect);
    for (const id of ids) {
      const rect = proyectadas.find((r) => r.id === id);
      if (!rect) continue;
      const errorGeometria = validarGeometriaArea(
        rect,
        proyectadas.filter((r) => r.id !== id),
      );
      if (errorGeometria) {
        setSaveAllError(`"${rect.label ?? id}": ${errorGeometria}`);
        return;
      }
    }

    setSavingAll(true);
    setSaveAllError("");
    try {
      for (const id of ids) {
        const ch = pendingChanges[id];
        await updateArea(id, {
          label: ch.label,
          gridX1: ch.gridX1,
          gridY1: ch.gridY1,
          gridX2: ch.gridX2,
          gridY2: ch.gridY2,
          floor: ch.floor,
          esSalaJuntas: ch.esSalaJuntas,
          esComun: ch.esComun ?? false,
          tipoComun: ch.tipoComun ?? null,
          nombrePropio: ch.nombrePropio ?? null,
        });
      }
      persistPending({});
      await loadAreas();
    } catch (err) {
      setSaveAllError(err.response?.data?.error ?? "Error al guardar cambios");
    } finally {
      setSavingAll(false);
    }
  };

  const handleGenerarRender = () => {
    const iframe = visor3DRef.current;
    if (!iframe) return;
    const src = iframe.src;
    iframe.src = "";
    setTimeout(() => {
      iframe.src = src;
    }, 50);
  };

  const handleCancelar = () => {
    setSelectedId(null);
    setEditForm(null);
    setSaveError("");
  };

  // ── Muebles ────────────────────────────────────────────────────────────────

  const loadMuebles = useCallback(async (areaId) => {
    try {
      const res = await getMueblesByArea(areaId);
      const lista = res.data ?? res ?? [];
      setMueblesPorArea((prev) => ({ ...prev, [areaId]: lista }));
    } catch {
      setMueblesPorArea((prev) => ({ ...prev, [areaId]: [] }));
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadMuebles(selectedId);
  }, [selectedId, loadMuebles]);

  // ── Eliminar área ──────────────────────────────────────────────────────────

  const handleEliminar = async () => {
    if (!editForm) return;
    if (!window.confirm(`¿Desactivar el área "${editForm.label}"?`)) return;
    try {
      await deleteArea(editForm.id);
      await loadAreas();
      handleCancelar();
    } catch (err) {
      setSaveError(err.response?.data?.error ?? "Error al eliminar");
    }
  };

  // ── SIRH ───────────────────────────────────────────────────────────────────

  const todasAdscripciones = useMemo(() => {
    if (!sirh) return [];
    const niveles = [
      { items: sirh.nivel2 ?? [], tipo: "Subsecretaría" },
      { items: sirh.nivel3 ?? [], tipo: "Dirección" },
      { items: sirh.nivel4 ?? [], tipo: "Coordinación" },
      { items: sirh.nivel5 ?? [], tipo: "Departamento" },
    ];
    return niveles.flatMap(({ items, tipo }) =>
      items.map((item) => ({ nombre: item.nombre, tipo, nivel: item.nivel ?? null })),
    );
  }, [sirh]);

  // ── Modal Nueva Área ───────────────────────────────────────────────────────

  const handleNuevaGuardar = async () => {
    setNuevaError("");
    const { id, label, piso, gridX1, gridY1, gridX2, gridY2 } = nuevaForm;
    if (!id.trim() || !label.trim() || !piso) {
      setNuevaError("ID, Nombre y Piso son obligatorios");
      return;
    }
    const pisoItem = PISOS.find((p) => p.piso === piso);
    setNuevaSaving(true);
    try {
      const x1 = gridX1 !== "" ? Number(gridX1) : DEFAULT_COORDS.gridX1;
      const y1 = gridY1 !== "" ? Number(gridY1) : DEFAULT_COORDS.gridY1;
      const x2 = gridX2 !== "" ? Number(gridX2) : DEFAULT_COORDS.gridX2;
      const y2 = gridY2 !== "" ? Number(gridY2) : DEFAULT_COORDS.gridY2;
      await createArea({
        id: id.trim().toLowerCase().replace(/\s+/g, "_"),
        label: label.trim(),
        piso,
        floor: pisoItem?.floor ?? 0,
        gridX1: x1,
        gridY1: y1,
        gridX2: x2,
        gridY2: y2,
        esComun: nuevaForm.esComun ?? false,
        tipoComun: nuevaForm.tipoComun || null,
        nombrePropio: nuevaForm.nombrePropio?.trim() || null,
        ...(nuevaAdscripcion && {
          adscripcionNombre: nuevaAdscripcion.nombre,
          adscripcionNivel: nuevaAdscripcion.nivel ?? null,
        }),
      });
      setModalOpen(false);
      setNuevaForm(EMPTY_NUEVA);
      setNuevaAdscripcion(null);
      await loadAreas();
    } catch (err) {
      setNuevaError(err.response?.data?.error ?? "Error al crear el área");
    } finally {
      setNuevaSaving(false);
    }
  };

  const setNueva = (k, v) => setNuevaForm((prev) => ({ ...prev, [k]: v }));
  const setEdit = (k, v) =>
    setEditForm((prev) => (prev ? { ...prev, [k]: v, _dirty: true } : prev));

  // ── Areas filtradas según vista ────────────────────────────────────────────

  const pisoActivo = PISOS[pisoIdx];

  const { areasFiltradas, gridConfig } = useMemo(() => {
    if (viewMode === "full") {
      return {
        areasFiltradas: areas.filter((a) => a.floor === pisoActivo.floor),
        gridConfig: { colStart: 0, colCount: 32, zoneKey: "full" },
      };
    }
    const zona = ZONES[alaIdx];
    return {
      areasFiltradas: areas.filter((a) => {
        if (a.floor !== pisoActivo.floor) return false;
        const x1 = a.gridX1 ?? -1;
        if (x1 < 0) return false;
        return x1 >= zona.colStart && x1 < zona.colStart + zona.colCount;
      }),
      gridConfig: { colStart: zona.colStart, colCount: zona.colCount, zoneKey: zona.key },
    };
  }, [areas, viewMode, pisoIdx, alaIdx, pisoActivo.floor]);

  const gridKey = `${viewMode}-${alaIdx}-${pisoIdx}`;

  // ── Slide animation keyframe según dirección ──────────────────────────────

  const slideKeyframes = {
    right: {
      "@keyframes siast-slide": {
        from: { opacity: 0, transform: "translateX(18px)" },
        to: { opacity: 1, transform: "translateX(0)" },
      },
    },
    left: {
      "@keyframes siast-slide": {
        from: { opacity: 0, transform: "translateX(-18px)" },
        to: { opacity: 1, transform: "translateX(0)" },
      },
    },
    down: {
      "@keyframes siast-slide": {
        from: { opacity: 0, transform: "translateY(14px)" },
        to: { opacity: 1, transform: "translateY(0)" },
      },
    },
    up: {
      "@keyframes siast-slide": {
        from: { opacity: 0, transform: "translateY(-14px)" },
        to: { opacity: 1, transform: "translateY(0)" },
      },
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 0,
          pb: 1.5,
          flexWrap: "wrap",
          gap: 1,
          borderBottom: "2px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: "8px",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
            }}
          >
            <EditLocationAltIcon sx={{ color: "#fff", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                background: "linear-gradient(135deg, #9d2449 0%, #c0392b 60%, #e74c3c 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.1,
              }}
            >
              Mapa de Áreas
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.3 }}>
              Editor de planta del edificio
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {/* Toggle vista */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => {
              if (v) setViewMode(v);
            }}
            size="small"
            sx={{ "& .MuiToggleButton-root": { py: 0.5, px: 1, fontSize: 11, fontWeight: 700 } }}
          >
            <ToggleButton value="zones" title="Ver por zonas (Ala Izq / Conector / Ala Der)">
              <GridViewIcon sx={{ fontSize: 15, mr: 0.5 }} />
              Zonas
            </ToggleButton>
            <ToggleButton value="full" title="Vista completa del piso (32×27)">
              <ViewComfyIcon sx={{ fontSize: 15, mr: 0.5 }} />
              Planta completa
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="Persiste todos los cambios pendientes en la base de datos">
            <span>
              <Badge badgeContent={pendingCount} color="warning" max={99}>
                <Button
                  variant={pendingCount > 0 ? "contained" : "outlined"}
                  color="warning"
                  size="small"
                  startIcon={
                    savingAll ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />
                  }
                  onClick={handleGuardarTodo}
                  disabled={pendingCount === 0 || savingAll}
                  sx={{ fontWeight: 700 }}
                >
                  Guardar todo
                </Button>
              </Badge>
            </span>
          </Tooltip>
          <Tooltip title="Recarga el modelo 3D desde los datos guardados en la base de datos">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ThreeDRotationIcon />}
              onClick={handleGenerarRender}
            >
              Render
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => {
              setNuevaForm(EMPTY_NUEVA);
              setNuevaError("");
              setModalOpen(true);
            }}
          >
            Nueva Area
          </Button>
        </Box>
      </Box>

      {saveAllError && (
        <Alert severity="error" sx={{ mt: 1.5, mb: 0.5 }} onClose={() => setSaveAllError("")}>
          {saveAllError}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1.5, mb: 0.5 }}>
          {error}
        </Alert>
      )}

      {/* Áreas sin mapear */}
      {!loading &&
        (() => {
          const sinMapear = areas.filter(
            (a) => a.gridX1 == null || a.gridY1 == null || a.gridX2 == null || a.gridY2 == null,
          );
          if (sinMapear.length === 0) return null;
          return (
            <Paper variant="outlined" sx={{ mb: 1.5, p: 1.25, borderColor: "warning.light" }}>
              <Typography
                variant="caption"
                fontWeight={700}
                color="warning.dark"
                sx={{ display: "block", mb: 0.75, letterSpacing: 0.5 }}
              >
                {sinMapear.length} ÁREA{sinMapear.length !== 1 ? "S" : ""} SIN MAPEAR — haz clic en
                "Colocar" para posicionarlas en el grid
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {sinMapear.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.label}
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      const zoneIdx = ZONES.findIndex((z) => {
                        const x1 = a.gridX1 ?? -1;
                        return x1 >= z.colStart && x1 < z.colStart + z.colCount;
                      });
                      const targetZoneIdx = zoneIdx >= 0 ? zoneIdx : 0;
                      const defaultCoords = defaultCoordsForZone(ZONES[targetZoneIdx].key);
                      const pisoItem = PISOS.find((p) => p.floor === a.floor) ?? PISOS[0];
                      const withCoords = { ...a, ...defaultCoords, piso: pisoItem.piso };
                      setAreas((prev) => prev.map((x) => (x.id === a.id ? withCoords : x)));
                      const pIdx =
                        PISOS.findIndex((p) => p.floor === a.floor) >= 0
                          ? PISOS.findIndex((p) => p.floor === a.floor)
                          : 0;
                      changePiso(pIdx);
                      if (viewMode === "zones") changeAla(targetZoneIdx);
                      setSelectedId(a.id);
                      setEditForm({ ...withCoords, _dirty: true });
                      setSaveError("");
                    }}
                    sx={{ cursor: "pointer" }}
                    deleteIcon={<span style={{ fontSize: 10, paddingRight: 4 }}>Colocar</span>}
                    onDelete={() => {}}
                  />
                ))}
              </Box>
            </Paper>
          );
        })()}

      {/* Layout principal */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
          {/* Columna izquierda: grid */}
          <Box sx={{ flex: "0 0 67%", minWidth: 0 }}>
            <Paper sx={{ borderRadius: "10px", overflow: "hidden" }}>
              {/* Tabs de zona — solo en modo "zones" */}
              {viewMode === "zones" && (
                <Box sx={{ borderBottom: "2px solid rgba(0,0,0,0.10)", bgcolor: "grey.50" }}>
                  <Tabs
                    value={alaIdx}
                    onChange={(_, v) => changeAla(v)}
                    sx={{ minHeight: 40 }}
                    TabIndicatorProps={{ style: { height: 3 } }}
                  >
                    {ZONES.map((zone, i) => {
                      const isActive = alaIdx === i;
                      return (
                        <Tab
                          key={zone.key}
                          label={zone.label}
                          sx={{
                            minHeight: 40,
                            fontWeight: 700,
                            fontSize: zone.key === "conector" ? 10 : 12,
                            letterSpacing: 0.5,
                            opacity: isActive ? 1 : 0.4,
                            transition: "all 0.2s ease",
                            bgcolor: isActive ? `${zone.color}12` : "transparent",
                            color: isActive ? zone.color : "inherit",
                            borderRadius: "6px 6px 0 0",
                          }}
                        />
                      );
                    })}
                  </Tabs>
                </Box>
              )}

              {/* Tabs de piso */}
              <Box sx={{ borderBottom: "1px solid rgba(0,0,0,0.07)", bgcolor: "white" }}>
                <Tabs
                  value={pisoIdx}
                  onChange={(_, v) => changePiso(v)}
                  sx={{ minHeight: 36 }}
                  variant="fullWidth"
                >
                  {PISOS.map((p, i) => {
                    const count =
                      viewMode === "full"
                        ? areas.filter((a) => a.floor === p.floor).length
                        : areas.filter((a) => {
                            if (a.floor !== p.floor) return false;
                            const zona = ZONES[alaIdx];
                            const x1 = a.gridX1 ?? -1;
                            return x1 >= zona.colStart && x1 < zona.colStart + zona.colCount;
                          }).length;
                    const isActive = pisoIdx === i;
                    return (
                      <Tab
                        key={p.piso}
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <span>PISO {p.label}</span>
                            <Chip
                              label={count}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: 9,
                                fontWeight: 800,
                                bgcolor: isActive ? "primary.main" : "grey.300",
                                color: isActive ? "#fff" : "text.primary",
                                "& .MuiChip-label": { px: 0.5 },
                              }}
                            />
                          </Box>
                        }
                        sx={{
                          minHeight: 36,
                          fontSize: 11,
                          textTransform: "none",
                          fontWeight: 600,
                          opacity: isActive ? 1 : 0.45,
                          transition: "all 0.2s ease",
                          bgcolor: isActive ? "rgba(157,36,73,0.05)" : "transparent",
                        }}
                      />
                    );
                  })}
                </Tabs>
              </Box>

              {/* Grid con animación de slide */}
              <Box
                key={gridKey}
                sx={{
                  p: viewMode === "full" ? 1 : 1.5,
                  animation: "siast-slide 0.22s ease",
                  ...slideKeyframes[slideDir],
                }}
              >
                {/* Fondos de zona en vista completa */}
                {viewMode === "full" && (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      mb: 0.75,
                      px: 0.25,
                      pointerEvents: "none",
                    }}
                  >
                    {ZONES.map((z) => (
                      <Box
                        key={z.key}
                        sx={{
                          flex: z.colCount,
                          py: 0.25,
                          borderRadius: "4px",
                          bgcolor: z.color + "12",
                          border: `1px solid ${z.color}33`,
                          textAlign: "center",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontSize: 8, fontWeight: 800, color: z.color, letterSpacing: 0.8 }}
                        >
                          {z.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                <AreaGridEditor
                  areas={areasFiltradas}
                  allAreas={areas}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onResize={handleResize}
                  onMove={handleMove}
                  floorLabel={
                    viewMode === "full"
                      ? `PISO ${pisoActivo.label} — PLANTA COMPLETA`
                      : `PISO ${pisoActivo.label} — ${ZONES[alaIdx].label}`
                  }
                  colStart={gridConfig.colStart}
                  colCount={gridConfig.colCount}
                  zoneKey={gridConfig.zoneKey}
                  mueblesPorArea={mueblesPorArea}
                  pendingChanges={pendingChanges}
                  conflictIds={conflictIds}
                  flipY
                  compact={viewMode === "full"}
                />
                {conflictIds.size > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Hay áreas solapadas (marcadas en rojo). Corrige el solape antes de guardar.
                  </Alert>
                )}
              </Box>
            </Paper>
          </Box>

          {/* Panel lateral único (1/3) — sticky */}
          <Box
            sx={{
              flex: "0 0 33%",
              position: "sticky",
              top: 16,
              maxHeight: "calc(100vh - 80px)",
              pl: 1.5,
            }}
          >
            <Paper
              sx={{
                borderRadius: "10px",
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Visor 3D — siempre visible en la parte superior del panel */}
              <Box
                sx={{
                  borderBottom: editForm ? "1px solid" : "none",
                  borderColor: "divider",
                  flexShrink: 0,
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    bgcolor: "grey.50",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    borderBottom: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <ThreeDRotationIcon sx={{ fontSize: 16, color: "primary.main" }} />
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="primary.main"
                    letterSpacing={0.5}
                  >
                    VISOR 3D
                  </Typography>
                  {!editForm && (
                    <Typography variant="caption" color="text.secondary">
                      &nbsp;— haz clic en un área para editarla
                    </Typography>
                  )}
                  {editForm && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 0.5 }}>
                      &nbsp;— {editForm.label || editForm.id}
                    </Typography>
                  )}
                </Box>
                <iframe
                  ref={visor3DRef}
                  src="http://localhost:5174"
                  title="Visor 3D Edificio"
                  onLoad={() => {
                    // Heredar tema al iframe cuando carga (app fija en "light")
                    visor3DRef.current?.contentWindow?.postMessage(
                      { type: "SET_THEME", payload: { theme: "light" } },
                      "*",
                    );
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    display: "block",
                    height: editForm ? "220px" : "360px",
                    transition: "height 0.25s ease",
                  }}
                />
              </Box>

              {/* EditPanel — aparece debajo del visor cuando hay selección */}
              {editForm && (
                <Box sx={{ flex: 1, overflow: "auto" }}>
                  <EditPanel
                    key={editForm.id}
                    form={editForm}
                    setEdit={setEdit}
                    saveError={saveError}
                    isPending={!!pendingChanges[editForm.id]}
                    onCancelar={handleCancelar}
                    onEliminar={handleEliminar}
                    sirhLoading={sirhLoading}
                    sirhError={sirhError}
                    todasAdscripciones={todasAdscripciones}
                    esSalaJuntas={editForm.esSalaJuntas ?? false}
                    setEsSalaJuntas={(val) => setEdit("esSalaJuntas", val)}
                    muebles={mueblesPorArea[editForm.id] ?? []}
                    onMueblesChange={() => loadMuebles(editForm.id)}
                  />
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      )}

      {/* Modal Nueva Area */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Nueva Area</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
        >
          {nuevaError && <Alert severity="error">{nuevaError}</Alert>}

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="ID (unico)"
              value={nuevaForm.id}
              onChange={(e) =>
                setNueva("id", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
              }
              fullWidth
              required
              helperText="ej: n2_nominas — solo letras, numeros y guiones bajos"
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              label="Nombre"
              value={nuevaForm.label}
              onChange={(e) => setNueva("label", e.target.value)}
              fullWidth
              required
            />
          </Box>

          <FormControl fullWidth required>
            <InputLabel>Piso</InputLabel>
            <Select
              value={nuevaForm.piso}
              label="Piso"
              onChange={(e) => {
                const p = PISOS.find((x) => x.piso === e.target.value);
                setNueva("piso", e.target.value);
                setNueva("floor", p?.floor ?? 0);
              }}
            >
              {PISOS.map((p) => (
                <MenuItem key={p.piso} value={p.piso}>
                  PISO {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            options={todasAdscripciones}
            groupBy={(opt) => opt.tipo}
            getOptionLabel={(opt) => opt.nombre}
            value={nuevaAdscripcion}
            onChange={(_, val) => setNuevaAdscripcion(val)}
            loading={sirhLoading}
            noOptionsText={sirhError || "Sin resultados"}
            isOptionEqualToValue={(opt, val) => opt.nombre === val.nombre}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Adscripción SIRH (opcional)"
                helperText="Busca subsecretaría, dirección, coordinación o departamento"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {sirhLoading ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <Box
            sx={{
              p: 1.5,
              borderRadius: "8px",
              bgcolor: "action.hover",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ letterSpacing: 0.5, display: "block", mb: 1 }}
            >
              COORDENADAS EN LA CUADRICULA (0-based)
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              {["gridX1", "gridY1", "gridX2", "gridY2"].map((field) => (
                <TextField
                  key={field}
                  label={field.replace("grid", "")}
                  value={nuevaForm[field]}
                  onChange={(e) => setNueva(field, e.target.value.replace(/\D/g, ""))}
                  size="small"
                  inputProps={{ inputMode: "numeric", maxLength: 3 }}
                  sx={{ flex: 1 }}
                />
              ))}
            </Box>
          </Box>

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={nuevaForm.esComun ?? false}
                onChange={(e) => setNueva("esComun", e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="body2">Es Area Comun</Typography>}
          />

          {(nuevaForm.esComun ?? false) && (
            <>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Area Comun</InputLabel>
                <Select
                  value={nuevaForm.tipoComun ?? ""}
                  label="Tipo de Area Comun"
                  onChange={(e) => setNueva("tipoComun", e.target.value || "")}
                >
                  <MenuItem value="">
                    <em>Sin tipo</em>
                  </MenuItem>
                  {Object.entries(TIPO_AREA_COMUN_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Nombre propio"
                value={nuevaForm.nombrePropio ?? ""}
                onChange={(e) => setNueva("nombrePropio", e.target.value)}
                fullWidth
                size="small"
                placeholder="ej: Sala Oaxaca, Bano Norte..."
                helperText="Nombre especifico del espacio (opcional)"
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleNuevaGuardar} disabled={nuevaSaving}>
            {nuevaSaving ? <CircularProgress size={18} /> : "Crear Area"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog />
    </Box>
  );
};

// ── Constantes de tipos de mueble ────────────────────────────────────────────

const TIPOS_MUEBLE = [
  { value: "CUBICULO", label: "Cubículo", color: "#4caf50" },
  { value: "ESCRITORIO", label: "Escritorio", color: "#2196f3" },
  { value: "SALA", label: "Sala", color: "#9c27b0" },
  { value: "IMPRESORA", label: "Impresora", color: "#ff9800" },
  { value: "BODEGA", label: "Bodega", color: "#795548" },
  { value: "OTRO", label: "Otro", color: "#607d8b" },
];

const colorMueble = (tipo) => TIPOS_MUEBLE.find((t) => t.value === tipo)?.color ?? "#607d8b";
const labelMueble = (tipo) => TIPOS_MUEBLE.find((t) => t.value === tipo)?.label ?? tipo;

// ── EditPanel ────────────────────────────────────────────────────────────────

const MUEBLE_EMPTY = {
  label: "",
  tipo: "CUBICULO",
  gridX: "0.5",
  gridY: "0.5",
  ancho: "0.15",
  alto: "0.15",
  rotacion: 0,
  // Modo fila
  modo: "uno", // "uno" | "fila"
  cantidad: "4",
  orientacion: "H",
};

const ROTACIONES = [
  { value: 0, label: "0°" },
  { value: 90, label: "90°" },
  { value: 180, label: "180°" },
  { value: 270, label: "270°" },
];

function EditPanel({
  form,
  setEdit,
  saveError,
  isPending,
  onCancelar,
  onEliminar,
  sirhLoading,
  sirhError,
  todasAdscripciones,
  esSalaJuntas,
  setEsSalaJuntas,
  muebles,
  onMueblesChange,
}) {
  const [adscripcion, setAdscripcion] = useState(null);
  const [mueblesExpanded, setMueblesExpanded] = useState(false);
  const [addingMueble, setAddingMueble] = useState(false);
  const [muebleForm, setMuebleForm] = useState(MUEBLE_EMPTY);
  const [muebleSaving, setMuebleSaving] = useState(false);
  const [muebleError, setMuebleError] = useState("");

  const handleAdscripcionChange = (_, val) => {
    setAdscripcion(val);
    if (val) setEdit("label", val.nombre);
  };

  const handleGuardarMueble = async () => {
    if (!muebleForm.label.trim()) {
      setMuebleError("El nombre es obligatorio");
      return;
    }
    const gridX = Number(muebleForm.gridX);
    const gridY = Number(muebleForm.gridY);
    if (isNaN(gridX) || gridX < 0 || gridX > 1 || isNaN(gridY) || gridY < 0 || gridY > 1) {
      setMuebleError("gridX y gridY deben estar entre 0 y 1");
      return;
    }
    setMuebleSaving(true);
    setMuebleError("");
    try {
      const base = {
        tipo: muebleForm.tipo,
        gridX,
        gridY,
        ancho: muebleForm.ancho !== "" ? Number(muebleForm.ancho) : 0.15,
        alto: muebleForm.alto !== "" ? Number(muebleForm.alto) : 0.15,
        rotacion: muebleForm.rotacion,
      };
      if (muebleForm.modo === "fila") {
        const cantidad = parseInt(muebleForm.cantidad, 10);
        if (isNaN(cantidad) || cantidad < 1 || cantidad > 30) {
          setMuebleError("La cantidad debe ser de 1 a 30 módulos");
          setMuebleSaving(false);
          return;
        }
        await createFilaMuebles(form.id, {
          ...base,
          labelPrefix: muebleForm.label.trim(),
          cantidad,
          orientacion: muebleForm.orientacion,
        });
      } else {
        await createMueble(form.id, { ...base, label: muebleForm.label.trim() });
      }
      setMuebleForm(MUEBLE_EMPTY);
      setAddingMueble(false);
      onMueblesChange();
    } catch (err) {
      setMuebleError(err.response?.data?.error ?? "Error al guardar mueble");
    } finally {
      setMuebleSaving(false);
    }
  };

  const handleEliminarMueble = async (muebleId) => {
    try {
      await deleteMueble(muebleId);
      onMueblesChange();
    } catch {}
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      {/* Header del panel */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: "2px solid",
          borderColor: "primary.main",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(135deg, rgba(157,36,73,0.08) 0%, rgba(157,36,73,0.03) 100%)",
        }}
      >
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            noWrap
            sx={{ maxWidth: 160, lineHeight: 1.2 }}
          >
            {form.label || form.id}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            {form.id}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {isPending && (
            <Chip
              label="Pendiente"
              size="small"
              color="warning"
              sx={{
                fontWeight: 700,
                fontSize: 10,
                height: 20,
                "& .MuiChip-label": { px: 1 },
                animation: "siast-pulse 1.5s ease infinite",
                "@keyframes siast-pulse": {
                  "0%,100%": { boxShadow: "0 0 0 0 rgba(237,108,2,0.35)" },
                  "50%": { boxShadow: "0 0 0 4px rgba(237,108,2,0)" },
                },
              }}
            />
          )}
          <Chip
            label={`PISO ${PISO_LABELS[form.piso] ?? form.piso}`}
            size="small"
            color="primary"
            variant="filled"
            sx={{ fontWeight: 700, fontSize: 11, height: 20, "& .MuiChip-label": { px: 1 } }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 1.75,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        {saveError && (
          <Alert severity="error" sx={{ fontSize: 12 }}>
            {saveError}
          </Alert>
        )}

        <SectionLabel>DATOS DEL AREA</SectionLabel>

        <TextField
          label="Nombre del area"
          value={form.label}
          onChange={(e) => setEdit("label", e.target.value)}
          fullWidth
          size="small"
          required
        />

        <FormControlLabel
          control={
            <Switch
              checked={esSalaJuntas}
              onChange={(e) => setEsSalaJuntas(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Sala de juntas (legacy)
            </Typography>
          }
          sx={{ ml: 0 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={form.esComun ?? false}
              onChange={(e) => setEdit("esComun", e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Es Area Comun
            </Typography>
          }
          sx={{ ml: 0 }}
        />

        {(form.esComun ?? false) && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
              pl: 1,
              borderLeft: "3px solid",
              borderColor: "info.light",
            }}
          >
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Area Comun</InputLabel>
              <Select
                value={form.tipoComun ?? ""}
                label="Tipo de Area Comun"
                onChange={(e) => setEdit("tipoComun", e.target.value || null)}
              >
                <MenuItem value="">
                  <em>Sin tipo</em>
                </MenuItem>
                {Object.entries(TIPO_AREA_COMUN_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Nombre propio"
              value={form.nombrePropio ?? ""}
              onChange={(e) => setEdit("nombrePropio", e.target.value || null)}
              fullWidth
              size="small"
              placeholder="ej: Sala Oaxaca, Bano Norte..."
              helperText="Nombre especifico del espacio (opcional)"
            />
          </Box>
        )}

        <Divider sx={{ my: 0.25 }} />

        <SectionLabel>ADSCRIPCION SIRH</SectionLabel>

        {sirhError ? (
          <Alert severity="warning" sx={{ fontSize: 11 }}>
            {sirhError}
          </Alert>
        ) : (
          <>
            <Autocomplete
              size="small"
              options={todasAdscripciones}
              groupBy={(opt) => opt.tipo}
              getOptionLabel={(opt) => opt.nombre}
              value={adscripcion}
              onChange={handleAdscripcionChange}
              loading={sirhLoading}
              noOptionsText="Sin resultados"
              isOptionEqualToValue={(opt, val) => opt.nombre === val.nombre}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar adscripción SIRH"
                  helperText="Subsecretaría, dirección, coordinación o departamento"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {sirhLoading ? <CircularProgress size={14} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {adscripcion && (
              <Typography variant="caption" color="success.main" fontWeight={600}>
                Al guardar: {adscripcion.nombre}
              </Typography>
            )}
          </>
        )}

        <Divider sx={{ my: 0.25 }} />

        <SectionLabel>POSICION EN CUADRICULA</SectionLabel>
        <Box
          sx={{
            p: 1.25,
            borderRadius: "6px",
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", gap: 1 }}>
            {["gridX1", "gridY1", "gridX2", "gridY2"].map((field) => (
              <TextField
                key={field}
                label={field.replace("grid", "")}
                value={form[field] ?? ""}
                onChange={(e) =>
                  setEdit(field, e.target.value === "" ? "" : Number(e.target.value))
                }
                size="small"
                type="number"
                inputProps={{ min: 0, max: field.startsWith("gridX") ? 31 : 26 }}
                sx={{ flex: 1 }}
              />
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 0.25 }} />

        {/* Muebles colapsable */}
        <Box>
          <Box
            onClick={() => setMueblesExpanded((v) => !v)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              py: 0.5,
              borderRadius: "4px",
              "&:hover": { bgcolor: "action.hover" },
              px: 0.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <ChairIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ letterSpacing: 0.8, fontSize: 11 }}
              >
                MUEBLES / CUBICULOS
              </Typography>
              {muebles.length > 0 && (
                <Chip
                  label={muebles.length}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: 10,
                    fontWeight: 800,
                    bgcolor: "primary.main",
                    color: "#fff",
                    "& .MuiChip-label": { px: 0.75 },
                  }}
                />
              )}
            </Box>
            <ExpandMoreIcon
              sx={{
                fontSize: 18,
                color: "text.secondary",
                transition: "transform 0.2s",
                transform: mueblesExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </Box>

          <Collapse in={mueblesExpanded}>
            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
              {muebles.length > 0 && (
                <Paper variant="outlined" sx={{ borderRadius: "6px", overflow: "hidden" }}>
                  <List dense disablePadding>
                    {muebles.map((m, idx) => (
                      <ListItem
                        key={m.id}
                        divider={idx < muebles.length - 1}
                        secondaryAction={
                          <Tooltip title="Eliminar mueble">
                            <IconButton
                              edge="end"
                              size="small"
                              color="error"
                              onClick={() => handleEliminarMueble(m.id)}
                            >
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        }
                        sx={{ py: 0.5 }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: colorMueble(m.tipo),
                            mr: 1,
                            flexShrink: 0,
                          }}
                        />
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>
                              {m.label}
                            </Typography>
                          }
                          secondary={
                            <Chip
                              label={labelMueble(m.tipo)}
                              size="small"
                              sx={{
                                height: 14,
                                fontSize: 9,
                                fontWeight: 700,
                                bgcolor: colorMueble(m.tipo) + "22",
                                color: colorMueble(m.tipo),
                                "& .MuiChip-label": { px: 0.75 },
                                mt: 0.25,
                              }}
                            />
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}

              {addingMueble ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  {muebleError && (
                    <Alert severity="error" sx={{ fontSize: 11, py: 0 }}>
                      {muebleError}
                    </Alert>
                  )}
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      label={muebleForm.modo === "fila" ? "Prefijo (ej. Cubículo)" : "Nombre"}
                      value={muebleForm.label}
                      onChange={(e) => setMuebleForm((p) => ({ ...p, label: e.target.value }))}
                      size="small"
                      fullWidth
                      autoFocus
                      required
                    />
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                      <InputLabel>Tipo</InputLabel>
                      <Select
                        value={muebleForm.tipo}
                        label="Tipo"
                        onChange={(e) => setMuebleForm((p) => ({ ...p, tipo: e.target.value }))}
                      >
                        {TIPOS_MUEBLE.map((t) => (
                          <MenuItem key={t.value} value={t.value}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  bgcolor: t.color,
                                }}
                              />
                              {t.label}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  {/* Modo: módulo solo o fila de módulos */}
                  <ToggleButtonGroup
                    value={muebleForm.modo}
                    exclusive
                    size="small"
                    fullWidth
                    onChange={(_, v) => v && setMuebleForm((p) => ({ ...p, modo: v }))}
                    sx={{ "& .MuiToggleButton-root": { py: 0.4, fontSize: 11, fontWeight: 700 } }}
                  >
                    <ToggleButton value="uno">Módulo solo</ToggleButton>
                    <ToggleButton value="fila">Fila de módulos</ToggleButton>
                  </ToggleButtonGroup>

                  {muebleForm.modo === "fila" && (
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <TextField
                        label="Cantidad"
                        value={muebleForm.cantidad}
                        onChange={(e) =>
                          setMuebleForm((p) => ({
                            ...p,
                            cantidad: e.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                        size="small"
                        sx={{ flex: 1 }}
                        inputProps={{ inputMode: "numeric" }}
                      />
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel>Orientación</InputLabel>
                        <Select
                          value={muebleForm.orientacion}
                          label="Orientación"
                          onChange={(e) =>
                            setMuebleForm((p) => ({ ...p, orientacion: e.target.value }))
                          }
                        >
                          <MenuItem value="H">Horizontal →</MenuItem>
                          <MenuItem value="V">Vertical ↓</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}

                  <Box sx={{ display: "flex", gap: 1 }}>
                    {[
                      { field: "gridX", label: "Pos X (0-1)" },
                      { field: "gridY", label: "Pos Y (0-1)" },
                      { field: "ancho", label: "Ancho (0-1)" },
                      { field: "alto", label: "Alto (0-1)" },
                    ].map(({ field, label }) => (
                      <TextField
                        key={field}
                        label={label}
                        value={muebleForm[field]}
                        onChange={(e) =>
                          setMuebleForm((p) => ({
                            ...p,
                            [field]: e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                        size="small"
                        inputProps={{ inputMode: "decimal" }}
                        sx={{ flex: 1 }}
                        placeholder="0-1"
                      />
                    ))}
                  </Box>

                  <FormControl size="small" fullWidth>
                    <InputLabel>Rotación</InputLabel>
                    <Select
                      value={muebleForm.rotacion}
                      label="Rotación"
                      onChange={(e) =>
                        setMuebleForm((p) => ({ ...p, rotacion: Number(e.target.value) }))
                      }
                    >
                      {ROTACIONES.map((r) => (
                        <MenuItem key={r.value} value={r.value}>
                          {r.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setAddingMueble(false);
                        setMuebleForm(MUEBLE_EMPTY);
                        setMuebleError("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleGuardarMueble}
                      disabled={muebleSaving}
                      startIcon={
                        muebleSaving ? <CircularProgress size={12} color="inherit" /> : null
                      }
                    >
                      Guardar
                    </Button>
                  </Box>
                </Paper>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setAddingMueble(true)}
                  fullWidth
                  sx={{ borderStyle: "dashed" }}
                >
                  Agregar mueble
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      </Box>

      {/* Acciones */}
      <Box
        sx={{
          p: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          bgcolor: "grey.50",
        }}
      >
        <Tooltip title="Desactivar area">
          <IconButton size="small" color="error" onClick={onEliminar}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isPending && (
            <Typography
              variant="caption"
              color="warning.dark"
              fontWeight={700}
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <SaveIcon sx={{ fontSize: 13 }} /> Auto-guardado
            </Typography>
          )}
          <Button size="small" onClick={onCancelar}>
            Cerrar
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      color="text.secondary"
      sx={{ letterSpacing: 0.8, fontSize: 10, display: "block", mt: 0.25 }}
    >
      {children}
    </Typography>
  );
}
