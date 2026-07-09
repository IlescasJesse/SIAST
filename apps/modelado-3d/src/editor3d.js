// ============================================================
// EDITOR 3D DE ÁREAS — herramientas move / draw / resize / delete
// Solo se activa con ?editor=1 (initEditor3D se llama desde main.js).
// La validación de la huella en U es espejo de
// packages/shared/src/areaGeometry.ts (fuente de verdad) — si las
// zonas cambian allá, actualizar BUILDING_ZONES aquí.
// ============================================================
import * as THREE from "three";
import { FLOOR_Y } from "./building.js";

// ── Cuadrícula (espejo de building.js / camera.js) ───────────────────────────
const CELL = 1; // 1 unidad Three.js = 1 celda
const GRID_COLS = 32;
const GRID_ROWS = 27;
const CX = 16; // centro X de la cuadrícula (32/2)
const CY = 13.5; // centro Y de la cuadrícula (27/2)

// Zonas de la huella en U del edificio (fila 0 = frente).
const BUILDING_ZONES = [
  { x1: 0, y1: 0, x2: 14, y2: 27 }, // ala izquierda
  { x1: 18, y1: 0, x2: 32, y2: 27 }, // ala derecha
  { x1: 14, y1: 14, x2: 18, y2: 27 }, // conector (solo fondo)
];

/** Rango de filas admitido por una columna de celda (null = fuera del edificio). */
const rowRangeForColumn = (col) => {
  for (const z of BUILDING_ZONES) {
    if (col >= z.x1 && col < z.x2) return { y1: z.y1, y2: z.y2 };
  }
  return null;
};

/**
 * Un rect es válido si CADA columna que ocupa admite el rango completo de
 * filas del rect. Esto permite cruzar ala↔conector en filas 14–27 sin
 * restricciones extra. Coordenadas enteras, x1<x2, y1<y2.
 *
 * @param {{x1:number,y1:number,x2:number,y2:number}} rect
 * @returns {boolean}
 */
export const isRectInsideBuilding = (rect) => {
  const { x1, y1, x2, y2 } = rect;
  if (![x1, y1, x2, y2].every(Number.isInteger)) return false;
  if (x1 < 0 || y1 < 0 || x2 > GRID_COLS || y2 > GRID_ROWS) return false;
  if (x1 >= x2 || y1 >= y2) return false;
  for (let col = x1; col < x2; col++) {
    const range = rowRangeForColumn(col);
    if (!range || y1 < range.y1 || y2 > range.y2) return false;
  }
  return true;
};

// ── Conversión cuadrícula ↔ mundo (misma transformación que gridToScene) ─────
/** Centro world-space (XZ) de un rect de cuadrícula. Z invertido. */
const rectCenterWorld = (rect) => ({
  px: ((rect.x1 + rect.x2) / 2 - CX) * CELL,
  pz: -((rect.y1 + rect.y2) / 2 - CY) * CELL,
});

/** Esquina de cuadrícula (gx,gy) → coordenadas world XZ. */
const gridPointToWorld = (gx, gy) => ({
  x: (gx - CX) * CELL,
  z: -(gy - CY) * CELL,
});

const clampInt = (v, min, max) => Math.max(min, Math.min(max, v));

// ── Estado del editor ─────────────────────────────────────────────────────────
const TOOLS = ["select", "move", "draw", "resize", "delete"];
const CURSOR_BY_TOOL = {
  select: "default",
  move: "move",
  draw: "crosshair",
  resize: "pointer",
  delete: "pointer",
};
const LIVE_EMIT_THROTTLE_MS = 80;
const HANDLE_SIZE = 0.55;
const HANDLE_COLOR = 0xff8f00; // ámbar contrastante con el guinda/azul de la escena
const GHOST_COLOR = 0x9d2449; // guinda institucional
const GHOST_HEIGHT = 1.2;

let _ctx = null; // referencias inyectadas desde main.js
let _tool = "select";
let _drag = null; // drag activo: { kind: 'move'|'resize'|'draw', ... }
let _selectedAreaId = null; // área con handles visibles (tool resize)
let _handlesGroup = null; // THREE.Group con los 4 handles de esquina
let _ghostMesh = null; // rectángulo fantasma del tool draw
let _hoverMesh = null; // mesh de área bajo el puntero (feedback visual)
let _lastLiveEmit = 0;

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _planeHit = new THREE.Vector3();

