// ============================================================
// EDITOR 3D DE ÁREAS — herramientas move / draw / resize / delete
// Solo se activa con ?editor=1 (initEditor3D se llama desde main.js).
// La validación de la huella en U es espejo de
// packages/shared/src/areaGeometry.ts (fuente de verdad) — si las
// zonas cambian allá, actualizar BUILDING_ZONES aquí.
// ============================================================
import * as THREE from "three";
import { FLOOR_Y, setRoomMeshShape } from "./building.js";
// Geometría de polígonos: fuente de verdad compartida con la API y el editor React
import {
  cajaDeVertices,
  dentroDelEdificio,
  esRectangulo,
  MAX_VERTICES_AREA,
  verticesDeRect,
} from "../../../packages/shared/src/areaGeometry.ts";

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
const EDGE_HANDLE_COLOR = 0x00838f; // teal: distingue las aristas de las esquinas
// Tamaño en pantalla de los handles y radio de agarre (px). En táctil el dedo
// tapa el handle, así que ambos crecen respecto al mouse.
const HANDLE_PX = { fine: 13, coarse: 22 };
const PICK_RADIUS_PX = { fine: 18, coarse: 34 };
const TAP_SLOP_PX = 8; // movimiento mínimo para que un toque cuente como arrastre
const IS_COARSE = window.matchMedia?.("(pointer: coarse)").matches ?? false;
const GHOST_COLOR = 0x9d2449; // guinda institucional
const GHOST_HEIGHT = 1.2;

let _ctx = null; // referencias inyectadas desde main.js
let _tool = "select";
let _drag = null; // drag activo: { kind: 'move'|'resize'|'draw', ... }
let _selectedAreaId = null; // área con handles visibles (tool resize)
let _handlesGroup = null; // THREE.Group con 4 handles de esquina + 4 de arista
let _ghostMesh = null; // rectángulo fantasma del tool draw
let _hoverMesh = null; // mesh de área bajo el puntero (feedback visual)
let _lastLiveEmit = 0;
// Handle enfocado tras elegir una opción del menú de lado: solo ese queda
// visible y arrastrable; los demás se bloquean hasta soltarlo o cancelar.
let _focus = null; // { areaId, vi } | { areaId, ei } | null
let _menuEl = null; // popup DOM con las opciones del lado

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

// vertices: polígono de 4 puntos [col, fila], o null si el área es un rectángulo
const _geometryPayload = (areaId, rect, floor, live, vertices = null) => ({
  areaId,
  gridX1: rect.x1,
  gridY1: rect.y1,
  gridX2: rect.x2,
  gridY2: rect.y2,
  vertices,
  floor,
  live,
});

const _setRayFromEvent = (e) => {
  const r = _ctx.renderer.domElement.getBoundingClientRect();
  _ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  _ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, _ctx.camera);
};

const _isTouch = (e) => e?.pointerType === "touch";

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

const _projected = new THREE.Vector3();

/**
 * Handle (esquina o arista) más cercano al puntero, medido en píxeles de
 * pantalla en vez de raycast: el radio de agarre no depende del zoom y en
 * táctil es lo bastante amplio para un dedo.
 */
