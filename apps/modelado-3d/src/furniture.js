/**
 * furniture.js — Sistema de muebles/cubículos dentro de las áreas del edificio.
 *
 * Los muebles viven en la tabla `Mueble` (MySQL) y se consultan vía
 *   GET /api/admin/areas/:areaId/muebles → { data: [...] }
 *
 * Cada mueble trae coordenadas RELATIVAS al área padre (0.0 a 1.0):
 *   { id, areaId, label, tipo, gridX, gridY, ancho, alto, activo }
 *
 * Mapeo a grid global (luego a world-space con la MISMA transformación que las áreas):
 *   gx = area.x1 + mueble.gridX * (area.x2 - area.x1)
 *   gy = area.y1 + mueble.gridY * (area.y2 - area.y1)
 *
 * LOD: los muebles solo se hacen visibles cuando la cámara está cerca del área.
 * Todos los meshes viven en un Group separado (`mueblesGroup`) para hide/show
 * y limpieza (dispose) eficientes al cambiar de piso o recargar.
 */

import * as THREE from "three";

// Debe coincidir con building.js
const CELL = 1;
const FLOOR_H = 4;
const FLOOR_Y = (floor) => floor * FLOOR_H;

// Centro de la cuadrícula global (32×27) — idéntico a gridToScene en building.js
const CX = 16;
const CY = 13.5;

// Altura fija del mueble (low-poly). El edificio usa ROOM_H=3.4; los muebles
// son piezas pequeñas que descansan sobre la losa del piso.
const MUEBLE_H = 0.5;

// Distancia (unidades Three.js) bajo la cual los muebles se vuelven visibles.
// La escala del edificio es 1 unidad = 1 celda (~3.5 m). El edificio mide
// 32×27 unidades; vista general la cámara está a >40 u. Un valor de 22 hace
// que los muebles aparezcan al acercarse a un área concreta, no en vista global.
export const MUEBLE_LOD_DISTANCE = 22;

const MUEBLE_COLORS = {
  CUBICULO: 0x8bc34a,
  ESCRITORIO: 0x4caf50,
  SALA: 0x2196f3,
  IMPRESORA: 0xff9800,
  BODEGA: 0x9e9e9e,
  OTRO: 0x607d8b,
};

const PIN_COLOR = 0xff1744; // ticket_activo

/**
 * Convierte una coordenada de grid global (gx, gy) a posición world-space (x, z),
 * usando EXACTAMENTE la misma transformación que building.gridToScene para que
 * los muebles queden perfectamente alineados dentro del mesh del área.
 */
const gridPointToWorld = (gx, gy) => ({
  x: (gx - CX) * CELL,
  z: -(gy - CY) * CELL, // Z invertido, igual que las áreas
});

/**
 * Calcula la caja world-space de un área a partir de sus coords de grid.
 * Devuelve { worldX, worldZ, worldAncho, worldAlto, worldY } donde
 * (worldX, worldZ) es la esquina (x1,y1) y worldAncho/worldAlto el tamaño.
 * NOTA: por el Z invertido, worldZ corresponde a y2 (no y1).
 */
export const areaToWorldBox = (area) => {
  const { x1, y1, x2, y2, floor } = area;
  const a = gridPointToWorld(x1, y1);
  const b = gridPointToWorld(x2, y2);
  return {
    worldXMin: Math.min(a.x, b.x),
    worldZMin: Math.min(a.z, b.z),
    worldAncho: Math.abs(b.x - a.x),
    worldAlto: Math.abs(b.z - a.z),
    worldY: FLOOR_Y(floor ?? 0),
    gx1: x1,
    gy1: y1,
    gx2: x2,
    gy2: y2,
    floor: floor ?? 0,
  };
};

/**
 * Crea el mesh low-poly de un mueble posicionado dentro de su área.
 * @param {object} mueble - { id, label, tipo, gridX, gridY, ancho, alto }
 * @param {object} area   - room del liveRoomMap: { id, x1,y1,x2,y2, floor, label }
 * @returns {THREE.Mesh}
 */