// ── Utilidades internas ───────────────────────────────────────────────────────
const _emit = (type, payload) => {
  parent?.postMessage({ type, payload }, "*");
};

const _emitLive = (type, payload) => {
  const now = performance.now();
  if (now - _lastLiveEmit < LIVE_EMIT_THROTTLE_MS) return;
  _lastLiveEmit = now;
  _emit(type, payload);
};

const _geometryPayload = (areaId, rect, floor, live) => ({
  areaId,
  gridX1: rect.x1,
  gridY1: rect.y1,
  gridX2: rect.x2,
  gridY2: rect.y2,
  floor,
  live,
});

const _setRayFromEvent = (e) => {
  _ndc.x = (e.clientX / innerWidth) * 2 - 1;
  _ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  _raycaster.setFromCamera(_ndc, _ctx.camera);
};

/** Intersección del rayo actual con el plano del piso indicado (o null). */
const _pickFloorPoint = (floor) => {
  // Plano y = FLOOR_Y(floor): normal (0,1,0), constant = -FLOOR_Y
  _floorPlane.constant = -FLOOR_Y(floor);
  return _raycaster.ray.intersectPlane(_floorPlane, _planeHit) ? _planeHit.clone() : null;
};

/** Mesh de área visible bajo el rayo actual (o null). Ignora meshes ocultos. */
const _pickRoomMesh = () => {
  const candidates = [..._ctx.roomMeshes.values()].filter(
    (m) => m.visible && m.parent?.visible !== false,
  );
  const hits = _raycaster.intersectObjects(candidates, false);
  return hits.length ? hits[0].object : null;
};

/** Handle de esquina bajo el rayo actual (o null). */
const _pickHandle = () => {
  if (!_handlesGroup || !_handlesGroup.visible) return null;
  const hits = _raycaster.intersectObjects(_handlesGroup.children, false);
  return hits.length ? hits[0].object : null;
};

const _rectsEqual = (a, b) => a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;

/** Rect actual de un área desde liveRoomMap (fallback a userData del mesh). */
const _currentRect = (areaId) => {
  const room = _ctx.liveRoomMap[areaId];
  if (room && room.x1 != null) {
    return { x1: room.x1, y1: room.y1, x2: room.x2, y2: room.y2 };
  }
  const ud = _ctx.roomMeshes.get(areaId)?.userData;
  return ud ? { x1: ud.x1, y1: ud.y1, x2: ud.x2, y2: ud.y2 } : null;
};

const _areaFloor = (areaId) =>
  _ctx.liveRoomMap[areaId]?.floor ?? _ctx.roomMeshes.get(areaId)?.userData?.floor ?? 0;

// ── Feedback visual: hover ────────────────────────────────────────────────────
const _setHover = (mesh) => {
  if (mesh === _hoverMesh) return;
  // Restaurar el emissive previo del mesh que deja de estar bajo el puntero
  if (_hoverMesh?.material?.emissive && _hoverMesh.userData._editorHoverPrev) {
    const prev = _hoverMesh.userData._editorHoverPrev;
    _hoverMesh.material.emissive.setHex(prev.emissive);
    _hoverMesh.material.emissiveIntensity = prev.intensity;
    delete _hoverMesh.userData._editorHoverPrev;
  }
  _hoverMesh = mesh;
  if (_hoverMesh?.material?.emissive) {
    _hoverMesh.userData._editorHoverPrev = {
      emissive: _hoverMesh.material.emissive.getHex(),
      intensity: _hoverMesh.material.emissiveIntensity ?? 0,
    };
    _hoverMesh.material.emissive.setHex(_hoverMesh.userData.baseColor ?? 0xffffff);
    _hoverMesh.material.emissiveIntensity = 0.35;
  }
};

