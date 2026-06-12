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
  CUBICULO: 0x9d2549, // guinda institucional (color de la mampara)
  ESCRITORIO: 0x2196f3,
  SALA: 0x6d4c41,
  IMPRESORA: 0xff9800,
  BODEGA: 0x9e9e9e,
  OTRO: 0x607d8b,
};

const PIN_COLOR = 0xff1744; // ticket_activo

// ── Materiales compartidos (NO se hacen dispose por instancia) ───────────────
const mkMat = (color, opts = {}) =>
  Object.assign(
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.08,
      envMapIntensity: 0.6,
      ...opts,
    }),
    { userData: { shared: true } },
  );

const MATS = {
  escritorio: mkMat(0xd8d4cc), // superficie gris claro del módulo real
  cajonera: mkMat(0xc4c0b8),
  panel: mkMat(0x8a2143), // mampara guinda
  gabinete: mkMat(0xbfbbb2),
  monitor: mkMat(0x2b2b30, { roughness: 0.35, metalness: 0.3 }),
  pantalla: mkMat(0x1a3a5c, { emissive: 0x1a3a5c, emissiveIntensity: 0.35 }),
  silla: mkMat(0x3a3a3f, { roughness: 0.85 }),
  mesa: mkMat(0x6d4c41),
  impresora: mkMat(0xe8e6e1),
  impresoraAccent: mkMat(0xff9800),
  bodega: mkMat(0x9e9e9e),
  otro: mkMat(0x607d8b),
};

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

// ── Constructores de geometría por tipo (low-poly compuesto) ─────────────────
// Cada constructor recibe (group, w, d) y agrega cajas al grupo. El grupo está
// centrado en (0, 0, 0) con yBase = 0; la pared/mampara queda hacia -z (la
// rotación del grupo gira todo el módulo).