const _pickHandle = (e) => {
  if (!_handlesGroup || !_handlesGroup.visible) return null;
  const r = _ctx.renderer.domElement.getBoundingClientRect();
  const radius = _isTouch(e) ? PICK_RADIUS_PX.coarse : PICK_RADIUS_PX.fine;
  let best = null;
  let bestDist = radius;
  for (const handle of _handlesGroup.children) {
    if (!handle.visible) continue; // bloqueado por el foco
    _projected.copy(handle.position).project(_ctx.camera);
    if (_projected.z > 1) continue; // detrás de la cámara
    const sx = r.left + ((_projected.x + 1) / 2) * r.width;
    const sy = r.top + ((1 - _projected.y) / 2) * r.height;
    const dist = Math.hypot(sx - e.clientX, sy - e.clientY);
    if (dist < bestDist) {
      best = handle;
      bestDist = dist;
    }
  }
  return best;
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

/** Los 4 vértices actuales de un área (los propios o las esquinas de su rect). */
const _currentVerts = (areaId) => {
  const verts =
    _ctx.liveRoomMap[areaId]?.vertices ?? _ctx.roomMeshes.get(areaId)?.userData?.vertices;
  if (verts?.length >= 3) return verts.map(([x, y]) => [x, y]);
  const rect = _currentRect(areaId);
  return rect ? verticesDeRect(rect) : null;
};

const _vertsEqual = (a, b) => a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

/** Polígono → forma a guardar: caja envolvente + vértices (null si es un rectángulo). */
const _shapeFromVerts = (verts) => ({
  ...cajaDeVertices(verts),
  vertices: esRectangulo(verts) ? null : verts,
});

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

// ── Handles de vértice y de arista ────────────────────────────────────────────
// Vértice (ámbar, userData.vi): arrastrarlo mueve SOLO esa esquina; las demás
// quedan ancladas, así el rectángulo se vuelve un polígono. Arista (teal,
// userData.ei, une el vértice ei con el siguiente): arrastrarla mueve ese lado
// completo. Un clic sin arrastrar abre un menú de acciones: lado → agregar
// vértice / mover lado; vértice → mover / eliminar. La acción elegida enfoca un
// solo handle y bloquea los demás hasta que se suelta.
// Hay un handle por vértice y uno por lado: se regeneran si cambia la cantidad.
const _handleGeo = new THREE.BoxGeometry(HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE);

const _ensureHandlesGroup = (n = 4) => {
  if (!_handlesGroup) {
    _handlesGroup = new THREE.Group();
    _handlesGroup.name = "editor_resize_handles";
    _handlesGroup.visible = false;
    _ctx.scene.add(_handlesGroup);
  }
  if (_handlesGroup.children.length === n * 2) return _handlesGroup;
  for (const old of [..._handlesGroup.children]) {
    _handlesGroup.remove(old);
    old.material.dispose();
  }
  const geo = _handleGeo;
  for (let i = 0; i < n * 2; i++) {
    const isEdge = i >= n;
    const mat = new THREE.MeshBasicMaterial({
      color: isEdge ? EDGE_HANDLE_COLOR : HANDLE_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const handle = new THREE.Mesh(geo, mat);
    handle.renderOrder = 999; // siempre encima del vidrio de las áreas
    handle.userData = { isEditorHandle: true, ...(isEdge ? { ei: i - n } : { vi: i }) };
    _handlesGroup.add(handle);
  }
  return _handlesGroup;
};

/**
 * Mantiene los handles con tamaño constante en pantalla (px) sin importar el
 * zoom. Los de arista se alargan sobre el lado que controlan.
 */
const _rescaleHandles = () => {
  if (!_handlesGroup || !_handlesGroup.visible) return;
  const cam = _ctx.camera;
  const px = IS_COARSE ? HANDLE_PX.coarse : HANDLE_PX.fine;
  const worldPerPx =
    (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / _ctx.renderer.domElement.clientHeight;
  for (const handle of _handlesGroup.children) {
    const dist = cam.position.distanceTo(handle.position);
    // El handle enfocado se ve más grande para que sea obvio cuál se mueve
    const boost = _focus && _isFocused(handle) ? 1.5 : 1;
    const s = THREE.MathUtils.clamp((px * worldPerPx * dist) / HANDLE_SIZE, 0.5, 6) * boost;
    const isEdge = handle.userData.ei != null;
    // El eje X local del handle de arista va a lo largo del lado (ver rotación)
    handle.scale.set(isEdge ? s * 2.2 : s, s * 0.8, isEdge ? s * 0.8 : s);
  }
};

const _updateHandlePositions = (verts, floor) => {
  if (!_handlesGroup) return;
  _ensureHandlesGroup(verts.length);
  const y = FLOOR_Y(floor) + HANDLE_SIZE / 2 + 0.05;
  for (const handle of _handlesGroup.children) {
    const { vi, ei } = handle.userData;
    if (vi != null) {
      const { x, z } = gridPointToWorld(verts[vi][0], verts[vi][1]);
      handle.position.set(x, y, z);
      continue;
    }
    // Arista: punto medio del lado, girada para seguir su dirección
    const a = verts[ei];
    const b = verts[(ei + 1) % verts.length];
    const { x, z } = gridPointToWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    handle.position.set(x, y, z);
    handle.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  _applyFocusVisibility();
};

// ── Foco: un solo handle activo, los demás bloqueados ────────────────────────
const _isFocused = (handle) =>
  _focus.vi != null ? handle.userData.vi === _focus.vi : handle.userData.ei === _focus.ei;

const _applyFocusVisibility = () => {
  if (!_handlesGroup) return;
  for (const handle of _handlesGroup.children) {
    handle.visible = !_focus || _isFocused(handle);
  }
  _rescaleHandles();
};

const _setFocus = (focus) => {
  _focus = focus;
  _applyFocusVisibility();
};

// ── Menú emergente del lado: segmentar o arrastrar ───────────────────────────
const _injectMenuStyles = () => {
  if (document.getElementById("editor3d-menu-styles")) return;
  const style = document.createElement("style");
  style.id = "editor3d-menu-styles";
  style.textContent = `
    .e3d-menu {
      position: fixed; z-index: 1000; display: flex; gap: 4px; padding: 4px;
      background: #fff; border-radius: 10px;
      box-shadow: 0 6px 20px rgba(30, 10, 18, 0.22);
      font: 600 12px/1 system-ui, sans-serif;
      transform-origin: center bottom;
      animation: e3d-pop 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.3);
    }
    .e3d-menu button {
      display: flex; align-items: center; gap: 6px; padding: 8px 10px;
      border: 0; border-radius: 7px; background: transparent; color: #3a1422;
      font: inherit; cursor: pointer; white-space: nowrap;
    }
    .e3d-menu button:hover, .e3d-menu button:focus-visible {
      background: rgba(157, 36, 73, 0.1); color: #9d2449; outline: none;
    }
    .e3d-menu button:disabled { opacity: 0.4; cursor: default; background: transparent; color: #3a1422; }
    .e3d-menu .e3d-dot { width: 9px; height: 9px; border-radius: 2px; flex: none; }
    @keyframes e3d-pop {
      from { opacity: 0; transform: translate(-50%, -100%) scale(0.8); }
      to   { opacity: 1; transform: translate(-50%, -100%) scale(1); }
    }
    @media (pointer: coarse) { .e3d-menu button { padding: 12px 14px; font-size: 14px; } }
  `;
  document.head.appendChild(style);
};

const _closeMenu = () => {
  _menuEl?.remove();
  _menuEl = null;
};

/** Menú de acciones de un handle: lado (agregar/mover) o vértice (mover/eliminar). */
const _openHandleMenu = (d, x, y) => {
  _closeMenu();
  _injectMenuStyles();
  const { areaId, ei, vi } = d;
  const menu = document.createElement("div");
  menu.className = "e3d-menu";
  menu.setAttribute("role", "menu");
  const opcion = (texto, color, accion, disabled = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = disabled;
    btn.setAttribute("role", "menuitem");
    const dot = document.createElement("span");
    dot.className = "e3d-dot";
    dot.style.background = color;
    btn.append(dot, texto);
    btn.addEventListener("click", () => {
      _closeMenu();
      accion();
    });
    return btn;
  };
  const numVerts = _currentVerts(areaId)?.length ?? 0;
  if (ei != null) {
    menu.append(
      opcion(
        "Agregar vértice",
        "#ff8f00",
        () => {
          // El vértice nuevo queda en ei+1; solo él se puede arrastrar
          if (_insertVertex(areaId, ei)) _setFocus({ areaId, vi: ei + 1 });
        },
        numVerts >= MAX_VERTICES_AREA,
      ),
      opcion("Mover lado", "#00838f", () => _setFocus({ areaId, ei })),
    );
  } else {
    menu.append(
      opcion("Mover vértice", "#ff8f00", () => _setFocus({ areaId, vi })),
      // Mínimo 3 vértices: con menos no hay polígono
      opcion("Eliminar vértice", "#c62828", () => _removeVertex(areaId, vi), numVerts <= 3),
    );
  }
  // Arriba del punto de clic, sin salirse de la ventana
  const margin = 8;
  menu.style.left = `${x}px`;
  menu.style.top = `${y - 14}px`;
  menu.style.transform = "translate(-50%, -100%)";
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  const dx = Math.max(margin - r.left, 0) - Math.max(r.right - (window.innerWidth - margin), 0);
  const dy = Math.max(margin - r.top, 0);
  if (dx || dy) {
    menu.style.left = `${x + dx}px`;
    menu.style.top = `${y - 14 + dy}px`;
  }
  _menuEl = menu;
  menu.querySelector("button")?.focus({ preventScroll: true });
};

const _onKeyDown = (e) => {
  if (e.key !== "Escape") return;
  if (_menuEl) _closeMenu();
  else if (_focus) _setFocus(null);
};

const _showHandles = (areaId) => {
  const verts = _currentVerts(areaId);
  if (!verts) return;
  _selectedAreaId = areaId;
  _ensureHandlesGroup();
  _handlesGroup.visible = true;
  _updateHandlePositions(verts, _areaFloor(areaId));
};

const _hideHandles = () => {
  _closeMenu();
  _focus = null;
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
  drag.pointerId = e.pointerId;
  drag.downX = e.clientX;
  drag.downY = e.clientY;
  drag.moved = false;
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
 * a lo largo de los bordes de la huella). Con polígono se desplazan sus vértices.
 */
const _resolveMoveRect = (orig, origVerts, dx, dy, lastDx, lastDy) => {
  const shift = (ddx, ddy) => ({
    x1: orig.x1 + ddx,
    y1: orig.y1 + ddy,
    x2: orig.x2 + ddx,
    y2: orig.y2 + ddy,
    vertices: origVerts ? origVerts.map(([x, y]) => [x + ddx, y + ddy]) : null,
  });
  const full = shift(dx, dy);
  if (dentroDelEdificio(full)) return { rect: full, dx, dy };
  const onlyX = shift(dx, lastDy);
  if (dentroDelEdificio(onlyX)) return { rect: onlyX, dx, dy: lastDy };
  const onlyY = shift(lastDx, dy);
  if (dentroDelEdificio(onlyY)) return { rect: onlyY, dx: lastDx, dy };
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

  const resolved = _resolveMoveRect(d.origRect, d.origVerts, dx, dy, d.lastDx, d.lastDy);
  if (!resolved) return; // sin posición válida cercana — mantener la última
  d.lastDx = resolved.dx;
  d.lastDy = resolved.dy;
  if (_rectsEqual(resolved.rect, d.lastRect)) return;
  d.lastRect = resolved.rect;
  _applyRectToMesh(d.mesh, d.lastRect);
  _emitLive(
    "AREA_MOVED",
    _geometryPayload(d.areaId, d.lastRect, d.floor, true, d.lastRect.vertices),
  );
};

/** Aplica al drag de resize un polígono candidato si es válido; devuelve si se aplicó. */
const _tryResizeVerts = (verts) => {
  const d = _drag;
  const shape = _shapeFromVerts(verts);
  // Se valida siempre como polígono: cubre huella, lados cruzados y área nula
  if (!dentroDelEdificio({ ...shape, vertices: verts })) return false;
  if (_vertsEqual(verts, d.lastVerts)) return true;
  d.lastVerts = verts;
  d.lastShape = shape;
  setRoomMeshShape(d.mesh, shape);
  _updateHandlePositions(verts, d.floor);
  _emitLive("AREA_RESIZED", _geometryPayload(d.areaId, shape, d.floor, true, shape.vertices));
  return true;
};

const _onResizeDrag = () => {
  const d = _drag;
  // Un clic sobre un handle no debe mover nada: solo cuenta como arrastre
  // cuando el puntero ya pasó el margen de tolerancia (ver _onPointerMove).
  if (!d.moved) return;
  const p = _pickFloorPoint(d.floor);
  if (!p) return;

  if (d.vi != null) {
    // Vértice: se desplaza lo mismo que el puntero desde que se agarró (snap a
    // la cuadrícula); los demás no se mueven. Se usa el delta y no la posición
    // absoluta porque el handle flota sobre el piso: con la cámara inclinada el
    // punto del piso bajo el clic cae a una celda de distancia del vértice.
    const [ox, oy] = d.origVerts[d.vi];
    const gx = clampInt(ox + Math.round((p.x - d.startPoint.x) / CELL), 0, GRID_COLS);
    const gy = clampInt(oy + Math.round((d.startPoint.z - p.z) / CELL), 0, GRID_ROWS);
    const con = (x, y) => d.origVerts.map((v, i) => (i === d.vi ? [x, y] : v));
    const last = d.lastVerts[d.vi];
    // Fallback por eje: si el punto exacto no es válido, deslizar en X o en Y
    if (_tryResizeVerts(con(gx, gy))) return;
    if (_tryResizeVerts(con(gx, last[1]))) return;
    _tryResizeVerts(con(last[0], gy));
    return;
  }

  // Arista: sus 2 vértices se desplazan juntos. Un lado horizontal o vertical
  // solo se mueve en perpendicular (las formas rectas siguen siendo rectas).
  const sig = (d.ei + 1) % d.origVerts.length;
  const a = d.origVerts[d.ei];
  const b = d.origVerts[sig];
  let dx = Math.round(p.x - d.startPoint.x);
  let dy = Math.round(d.startPoint.z - p.z);
  if (a[1] === b[1]) dx = 0;
  else if (a[0] === b[0]) dy = 0;
  const con = (ddx, ddy) =>
    d.origVerts.map((v, i) => (i === d.ei || i === sig ? [v[0] + ddx, v[1] + ddy] : v));
  if (_tryResizeVerts(con(dx, dy))) {
    d.lastDx = dx;
    d.lastDy = dy;
  } else if (_tryResizeVerts(con(dx, d.lastDy))) {
    d.lastDx = dx;
  } else if (_tryResizeVerts(con(d.lastDx, dy))) {
    d.lastDy = dy;
  }
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
    // El visor NO crea el área — el frontend abre su modal con estas coords.
    // En táctil un toque sin arrastre no dibuja (evita áreas 1×1 accidentales
    // al tocar la pantalla o al iniciar un gesto de dos dedos).
    if (!abort && d.lastRect && (d.moved || !d.isTouch)) {
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

  // Quitar hover antes de reconstruir (el mesh se destruye en applyGeometry)
  _setHover(null);

  if (d.kind === "resize") {
    const finalShape = abort ? d.origShape : d.lastShape;
    const finalVerts = abort ? d.origVerts : d.lastVerts;
    if (!abort && !_vertsEqual(d.lastVerts, d.origVerts)) {
      _ctx.applyGeometry(d.areaId, finalShape, d.floor, finalShape.vertices);
    } else {
      // Sin cambio o cancelado: devolver el mesh a su forma original
      setRoomMeshShape(d.mesh, d.origShape);
    }
    _emit(
      "AREA_RESIZED",
      _geometryPayload(d.areaId, finalShape, d.floor, false, finalShape.vertices),
    );
    // Reanclar handles al mesh reconstruido (resize mantiene la selección)
    if (_selectedAreaId === d.areaId) _updateHandlePositions(finalVerts, d.floor);
    return;
  }

  // move: rect final = último válido (si nunca hubo uno, el original)
  const finalRect = abort ? { ...d.origRect, vertices: d.origVerts } : d.lastRect;
  const changed = !_rectsEqual(finalRect, d.origRect);

  // Restaurar la transformación temporal del drag; la geometría real la
  // reconstruye applyGeometry (o queda como estaba si no hubo cambio).
  const ud = d.mesh.userData;
  d.mesh.scale.set(1, 1, 1);
  _applyRectToMesh(d.mesh, { x1: ud.x1, y1: ud.y1, x2: ud.x2, y2: ud.y2 });

  if (changed) {
    _ctx.applyGeometry(d.areaId, finalRect, d.floor, finalRect.vertices ?? null);
  }
  // Mensaje final siempre con live:false (con coords originales si se revirtió)
  _emit(
    "AREA_MOVED",
    _geometryPayload(d.areaId, finalRect, d.floor, false, finalRect.vertices ?? null),
  );
};

// ── Agregar / quitar vértices ─────────────────────────────────────────────────
const _mcd = (a, b) => (b === 0 ? a : _mcd(b, a % b));

/**
 * Aplica de inmediato un polígono nuevo (alta/baja de vértice). Devuelve false
 * y no toca nada si la forma resultante no es válida.
 */
const _commitVerts = (areaId, verts) => {
  const shape = _shapeFromVerts(verts);
  if (!dentroDelEdificio({ ...shape, vertices: verts })) return false;
  const floor = _areaFloor(areaId);
  const antes = _currentVerts(areaId);
  const formaAntes = _shapeFromVerts(antes);
  // live:true con la forma previa → el frontend guarda el original para poder
  // revertir si la nueva forma se solapa con otra área; luego el cambio final.
  _emit("AREA_RESIZED", _geometryPayload(areaId, formaAntes, floor, true, formaAntes.vertices));
  // Se guardan los vértices tal cual (aunque el nuevo quede alineado sobre un
  // lado y la forma siga pareciendo un rectángulo) para no perder el vértice.
  _ctx.applyGeometry(areaId, shape, floor, verts);
  _emit("AREA_RESIZED", _geometryPayload(areaId, shape, floor, false, verts));
  _updateHandlePositions(verts, floor);
  return true;
};

/** Inserta un vértice a la mitad del lado `ei` (sobre la cuadrícula). */
const _insertVertex = (areaId, ei) => {
  const verts = _currentVerts(areaId);
  if (!verts || verts.length >= MAX_VERTICES_AREA) return false;
  const a = verts[ei];
  const b = verts[(ei + 1) % verts.length];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  // Puntos de cuadrícula que caen exactamente sobre el lado: se usa el central.
  // Si no hay ninguno (lado inclinado corto) se toma el punto medio redondeado.
  const pasos = _mcd(Math.abs(dx), Math.abs(dy));
  const k = Math.round(pasos / 2);
  const nuevo =
    pasos >= 2
      ? [a[0] + (dx / pasos) * k, a[1] + (dy / pasos) * k]
      : [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
  const igual = (p, q) => p[0] === q[0] && p[1] === q[1];
  if (igual(nuevo, a) || igual(nuevo, b)) return false; // lado de 1 celda: no cabe otro vértice
  const next = [...verts.slice(0, ei + 1), nuevo, ...verts.slice(ei + 1)];
  return _commitVerts(areaId, next);
};

/** Elimina el vértice `vi` (mínimo quedan 3). */
const _removeVertex = (areaId, vi) => {
  const verts = _currentVerts(areaId);
  if (!verts || verts.length <= 3) return false;
  return _commitVerts(
    areaId,
    verts.filter((_, i) => i !== vi),
  );
};

/** Clic/toque sin arrastre sobre un handle: abre su menú de acciones. */
const _onHandleTap = (d, e) => {
  // Con un handle ya enfocado el clic no abre el menú: solo falta arrastrarlo
  if (!_focus) _openHandleMenu(d, e.clientX, e.clientY);
};

// ── Handlers de puntero ───────────────────────────────────────────────────────
/**
 * Fase de captura (corre antes que OrbitControls): un segundo dedo durante un
 * drag cancela la edición y devuelve el control a la cámara, para que el
 * gesto de dos dedos (zoom / desplazar) funcione con cualquier herramienta.
 */
const _onPointerDownCapture = (e) => {
  if (_drag && e.pointerId !== _drag.pointerId) _finishDrag({ pointerId: _drag.pointerId }, true);
  // Un clic fuera del menú lo cierra sin hacer nada más
  if (_menuEl) {
    _closeMenu();
    e.stopImmediatePropagation();
  }
};

const _onPointerDown = (e) => {
  if (!_ctx || _tool === "select" || e.button !== 0 || _drag) return;
  // Con otro dedo ya en pantalla es un gesto de cámara, no una edición
  if (_isTouch(e) && !e.isPrimary) return;
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
        // Polígono: sus vértices viajan con el área (null si es rectángulo)
        origVerts: _ctx.liveRoomMap[areaId]?.vertices ?? mesh.userData.vertices ?? null,
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
    const handle = _pickHandle(e);
    if (handle && _selectedAreaId) {
      const areaId = _selectedAreaId;
      const verts = _currentVerts(areaId);
      const mesh = _ctx.roomMeshes.get(areaId);
      if (!verts || !mesh) return;
      const floor = _areaFloor(areaId);
      const startPoint = _pickFloorPoint(floor);
      if (!startPoint) return;
      const { vi, ei } = handle.userData;
      const shape = _shapeFromVerts(verts);
      _startDrag(
        {
          kind: "resize",
          areaId,
          mesh,
          floor,
          vi, // vértice agarrado (los otros 3 quedan anclados) …
          ei, // … o arista agarrada (se mueven sus 2 vértices)
          startPoint,
          origVerts: verts,
          lastVerts: verts,
          origShape: shape,
          lastShape: shape,
          lastDx: 0,
          lastDy: 0,
        },
        e,
      );
      return;
    }
    // Con un handle enfocado, clic fuera de él cancela el bloqueo
    if (_focus) {
      _setFocus(null);
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
    _startDrag({ kind: "draw", floor, startCell, lastRect: rect, isTouch: _isTouch(e) }, e);
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
    if (e.pointerId !== _drag.pointerId) return;
    if (Math.hypot(e.clientX - _drag.downX, e.clientY - _drag.downY) > TAP_SLOP_PX) {
      _drag.moved = true;
    }
    if (_drag.kind === "move") _onMoveDrag();
    else if (_drag.kind === "resize") _onResizeDrag();
    else if (_drag.kind === "draw") _onDrawDrag();
    return;
  }

  // Hover-highlight en tools que operan sobre áreas existentes (en táctil no
  // hay hover: el resaltado se quedaría pegado en el último toque)
  if (_isTouch(e)) return;
  if (_tool === "move" || _tool === "resize" || _tool === "delete") {
    _setHover(_pickRoomMesh());
  }
};

const _onPointerUp = (e) => {
  if (!_ctx || !_drag || e.pointerId !== _drag.pointerId) return;
  _setRayFromEvent(e);
  // Procesar la posición final del puntero antes de cerrar el drag
  if (_drag.kind === "move") _onMoveDrag();
  else if (_drag.kind === "resize") _onResizeDrag();
  else if (_drag.kind === "draw") _onDrawDrag();
  const d = _drag;
  _finishDrag(e, false);
  // Soltar un handle sin haberlo arrastrado es un clic/toque sobre él
  if (d.kind === "resize" && !d.moved && _vertsEqual(d.lastVerts, d.origVerts)) {
    _onHandleTap(d, e);
  } else if (d.kind === "resize" && _focus) {
    _setFocus(null); // ya se colocó: se desbloquean los demás handles
  }
};

const _onPointerCancel = (e) => {
  if (!_ctx || !_drag || e.pointerId !== _drag.pointerId) return;
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
  el.addEventListener("pointerdown", _onPointerDownCapture, { capture: true });
  el.addEventListener("pointerdown", _onPointerDown);
  el.addEventListener("pointermove", _onPointerMove);
  el.addEventListener("pointerup", _onPointerUp);
  el.addEventListener("pointercancel", _onPointerCancel);
  el.addEventListener("pointerleave", _onPointerLeave);
  // Táctil: sin menú contextual ni selección por pulsación larga sobre el canvas
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.style.touchAction = "none";
  el.style.userSelect = "none";
  el.style.webkitUserSelect = "none";
  el.style.webkitTouchCallout = "none";
  // Los handles conservan su tamaño en pantalla al orbitar / hacer zoom
  ctx.controls.addEventListener("change", _rescaleHandles);
  // Al mover la cámara el menú quedaría flotando lejos de su lado
  ctx.controls.addEventListener("start", _closeMenu);
  window.addEventListener("resize", _rescaleHandles);
  window.addEventListener("keydown", _onKeyDown);
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