export const createMuebleMesh = (mueble, area) => {
  // Grid global del centro del mueble
  const gw = area.x2 - area.x1; // ancho del área en celdas
  const gh = area.y2 - area.y1; // alto del área en celdas

  const gx = area.x1 + mueble.gridX * gw;
  const gy = area.y1 + mueble.gridY * gh;

  // Tamaño del mueble en celdas → unidades
  const w = Math.max(0.15, mueble.ancho * gw) * CELL;
  const d = Math.max(0.15, mueble.alto * gh) * CELL;

  const center = gridPointToWorld(gx, gy);
  const yBase = FLOOR_Y(area.floor ?? 0);

  const geo = new THREE.BoxGeometry(w, MUEBLE_H, d);
  const mat = new THREE.MeshStandardMaterial({
    color: MUEBLE_COLORS[mueble.tipo] ?? MUEBLE_COLORS.OTRO,
    roughness: 0.65,
    metalness: 0.1,
    envMapIntensity: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Descansa sobre la losa del piso (losa en FLOOR_Y - 0.15, superficie ~FLOOR_Y)
  mesh.position.set(center.x, yBase + MUEBLE_H / 2, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false; // LOD lo activa
  mesh.userData = {
    type: "mueble",
    muebleId: mueble.id,
    areaId: area.id,
    label: mueble.label,
    tipo: mueble.tipo,
    baseColor: MUEBLE_COLORS[mueble.tipo] ?? MUEBLE_COLORS.OTRO,
    worldPos: mesh.position.clone(),
  };
  return mesh;
};

/**
 * Crea el sprite-label de un mueble (oculto por defecto).
 */
export const createMuebleLabel = (mueble, worldPos) => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.fillText(String(mueble.label ?? "").substring(0, 14), 4, 22);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.position.copy(worldPos).add(new THREE.Vector3(0, 1.2, 0));
  sprite.scale.set(2, 0.5, 1);
  sprite.visible = false;
  sprite.userData = { type: "muebleLabel", muebleId: mueble.id };
  return sprite;
};

/**
 * Crea un pin/indicador de ticket (cono invertido) para colocar sobre un mueble.
 */
export const createMueblePin = () => {
  const geo = new THREE.ConeGeometry(0.35, 0.9, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: PIN_COLOR,
    emissive: PIN_COLOR,
    emissiveIntensity: 0.6,
    roughness: 0.4,
    metalness: 0.2,
  });
  const pin = new THREE.Mesh(geo, mat);
  pin.rotation.x = Math.PI; // punta hacia abajo
  pin.userData = { type: "mueblePin" };
  pin.visible = false;
  return pin;
};

/**
 * Libera geometría y materiales de un objeto (mesh o sprite).
 */
const disposeObject = (obj) => {
  if (!obj) return;
  obj.geometry?.dispose?.();
  const mat = obj.material;
  if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
  else mat?.dispose?.();
  if (mat?.map) mat.map.dispose?.();
};

/**
 * Gestor de muebles. Mantiene un Group con todos los meshes/labels y aplica LOD.
 */
export class FurnitureManager {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "muebles";
    scene.add(this.group);

    // muebleId → { mesh, label }
    this.entries = new Map();
    // areaId → [muebleId, ...]
    this.byArea = new Map();

    // Pin compartido de ticket
    this.pin = createMueblePin();
    this.group.add(this.pin);
    this._activePinMuebleId = null;
  }

  /**
   * Construye los meshes de muebles a partir del mapa { areaId: [muebles] }
   * y el roomMap vivo (para obtener coords de cada área).
   * Limpia los existentes antes de reconstruir.
   */
  build(mueblesByArea, roomMap) {
    this.clear();
    for (const [areaId, muebles] of Object.entries(mueblesByArea)) {
      const area = roomMap[areaId];
      if (!area || !Array.isArray(muebles)) continue;
      for (const mueble of muebles) {
        const mesh = createMuebleMesh(mueble, area);
        const label = createMuebleLabel(mueble, mesh.userData.worldPos);
        this.group.add(mesh);
        this.group.add(label);
        this.entries.set(mueble.id, { mesh, label, areaId });
        if (!this.byArea.has(areaId)) this.byArea.set(areaId, []);
        this.byArea.get(areaId).push(mueble.id);
      }
    }
  }

  /** Elimina y libera todos los meshes de muebles (mantiene el pin). */
  clear() {
    for (const { mesh, label } of this.entries.values()) {
      this.group.remove(mesh);
      this.group.remove(label);
      disposeObject(mesh);
      disposeObject(label);
    }
    this.entries.clear();
    this.byArea.clear();
    this.hidePin();
  }

  /**
   * LOD: muestra muebles (y sus labels) solo si la cámara está dentro de
   * MUEBLE_LOD_DISTANCE, y si su piso está visible.
   * @param {THREE.Camera} camera
   * @param {number} activeFloor  -1 = todos
   */
  updateVisibility(camera, activeFloor) {
    for (const { mesh, label } of this.entries.values()) {
      const floor = roomFloorFromMesh(mesh);
      const floorVisible = activeFloor === -1 || floor === activeFloor;
      if (!floorVisible) {
        mesh.visible = false;
        label.visible = false;
        continue;
      }
      const dist = camera.position.distanceTo(mesh.userData.worldPos);
      const near = dist < MUEBLE_LOD_DISTANCE;
      mesh.visible = near;
      label.visible = near;
    }
    // El pin sigue al mueble activo y se oculta si el mueble se oculta
    if (this._activePinMuebleId != null) {
      const entry = this.entries.get(this._activePinMuebleId);
      this.pin.visible = !!(entry && entry.mesh.visible);
    }
  }

  /** Devuelve los meshes de muebles actualmente visibles (para raycasting). */
  visibleMeshes() {
    const out = [];
    for (const { mesh } of this.entries.values()) {
      if (mesh.visible) out.push(mesh);
    }
    return out;
  }

  getEntry(muebleId) {
    return this.entries.get(muebleId);
  }

  /** Coloca el pin de ticket sobre un mueble y lo resalta. */
  showPin(muebleId) {
    const entry = this.entries.get(muebleId);
    if (!entry) return null;
    const pos = entry.mesh.userData.worldPos;
    this.pin.position.set(pos.x, pos.y + 1.4, pos.z);
    this.pin.visible = true;
    this._activePinMuebleId = muebleId;
    return entry;
  }

  hidePin() {
    this.pin.visible = false;
    this._activePinMuebleId = null;
  }
}

/** Lee el piso desde el world-space del mesh (yBase = floor * FLOOR_H). */
const roomFloorFromMesh = (mesh) => Math.round((mesh.userData.worldPos.y - MUEBLE_H / 2) / FLOOR_H);

/**
 * Fetch de muebles para un conjunto de áreas. Degradación elegante:
 * si un área falla, devuelve [] para esa área sin romper el resto.
 * @param {Array} areas - rooms con { id }
 * @param {string} apiBase
 * @returns {Promise<Object>} { areaId: [muebles] }
 */
export const loadMuebles = async (areas, apiBase, jwtToken = null) => {
  const allMuebles = {};
  const headers = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
  await Promise.all(
    areas.map(async (area) => {
      try {
        const res = await fetch(`${apiBase}/api/admin/areas/${area.id}/muebles`, { headers });
        if (!res.ok) {
          allMuebles[area.id] = [];
          return;
        }
        const json = await res.json();
        allMuebles[area.id] = json.data ?? [];
      } catch {
        allMuebles[area.id] = [];
      }
    }),
  );
  return allMuebles;
};