const addBox = (group, mat, w, h, d, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

/** Módulo estándar de Finanzas: escritorio + cajonera + mampara guinda + gabinete + monitor + silla. */
const buildCubiculo = (group, w, d) => {
  const panelH = 1.5;
  // Mampara guinda al fondo
  addBox(group, MATS.panel, w, panelH, 0.06, 0, panelH / 2, -d / 2 + 0.03);
  // Escritorio (cubre el 55% de profundidad, pegado a la mampara)
  const deskD = d * 0.55;
  addBox(group, MATS.escritorio, w * 0.96, 0.06, deskD, 0, 0.72, -d / 2 + 0.06 + deskD / 2);
  // Cajonera de 3 gavetas bajo el lado derecho
  addBox(group, MATS.cajonera, w * 0.24, 0.62, deskD * 0.85, w * 0.32, 0.31, -d / 2 + 0.06 + deskD / 2);
  // Gabinete superior cerrado sobre la mampara
  addBox(group, MATS.gabinete, w * 0.9, 0.34, 0.3, 0, 1.22, -d / 2 + 0.18);
  // Monitor sobre el escritorio (marco + pantalla)
  addBox(group, MATS.monitor, w * 0.3, 0.26, 0.03, -w * 0.1, 0.92, -d / 2 + 0.2);
  addBox(group, MATS.pantalla, w * 0.26, 0.2, 0.012, -w * 0.1, 0.92, -d / 2 + 0.22);
  // Silla simple (asiento + respaldo) frente al escritorio
  addBox(group, MATS.silla, w * 0.26, 0.06, d * 0.22, -w * 0.05, 0.45, d * 0.18);
  addBox(group, MATS.silla, w * 0.26, 0.4, 0.05, -w * 0.05, 0.68, d * 0.28);
  return panelH;
};

/** Escritorio abierto: superficie + cajonera + monitor + silla, sin mampara. */
const buildEscritorio = (group, w, d) => {
  const deskD = d * 0.5;
  addBox(group, MATS.escritorio, w * 0.96, 0.06, deskD, 0, 0.72, -d / 2 + deskD / 2);
  // Patas laterales
  addBox(group, MATS.cajonera, 0.05, 0.7, deskD * 0.9, -w * 0.44, 0.35, -d / 2 + deskD / 2);
  addBox(group, MATS.cajonera, w * 0.22, 0.62, deskD * 0.85, w * 0.34, 0.31, -d / 2 + deskD / 2);
  addBox(group, MATS.monitor, w * 0.28, 0.24, 0.03, 0, 0.9, -d / 2 + 0.12);
  addBox(group, MATS.pantalla, w * 0.24, 0.18, 0.012, 0, 0.9, -d / 2 + 0.14);
  addBox(group, MATS.silla, w * 0.26, 0.06, d * 0.22, 0, 0.45, d * 0.18);
  addBox(group, MATS.silla, w * 0.26, 0.4, 0.05, 0, 0.68, d * 0.28);
  return 1.1;
};

/** Sala de juntas: mesa grande + sillas en los costados largos. */
const buildSala = (group, w, d) => {
  addBox(group, MATS.mesa, w * 0.7, 0.07, d * 0.45, 0, 0.74, 0);
  addBox(group, MATS.cajonera, w * 0.1, 0.7, d * 0.12, 0, 0.37, 0); // pedestal central
  const sillas = Math.max(2, Math.floor((w * 0.7) / 0.6));
  for (let i = 0; i < sillas; i++) {
    const x = -w * 0.28 + (i * (w * 0.56)) / Math.max(1, sillas - 1);
    addBox(group, MATS.silla, 0.32, 0.06, 0.32, x, 0.45, d * 0.32);
    addBox(group, MATS.silla, 0.32, 0.06, 0.32, x, 0.45, -d * 0.32);
  }
  return 1.0;
};

/** Impresora/multifuncional sobre gabinete bajo. */
const buildImpresora = (group, w, d) => {
  addBox(group, MATS.cajonera, w * 0.7, 0.6, d * 0.7, 0, 0.3, 0);
  addBox(group, MATS.impresora, w * 0.55, 0.35, d * 0.55, 0, 0.78, 0);
  addBox(group, MATS.impresoraAccent, w * 0.4, 0.06, d * 0.4, 0, 0.99, 0); // bandeja superior
  return 1.2;
};

/** Bodega/anaquel alto. */
const buildBodega = (group, w, d) => {
  addBox(group, MATS.bodega, w * 0.9, 1.7, d * 0.8, 0, 0.85, 0);
  addBox(group, MATS.cajonera, w * 0.92, 0.05, d * 0.82, 0, 0.6, 0); // repisa visible
  addBox(group, MATS.cajonera, w * 0.92, 0.05, d * 0.82, 0, 1.2, 0);
  return 1.8;
};

/** Caja genérica (tipo OTRO o desconocido). */
const buildOtro = (group, w, d) => {
  addBox(group, MATS.otro, w, MUEBLE_H, d, 0, MUEBLE_H / 2, 0);
  return MUEBLE_H + 0.3;
};

const BUILDERS = {
  CUBICULO: buildCubiculo,
  ESCRITORIO: buildEscritorio,
  SALA: buildSala,
  IMPRESORA: buildImpresora,
  BODEGA: buildBodega,
  OTRO: buildOtro,
};

/**
 * Crea el grupo low-poly de un mueble posicionado dentro de su área.
 * El grupo contiene varias cajas (módulo compuesto) y soporta rotación
 * en grados (0/90/180/270) sobre el eje Y.
 * @param {object} mueble - { id, label, tipo, gridX, gridY, ancho, alto, rotacion }
 * @param {object} area   - room del liveRoomMap: { id, x1,y1,x2,y2, floor, label }
 * @returns {THREE.Group}
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

  const group = new THREE.Group();
  const builder = BUILDERS[mueble.tipo] ?? buildOtro;
  const topY = builder(group, w, d);

  group.position.set(center.x, yBase, center.z);
  group.rotation.y = THREE.MathUtils.degToRad(mueble.rotacion ?? 0);
  group.visible = false; // LOD lo activa

  const userData = {
    type: "mueble",
    muebleId: mueble.id,
    areaId: area.id,
    label: mueble.label,
    tipo: mueble.tipo,
    baseColor: MUEBLE_COLORS[mueble.tipo] ?? MUEBLE_COLORS.OTRO,
    worldPos: group.position.clone(),
    floor: area.floor ?? 0,
    topY: yBase + topY, // altura world-space del punto más alto (para pin/label)
  };
  group.userData = userData;
  // El raycaster intersecta meshes hijos: cada uno expone el MISMO userData
  group.traverse((child) => {
    if (child.isMesh) child.userData = userData;
  });
  return group;
};

/**
 * Crea el sprite-label de un mueble (oculto por defecto).
 * @param {number} [topY] - altura world-space del tope del mueble; el label flota encima.
 */
export const createMuebleLabel = (mueble, worldPos, topY = null) => {
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
  const labelY = topY != null ? topY - worldPos.y + 0.5 : 1.2;
  sprite.position.copy(worldPos).add(new THREE.Vector3(0, labelY, 0));
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
 * Libera geometría y materiales de un objeto (mesh, group o sprite).
 * Los materiales compartidos (userData.shared) NO se liberan: viven todo
 * el ciclo de vida del visor y se reutilizan entre rebuilds.
 */
const disposeOne = (obj) => {
  obj.geometry?.dispose?.();
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const m of mats) {
    if (!m || m.userData?.shared) continue;
    m.map?.dispose?.();
    m.dispose?.();
  }
};

const disposeObject = (obj) => {
  if (!obj) return;
  if (obj.isGroup) {
    obj.traverse((child) => {
      if (child.isMesh || child.isSprite) disposeOne(child);
    });
  } else {
    disposeOne(obj);
  }
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
        const label = createMuebleLabel(mueble, mesh.userData.worldPos, mesh.userData.topY);
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
      const floor = mesh.userData.floor ?? 0;
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

  /**
   * Devuelve los meshes raycasteables de los muebles visibles.
   * Cada mueble es un Group: se devuelven sus meshes hijos (todos comparten
   * el mismo userData del mueble, así el hit expone muebleId/areaId/label).
   */
  visibleMeshes() {
    const out = [];
    for (const { mesh } of this.entries.values()) {
      if (!mesh.visible) continue;
      mesh.traverse((child) => {
        if (child.isMesh) out.push(child);
      });
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
    const { worldPos, topY } = entry.mesh.userData;
    const pinY = (topY ?? worldPos.y + 0.9) + 0.7;
    this.pin.position.set(worldPos.x, pinY, worldPos.z);
    this.pin.visible = true;
    this._activePinMuebleId = muebleId;
    return entry;
  }

  hidePin() {
    this.pin.visible = false;
    this._activePinMuebleId = null;
  }
}

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
