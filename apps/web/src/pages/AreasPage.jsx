/**
 * AreasPage — Editor de Áreas del Edificio
 *
 * Ruta: /admin/areas  (solo ADMIN)
 *
 * Layout:
 *   Header (título + botón Nueva Área)
 *   Pisos apilados verticalmente (PB / 2 / 3 / 4)
 *   Panel lateral flotante único a la derecha para el área seleccionada
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
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tabs,
  Tab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import ThreeDRotationIcon from "@mui/icons-material/ThreeDRotation";
import { getAreas, createArea, updateArea, deleteArea, getSirhAdscripciones } from "../api/catalogos.js";
import { AreaGridEditor } from "../components/areas/AreaGridEditor.jsx";

// ── Constantes ────────────────────────────────────────────────────────────────

const PISOS = [
  { piso: "PB",      floor: 0, label: "PB" },
  { piso: "NIVEL_1", floor: 1, label: "2"  },
  { piso: "NIVEL_2", floor: 2, label: "3"  },
  { piso: "NIVEL_3", floor: 3, label: "4"  },
];

const PISO_LABELS = { PB: "PB", NIVEL_1: "2", NIVEL_2: "3", NIVEL_3: "4" };

// ── Zonas del edificio: Ala Izquierda | Conector | Ala Derecha ────────────────
// Conector: cols 13-18 (6 cols, un poco más ancho) ubicado al FONDO del edificio.
// Filas altas (14-26) → Z negativo en 3D → parte trasera del edificio.
const ZONES = [
  { key: "izq",      label: "ALA IZQUIERDA", colStart: 0,  colCount: 14 },
  { key: "conector", label: "CONECTOR",       colStart: 13, colCount: 6  },
  { key: "der",      label: "ALA DERECHA",    colStart: 18, colCount: 14 },
];

// Coordenadas por defecto al crear un área según zona.
// Conector usa filas 14-22 (parte trasera del edificio = Z negativo en 3D).
const defaultCoordsForZone = (zoneKey) => {
  if (zoneKey === "conector") return { gridX1: 14, gridY1: 14, gridX2: 18, gridY2: 22 };
  if (zoneKey === "der")      return { gridX1: 20, gridY1: 10, gridX2: 25, gridY2: 15 };
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
};

// ── Helpers SIRH ──────────────────────────────────────────────────────────────

/**
 * Infiere el padre de un ítem nivel N buscando entre los ítems de nivel N-1
 * aquellos que tengan proyectos cuyos unidades_ejecutoras contengan el nombre del ítem.
 */