// ── Handles de resize ─────────────────────────────────────────────────────────
// Cada handle sabe qué lado del rect controla: xKey ∈ {x1,x2}, yKey ∈ {y1,y2}.
const _ensureHandlesGroup = () => {
  if (_handlesGroup) return _handlesGroup;
  _handlesGroup = new THREE.Group();
  _handlesGroup.name = "editor_resize_handles";
  const geo = new THREE.BoxGeometry(HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE);
  const corners = [
    { xKey: "x1", yKey: "y1" },
    { xKey: "x2", yKey: "y1" },
    { xKey: "x1", yKey: "y2" },
    { xKey: "x2", yKey: "y2" },
  ];
  for (const corner of corners) {
    const mat = new THREE.MeshBasicMaterial({
      color: HANDLE_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const handle = new THREE.Mesh(geo, mat);
    handle.renderOrder = 999; // siempre encima del vidrio de las áreas
    handle.userData = { isEditorHandle: true, ...corner };
    _handlesGroup.add(handle);
  }
  _handlesGroup.visible = false;
  _ctx.scene.add(_handlesGroup);
  return _handlesGroup;
};

const _updateHandlePositions = (rect, floor) => {
  if (!_handlesGroup) return;
  const y = FLOOR_Y(floor) + HANDLE_SIZE / 2 + 0.05;
  for (const handle of _handlesGroup.children) {
    const gx = rect[handle.userData.xKey];
    const gy = rect[handle.userData.yKey];
    const { x, z } = gridPointToWorld(gx, gy);
    handle.position.set(x, y, z);
  }
};

const _showHandles = (areaId) => {
  const rect = _currentRect(areaId);
  if (!rect) return;
  _selectedAreaId = areaId;
  _ensureHandlesGroup();
  _updateHandlePositions(rect, _areaFloor(areaId));
  _handlesGroup.visible = true;
};

const _hideHandles = () => {
  _selectedAreaId = null;
  if (_handlesGroup) _handlesGroup.visible = false;
};

// ── Rectángulo fantasma del tool draw ─────────────────────────────────────────
const _updateGhost = (rect, floor) => {
  if (!_ghostMesh) {
    const geo = new THREE.BoxGeometry(1, GHOST_HEIGHT, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    _ghostMesh = new THREE.Mesh(geo, mat);
    _ghostMesh.renderOrder = 998;
    _ctx.scene.add(_ghostMesh);
  }
  const { px, pz } = rectCenterWorld(rect);
  // BoxGeometry unitario escalado al tamaño del rect — evita recrear geometría
  _ghostMesh.scale.set((rect.x2 - rect.x1) * CELL, 1, (rect.y2 - rect.y1) * CELL);
  _ghostMesh.position.set(px, FLOOR_Y(floor) + GHOST_HEIGHT / 2 + 0.03, pz);
  _ghostMesh.visible = true;
};

const _removeGhost = () => {
  if (!_ghostMesh) return;
  _ctx.scene.remove(_ghostMesh);
  _ghostMesh.geometry.dispose();
  _ghostMesh.material.dispose();
  _ghostMesh = null;
};

// ── Transformación visual en vivo (sin reconstruir geometría) ─────────────────
/**
 * Coloca/escala el mesh según el rect dado, relativo al rect con el que fue
 * construido (userData). El escalado ignora WALL_T (~0.08) — imperceptible
 * durante el drag; al soltar se reconstruye la geometría real.
 */
const _applyRectToMesh = (mesh, rect) => {
  const ud = mesh.userData;
  const w0 = (ud.x2 - ud.x1) * CELL;
  const d0 = (ud.y2 - ud.y1) * CELL;
  const { px, pz } = rectCenterWorld(rect);
  mesh.scale.x = ((rect.x2 - rect.x1) * CELL) / w0;
  mesh.scale.z = ((rect.y2 - rect.y1) * CELL) / d0;
  mesh.position.x = px;
  mesh.position.z = pz;
};

// ── Drags ─────────────────────────────────────────────────────────────────────
const _startDrag = (drag, e) => {
  _drag = drag;
  _ctx.controls.enabled = false; // la cámara no debe orbitar durante el drag
  _ctx.renderer.domElement.setPointerCapture?.(e.pointerId);
};

const _endDragCleanup = (e) => {
  _drag = null;
  _ctx.controls.enabled = true;
  if (e?.pointerId != null) {
    try {
      _ctx.renderer.domElement.releasePointerCapture?.(e.pointerId);
    } catch {
      /* el capture pudo haberse liberado ya — ignorar */
    }
  }
};

/**
 * Candidato de move con fallback de deslizamiento por eje: si el delta
 * completo es inválido se intenta solo X o solo Y (permite "resbalar"
 * a lo largo de los bordes de la huella).
 */
const _resolveMoveRect = (orig, dx, dy, lastDx, lastDy) => {
  const shift = (ddx, ddy) => ({
    x1: orig.x1 + ddx,
    y1: orig.y1 + ddy,
    x2: orig.x2 + ddx,
    y2: orig.y2 + ddy,
  });
  const full = shift(dx, dy);
  if (isRectInsideBuilding(full)) return { rect: full, dx, dy };
  const onlyX = shift(dx, lastDy);
  if (isRectInsideBuilding(onlyX)) return { rect: onlyX, dx, dy: lastDy };
  const onlyY = shift(lastDx, dy);
  if (isRectInsideBuilding(onlyY)) return { rect: onlyY, dx: lastDx, dy };
  return null;
};

const _onMoveDrag = () => {
  const d = _drag;
  const p = _pickFloorPoint(d.floor);
  if (!p) return;
  // Delta en celdas (snap a enteros). Eje Z invertido: dy = -(dz)
  const dx = Math.round(p.x - d.startPoint.x);
  const dy = Math.round(d.startPoint.z - p.z);
  if (dx === d.lastDx && dy === d.lastDy) return;

  const resolved = _resolveMoveRect(d.origRect, dx, dy, d.lastDx, d.lastDy);
  if (!resolved) return; // sin posición válida cercana — mantener la última
  d.lastDx = resolved.dx;
  d.lastDy = resolved.dy;
  if (_rectsEqual(resolved.rect, d.lastRect)) return;
  d.lastRect = resolved.rect;
  _applyRectToMesh(d.mesh, d.lastRect);
  _emitLive("AREA_MOVED", _geometryPayload(d.areaId, d.lastRect, d.floor, true));
};

const _onResizeDrag = () => {
  const d = _drag;
  const p = _pickFloorPoint(d.floor);
  if (!p) return;
  // Esquina móvil snapeada al punto de cuadrícula más cercano
  const mx = clampInt(Math.round(p.x / CELL + CX), 0, GRID_COLS);
  const my = clampInt(Math.round(CY - p.z / CELL), 0, GRID_ROWS);

  // La esquina fija no se mueve; mínimo 1×1 sin permitir "voltear" el rect
  const buildRect = (cornerX, cornerY) => {
    const rect = { ...d.lastRect };
    if (d.xKey === "x1") {
      rect.x1 = Math.min(cornerX, d.fixed.x - 1);
      rect.x2 = d.fixed.x;
    } else {
      rect.x1 = d.fixed.x;
      rect.x2 = Math.max(cornerX, d.fixed.x + 1);
    }
    if (d.yKey === "y1") {
      rect.y1 = Math.min(cornerY, d.fixed.y - 1);
      rect.y2 = d.fixed.y;
    } else {
      rect.y1 = d.fixed.y;
      rect.y2 = Math.max(cornerY, d.fixed.y + 1);
    }
    return rect;
  };

  // Fallback por eje igual que en move: probar (X,Y), luego solo X, luego solo Y
  let rect = buildRect(mx, my);
  if (!isRectInsideBuilding(rect)) rect = buildRect(mx, d.lastCorner.y);
  if (!isRectInsideBuilding(rect)) rect = buildRect(d.lastCorner.x, my);
  if (!isRectInsideBuilding(rect)) return; // mantener el último rect válido

  d.lastCorner = {
    x: d.xKey === "x1" ? rect.x1 : rect.x2,
    y: d.yKey === "y1" ? rect.y1 : rect.y2,
  };
  if (_rectsEqual(rect, d.lastRect)) return;
  d.lastRect = rect;
  _applyRectToMesh(d.mesh, rect);
  _updateHandlePositions(rect, d.floor);
  _emitLive("AREA_RESIZED", _geometryPayload(d.areaId, rect, d.floor, true));
};

const _onDrawDrag = () => {
  const d = _drag;
  const p = _pickFloorPoint(d.floor);
  if (!p) return;
  const cellX = clampInt(Math.floor(p.x / CELL + CX), 0, GRID_COLS - 1);
  const cellY = clampInt(Math.floor(CY - p.z / CELL), 0, GRID_ROWS - 1);
  const rect = {
    x1: Math.min(d.startCell.x, cellX),
    y1: Math.min(d.startCell.y, cellY),
    x2: Math.max(d.startCell.x, cellX) + 1,
    y2: Math.max(d.startCell.y, cellY) + 1,
  };
  if (!isRectInsideBuilding(rect)) return; // clamp: mantener el último rect válido
  if (_rectsEqual(rect, d.lastRect)) return;
  d.lastRect = rect;
  _updateGhost(rect, d.floor);
};

/** Cierra el drag activo. abort=true revierte al estado original (pointercancel). */
const _finishDrag = (e, abort = false) => {
  const d = _drag;
  if (!d) return;
  _endDragCleanup(e);

  if (d.kind === "draw") {
    _removeGhost();
    // El visor NO crea el área — el frontend abre su modal con estas coords
    if (!abort && d.lastRect) {
      _emit("AREA_DRAWN", {
        gridX1: d.lastRect.x1,
        gridY1: d.lastRect.y1,
        gridX2: d.lastRect.x2,
        gridY2: d.lastRect.y2,
        floor: d.floor,
      });
    }
    return;
  }

  // move / resize: rect final = último válido (si nunca hubo uno, el original)
  const type = d.kind === "move" ? "AREA_MOVED" : "AREA_RESIZED";
  const finalRect = abort ? d.origRect : d.lastRect;
  const changed = !_rectsEqual(finalRect, d.origRect);

  // Quitar hover antes de reconstruir (el mesh se destruye en applyGeometry)
  _setHover(null);
  // Restaurar la transformación temporal del drag; la geometría real la
  // reconstruye applyGeometry (o queda como estaba si no hubo cambio).
  const ud = d.mesh.userData;
  d.mesh.scale.set(1, 1, 1);
  _applyRectToMesh(d.mesh, { x1: ud.x1, y1: ud.y1, x2: ud.x2, y2: ud.y2 });

  if (changed) {
    _ctx.applyGeometry(d.areaId, finalRect, d.floor);
  }
  // Mensaje final siempre con live:false (con coords originales si se revirtió)
  _emit(type, _geometryPayload(d.areaId, finalRect, d.floor, false));

  // Reanclar handles al mesh reconstruido (resize mantiene la selección)
  if (d.kind === "resize" && _selectedAreaId === d.areaId) {
    _updateHandlePositions(finalRect, d.floor);
  }
};

// ── Handlers de puntero ───────────────────────────────────────────────────────
const _onPointerDown = (e) => {
  if (!_ctx || _tool === "select" || e.button !== 0) return;
  _setRayFromEvent(e);

  if (_tool === "move") {
    const mesh = _pickRoomMesh();
    if (!mesh) return;
    const areaId = mesh.userData.roomId;
    const rect = _currentRect(areaId);
    if (!rect) return;
    const floor = _areaFloor(areaId);
    const startPoint = _pickFloorPoint(floor);
    if (!startPoint) return;
    _startDrag(
      {
        kind: "move",
        areaId,
        mesh,
        floor,
        origRect: rect,
        lastRect: rect,
        startPoint,
        lastDx: 0,
        lastDy: 0,
      },
      e,
    );
    return;
  }

  if (_tool === "resize") {
    const handle = _pickHandle();
    if (handle && _selectedAreaId) {
      const areaId = _selectedAreaId;
      const rect = _currentRect(areaId);
      const mesh = _ctx.roomMeshes.get(areaId);
      if (!rect || !mesh) return;
      const floor = _areaFloor(areaId);
      const { xKey, yKey } = handle.userData;
      _startDrag(
        {
          kind: "resize",
          areaId,
          mesh,
          floor,
          xKey,
          yKey,
          // Esquina opuesta a la agarrada — permanece fija durante el drag
          fixed: {
            x: xKey === "x1" ? rect.x2 : rect.x1,
            y: yKey === "y1" ? rect.y2 : rect.y1,
          },
          lastCorner: { x: rect[xKey], y: rect[yKey] },
          origRect: rect,
          lastRect: rect,
        },
        e,
      );
      return;
    }
    // Sin handle: click sobre área selecciona; sobre vacío deselecciona
    const mesh = _pickRoomMesh();
    if (mesh) _showHandles(mesh.userData.roomId);
    else _hideHandles();
    return;
  }

  if (_tool === "draw") {
    if (_pickRoomMesh()) return; // solo sobre piso vacío
    const activeFloor = _ctx.getActiveFloor();
    const floor = activeFloor >= 0 ? activeFloor : 0;
    const p = _pickFloorPoint(floor);
    if (!p) return;
    const startCell = {
      x: Math.floor(p.x / CELL + CX),
      y: Math.floor(CY - p.z / CELL),
    };
    const rect = { x1: startCell.x, y1: startCell.y, x2: startCell.x + 1, y2: startCell.y + 1 };
    if (!isRectInsideBuilding(rect)) return; // celda inicial fuera de la huella
    _startDrag({ kind: "draw", floor, startCell, lastRect: rect }, e);
    _updateGhost(rect, floor);
    return;
  }

  if (_tool === "delete") {
    const mesh = _pickRoomMesh();
    if (!mesh) return;
    const { roomId, label, floor } = mesh.userData;
    // Solo se solicita — la confirmación y el borrado los maneja el frontend
    _emit("AREA_DELETE_REQUEST", { areaId: roomId, label, floor });
    return;
  }
};

const _onPointerMove = (e) => {
  if (!_ctx || _tool === "select") return;
  _setRayFromEvent(e);

  if (_drag) {
    if (_drag.kind === "move") _onMoveDrag();
    else if (_drag.kind === "resize") _onResizeDrag();
    else if (_drag.kind === "draw") _onDrawDrag();
    return;
  }

  // Hover-highlight en tools que operan sobre áreas existentes
  if (_tool === "move" || _tool === "resize" || _tool === "delete") {
    _setHover(_pickRoomMesh());
  }
};

const _onPointerUp = (e) => {
  if (!_ctx || !_drag) return;
  _setRayFromEvent(e);
  // Procesar la posición final del puntero antes de cerrar el drag
  if (_drag.kind === "move") _onMoveDrag();
  else if (_drag.kind === "resize") _onResizeDrag();
  else if (_drag.kind === "draw") _onDrawDrag();
  _finishDrag(e, false);
};

const _onPointerCancel = (e) => {
  if (!_ctx || !_drag) return;
  _finishDrag(e, true);
};

const _onPointerLeave = () => {
  if (!_drag) _setHover(null);
};

// ── API pública ───────────────────────────────────────────────────────────────
/**
 * Inicializa el editor 3D. Llamar UNA vez desde main.js, solo con ?editor=1.
 *
 * @param {object}   ctx
 * @param {THREE.WebGLRenderer} ctx.renderer
 * @param {THREE.Camera}        ctx.camera
 * @param {object}              ctx.controls       — OrbitControls
 * @param {THREE.Scene}         ctx.scene
 * @param {Map}                 ctx.roomMeshes     — Map areaId → Mesh (viva)
 * @param {object}              ctx.liveRoomMap    — coords actuales por areaId
 * @param {() => number}        ctx.getActiveFloor — piso activo (-1 = todos)
 * @param {(areaId:string, rect:object, floor:number) => void} ctx.applyGeometry
 *        — aplica la geometría final (rebuildRoomGeometry + label + muebles)
 */
export const initEditor3D = (ctx) => {
  _ctx = ctx;
  const el = ctx.renderer.domElement;
  el.addEventListener("pointerdown", _onPointerDown);
  el.addEventListener("pointermove", _onPointerMove);
  el.addEventListener("pointerup", _onPointerUp);
  el.addEventListener("pointercancel", _onPointerCancel);
  el.addEventListener("pointerleave", _onPointerLeave);
};

/**
 * Cambia la herramienta activa (mensaje SET_EDIT_TOOL desde el frontend).
 * Limpia el estado transitorio de la herramienta anterior.
 *
 * @param {'select'|'move'|'draw'|'resize'|'delete'} tool
 */
export const setEditTool = (tool) => {
  if (!_ctx || !TOOLS.includes(tool) || tool === _tool) return;
  // Abortar drag en curso y limpiar feedback de la herramienta anterior
  if (_drag) _finishDrag(null, true);
  _setHover(null);
  _hideHandles();
  _removeGhost();
  _tool = tool;
  _ctx.renderer.domElement.style.cursor = CURSOR_BY_TOOL[tool] ?? "default";
};

/**
 * true cuando el editor está activo con una herramienta ≠ select.
 * main.js lo usa para suprimir el click normal (ROOM_CLICKED / showArea).
 */
export const isEditToolIntercepting = () => _ctx !== null && _tool !== "select";
