/**
 * AreasPage — Editor de Áreas del Edificio
 *
 * Ruta: /admin/areas  (solo ADMIN)
 *
 * Layout v2 (sub-fase A):
 *   DESKTOP  — iframe visor 3D a pantalla completa de fondo (z-index 0),
 *               overlays glass flotantes encima (z-index 10–30):
 *                 · TopBar (título, tabs de piso, toggle cámara, guardar)
 *                 · ToolbarVert (herramientas selección/dibujo/mover/borrar) — placeholder B
 *                 · PanelAreas (lista áreas del piso activo, "Nueva área")
 *                 · PanelEditar (EditPanel del área seleccionada)
 *                 · BottomBar (estado, modo, solapes)
 *   MOBILE   — FloorPlanMobile a pantalla completa (sin Three.js) + mismos overlays.
 *
 * Integración visor 3D:
 *   React → Visor (postMessage):
 *     SET_THEME { theme }        — al cargar el iframe (siempre "light")
 *     GO_TO_FLOOR { floor }      — al cambiar piso en TopBar (floor 0=PB..3; -1 = edificio)
 *                                  también se emite al activar la herramienta "draw"
 *     FLY_TO_AREA { areaId }     — al seleccionar área (animación edificio→área)
 *     HIGHLIGHT_ROOM { roomId }  — al seleccionar área (fallback)
 *     SET_CAMERA_MODE { mode }   — toggle órbita/cenital
 *     SET_EDIT_TOOL { tool }     — toolbar: select | move | draw | resize | delete
 *   Visor → React (listeners):
 *     ROOM_CLICKED { roomId, floor }    — selección desde el visor
 *     AREA_MOVED   { areaId, gridX1..gridY2, floor, live } — live:true durante el drag
 *                    (solo actualiza state para el minimapa); live:false al soltar
 *                    (valida solape + entra a pendingChanges vía handleMove)
 *     AREA_RESIZED { areaId, gridX1..gridY2, floor, live } — igual que AREA_MOVED
 *     AREA_DRAWN   { gridX1..gridY2, floor } — abre el modal "Nueva Área" con coords
 *                    prellenadas; el visor NO crea el área
 *     AREA_DELETE_REQUEST { areaId, label, floor } — abre confirmación de desactivar
 *
 *   El visor solo valida la huella del edificio; el solape entre áreas se valida
 *   aquí. Si el rect final (live:false) solapa otra área del piso se revierte a
 *   las coords originales y se re-sincroniza el visor con
 *   SIAST3D.updateAreaGeometry(areaId, x1, y1, x2, y2, floor).
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTheme, useMediaQuery } from "@mui/material";
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import SaveIcon from "@mui/icons-material/Save";
import ThreeDRotationIcon from "@mui/icons-material/ThreeDRotation";
import ChairIcon from "@mui/icons-material/Chair";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MapIcon from "@mui/icons-material/Map";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import NearMeIcon from "@mui/icons-material/NearMe";
import PanToolIcon from "@mui/icons-material/PanTool";
import DrawIcon from "@mui/icons-material/Draw";
import HighlightAltIcon from "@mui/icons-material/HighlightAlt";
import CloseIcon from "@mui/icons-material/Close";
import LayersIcon from "@mui/icons-material/Layers";
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
import { FloorPlanMobile } from "../components/areas/FloorPlanMobile.jsx";
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

/** Zona/ala del edificio según la posición X en la cuadrícula — etiqueta acorde al visor 3D */
const zonaForGridX = (gridX1, gridX2) => {
  const cx = (Number(gridX1) + Number(gridX2)) / 2;
  const zone = ZONES.find((z) => cx >= z.colStart && cx < z.colStart + z.colCount) ?? ZONES[0];
  return zone.label;
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

// ── Glass overlay helpers ─────────────────────────────────────────────────────

/** Estilo base para paneles glass flotantes sobre el 3D — tema claro institucional */
const glassSx = {
  backdropFilter: "blur(14px) saturate(1.6)",
  WebkitBackdropFilter: "blur(14px) saturate(1.6)",
  background: "rgba(255, 255, 255, 0.82)",
  border: "1px solid rgba(157, 36, 73, 0.22)",
  borderRadius: "10px",
  color: "#1a0a10",
  boxShadow: "0 4px 24px rgba(157, 36, 73, 0.08), 0 1px 4px rgba(0,0,0,0.08)",
};

/** Variante más compacta para barras — tema claro institucional */
const glassBarSx = {
  backdropFilter: "blur(16px) saturate(1.5)",
  WebkitBackdropFilter: "blur(16px) saturate(1.5)",
  background: "rgba(255, 255, 255, 0.88)",
  borderBottom: "1px solid rgba(157, 36, 73, 0.18)",
  color: "#1a0a10",
  boxShadow: "0 2px 12px rgba(157, 36, 73, 0.06), 0 1px 3px rgba(0,0,0,0.06)",
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

  // Navegación: piso activo
  const [pisoIdx, setPisoIdx] = useState(0);

  // Modal Nueva Área
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevaForm, setNuevaForm] = useState(EMPTY_NUEVA);
  const [nuevaAdscripcion, setNuevaAdscripcion] = useState(null);
  const [nuevaError, setNuevaError] = useState("");
  const [nuevaSaving, setNuevaSaving] = useState(false);

  const visor3DRef = useRef(null);
  const [mueblesPorArea, setMueblesPorArea] = useState({});

  // ── Estados nuevos sub-fase A ──────────────────────────────────────────────
  /** Modo de cámara: 'orbita' (exploración) | 'cenital' (edición top-down) */
  const [camMode, setCamMode] = useState("orbita");
  /** Herramienta activa del toolbar flotante — se replica al visor vía SET_EDIT_TOOL */
  const [activeTool, setActiveTool] = useState("select");
  /** Panel de lista de áreas flotante colapsado/expandido */
  const [panelAreasOpen, setPanelAreasOpen] = useState(true);
  /** Minimapa 2D en tiempo real (solo desktop) colapsado/expandido */
  const [miniMapOpen, setMiniMapOpen] = useState(true);
  /** Solicitud de borrado proveniente del visor (tool delete) — abre Dialog de confirmación */
  const [deleteRequest, setDeleteRequest] = useState(null); // { id, label } | null

  /** Coords originales por área al iniciar un drag en el visor (para revertir solapes) */
  const dragOriginalsRef = useRef({});
  /** Espejo de `areas` para leer estado actual dentro del listener de postMessage */
  const areasRef = useRef([]);

  // ── Helper: comandar el visor 3D ──────────────────────────────────────────
  const sendToVisor = useCallback((type, payload = {}) => {
    const iframe = visor3DRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({ type, payload }, "*");
  }, []);

  const visorShowArea = useCallback(
    (areaId) => {
      const iframe = visor3DRef.current;
      if (!iframe) return;
      try {
        if (iframe.contentWindow?.SIAST3D) {
          iframe.contentWindow.SIAST3D.showArea(areaId);
          return;
        }
      } catch {
        // cross-origin: caer en postMessage
      }
      sendToVisor("HIGHLIGHT_ROOM", { roomId: areaId });
    },
    [sendToVisor],
  );

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

  // Espejo de areas para el listener de postMessage (evita closures obsoletos)
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  // ── Cambio de piso ────────────────────────────────────────────────────────

  const changePiso = useCallback(
    (nextIdx) => {
      setPisoIdx(nextIdx);
      setSelectedId(null);
      setEditForm(null);
      // Emisor GO_TO_FLOOR → visor (consumidor en main.js: showFloor / showBuilding)
      const floor = PISOS[nextIdx]?.floor ?? 0;
      sendToVisor("GO_TO_FLOOR", { floor });
      try {
        visor3DRef.current?.contentWindow?.SIAST3D?.showFloor?.(floor);
      } catch {}
    },
    [sendToVisor],
  );

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
      // Volar a la habitación y resaltarla en el visor 3D
      sendToVisor("FLY_TO_AREA", { areaId: area.id, floor: area.floor });
      visorShowArea(area.id);
    },
    [visorShowArea, sendToVisor],
  );

  // ── Move / Resize (validación de huella + pendingChanges vía editForm) ───

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

  /** Revierte la geometría de un área en el state y re-sincroniza el visor 3D */
  const revertGeometry = useCallback((areaId, original, floor) => {
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, ...original } : a)));
    setEditForm((prev) => (prev && prev.id === areaId ? { ...prev, ...original } : prev));
    try {
      visor3DRef.current?.contentWindow?.SIAST3D?.updateAreaGeometry?.(
        areaId,
        original.gridX1,
        original.gridY1,
        original.gridX2,
        original.gridY2,
        floor,
      );
    } catch {
      // cross-origin: el visor se re-sincroniza en el próximo fetch/rebuild
    }
  }, []);

  // ── Listeners postMessage del visor ───────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      const { type, payload } = e.data ?? {};
      if (!type) return;

      // ROOM_CLICKED — selección desde el visor (ya existía)
      if (type === "ROOM_CLICKED") {
        const { roomId, floor } = payload ?? {};
        if (!roomId) return;
        const pisoItemIdx = PISOS.findIndex((p) => p.floor === floor);
        if (pisoItemIdx >= 0) changePiso(pisoItemIdx);
        setAreas((prev) => {
          const area = prev.find((a) => a.id === roomId);
          if (area) handleSelect(area);
          return prev;
        });
        return;
      }

      // AREA_DRAWN — el visor terminó un dibujo; abre el modal "Nueva Área"
      // con las coords prellenadas (el visor NO crea el área, la crea la API)
      if (type === "AREA_DRAWN") {
        const { gridX1, gridY1, gridX2, gridY2, floor } = payload ?? {};
        const pisoItem = PISOS.find((p) => p.floor === (floor ?? 0)) ?? PISOS[0];
        setNuevaForm({
          ...EMPTY_NUEVA,
          piso: pisoItem.piso,
          floor: pisoItem.floor,
          gridX1: String(gridX1 ?? DEFAULT_COORDS.gridX1),
          gridY1: String(gridY1 ?? DEFAULT_COORDS.gridY1),
          gridX2: String(gridX2 ?? DEFAULT_COORDS.gridX2),
          gridY2: String(gridY2 ?? DEFAULT_COORDS.gridY2),
        });
        setNuevaAdscripcion(null);
        setNuevaError("");
        setModalOpen(true);
        return;
      }

      // AREA_MOVED / AREA_RESIZED — drag en el visor 3D
      //   live:true  → solo actualizar `areas` (minimapa en tiempo real)
      //   live:false → validar solape y pasar por handleMove/handleResize
      //                (pendingChanges + editForm._dirty → "Guardar todo")
      if (type === "AREA_MOVED" || type === "AREA_RESIZED") {
        const { areaId, gridX1, gridY1, gridX2, gridY2, floor, live } = payload ?? {};
        if (!areaId) return;
        const coords = { gridX1, gridY1, gridX2, gridY2 };
        const areaState = areasRef.current.find((a) => a.id === areaId);
        if (!areaState) return;
        const areaFloor = areaState.floor ?? floor ?? 0;

        if (live) {
          // Capturar coords originales al primer evento live del drag (para revertir)
          if (!dragOriginalsRef.current[areaId]) {
            dragOriginalsRef.current[areaId] = {
              gridX1: areaState.gridX1,
              gridY1: areaState.gridY1,
              gridX2: areaState.gridX2,
              gridY2: areaState.gridY2,
            };
          }
          // Solo state → el minimapa 2D se mueve en tiempo real; sin pendingChanges
          setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, ...coords } : a)));
          return;
        }

        // live:false — rect final
        const original = dragOriginalsRef.current[areaId] ?? null;
        delete dragOriginalsRef.current[areaId];

        // Drag terminó sin cambio (el visor devuelve las coords originales)
        if (
          original &&
          original.gridX1 === gridX1 &&
          original.gridY1 === gridY1 &&
          original.gridX2 === gridX2 &&
          original.gridY2 === gridY2
        ) {
          revertGeometry(areaId, original, areaFloor);
          return;
        }

        // Click sin arrastre (sin eventos live) y coords idénticas → no-op,
        // no ensuciar pendingChanges
        if (
          !original &&
          areaState.gridX1 === gridX1 &&
          areaState.gridY1 === gridY1 &&
          areaState.gridX2 === gridX2 &&
          areaState.gridY2 === gridY2
        )
          return;

        // El visor solo valida huella; el solape entre áreas se valida aquí
        const rect = {
          id: areaId,
          floor: areaFloor,
          x1: gridX1,
          y1: gridY1,
          x2: gridX2,
          y2: gridY2,
        };
        const overlaps = areasRef.current.some(
          (a) =>
            a.id !== areaId &&
            a.activo !== false &&
            a.floor === areaFloor &&
            a.gridX1 != null &&
            seSolapan(rect, areaToRect(a)),
        );
        const fueraDeHuella = !dentroDelEdificio({
          x1: gridX1,
          y1: gridY1,
          x2: gridX2,
          y2: gridY2,
        });

        if ((overlaps || fueraDeHuella) && original) {
          revertGeometry(areaId, original, areaFloor);
          setSaveAllError(
            `"${areaState.label ?? areaId}" ${overlaps ? "se solapa con otra área del piso" : "queda fuera de la huella del edificio"} — cambio revertido`,
          );
          return;
        }
        if (overlaps || fueraDeHuella) return; // sin original: no aplicar el rect inválido

        // Seleccionar el área para que el cambio entre a pendingChanges (el efecto
        // de editForm._dirty solo persiste el área actualmente en edición)
        setSelectedId(areaId);
        setEditForm((prev) =>
          prev && prev.id === areaId
            ? prev
            : {
                ...areaState,
                esSalaJuntas: areaState.esSalaJuntas ?? false,
                esComun: areaState.esComun ?? false,
                tipoComun: areaState.tipoComun ?? null,
                nombrePropio: areaState.nombrePropio ?? null,
                _dirty: false,
              },
        );
        if (type === "AREA_MOVED") handleMove(areaId, coords);
        else handleResize(areaId, coords);
        return;
      }

      // AREA_DELETE_REQUEST — click con tool delete en el visor.
      // NUNCA borra directo: selecciona el área y abre Dialog de confirmación.
      if (type === "AREA_DELETE_REQUEST") {
        const { areaId } = payload ?? {};
        if (!areaId) return;
        const area = areasRef.current.find((a) => a.id === areaId);
        if (!area) return;
        handleSelect(area);
        setDeleteRequest({ id: area.id, label: area.label || area.id });
        return;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [changePiso, handleSelect, handleMove, handleResize, revertGeometry]);

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
      // Si algunas áreas ya se guardaron antes de que una fallara, releer del
      // servidor para no dejar la UI mostrando cambios como "pendientes" que
      // en realidad ya quedaron aplicados (loadAreas limpia pendingChanges
      // que ya coinciden con lo que hay en el servidor).
      await loadAreas();
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

  // ── Toggle modo cámara ─────────────────────────────────────────────────────

  const handleToggleCamMode = () => {
    const next = camMode === "orbita" ? "cenital" : "orbita";
    setCamMode(next);
    // Emisor SET_CAMERA_MODE → visor (consumidor en sub-fase B)
    sendToVisor("SET_CAMERA_MODE", { mode: next });
  };

  // ── Cambiar herramienta ────────────────────────────────────────────────────

  const handleSetTool = (tool) => {
    setActiveTool(tool);
    // Al dibujar, asegurar que el visor esté en el piso activo (recomendación
    // del visor: el rect dibujado se ancla al piso visible)
    if (tool === "draw") {
      const floor = PISOS[pisoIdx]?.floor ?? 0;
      sendToVisor("GO_TO_FLOOR", { floor });
    }
    sendToVisor("SET_EDIT_TOOL", { tool });
  };

  // ── Muebles / Módulos ──────────────────────────────────────────────────────

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

  /** Confirmación del Dialog abierto por AREA_DELETE_REQUEST (tool delete del visor) */
  const handleConfirmDeleteRequest = async () => {
    if (!deleteRequest) return;
    const { id } = deleteRequest;
    setDeleteRequest(null);
    try {
      await deleteArea(id);
      await loadAreas();
      handleCancelar();
    } catch (err) {
      setSaveAllError(err.response?.data?.error ?? "Error al eliminar el área");
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

  // ── Areas filtradas según piso activo ────────────────────────────────────

  const pisoActivo = PISOS[pisoIdx];

  const areasDelPiso = useMemo(
    () => areas.filter((a) => a.floor === pisoActivo.floor),
    [areas, pisoActivo.floor],
  );

  // ── Detección mobile/tablet ────────────────────────────────────────────────
  // Antes cualquier touch (isCoarsePointer) forzaba el visor 2D, incluyendo
  // tablets grandes. Ahora solo pantallas angostas (celulares) usan el 2D;
  // tablets (>= breakpoint "sm") ya usan el visor 3D con controles táctiles.
  const muiTheme = useTheme();
  const isMobileView = useMediaQuery(muiTheme.breakpoints.down("sm"));

  // Número de áreas válidas (sin solape) en el piso activo
  const areasValidasPiso = areasDelPiso.filter((a) => !conflictIds.has(a.id)).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /*
     * Contenedor raíz: ocupa todo el viewport menos el AppShell.
     * position: relative para que los overlays position: absolute queden
     * confinados a este contenedor (no al viewport completo).
     */
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 64px)", // 64px = altura AppShell header
        overflow: "hidden",
      }}
    >
      {/* ── FONDO: iframe visor 3D (desktop) o FloorPlanMobile (mobile) ── */}
      {isMobileView ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "#f5f0f2",
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <FloorPlanMobile areas={areasDelPiso} selectedId={selectedId} onSelect={handleSelect} />
        </Box>
      ) : (
        <iframe
          ref={visor3DRef}
          src={`${import.meta.env.VITE_VIEWER_URL ?? `http://${window.location.hostname}:5174`}?editor=1`}
          title="Visor 3D Edificio"
          onLoad={() => {
            sendToVisor("SET_THEME", { theme: "light" });
            // JWT para que el visor pueda cargar muebles (/api/admin/areas/:id/muebles)
            const token = localStorage.getItem("siast_token");
            if (token) sendToVisor("SET_TOKEN", { token });
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* ── OVERLAY z=5: Alertas globales (errores, áreas sin mapear) ── */}
      <Box
        sx={{
          position: "absolute",
          top: 72, // debajo de la TopBar
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(560px, 90%)",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          pointerEvents: "none",
          "& .MuiAlert-root": { pointerEvents: "auto" },
        }}
      >
        {saveAllError && (
          <Alert severity="error" onClose={() => setSaveAllError("")} sx={{ fontSize: 12 }}>
            {saveAllError}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ fontSize: 12 }}>
            {error}
          </Alert>
        )}
        {!loading &&
          (() => {
            const sinMapear = areas.filter(
              (a) => a.gridX1 == null || a.gridY1 == null || a.gridX2 == null || a.gridY2 == null,
            );
            if (sinMapear.length === 0) return null;
            return (
              <Box
                sx={{
                  ...glassSx,
                  p: 1.25,
                  border: "1px solid rgba(237,108,2,0.35)",
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ display: "block", mb: 0.75, color: "#b05a00", letterSpacing: 0.5 }}
                >
                  {sinMapear.length} ÁREA{sinMapear.length !== 1 ? "S" : ""} SIN MAPEAR
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {sinMapear.map((a) => (
                    <Chip
                      key={a.id}
                      label={`Colocar: ${a.label}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: "rgba(237,108,2,0.5)",
                        color: "#b05a00",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
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
                        setSelectedId(a.id);
                        setEditForm({ ...withCoords, _dirty: true });
                        setSaveError("");
                      }}
                    />
                  ))}
                </Box>
              </Box>
            );
          })()}
        {loading && (
          <Box
            sx={{
              ...glassSx,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2.5,
              py: 1.5,
            }}
          >
            <CircularProgress size={18} sx={{ color: "#9d2449" }} />
            <Typography variant="body2" sx={{ color: "rgba(60,20,35,0.8)" }}>
              Cargando áreas…
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── OVERLAY z=20: TopBar flotante ── */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          ...glassBarSx,
          px: 2,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {/* Título */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1 }}>
          <EditLocationAltIcon sx={{ fontSize: 18, color: "#c44e71" }} />
          <Typography
            variant="subtitle1"
            fontWeight={800}
            sx={{
              background: "linear-gradient(135deg, #c44e71 0%, #e8789a 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Mapa de Áreas
          </Typography>
        </Box>

        {/* Tabs de piso */}
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            flex: 1,
            justifyContent: "center",
            minWidth: 0,
            alignItems: "center",
          }}
        >
          {/* Botón Edificio completo */}
          <Tooltip title="Ver edificio completo (todos los pisos)">
            <Button
              size="small"
              onClick={() => {
                sendToVisor("GO_TO_FLOOR", { floor: -1 });
                try {
                  visor3DRef.current?.contentWindow?.SIAST3D?.showBuilding?.();
                } catch {}
                setSelectedId(null);
                setEditForm(null);
              }}
              startIcon={<ViewInArIcon sx={{ fontSize: 13 }} />}
              sx={{
                minWidth: 48,
                fontWeight: 700,
                fontSize: 11,
                color: "rgba(60,20,35,0.65)",
                bgcolor: "transparent",
                border: "1px solid rgba(157,36,73,0.20)",
                borderRadius: "6px",
                py: 0.4,
                px: 1,
                mr: 0.5,
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: "rgba(157,36,73,0.10)",
                  color: "rgba(157,36,73,0.9)",
                  borderColor: "rgba(157,36,73,0.45)",
                },
              }}
            >
              Edificio
            </Button>
          </Tooltip>

          {PISOS.map((p, i) => {
            const isActive = pisoIdx === i;
            const count = areas.filter((a) => a.floor === p.floor).length;
            return (
              <Button
                key={p.piso}
                size="small"
                onClick={() => changePiso(i)}
                sx={{
                  minWidth: 52,
                  fontWeight: isActive ? 800 : 500,
                  fontSize: 11,
                  color: isActive ? "#fff" : "rgba(60,20,35,0.65)",
                  bgcolor: isActive ? "rgba(157,36,73,0.85)" : "transparent",
                  border: isActive
                    ? "1px solid rgba(157,36,73,0.9)"
                    : "1px solid rgba(157,36,73,0.20)",
                  borderRadius: "6px",
                  py: 0.4,
                  px: 1,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: isActive ? "rgba(157,36,73,0.95)" : "rgba(157,36,73,0.10)",
                    color: isActive ? "#fff" : "rgba(157,36,73,0.9)",
                  },
                  gap: 0.5,
                }}
              >
                PISO {p.label}
                <Chip
                  label={count}
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: 9,
                    fontWeight: 800,
                    bgcolor: isActive ? "rgba(255,255,255,0.25)" : "rgba(157,36,73,0.10)",
                    color: isActive ? "#fff" : "rgba(157,36,73,0.7)",
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Button>
            );
          })}
        </Box>

        {/* Acciones derechas */}
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
          {/* Toggle órbita / cenital */}
          <Tooltip
            title={
              camMode === "orbita"
                ? "Cambiar a vista cenital (top-down de edición)"
                : "Cambiar a vista órbita (exploración 3D)"
            }
          >
            <Button
              size="small"
              variant={camMode === "cenital" ? "contained" : "outlined"}
              startIcon={
                camMode === "cenital" ? (
                  <CenterFocusStrongIcon sx={{ fontSize: 15 }} />
                ) : (
                  <ViewInArIcon sx={{ fontSize: 15 }} />
                )
              }
              onClick={handleToggleCamMode}
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: camMode === "cenital" ? "#fff" : "rgba(60,20,35,0.75)",
                borderColor: camMode === "cenital" ? "rgba(157,36,73,0.9)" : "rgba(157,36,73,0.35)",
                bgcolor: camMode === "cenital" ? "rgba(157,36,73,0.85)" : "transparent",
                py: 0.4,
                "&:hover": {
                  bgcolor: camMode === "cenital" ? "rgba(157,36,73,0.95)" : "rgba(157,36,73,0.10)",
                },
              }}
            >
              {camMode === "cenital" ? "Cenital" : "Órbita 3D"}
            </Button>
          </Tooltip>

          {/* Render */}
          <Tooltip title="Recarga el modelo 3D desde la base de datos">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ThreeDRotationIcon sx={{ fontSize: 14 }} />}
              onClick={handleGenerarRender}
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(60,20,35,0.70)",
                borderColor: "rgba(157,36,73,0.30)",
                py: 0.4,
                "&:hover": { bgcolor: "rgba(157,36,73,0.08)", color: "rgba(157,36,73,0.9)" },
              }}
            >
              Render
            </Button>
          </Tooltip>

          {/* Guardar todo */}
          <Tooltip title="Persiste todos los cambios pendientes en la base de datos">
            <span>
              <Badge badgeContent={pendingCount} color="warning" max={99}>
                <Button
                  variant={pendingCount > 0 ? "contained" : "outlined"}
                  size="small"
                  startIcon={
                    savingAll ? (
                      <CircularProgress size={13} color="inherit" />
                    ) : (
                      <SaveIcon sx={{ fontSize: 14 }} />
                    )
                  }
                  onClick={handleGuardarTodo}
                  disabled={pendingCount === 0 || savingAll}
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    py: 0.4,
                    bgcolor: pendingCount > 0 ? "rgba(237,108,2,0.75)" : "transparent",
                    borderColor: pendingCount > 0 ? "rgba(237,108,2,0.9)" : "rgba(157,36,73,0.3)",
                    color: pendingCount > 0 ? "#fff" : "rgba(60,20,35,0.70)",
                    "&:hover": {
                      bgcolor: pendingCount > 0 ? "rgba(237,108,2,0.9)" : "rgba(157,36,73,0.2)",
                    },
                  }}
                >
                  Guardar
                </Button>
              </Badge>
            </span>
          </Tooltip>

          {/* Nueva área */}
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              setNuevaForm(EMPTY_NUEVA);
              setNuevaError("");
              setModalOpen(true);
            }}
            sx={{
              fontSize: 11,
              fontWeight: 700,
              py: 0.4,
              bgcolor: "rgba(157,36,73,0.75)",
              "&:hover": { bgcolor: "rgba(157,36,73,0.95)" },
            }}
          >
            Nueva Área
          </Button>
        </Box>
      </Box>

      {/* ── OVERLAY z=15: Toolbar vertical de herramientas ── */}
      <Box
        sx={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 15,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          // Sin backdrop-filter para evitar pixelado sobre el canvas WebGL
          background: "rgba(255, 255, 255, 0.94)",
          border: "1px solid rgba(157, 36, 73, 0.22)",
          borderRadius: "10px",
          color: "#1a0a10",
          boxShadow: "0 4px 24px rgba(157, 36, 73, 0.12), 0 1px 4px rgba(0,0,0,0.10)",
          p: 0.75,
        }}
      >
        {[
          { tool: "select", icon: <NearMeIcon sx={{ fontSize: 17 }} />, label: "Seleccionar" },
          { tool: "move", icon: <PanToolIcon sx={{ fontSize: 17 }} />, label: "Mover" },
          { tool: "draw", icon: <DrawIcon sx={{ fontSize: 17 }} />, label: "Dibujar área" },
          {
            tool: "resize",
            icon: <HighlightAltIcon sx={{ fontSize: 17 }} />,
            label: "Redimensionar",
          },
          {
            tool: "delete",
            icon: <DeleteOutlineIcon sx={{ fontSize: 17 }} />,
            label: "Borrar área",
            danger: true,
          },
        ].map(({ tool, icon, label, danger }) => {
          const isActive = activeTool === tool;
          // El tool "delete" usa paleta de advertencia (rojo) en vez del guinda
          const activeBg = danger ? "rgba(198,40,40,0.88)" : "rgba(157,36,73,0.85)";
          const activeBorder = danger ? "rgba(198,40,40,0.95)" : "rgba(157,36,73,0.9)";
          const idleColor = danger ? "rgba(183,28,28,0.75)" : "rgba(60,20,35,0.55)";
          const hoverBg = danger ? "rgba(198,40,40,0.12)" : "rgba(157,36,73,0.12)";
          const hoverColor = danger ? "#b71c1c" : "rgba(157,36,73,0.9)";
          const hoverBorder = danger ? "rgba(198,40,40,0.40)" : "rgba(157,36,73,0.35)";
          return (
            <Tooltip key={tool} title={label} placement="right">
              <IconButton
                size="small"
                onClick={() => handleSetTool(tool)}
                sx={{
                  color: isActive ? "#fff" : idleColor,
                  bgcolor: isActive ? activeBg : "transparent",
                  border: isActive ? `1px solid ${activeBorder}` : "1px solid rgba(157,36,73,0.12)",
                  borderRadius: "6px",
                  width: 34,
                  height: 34,
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: isActive ? activeBg : hoverBg,
                    color: isActive ? "#fff" : hoverColor,
                    border: `1px solid ${hoverBorder}`,
                  },
                }}
              >
                {icon}
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {/* ── OVERLAY z=15: Panel flotante izquierdo "Áreas del piso" ── */}
      <Box
        sx={{
          position: "absolute",
          left: 60,
          top: 64,
          zIndex: 15,
          width: 220,
          maxHeight: "calc(100vh - 160px)",
          display: "flex",
          flexDirection: "column",
          ...glassSx,
          overflow: "hidden",
        }}
      >
        {/* Header del panel áreas */}
        <Box
          onClick={() => setPanelAreasOpen((v) => !v)}
          sx={{
            px: 1.5,
            py: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: panelAreasOpen ? "1px solid rgba(157,36,73,0.25)" : "none",
            "&:hover": { bgcolor: "rgba(157,36,73,0.15)" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <LayersIcon sx={{ fontSize: 14, color: "#c44e71" }} />
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ color: "#c44e71", letterSpacing: 0.8, fontSize: 10 }}
            >
              ÁREAS — PISO {pisoActivo.label}
            </Typography>
            <Chip
              label={areasDelPiso.length}
              size="small"
              sx={{
                height: 14,
                fontSize: 9,
                fontWeight: 800,
                bgcolor: "rgba(157,36,73,0.15)",
                color: "#9d2449",
                "& .MuiChip-label": { px: 0.5 },
              }}
            />
          </Box>
          <ExpandMoreIcon
            sx={{
              fontSize: 15,
              color: "rgba(60,20,35,0.40)",
              transition: "transform 0.2s",
              transform: panelAreasOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </Box>

        <Collapse in={panelAreasOpen}>
          <Box sx={{ overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
            {areasDelPiso.length === 0 ? (
              <Typography
                variant="caption"
                sx={{ color: "rgba(60,20,35,0.38)", px: 1.5, py: 1, display: "block" }}
              >
                Sin áreas en este piso
              </Typography>
            ) : (
              <List dense disablePadding>
                {areasDelPiso.map((a) => {
                  const isSelected = selectedId === a.id;
                  const hasConflict = conflictIds.has(a.id);
                  return (
                    <ListItem
                      key={a.id}
                      disablePadding
                      onClick={() => handleSelect(a)}
                      sx={{
                        cursor: "pointer",
                        px: 1.25,
                        py: 0.5,
                        bgcolor: isSelected ? "rgba(157,36,73,0.35)" : "transparent",
                        borderLeft: isSelected
                          ? "3px solid rgba(157,36,73,0.9)"
                          : "3px solid transparent",
                        "&:hover": { bgcolor: "rgba(157,36,73,0.2)" },
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: hasConflict ? "#f44336" : "#9d2449",
                          mr: 1,
                          flexShrink: 0,
                        }}
                      />
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            fontWeight={isSelected ? 700 : 500}
                            sx={{
                              fontSize: 11,
                              color: hasConflict
                                ? "#b71c1c"
                                : isSelected
                                  ? "#5c0a22"
                                  : "rgba(30,10,18,0.75)",
                              lineHeight: 1.3,
                            }}
                          >
                            {a.label || a.id}
                          </Typography>
                        }
                        secondary={
                          a.esComun ? (
                            <Typography
                              variant="caption"
                              sx={{ fontSize: 9, color: "rgba(60,20,35,0.40)" }}
                            >
                              Área común
                            </Typography>
                          ) : null
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>

          {/* Botón nueva área en el panel */}
          <Box sx={{ p: 1, borderTop: "1px solid rgba(157,36,73,0.2)" }}>
            <Button
              fullWidth
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 13 }} />}
              onClick={() => {
                setNuevaForm(EMPTY_NUEVA);
                setNuevaError("");
                setModalOpen(true);
              }}
              sx={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(157,36,73,0.75)",
                borderColor: "rgba(157,36,73,0.30)",
                borderStyle: "dashed",
                py: 0.4,
                "&:hover": {
                  bgcolor: "rgba(157,36,73,0.08)",
                  borderColor: "rgba(157,36,73,0.60)",
                  color: "#9d2449",
                },
              }}
              variant="outlined"
            >
              Nueva área
            </Button>
          </Box>
        </Collapse>
      </Box>

      {/* ── OVERLAY z=15: Panel flotante derecho "Editar área" ── */}
      {editForm && (
        <Box
          sx={{
            position: "absolute",
            right: 12,
            top: 64,
            zIndex: 15,
            width: 340,
            maxHeight: "calc(100vh - 140px)",
            display: "flex",
            flexDirection: "column",
            ...glassSx,
            overflow: "hidden",
          }}
        >
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
            glass
          />
        </Box>
      )}

      {/* ── OVERLAY z=15: BottomBar de estado ── */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 15,
          ...glassBarSx,
          borderBottom: "none",
          borderTop: "1px solid rgba(157,36,73,0.3)",
          px: 2,
          py: 0.6,
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        {/* Área activa */}
        <Typography variant="caption" sx={{ color: "rgba(30,10,18,0.55)", fontSize: 10 }}>
          {editForm ? (
            <span>
              <span style={{ color: "#9d2449", fontWeight: 700 }}>
                {editForm.label || editForm.id}
              </span>
              {" — "}
              {editForm.gridX1 != null
                ? `${zonaForGridX(editForm.gridX1, editForm.gridX2)} · PISO ${PISO_LABELS[editForm.piso] ?? editForm.piso}`
                : "sin ubicación"}
            </span>
          ) : (
            <span style={{ color: "rgba(30,10,18,0.30)" }}>Sin área seleccionada</span>
          )}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* Modo cámara */}
        <Typography
          variant="caption"
          sx={{
            fontSize: 10,
            color: camMode === "cenital" ? "#9d2449" : "rgba(30,10,18,0.45)",
            fontWeight: 700,
          }}
        >
          CAM: {camMode.toUpperCase()}
        </Typography>

        {/* Herramienta activa */}
        <Typography
          variant="caption"
          sx={{ fontSize: 10, color: "rgba(30,10,18,0.45)", fontWeight: 700 }}
        >
          TOOL: {activeTool.toUpperCase()}
        </Typography>

        {/* Contador de áreas válidas / solapes */}
        <Typography variant="caption" sx={{ fontSize: 10, color: "rgba(30,10,18,0.45)" }}>
          Piso {pisoActivo.label}:{" "}
          <span style={{ color: "#2e7d32", fontWeight: 700 }}>{areasValidasPiso} válidas</span>
          {conflictIds.size > 0 && (
            <span style={{ color: "#b71c1c", fontWeight: 700 }}>
              {" "}
              · {conflictIds.size} con solape
            </span>
          )}
        </Typography>
      </Box>

      {/* ── OVERLAY z=12: Minimapa 2D en tiempo real (solo desktop) ── */}
      {/* Reactivo al state `areas`: los eventos live del visor lo mueven en vivo. */}
      {!isMobileView &&
        (miniMapOpen ? (
          <Box
            sx={{
              position: "absolute",
              left: 12,
              bottom: 40,
              zIndex: 12, // sobre el iframe (0), bajo toolbar/paneles (15)
              width: 300,
              bgcolor: "#fff",
              border: "1px solid rgba(157,36,73,0.22)",
              borderRadius: 2,
              boxShadow: "0 4px 18px rgba(157,36,73,0.14), 0 1px 4px rgba(0,0,0,0.10)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 1.25,
                py: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(157,36,73,0.15)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <MapIcon sx={{ fontSize: 13, color: "#c44e71" }} />
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ color: "#c44e71", letterSpacing: 0.8, fontSize: 9 }}
                >
                  PLANTA — PISO {pisoActivo.label}
                </Typography>
              </Box>
              <Tooltip title="Ocultar minimapa">
                <IconButton
                  size="small"
                  onClick={() => setMiniMapOpen(false)}
                  sx={{ color: "rgba(60,20,35,0.45)", p: 0.25 }}
                >
                  <ExpandMoreIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
            {/* 300 × 254 ≈ proporción del viewBox del plano (464 × 394) */}
            <Box sx={{ height: 254 }}>
              <FloorPlanMobile
                areas={areasDelPiso}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </Box>
          </Box>
        ) : (
          <Tooltip title="Mostrar minimapa 2D" placement="right">
            <IconButton
              onClick={() => setMiniMapOpen(true)}
              sx={{
                position: "absolute",
                left: 12,
                bottom: 40,
                zIndex: 12,
                bgcolor: "rgba(255,255,255,0.94)",
                border: "1px solid rgba(157,36,73,0.22)",
                borderRadius: "8px",
                boxShadow: "0 2px 10px rgba(157,36,73,0.12)",
                color: "#9d2449",
                width: 36,
                height: 36,
                "&:hover": { bgcolor: "rgba(157,36,73,0.10)" },
              }}
            >
              <MapIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ))}

      {/* ── Modal Nueva Área ── */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Nueva Área</DialogTitle>
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
            label={<Typography variant="body2">Es Área Común</Typography>}
          />

          {(nuevaForm.esComun ?? false) && (
            <>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Área Común</InputLabel>
                <Select
                  value={nuevaForm.tipoComun ?? ""}
                  label="Tipo de Área Común"
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
            {nuevaSaving ? <CircularProgress size={18} /> : "Crear Área"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: confirmar borrado solicitado desde el visor (tool delete) ── */}
      <Dialog open={!!deleteRequest} onClose={() => setDeleteRequest(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Desactivar área</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Desactivar el área <strong style={{ color: "#9d2449" }}>{deleteRequest?.label}</strong>
            ? El área dejará de mostrarse en el visor (borrado lógico, se puede reactivar desde la
            base de datos).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteRequest(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 15 }} />}
            onClick={handleConfirmDeleteRequest}
          >
            Desactivar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog />
    </Box>
  );
};

// ── Constantes de tipos de módulo (renombrado visual: Mueble → Módulo) ────────

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

/**
 * EditPanel — panel de edición del área seleccionada.
 * Acepta prop `glass` para adaptar colores al fondo oscuro del overlay.
 */
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
  glass = false,
}) {
  const [adscripcion, setAdscripcion] = useState(null);
  const [modulosExpanded, setModulosExpanded] = useState(false);
  const [addingModulo, setAddingModulo] = useState(false);
  const [muebleForm, setMuebleForm] = useState(MUEBLE_EMPTY);
  const [muebleSaving, setMuebleSaving] = useState(false);
  const [muebleError, setMuebleError] = useState("");

  const textColor = glass ? "#1a0a10" : "inherit";
  const secondaryColor = glass ? "rgba(30,10,18,0.55)" : "text.secondary";
  const dividerColor = glass ? "rgba(157,36,73,0.18)" : "divider";
  const bgAccent = glass ? "rgba(157,36,73,0.07)" : "action.hover";
  const borderAccent = glass ? "rgba(157,36,73,0.22)" : "divider";

  const handleAdscripcionChange = (_, val) => {
    setAdscripcion(val);
    if (val) setEdit("label", val.nombre);
  };

  const handleGuardarModulo = async () => {
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
      setAddingModulo(false);
      onMueblesChange();
    } catch (err) {
      setMuebleError(err.response?.data?.error ?? "Error al guardar módulo");
    } finally {
      setMuebleSaving(false);
    }
  };

  const handleEliminarModulo = async (muebleId) => {
    try {
      await deleteMueble(muebleId);
      onMueblesChange();
    } catch {}
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      {/* Barra mínima: solo cerrar + chip pendiente — sin duplicar nombre/id */}
      <Box
        sx={{
          px: 1.25,
          py: 0.5,
          borderBottom: "1px solid rgba(157,36,73,0.25)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 0.5,
          flexShrink: 0,
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
              height: 18,
              "& .MuiChip-label": { px: 0.75 },
              animation: "siast-pulse 1.5s ease infinite",
              "@keyframes siast-pulse": {
                "0%,100%": { boxShadow: "0 0 0 0 rgba(237,108,2,0.35)" },
                "50%": { boxShadow: "0 0 0 4px rgba(237,108,2,0)" },
              },
            }}
          />
        )}
        <IconButton size="small" onClick={onCancelar} sx={{ color: secondaryColor }}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {saveError && (
          <Alert severity="error" sx={{ fontSize: 11, py: 0.25 }}>
            {saveError}
          </Alert>
        )}

        <GlassSectionLabel color={secondaryColor}>DATOS DEL ÁREA</GlassSectionLabel>

        <TextField
          label="Nombre del área"
          value={form.label}
          onChange={(e) => setEdit("label", e.target.value)}
          fullWidth
          size="small"
          required
          InputLabelProps={glass ? { sx: { color: secondaryColor } } : undefined}
          inputProps={{ style: glass ? { color: textColor } : undefined }}
          sx={
            glass
              ? {
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: borderAccent },
                    "&:hover fieldset": { borderColor: "rgba(157,36,73,0.6)" },
                    "&.Mui-focused fieldset": { borderColor: "#9d2449" },
                    color: textColor,
                  },
                }
              : {}
          }
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
            <Typography variant="body2" sx={{ fontSize: 11, color: secondaryColor }}>
              Marcar como Sala de Juntas
            </Typography>
          }
          sx={{ ml: 0, my: 0 }}
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
            <Typography variant="body2" sx={{ fontSize: 11, color: secondaryColor }}>
              Es Área Común
            </Typography>
          }
          sx={{ ml: 0, my: 0 }}
        />

        {(form.esComun ?? false) && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              pl: 1,
              borderLeft: "3px solid rgba(157,36,73,0.4)",
            }}
          >
            <FormControl fullWidth size="small">
              <InputLabel sx={glass ? { color: secondaryColor } : undefined}>
                Tipo de Área Común
              </InputLabel>
              <Select
                value={form.tipoComun ?? ""}
                label="Tipo de Área Común"
                onChange={(e) => setEdit("tipoComun", e.target.value || null)}
                sx={glass ? { color: textColor } : undefined}
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
              InputLabelProps={glass ? { sx: { color: secondaryColor } } : undefined}
              inputProps={{ style: glass ? { color: textColor } : undefined }}
              sx={
                glass
                  ? {
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: borderAccent },
                        color: textColor,
                      },
                      "& .MuiFormHelperText-root": { color: "rgba(30,10,18,0.40)" },
                    }
                  : {}
              }
            />
          </Box>
        )}

        <Divider sx={{ my: 0.25, borderColor: dividerColor }} />

        <GlassSectionLabel color={secondaryColor}>ADSCRIPCION SIRH</GlassSectionLabel>

        {sirhError ? (
          <Alert severity="warning" sx={{ fontSize: 11, py: 0.25 }}>
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
                  InputLabelProps={glass ? { sx: { color: secondaryColor } } : undefined}
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
              <Typography
                variant="caption"
                sx={{ color: glass ? "#2e7d32" : "success.main", fontWeight: 600, fontSize: 10 }}
              >
                Al guardar: {adscripcion.nombre}
              </Typography>
            )}
          </>
        )}

        <Divider sx={{ my: 0.25, borderColor: dividerColor }} />

        <GlassSectionLabel color={secondaryColor}>POSICION EN CUADRICULA</GlassSectionLabel>
        <Box
          sx={{
            p: 1,
            borderRadius: "6px",
            bgcolor: bgAccent,
            border: "1px solid",
            borderColor: borderAccent,
          }}
        >
          <Box sx={{ display: "flex", gap: 0.75 }}>
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
                sx={{
                  flex: 1,
                  ...(glass
                    ? {
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": { borderColor: borderAccent },
                          color: textColor,
                        },
                        "& label": { color: secondaryColor },
                      }
                    : {}),
                }}
              />
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 0.25, borderColor: dividerColor }} />

        {/* Módulos (renombrado visual de Muebles) */}
        <Box>
          <Box
            onClick={() => setModulosExpanded((v) => !v)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              py: 0.5,
              borderRadius: "4px",
              px: 0.5,
              "&:hover": { bgcolor: bgAccent },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <ChairIcon sx={{ fontSize: 13, color: secondaryColor }} />
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{ color: secondaryColor, letterSpacing: 0.8, fontSize: 10 }}
              >
                MÓDULOS
              </Typography>
              {muebles.length > 0 && (
                <Chip
                  label={muebles.length}
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: 9,
                    fontWeight: 800,
                    bgcolor: "rgba(157,36,73,0.12)",
                    color: "#9d2449",
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              )}
            </Box>
            <ExpandMoreIcon
              sx={{
                fontSize: 16,
                color: secondaryColor,
                transition: "transform 0.2s",
                transform: modulosExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </Box>

          <Collapse in={modulosExpanded}>
            <Box sx={{ mt: 0.75, display: "flex", flexDirection: "column", gap: 0.75 }}>
              {muebles.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: "6px",
                    overflow: "hidden",
                    bgcolor: glass ? "rgba(157,36,73,0.04)" : undefined,
                    borderColor: borderAccent,
                  }}
                >
                  <List dense disablePadding>
                    {muebles.map((m, idx) => (
                      <ListItem
                        key={m.id}
                        divider={idx < muebles.length - 1}
                        secondaryAction={
                          <Tooltip title="Eliminar módulo">
                            <IconButton
                              edge="end"
                              size="small"
                              color="error"
                              onClick={() => handleEliminarModulo(m.id)}
                            >
                              <DeleteIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        }
                        sx={{
                          py: 0.4,
                          "& .MuiDivider-root": { borderColor: borderAccent },
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: colorMueble(m.tipo),
                            mr: 1,
                            flexShrink: 0,
                          }}
                        />
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ fontSize: 11, color: textColor }}
                            >
                              {m.label}
                            </Typography>
                          }
                          secondary={
                            <Chip
                              label={labelMueble(m.tipo)}
                              size="small"
                              sx={{
                                height: 13,
                                fontSize: 9,
                                fontWeight: 700,
                                bgcolor: colorMueble(m.tipo) + "22",
                                color: colorMueble(m.tipo),
                                "& .MuiChip-label": { px: 0.5 },
                                mt: 0.2,
                              }}
                            />
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}

              {addingModulo ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    bgcolor: glass ? "rgba(157,36,73,0.04)" : undefined,
                    borderColor: borderAccent,
                  }}
                >
                  {muebleError && (
                    <Alert severity="error" sx={{ fontSize: 11, py: 0 }}>
                      {muebleError}
                    </Alert>
                  )}
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    <TextField
                      label={muebleForm.modo === "fila" ? "Prefijo (ej. Cubículo)" : "Nombre"}
                      value={muebleForm.label}
                      onChange={(e) => setMuebleForm((p) => ({ ...p, label: e.target.value }))}
                      size="small"
                      fullWidth
                      autoFocus
                      required
                      InputLabelProps={glass ? { sx: { color: secondaryColor } } : undefined}
                      inputProps={{ style: glass ? { color: textColor } : undefined }}
                      sx={
                        glass
                          ? {
                              "& .MuiOutlinedInput-root": {
                                "& fieldset": { borderColor: borderAccent },
                                color: textColor,
                              },
                            }
                          : {}
                      }
                    />
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <InputLabel sx={glass ? { color: secondaryColor } : undefined}>
                        Tipo de módulo
                      </InputLabel>
                      <Select
                        value={muebleForm.tipo}
                        label="Tipo de módulo"
                        onChange={(e) => setMuebleForm((p) => ({ ...p, tipo: e.target.value }))}
                        sx={glass ? { color: textColor } : undefined}
                      >
                        {TIPOS_MUEBLE.map((t) => (
                          <MenuItem key={t.value} value={t.value}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Box
                                sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: t.color }}
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
                    sx={{
                      "& .MuiToggleButton-root": {
                        py: 0.3,
                        fontSize: 10,
                        fontWeight: 700,
                        color: glass ? "rgba(30,10,18,0.55)" : undefined,
                        borderColor: glass ? borderAccent : undefined,
                      },
                      "& .MuiToggleButton-root.Mui-selected": glass
                        ? { color: "#fff", bgcolor: "rgba(157,36,73,0.75)" }
                        : {},
                    }}
                  >
                    <ToggleButton value="uno">Módulo solo</ToggleButton>
                    <ToggleButton value="fila">Fila de módulos</ToggleButton>
                  </ToggleButtonGroup>

                  {muebleForm.modo === "fila" && (
                    <Box sx={{ display: "flex", gap: 0.75 }}>
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
                        <InputLabel sx={glass ? { color: secondaryColor } : undefined}>
                          Orientación
                        </InputLabel>
                        <Select
                          value={muebleForm.orientacion}
                          label="Orientación"
                          onChange={(e) =>
                            setMuebleForm((p) => ({ ...p, orientacion: e.target.value }))
                          }
                          sx={glass ? { color: textColor } : undefined}
                        >
                          <MenuItem value="H">Horizontal →</MenuItem>
                          <MenuItem value="V">Vertical ↓</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}

                  <Box sx={{ display: "flex", gap: 0.75 }}>
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
                        sx={{
                          flex: 1,
                          ...(glass
                            ? {
                                "& .MuiOutlinedInput-root": {
                                  "& fieldset": { borderColor: borderAccent },
                                  color: textColor,
                                  fontSize: 11,
                                },
                                "& label": { color: secondaryColor, fontSize: 11 },
                              }
                            : {}),
                        }}
                        placeholder="0-1"
                      />
                    ))}
                  </Box>

                  <FormControl size="small" fullWidth>
                    <InputLabel sx={glass ? { color: secondaryColor } : undefined}>
                      Rotación
                    </InputLabel>
                    <Select
                      value={muebleForm.rotacion}
                      label="Rotación"
                      onChange={(e) =>
                        setMuebleForm((p) => ({ ...p, rotacion: Number(e.target.value) }))
                      }
                      sx={glass ? { color: textColor } : undefined}
                    >
                      {ROTACIONES.map((r) => (
                        <MenuItem key={r.value} value={r.value}>
                          {r.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setAddingModulo(false);
                        setMuebleForm(MUEBLE_EMPTY);
                        setMuebleError("");
                      }}
                      sx={glass ? { color: "rgba(30,10,18,0.55)" } : undefined}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleGuardarModulo}
                      disabled={muebleSaving}
                      startIcon={
                        muebleSaving ? <CircularProgress size={12} color="inherit" /> : null
                      }
                      sx={
                        glass
                          ? { bgcolor: "rgba(157,36,73,0.75)", "&:hover": { bgcolor: "#9d2449" } }
                          : undefined
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
                  startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                  onClick={() => setAddingModulo(true)}
                  fullWidth
                  sx={{
                    borderStyle: "dashed",
                    fontSize: 10,
                    fontWeight: 700,
                    ...(glass
                      ? {
                          color: "rgba(157,36,73,0.75)",
                          borderColor: borderAccent,
                          "&:hover": { bgcolor: bgAccent, color: "#9d2449" },
                        }
                      : {}),
                  }}
                >
                  Agregar módulo
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      </Box>

      {/* Acciones del panel */}
      <Box
        sx={{
          p: 1.25,
          borderTop: "1px solid",
          borderColor: dividerColor,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 0.75,
          bgcolor: glass ? "rgba(157,36,73,0.08)" : "grey.50",
          flexShrink: 0,
        }}
      >
        <Tooltip title="Desactivar área">
          <IconButton size="small" color="error" onClick={onEliminar}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {isPending && (
            <Typography
              variant="caption"
              sx={{
                fontSize: 10,
                color: glass ? "#e65100" : "warning.dark",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <SaveIcon sx={{ fontSize: 12 }} /> Pendiente
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function GlassSectionLabel({ children, color }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      sx={{
        letterSpacing: 0.8,
        fontSize: 10,
        display: "block",
        mt: 0.25,
        color: color ?? "text.secondary",
      }}
    >
      {children}
    </Typography>
  );
}