function inferirPadres(hijos, padres) {
  const hijoPadre = {};

  padres.forEach((padre) => {
    const obras = (padre.proyectos ?? []).flatMap(
      (proy) => proy.obras_actividades ?? [],
    );
    obras.forEach((obra) => {
      const ue = obra.unidad_ejecutora;
      if (ue && typeof ue === "string") {
        hijoPadre[ue] = padre.nombre;
      }
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
  const [sirh, setSirh] = useState(null); // { nivel1, nivel2, nivel3, nivel4, nivel5 }
  const [sirhLoading, setSirhLoading] = useState(false);
  const [sirhError, setSirhError] = useState("");

  // Área seleccionada en el grid (puede ser de cualquier piso)
  const [selectedId, setSelectedId] = useState(null);

  // Panel lateral — formulario de edición
  const [editForm, setEditForm] = useState(null); // null | { ...area, _dirty: bool }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Selects SIRH en cascada
  const [sirhSub, setSirhSub] = useState(""); // nombre subsecretaría
  const [sirhDir, setSirhDir] = useState(""); // nombre dirección
  const [sirhCoor, setSirhCoor] = useState(""); // nombre coordinación
  const [sirhDep, setSirhDep] = useState(""); // nombre departamento

  // Navegación: ala (0=IZQ, 1=DER) y piso (0-3)
  const [alaIdx, setAlaIdx] = useState(0);
  const [pisoIdx, setPisoIdx] = useState(0);

  // Modal Nueva Área
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevaForm, setNuevaForm] = useState(EMPTY_NUEVA);
  const [nuevaError, setNuevaError] = useState("");
  const [nuevaSaving, setNuevaSaving] = useState(false);

  // Ref al iframe del visor 3D embebido
  const visor3DRef = useRef(null);

  // ── Cambios pendientes (batch save) ──────────────────────────────────────
  // Objeto { [areaId]: { label, gridX1, gridY1, gridX2, gridY2, floor } }
  // Persiste en localStorage hasta que el usuario guarda todo.
  const [pendingChanges, setPendingChanges] = useState(() => {
    try {
      const raw = localStorage.getItem("siast:areas:pending");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllError, setSaveAllError] = useState("");

  const pendingCount = Object.keys(pendingChanges).length;

  const persistPending = (next) => {
    setPendingChanges(next);
    try { localStorage.setItem("siast:areas:pending", JSON.stringify(next)); } catch {}
  };

  // Protección de cambios sin guardar
  const isDirty = editForm?._dirty ?? false;
  const { ConfirmDialog } = useUnsavedChanges(isDirty);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  const loadAreas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAreas();
      setAreas(res.data ?? []);
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
      setSirhError(
        err.response?.data?.error ?? "SIRH no disponible. Verifica la conexión.",
      );
    } finally {
      setSirhLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAreas();
    loadSirh();
  }, []);

  // ── Selección en el grid (cualquier piso) ──────────────────────────────────

  const handleSelect = useCallback((area) => {
    setSelectedId(area.id);
    setEditForm({
      ...area,
      _dirty: false,
    });
    setSaveError("");
    // Resetear selects SIRH
    setSirhSub("");
    setSirhDir("");
    setSirhCoor("");
    setSirhDep("");
  }, []);

  // ── Resize desde el grid ───────────────────────────────────────────────────

  const handleResize = useCallback((id, coords) => {
    setAreas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...coords } : a)),
    );
    setEditForm((prev) =>
      prev && prev.id === id ? { ...prev, ...coords, _dirty: true } : prev,
    );
  }, []);

  // ── Move desde el grid ─────────────────────────────────────────────────────

  const handleMove = useCallback((id, coords) => {
    setAreas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...coords } : a)),
    );
    setEditForm((prev) =>
      prev && prev.id === id ? { ...prev, ...coords, _dirty: true } : prev,
    );
  }, []);

  // ── Agregar área al batch de cambios pendientes ───────────────────────────
  // No llama a la API todavía — acumula en localStorage.

  const handleGuardar = () => {
    if (!editForm) return;
    const next = {
      ...pendingChanges,
      [editForm.id]: {
        label: editForm.label,
        gridX1: Number(editForm.gridX1),
        gridY1: Number(editForm.gridY1),
        gridX2: Number(editForm.gridX2),
        gridY2: Number(editForm.gridY2),
        floor: editForm.floor,
      },
    };
    persistPending(next);
    setEditForm((prev) => (prev ? { ...prev, _dirty: false } : prev));
    setSaveError("");
  };

  // ── Guardar TODOS los cambios pendientes en la API ────────────────────────

  const handleGuardarTodo = async () => {
    const ids = Object.keys(pendingChanges);
    if (ids.length === 0) return;
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

  // ── Generar Render — recarga el visor 3D para que lea la DB actualizada ──

  const handleGenerarRender = () => {
    const iframe = visor3DRef.current;
    if (!iframe) return;
    // Forzar recarga del iframe (Three.js volverá a hacer fetch de /api/catalogos/areas)
    const src = iframe.src;
    iframe.src = "";
    setTimeout(() => { iframe.src = src; }, 50);
  };

  const handleCancelar = () => {
    setSelectedId(null);
    setEditForm(null);
    setSaveError("");
  };

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

  // ── SIRH — cálculo de listas en cascada ───────────────────────────────────

  const subsecretarias = useMemo(
    () => (sirh ? sirh.nivel2 ?? [] : []),
    [sirh],
  );

  const findParent = useMemo(() => {
    if (!sirh) return () => null;
    return {
      dir: inferirPadres(sirh.nivel3 ?? [], sirh.nivel2 ?? []),
      coor: inferirPadres(sirh.nivel4 ?? [], sirh.nivel3 ?? []),
      dep: inferirPadres(sirh.nivel5 ?? [], sirh.nivel4 ?? []),
    };
  }, [sirh]);

  const direcciones = useMemo(() => {
    if (!sirh || !sirhSub) return sirh?.nivel3 ?? [];
    return (sirh.nivel3 ?? []).filter(
      (d) => findParent.dir(d.nombre) === sirhSub,
    );
  }, [sirh, sirhSub, findParent]);

  const coordinaciones = useMemo(() => {
    if (!sirh || !sirhDir) return sirh?.nivel4 ?? [];
    return (sirh.nivel4 ?? []).filter(
      (c) => findParent.coor(c.nombre) === sirhDir,
    );
  }, [sirh, sirhDir, findParent]);

  const departamentos = useMemo(() => {
    if (!sirh || !sirhCoor) return sirh?.nivel5 ?? [];
    return (sirh.nivel5 ?? []).filter(
      (d) => findParent.dep(d.nombre) === sirhCoor,
    );
  }, [sirh, sirhCoor, findParent]);

  // SIRH — cualquier nivel seleccionado actualiza el label del área
  const handleSubChange = (nombre) => {
    setSirhSub(nombre);
    setSirhDir("");
    setSirhCoor("");
    setSirhDep("");
    if (nombre && editForm) {
      setEditForm((prev) => ({ ...prev, label: nombre, _dirty: true }));
    }
  };

  const handleDirChange = (nombre) => {
    setSirhDir(nombre);
    setSirhCoor("");
    setSirhDep("");
    if (nombre && editForm) {
      setEditForm((prev) => ({ ...prev, label: nombre, _dirty: true }));
    }
  };

  const handleCoorChange = (nombre) => {
    setSirhCoor(nombre);
    setSirhDep("");
    if (nombre && editForm) {
      setEditForm((prev) => ({ ...prev, label: nombre, _dirty: true }));
    }
  };

  const handleDepChange = (nombre) => {
    setSirhDep(nombre);
    if (nombre && editForm) {
      setEditForm((prev) => ({ ...prev, label: nombre, _dirty: true }));
    }
  };

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
      // Usar coordenadas del formulario o los defaults si están vacíos
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
      });
      setModalOpen(false);
      setNuevaForm(EMPTY_NUEVA);
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <EditLocationAltIcon sx={{ color: "primary.main" }} />
          <Typography variant="h5" fontWeight={700}>
            Mapa de Áreas
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {pendingCount > 0 && (
            <Chip
              label={`${pendingCount} cambio${pendingCount !== 1 ? "s" : ""} pendiente${pendingCount !== 1 ? "s" : ""}`}
              color="warning"
              size="small"
              sx={{ fontWeight: 700 }}
            />
          )}
          <Tooltip title="Persiste todos los cambios pendientes en la base de datos">
            <span>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={savingAll ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                onClick={handleGuardarTodo}
                disabled={pendingCount === 0 || savingAll}
              >
                Guardar todo
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Recarga el modelo 3D desde los datos guardados en la base de datos">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ThreeDRotationIcon />}
              onClick={handleGenerarRender}
            >
              Generar Render
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
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveAllError("")}>
          {saveAllError}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── Áreas sin mapear ── */}
      {!loading && (() => {
        const sinMapear = areas.filter(
          (a) => a.gridX1 == null || a.gridY1 == null || a.gridX2 == null || a.gridY2 == null,
        );
        if (sinMapear.length === 0) return null;
        return (
          <Paper variant="outlined" sx={{ mb: 2, p: 1.5, borderColor: "warning.light" }}>
            <Typography variant="caption" fontWeight={700} color="warning.dark" sx={{ display: "block", mb: 1, letterSpacing: 0.5 }}>
              {sinMapear.length} ÁREA{sinMapear.length !== 1 ? "S" : ""} SIN MAPEAR — haz clic en "Colocar" para posicionarlas en el grid
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
                    // Detectar a qué zona pertenece (por sus coords si las tiene, si no usar izq)
                    const zoneIdx = ZONES.findIndex((z) => {
                      const x1 = a.gridX1 ?? -1;
                      return x1 >= z.colStart && x1 < z.colStart + z.colCount;
                    });
                    const targetZoneIdx = zoneIdx >= 0 ? zoneIdx : 0;
                    const defaultCoords = defaultCoordsForZone(ZONES[targetZoneIdx].key);
                    const pisoItem = PISOS.find((p) => p.floor === a.floor) ?? PISOS[0];
                    const withCoords = { ...a, ...defaultCoords, piso: pisoItem.piso };
                    setAreas((prev) => prev.map((x) => (x.id === a.id ? withCoords : x)));
                    setPisoIdx(PISOS.findIndex((p) => p.floor === a.floor) >= 0 ? PISOS.findIndex((p) => p.floor === a.floor) : 0);
                    setAlaIdx(targetZoneIdx);
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

          {/* Columna izquierda: tabs de ALA + niveles + grid (2/3) */}
          <Box sx={{ flex: "0 0 67%" }}>
            <Paper sx={{ borderRadius: "10px", overflow: "hidden" }}>

              {/* TAB nivel 1: ALA IZQUIERDA / CONECTOR / ALA DERECHA */}
              <Box sx={{ borderBottom: "2px solid rgba(0,0,0,0.10)", bgcolor: "grey.50" }}>
                <Tabs
                  value={alaIdx}
                  onChange={(_, v) => { setAlaIdx(v); setSelectedId(null); setEditForm(null); }}
                  sx={{ minHeight: 44 }}
                  TabIndicatorProps={{ style: { height: 3 } }}
                >
                  {ZONES.map((zone, i) => (
                    <Tab
                      key={zone.key}
                      label={zone.label}
                      sx={{
                        minHeight: 44,
                        fontWeight: 700,
                        fontSize: zone.key === "conector" ? 11 : 13,
                        letterSpacing: 0.5,
                        opacity: alaIdx === i ? 1 : 0.4,
                        transition: "opacity 0.2s ease",
                        // Diferenciar visualmente el conector
                        color: zone.key === "conector" ? "text.secondary" : "inherit",
                      }}
                    />
                  ))}
                </Tabs>
              </Box>

              {/* TAB nivel 2: niveles PB / 2 / 3 / 4 */}
              <Box sx={{ borderBottom: "1px solid rgba(0,0,0,0.07)", bgcolor: "white" }}>
                <Tabs
                  value={pisoIdx}
                  onChange={(_, v) => { setPisoIdx(v); setSelectedId(null); setEditForm(null); }}
                  sx={{ minHeight: 38 }}
                  variant="fullWidth"
                >
                  {PISOS.map((p, i) => {
                    // Filtrar por zona + piso para el contador
                    const zona = ZONES[alaIdx];
                    const count = areas.filter((a) => {
                      if (a.floor !== p.floor) return false;
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
                              sx={{ height: 16, fontSize: 10, fontWeight: 700 }}
                              color={isActive ? "primary" : "default"}
                            />
                          </Box>
                        }
                        sx={{
                          minHeight: 38,
                          fontSize: 12,
                          textTransform: "none",
                          fontWeight: 600,
                          // Atenuar tabs inactivos visualmente
                          opacity: isActive ? 1 : 0.45,
                          transition: "opacity 0.2s ease",
                        }}
                      />
                    );
                  })}
                </Tabs>
              </Box>

              {/* Grid del piso + zona seleccionada */}
              {(() => {
                const pisoActivo = PISOS[pisoIdx];
                const zona = ZONES[alaIdx];
                const areasFiltradas = areas.filter((a) => {
                  if (a.floor !== pisoActivo.floor) return false;
                  const x1 = a.gridX1 ?? -1;
                  if (x1 < 0) return false;
                  return x1 >= zona.colStart && x1 < zona.colStart + zona.colCount;
                });
                return (
                  <Box
                    key={`${alaIdx}-${pisoIdx}`}
                    sx={{
                      p: 2,
                      animation: "siast-fadein 0.22s ease",
                      "@keyframes siast-fadein": {
                        from: { opacity: 0, transform: "translateY(4px)" },
                        to:   { opacity: 1, transform: "translateY(0)" },
                      },
                    }}
                  >
                    <AreaGridEditor
                      areas={areasFiltradas}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                      onResize={handleResize}
                      onMove={handleMove}
                      floorLabel={`PISO ${pisoActivo.label} — ${zona.label}`}
                      colStart={zona.colStart}
                      colCount={zona.colCount}
                    />
                  </Box>
                );
              })()}
            </Paper>
          </Box>

          {/* Panel lateral único (1/3) — sticky */}
          <Box
            sx={{
              flex: "0 0 33%",
              position: "sticky",
              top: 16,
              maxHeight: "calc(100vh - 80px)",
              pl: 2,
            }}
          >
            <Paper sx={{ borderRadius: "10px", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
              {/* Panel de edición — solo cuando hay área seleccionada */}
              {editForm && (
                <EditPanel
                  form={editForm}
                  setEdit={setEdit}
                  saving={false}
                  saveError={saveError}
                  isPending={!!pendingChanges[editForm.id]}
                  onGuardar={handleGuardar}
                  onCancelar={handleCancelar}
                  onEliminar={handleEliminar}
                  sirhLoading={sirhLoading}
                  sirhError={sirhError}
                  subsecretarias={subsecretarias}
                  direcciones={direcciones}
                  coordinaciones={coordinaciones}
                  departamentos={departamentos}
                  sirhSub={sirhSub}
                  sirhDir={sirhDir}
                  sirhCoor={sirhCoor}
                  sirhDep={sirhDep}
                  setSirhSub={handleSubChange}
                  setSirhDir={handleDirChange}
                  setSirhCoor={handleCoorChange}
                  setSirhDep={handleDepChange}
                />
              )}

              {/* Visor 3D — siempre en el DOM (ref persiste); oculto con display:none cuando hay edición activa */}
              <Box sx={{ display: editForm ? "none" : "flex", flexDirection: "column", flex: 1 }}>
                <Box sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(0,0,0,0.08)", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
                  <ThreeDRotationIcon sx={{ fontSize: 16, color: "primary.main" }} />
                  <Typography variant="caption" fontWeight={700} color="primary.main" letterSpacing={0.5}>
                    VISOR 3D
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    &nbsp;— selecciona un área para editarla
                  </Typography>
                </Box>
                <iframe
                  ref={visor3DRef}
                  src="http://localhost:5174"
                  title="Visor 3D Edificio"
                  style={{ flex: 1, width: "100%", border: "none", display: "block", minHeight: 300 }}
                />
              </Box>
            </Paper>
          </Box>
        </Box>
      )}

      {/* Modal Nueva Area */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Area</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {nuevaError && <Alert severity="error">{nuevaError}</Alert>}

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="ID (unico)"
              value={nuevaForm.id}
              onChange={(e) => setNueva("id", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
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

          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Coordenadas en la cuadrícula (0-based) — valores por defecto visibles en el grid
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleNuevaGuardar} disabled={nuevaSaving}>
            {nuevaSaving ? <CircularProgress size={18} /> : "Crear Area"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación de cambios sin guardar */}
      <ConfirmDialog />
    </Box>
  );
};

// ── Sub-componente: panel de edición ─────────────────────────────────────────

function EditPanel({
  form,
  setEdit,
  saving,
  saveError,
  isPending,
  onGuardar,
  onCancelar,
  onEliminar,
  sirhLoading,
  sirhError,
  subsecretarias,
  direcciones,
  coordinaciones,
  departamentos,
  sirhSub,
  sirhDir,
  sirhCoor,
  sirhDep,
  setSirhSub,
  setSirhDir,
  setSirhCoor,
  setSirhDep,
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      {/* Header del panel */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "grey.50",
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ maxWidth: 160 }}>
          {form.label || form.id}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {isPending && (
            <Chip label="Pendiente" size="small" color="warning" sx={{ fontWeight: 700, fontSize: 10, height: 18 }} />
          )}
          <Chip
            label={`PISO ${PISO_LABELS[form.piso] ?? form.piso}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, fontSize: 11 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {saveError && <Alert severity="error" sx={{ fontSize: 12 }}>{saveError}</Alert>}

        {/* Nombre */}
        <TextField
          label="Nombre del area"
          value={form.label}
          onChange={(e) => setEdit("label", e.target.value)}
          fullWidth
          size="small"
          required
        />

        <Divider />

        {/* Asignar desde SIRH */}
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
          ADSCRIPCION SIRH
        </Typography>

        {sirhError ? (
          <Alert severity="warning" sx={{ fontSize: 11 }}>
            {sirhError}
          </Alert>
        ) : sirhLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <>
            <Autocomplete
              size="small"
              options={subsecretarias.map((s) => s.nombre)}
              value={sirhSub || null}
              onChange={(_, v) => setSirhSub(v ?? "")}
              renderInput={(params) => <TextField {...params} label="Subsecretaría" />}
              noOptionsText="Sin resultados"
              clearOnEscape
            />

            <Autocomplete
              size="small"
              options={direcciones.map((d) => d.nombre)}
              value={sirhDir || null}
              onChange={(_, v) => setSirhDir(v ?? "")}
              disabled={subsecretarias.length > 0 && !sirhSub}
              renderInput={(params) => <TextField {...params} label="Dirección" />}
              noOptionsText="Sin resultados"
              clearOnEscape
            />

            <Autocomplete
              size="small"
              options={coordinaciones.map((c) => c.nombre)}
              value={sirhCoor || null}
              onChange={(_, v) => setSirhCoor(v ?? "")}
              disabled={direcciones.length > 0 && !sirhDir}
              renderInput={(params) => <TextField {...params} label="Coordinación" />}
              noOptionsText="Sin resultados"
              clearOnEscape
            />

            <Autocomplete
              size="small"
              options={departamentos.map((d) => d.nombre)}
              value={sirhDep || null}
              onChange={(_, v) => setSirhDep(v ?? "")}
              disabled={coordinaciones.length > 0 && !sirhCoor}
              renderInput={(params) => <TextField {...params} label="Departamento" />}
              noOptionsText="Sin resultados"
              clearOnEscape
            />

            {(sirhSub || sirhDir || sirhCoor || sirhDep) && (
              <Typography variant="caption" color="success.main" fontWeight={600}>
                Al guardar se vinculará: {sirhDep || sirhCoor || sirhDir || sirhSub}
              </Typography>
            )}
          </>
        )}

        <Divider />

        {/* Coordenadas grid */}
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
          POSICION EN CUADRICULA
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {["gridX1", "gridY1", "gridX2", "gridY2"].map((field) => (
            <TextField
              key={field}
              label={field.replace("grid", "")}
              value={form[field] ?? ""}
              onChange={(e) => setEdit(field, e.target.value === "" ? "" : Number(e.target.value))}
              size="small"
              type="number"
              inputProps={{ min: 0, max: field.startsWith("gridX") ? 31 : 26 }}
              sx={{ flex: 1 }}
            />
          ))}
        </Box>
      </Box>

      {/* Acciones */}
      <Box
        sx={{
          p: 2,
          borderTop: "1px solid rgba(0,0,0,0.08)",
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
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={onCancelar}>
            Cancelar
          </Button>
          <Tooltip title="Agrega este cambio a la cola — usa 'Guardar todo' para persistirlos en la base de datos">
            <span>
              <Button
                size="small"
                variant="contained"
                color={isPending ? "warning" : "primary"}
                onClick={onGuardar}
                disabled={!form._dirty}
                startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />}
              >
                {isPending ? "Actualizar" : "Agregar"}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
