import * as THREE from "three";
import { ROOMS, AREA_COLORS } from "./rooms.js";

const CELL = 1; // 1 unidad Three.js = 1 celda del plano
const FLOOR_H = 4; // altura por piso en unidades
const ROOM_H = 3.4; // altura de cuarto (deja espacio para losa)
const WALL_T = 0.08; // grosor de bordes

export const FLOOR_Y = (floor) => floor * FLOOR_H;

/**
 * Convierte coordenadas de cuadrícula a posición/tamaño Three.js.
 * El edificio se centra en el origen (grid 32x27 → centrado en 0,0).
 */
const gridToScene = (x1, y1, x2, y2) => {
  const cx = 16; // centro X de la cuadrícula (32/2)
  const cy = 13.5; // centro Y de la cuadrícula (27/2)

  const w = (x2 - x1) * CELL;
  const d = (y2 - y1) * CELL;
  const px = ((x1 + x2) / 2 - cx) * CELL;
  const pz = -((y1 + y2) / 2 - cy) * CELL; // Z invertido

  return { w, d, px, pz };
};

/**
 * Crea un mesh de cuarto.
 */
// Opacidad base del "acrílico arquitectónico" de las áreas (maqueta de vidrio).
export const ROOM_BASE_OPACITY = 0.48;

/**
 * Material de área tipo "acrílico de maqueta arquitectónica".
 * Transparencia alfa simple — sin transmission: el pase de transmisión de
 * Three.js solo ve objetos opacos, así que un cuarto de vidrio detrás de otro
 * desaparecía (se veía el fondo blanquecino). depthWrite:false evita que el
 * orden de dibujo de cajas solapadas oculte cuartos según el ángulo de cámara.
 */
const createRoomMaterial = (color) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: ROOM_BASE_OPACITY,
    depthWrite: false,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.7,
  });

export const createRoomMesh = (room) => {
  const { w, d, px, pz } = gridToScene(room.x1, room.y1, room.x2, room.y2);
  const yBase = FLOOR_Y(room.floor);

  const geo = new THREE.BoxGeometry(w - WALL_T, ROOM_H, d - WALL_T);
  const mat = createRoomMaterial(room.color);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, yBase + ROOM_H / 2, pz);
  mesh.userData = {
    roomId: room.id,
    floor: room.floor,
    label: room.label,
    x1: room.x1,
    y1: room.y1,
    x2: room.x2,
    y2: room.y2,
    baseColor: room.color,
    baseOpacity: ROOM_BASE_OPACITY, // usado por setFloorVisibility para restaurar vidrio
  };

  // Borde sutil que define la silueta del volumen acrílico.
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x5b7390, transparent: true, opacity: 0.45 }),
  );
  line.userData = { isEdge: true };
  mesh.add(line);

  return mesh;
};

// Grosor estructural de la losa entre pisos.
const SLAB_H = 0.45;

/**
 * Material de losa: concreto pulido claro. MeshStandardMaterial con roughness
 * alto y un toque de metalness para captar el environment como pulido sutil.
 */
const createSlabMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0xe8e6e1, // concreto claro
    roughness: 0.82,
    metalness: 0.05,
    envMapIntensity: 0.5,
  });

/**
 * Crea la losa del piso (plataforma base de cada nivel) con grosor estructural
 * y bordes definidos por LineSegments.
 */
const createSlab = (floor) => {
  // Losa con la forma real del edificio (U-shape vista desde arriba):
  //
  //   Grid 32×27, CELL=1. Z invertido: filas bajas → Z positivo (frente, hacia la
  //   cámara); filas altas → Z negativo (fondo del edificio).
  //
  //   Orientación de la U:
  //     FRENTE (Z+): patio abierto — el usuario lo recorre para ingresar.
  //     FONDO  (Z-): conector + entrada principal del edificio.
  //
  //   Ala izquierda : cols  0→13 (ancho 13), filas 0→27 (prof 27)
  //                   cx = (0+13)/2  - 16 = -9.5  |  cz = 0
  //                   Cubre X: -16 a -3   Z: -13.5 a +13.5
  //
  //   Ala derecha   : cols 19→32 (ancho 13), filas 0→27 (prof 27)
  //                   cx = (19+32)/2 - 16 = +9.5  |  cz = 0
  //                   Cubre X: +3 a +16   Z: -13.5 a +13.5
  //
  //   Conector+entrada : cols 13→19 (ancho 6), filas 16→27 (prof 11) — zona de FONDO
  //                   cx = (13+19)/2 - 16 = 0  |  cz = -((16+27)/2 - 13.5) = -8
  //                   Cubre X: -3 a +3   Z: -13.5 a -2.5
  //
  //   Vano/patio abierto de la U: cols 13→19, filas 0→16 (frente central). Sin losa.
  //
  //   Juntura ala↔conector: en X las alas cierran en col 13/19 (X=±3) donde el
  //   conector empieza — sin hueco. En Z el conector llega hasta -13.5, igual
  //   que las alas — sin hueco en la base del fondo.
  const mat = createSlabMaterial();
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x9aa6b2,
    transparent: true,
    opacity: 0.5,
  });
  const yPos = FLOOR_Y(floor) - SLAB_H / 2;
  const group = new THREE.Group();

  const addSlab = (w, d, cx, cz) => {
    const geo = new THREE.BoxGeometry(w * CELL, SLAB_H, d * CELL);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, yPos, cz);
    // Marca que permite distinguir losa de mesh de área en setViewLevel.
    mesh.userData = { isSlab: true, baseOpacity: 1 };
    // Borde definido para legibilidad arquitectónica.
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    line.userData = { isEdge: true };
    mesh.add(line);
    group.add(mesh);
  };

  addSlab(13, 27, -9.5, 0); // ala izquierda      cols  0→13, filas  0→27
  addSlab(13, 27, 9.5, 0); // ala derecha         cols 19→32, filas  0→27
  addSlab(6, 11, 0, -8); // conector + entrada  cols 13→19, filas 16→27 (fondo)

  return group;
};

// ── Pasillos ─────────────────────────────────────────────────────────────────
// Espejo de PASILLOS en @stf/shared (areaGeometry.ts) y de CORRIDOR_COLS del
// editor 2D: franjas de 1 celda de ancho a lo largo de cada ala.
const CORRIDOR_STRIPS = [
  { x1: 4, y1: 0, x2: 5, y2: 27 }, // ala izquierda, pasillo 1
  { x1: 9, y1: 0, x2: 10, y2: 27 }, // ala izquierda, pasillo 2
  { x1: 22, y1: 0, x2: 23, y2: 27 }, // ala derecha, pasillo 1
  { x1: 27, y1: 0, x2: 28, y2: 27 }, // ala derecha, pasillo 2
];

/**
 * Dibuja los pasillos sobre la losa de un piso como planos de color sólido.
 * Relleno color corredor (gris-azulado institucional) apenas elevado sobre la losa
 * para evitar z-fighting. Cada franja es un PlaneGeometry con MeshStandardMaterial.
 */
const createCorridorLines = (floor) => {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8fa8bf,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 0.38,
  });
  mat.userData = { baseOpacity: 0.38, isCorridor: true };
  const y = FLOOR_Y(floor) + 0.025; // apenas sobre la losa para evitar z-fighting

  for (const strip of CORRIDOR_STRIPS) {
    const { w, d, px, pz } = gridToScene(strip.x1, strip.y1, strip.x2, strip.y2);
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(px, y, pz);
    // isEdge=true para que setViewLevel lo gestione como elemento del pasillo
    mesh.userData = { isEdge: true, isCorridor: true };
    group.add(mesh);
  }
  return group;
};

/**
 * Construye todos los pisos del edificio a partir de los datos de rooms.js (fallback).
 * Retorna { floorGroups: Map<floor, Group>, roomMeshes: Map<roomId, Mesh> }
 */
export const buildBuilding = () => {
  const floorData = [
    { key: "pb", floor: 0 },
    { key: "nivel1", floor: 1 },
    { key: "nivel2", floor: 2 },
    { key: "nivel3", floor: 3 },
  ];

  const allRooms = floorData.flatMap(({ key, floor }) =>
    (ROOMS[key] ?? []).map((r) => ({ ...r, floor })),
  );

  return buildBuildingFromData(allRooms);
};

/**
 * Construye todos los pisos del edificio a partir de un array plano de rooms.
 * Cada room debe tener: { id, label, floor, x1, y1, x2, y2, color }
 * Retorna { floorGroups: Map<floor, Group>, roomMeshes: Map<roomId, Mesh> }
 */
export const buildBuildingFromData = (rooms) => {
  const floorGroups = new Map();
  const roomMeshes = new Map();

  // Asegurarse de que los 4 pisos existen (losa siempre visible)
  for (const floor of [0, 1, 2, 3]) {
    const group = new THREE.Group();
    group.name = `floor_${floor}`;
    group.add(createSlab(floor));
    group.add(createCorridorLines(floor));
    // Muros perimetrales exteriores — dan volumen estructural al edificio.
    // Cada muro vive dentro del floorGroup para heredar group.visible en
    // setViewLevel; la visibilidad en nivel 'area' se gestiona explícitamente
    // (userData.isWall) para ocultarlos cuando se enfoca un área.
    group.add(createPerimeterWalls(floor));
    floorGroups.set(floor, group);
  }

  for (const room of rooms) {
    const group = floorGroups.get(room.floor);
    if (!group) continue;
    const mesh = createRoomMesh(room);
    group.add(mesh);
    roomMeshes.set(room.id, mesh);
  }

  return { floorGroups, roomMeshes };
};

/**
 * Destruye el mesh de un cuarto y lo reconstruye con nuevas coordenadas.
 * Útil para actualizaciones de geometría en tiempo real vía postMessage.
 *
 * @param {object}  params
 * @param {string}  params.areaId
 * @param {number}  params.gridX1
 * @param {number}  params.gridY1
 * @param {number}  params.gridX2
 * @param {number}  params.gridY2
 * @param {number}  params.floor
 * @param {Map}     params.roomMeshes  — mapa roomId → Mesh (se muta in-place)
 * @param {Map}     params.floorGroups — mapa floor → Group
 * @param {object}  params.roomMap     — ROOM_MAP en memoria (se muta in-place)
 * @param {number}  [params.color]     — color hex del nuevo mesh (usa el original si omite)
 */
export const rebuildRoomGeometry = ({
  areaId,
  gridX1,
  gridY1,
  gridX2,
  gridY2,
  floor,
  roomMeshes,
  floorGroups,
  roomMap,
  color,
}) => {
  const oldMesh = roomMeshes.get(areaId);
  const existingRoom = roomMap[areaId];

  // Determinar color: prioridad color param → baseColor del mesh → color del roomMap → gris
  const resolvedColor = color ?? oldMesh?.userData?.baseColor ?? existingRoom?.color ?? 0x78909c;

  const label = oldMesh?.userData?.label ?? existingRoom?.label ?? areaId;

  // Destruir mesh viejo
  if (oldMesh) {
    const parent = oldMesh.parent;
    if (parent) parent.remove(oldMesh);
    oldMesh.geometry?.dispose();
    if (Array.isArray(oldMesh.material)) {
      oldMesh.material.forEach((m) => m.dispose());
    } else {
      oldMesh.material?.dispose();
    }
    roomMeshes.delete(areaId);
  }

  const newRoom = {
    id: areaId,
    label,
    floor,
    x1: gridX1,
    y1: gridY1,
    x2: gridX2,
    y2: gridY2,
    color: resolvedColor,
  };

  const newMesh = createRoomMesh(newRoom);

  // Agregar al grupo del piso correcto
  const group = floorGroups.get(floor);
  if (group) group.add(newMesh);

  roomMeshes.set(areaId, newMesh);

  // Actualizar roomMap en memoria
  if (roomMap[areaId]) {
    Object.assign(roomMap[areaId], {
      x1: gridX1,
      y1: gridY1,
      x2: gridX2,
      y2: gridY2,
      floor,
      color: resolvedColor,
    });
  }

  return newMesh;
};

/**
 * Devuelve todos los meshes clickeables (sin losas).
 */
export const getClickableMeshes = (roomMeshes) => [...roomMeshes.values()];

/**
 * Ajusta la opacidad/visibilidad de cada piso según el piso activo.
 * activeFloor = -1 → todos visibles.
 */
export const setFloorVisibility = (floorGroups, activeFloor) => {
  for (const [floor, group] of floorGroups) {
    const isActive = activeFloor === -1 || floor === activeFloor;
    group.traverse((obj) => {
      // Las líneas de borde gestionan su propia opacidad fija; no las atenúes
      // a 1.0 (perderían su sutileza) y no son meshes.
      if (obj.userData?.isEdge) {
        obj.material.opacity = isActive ? (obj.material.userData?.baseOpacity ?? 0.45) : 0.08;
        return;
      }
      if (obj.isMesh) {
        // Restaurar a la opacidad base del material (vidrio 0.42, losa 1.0)
        // en vez de forzar 1.0, que volvería sólido el acrílico de las áreas.
        const base = obj.userData?.baseOpacity ?? 1;
        obj.material.opacity = isActive ? base : Math.min(base, 0.1);
        obj.material.transparent = isActive ? base < 1 : true;
        obj.renderOrder = isActive ? 1 : 0;
      }
    });
  }
};

/**
 * Crea el mesh del conector entre las dos alas del edificio.
 * El conector es estático (no viene de la API) y aparece en todos los pisos.
 * gridX1=14, gridY1=7, gridX2=18, gridY2=20
 */
export const createConnectorMesh = (floor) => {
  const { w, d, px, pz } = gridToScene(14, 7, 18, 20);
  const yBase = FLOOR_Y(floor);

  const geo = new THREE.BoxGeometry(w - WALL_T, ROOM_H, d - WALL_T);
  const mat = createRoomMaterial(0xb0bec5);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, yBase + ROOM_H / 2, pz);
  mesh.userData = {
    isConnector: true,
    label: "Conector",
    floor,
    baseOpacity: ROOM_BASE_OPACITY,
  };

  // Borde sutil igual que createRoomMesh
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x5b7390, transparent: true, opacity: 0.45 }),
  );
  line.userData = { isEdge: true };
  mesh.add(line);

  return mesh;
};

/**
 * Crea la huella tenue del edificio en el suelo para anclar visualmente el volumen.
 * Sin sombras — shadowMap está deshabilitado en el visor.
 * Devuelve un Group con userData.isFootprint.
 */
export const createBuildingFootprint = () => {
  const group = new THREE.Group();
  group.userData = { isFootprint: true };

  // Huella tenue del edificio para definir el perímetro en el suelo.
  const fp = new THREE.Mesh(
    new THREE.PlaneGeometry(32 * CELL, 27 * CELL),
    new THREE.MeshStandardMaterial({
      color: 0x9fb0c0,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.12,
    }),
  );
  fp.rotation.x = -Math.PI / 2;
  fp.position.y = -0.04;
  group.add(fp);

  return group;
};

// ── Opacidades para cada nivel de zoom ───────────────────────────────────────
// Valores calibrados para la maqueta arquitectónica:
//   BUILDING → solo losas, sin ruido de áreas.
//   FLOOR    → contornos de áreas del piso activo; cuerpo casi invisible.
//   AREA     → un área destacada, resto del piso atenuado al mínimo.
const OPA = {
  // Losa principal del piso activo / único piso relevante
  SLAB_FULL: 1,
  // Losa de pisos no activos (edificio completo o contexto)
  SLAB_DIM: 0.12,
  // Borde de área en modo FLOOR (contorno fuerte, cuerpo transparente)
  AREA_FLOOR_EDGE: 0.7,
  AREA_FLOOR_BOX: 0.06,
  // Borde e interiores del área enfocada en modo AREA (usa baseOpacity)
  AREA_FOCUSED_EDGE: 0.45,
  // Áreas no enfocadas del mismo piso (modo AREA)
  AREA_DIM_EDGE: 0.15,
  AREA_DIM_BOX: 0.05,
  // Pasillo (isEdge dashed) cuando el piso está activo
  CORRIDOR_ACTIVE: 0.55,
};

// ── Muros perimetrales exteriores ────────────────────────────────────────────

/**
 * Grosor del muro perimetral (≈12 cm estructural, fino para no tapar interior).
 */
const WALL_THICK = 0.12;

/**
 * Altura útil del muro — techo del cuarto, sin llegar a la losa superior.
 */
const WALL_H = ROOM_H; // 3.4 u

/**
 * Alféizar de ventana: 1.40 m del suelo del piso.
 */
const WIN_SILL = 1.4;

/**
 * Dimensiones de ventana (ancho × alto) en metros/unidades Three.js.
 */
const WIN_W = 0.7;
const WIN_H = 0.7;

/**
 * Separación centro-a-centro entre ventanas a lo largo de cada tramo.
 * Se ajusta dinámicamente para distribuir de forma equidistante.
 */
const WIN_SPACING = 1.8;

/**
 * Material compartido para todos los muros perimetrales — acrílico gris
 * azulado muy tenue, coherente con el vocabulario de la maqueta.
 * opacity 0.22 → no tapa el interior desde ningún ángulo.
 */
const _wallMat = new THREE.MeshPhysicalMaterial({
  color: 0x8fa8c0,
  roughness: 0.3,
  metalness: 0.0,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  clearcoat: 0.5,
  clearcoatRoughness: 0.3,
  envMapIntensity: 0.6,
});

/**
 * Material compartido para los paneles de ventana — vidrio ligeramente
 * más claro y con emisivo azulado que los distingue del muro.
 */
const _winMat = new THREE.MeshPhysicalMaterial({
  color: 0xb8d8f0,
  roughness: 0.1,
  metalness: 0.0,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  envMapIntensity: 1.0,
  emissive: new THREE.Color(0x2255aa),
  emissiveIntensity: 0.04,
});

/**
 * Material de borde de muro — línea suave, ligeramente más oscura que el muro.
 */
const _wallEdgeMat = new THREE.LineBasicMaterial({
  color: 0x4a6880,
  transparent: true,
  opacity: 0.35,
});

/**
 * Geometría de ventana reutilizable (panel plano, sin grosor propio —
 * se desplaza al centro del muro para parecer empotrada).
 */
const _winGeo = new THREE.PlaneGeometry(WIN_W, WIN_H);

/**
 * Crea un tramo de muro recto con ventanas distribuidas uniformemente.
 *
 * @param {THREE.Vector3} from   — inicio del tramo (world XZ, Y = base del piso)
 * @param {THREE.Vector3} to     — fin del tramo
 * @param {'x'|'z'}       axis   — eje de extensión del tramo
 * @param {number}        yBase  — Y en la base del piso (FLOOR_Y(floor))
 * @returns {THREE.Group}
 */
const createWallSegment = (from, to, axis, yBase) => {
  const group = new THREE.Group();

  // Longitud del tramo y centro.
  const len = Math.abs(axis === "x" ? to.x - from.x : to.z - from.z);
  const cx = (from.x + to.x) / 2;
  const cz = (from.z + to.z) / 2;
  const cy = yBase + WALL_H / 2;

  // ── Panel de muro ──────────────────────────────────────────────────────────
  const wallGeo =
    axis === "x"
      ? new THREE.BoxGeometry(len, WALL_H, WALL_THICK)
      : new THREE.BoxGeometry(WALL_THICK, WALL_H, len);

  const wallMesh = new THREE.Mesh(wallGeo, _wallMat);
  wallMesh.position.set(cx, cy, cz);
  wallMesh.castShadow = false;
  wallMesh.receiveShadow = false;
  wallMesh.userData = { isWallPanel: true };
  group.add(wallMesh);

  // Borde perimetral del tramo de muro.
  const edgeGeo = new THREE.EdgesGeometry(wallGeo);
  const edgeLine = new THREE.LineSegments(edgeGeo, _wallEdgeMat);
  edgeLine.position.set(cx, cy, cz);
  edgeLine.userData = { isEdge: true };
  group.add(edgeLine);

  // ── Ventanas ───────────────────────────────────────────────────────────────
  // Número de ventanas que caben con spacing WIN_SPACING (al menos 1 si el
  // tramo es suficientemente largo).
  const nWin = len >= WIN_W + 0.4 ? Math.max(1, Math.floor(len / WIN_SPACING)) : 0;

  if (nWin > 0) {
    // Posición Y central del panel de ventana: alféizar + mitad de la ventana.
    const winY = yBase + WIN_SILL + WIN_H / 2;

    // Separación efectiva centrada en el tramo.
    const step = len / nWin;
    const startOffset = -(len / 2) + step / 2;

    for (let i = 0; i < nWin; i++) {
      const offset = startOffset + i * step;

      // Panel de ventana — plano fino desplazado al frente del muro.
      const winMesh = new THREE.Mesh(_winGeo, _winMat);
      if (axis === "x") {
        winMesh.position.set(cx + offset, winY, cz);
        // La ventana queda coplanar con la cara frontal del muro; si el muro
        // está en Z se rota 90° para mirar en Z, pero como PlaneGeometry mira
        // en Y, giramos siempre para orientar al exterior (±Z o ±X).
        // Para eje X el panel ya mira en Z (normal Z); sin rotación.
      } else {
        winMesh.position.set(cx, winY, cz + offset);
        // Para eje Z necesitamos rotar 90° alrededor de Y para que la cara
        // del panel mire en X en vez de Z.
        winMesh.rotation.y = Math.PI / 2;
      }
      winMesh.userData = { isWindowPanel: true };
      group.add(winMesh);
    }
  }

  return group;
};

/**
 * Construye el conjunto de muros perimetrales exteriores para un piso.
 *
 * Polígono de la U derivado de las coordenadas de las losas (world-space):
 *
 *   Ala izquierda : X [-16, -3]  Z [-13.5, +13.5]
 *   Ala derecha   : X [+3, +16]  Z [-13.5, +13.5]
 *   Conector      : X [-3, +3]   Z [-13.5, -2.5]
 *   Patio abierto : X [-3, +3]   Z [-2.5, +13.5]  ← sin losa, abierto al frente
 *
 * Se recorre el contorno EXTERIOR completo (incluye los lados del patio que
 * miran al vano abierto, pues también son exteriores con ventanas):
 *
 *   Frente ala izq   (Z+, X -16→-3)       eje X
 *   Frente patio izq (X=-3, Z -2.5→+13.5) eje Z  ← cara interior del patio
 *   Frente patio dch (X=+3, Z +13.5→-2.5) eje Z  ← cara interior del patio
 *   Frente ala dch   (Z+, X +3→+16)        eje X
 *   Lado dch exterior (X=+16, Z +13.5→-13.5) eje Z
 *   Fondo dch   (Z-, X +16→+3)             eje X
 *   Fondo conector dch (X=+3, Z -2.5→-13.5) eje Z
 *   Fondo conector (Z=−13.5, X +3→-3)      eje X
 *   Fondo conector izq (X=-3, Z -13.5→-2.5) eje Z
 *   Fondo izq   (Z-, X -3→-16)             eje X
 *   Lado izq exterior (X=-16, Z -13.5→+13.5) eje Z
 *   (cierra en el punto de inicio)
 *
 * Retorna un THREE.Group con userData.isWall=true.
 *
 * @param {number} floor — índice de piso (0=PB, 1, 2, 3)
 * @returns {THREE.Group}
 */
export const createPerimeterWalls = (floor) => {
  const group = new THREE.Group();
  group.name = `walls_floor_${floor}`;
  group.userData = { isWall: true };

  const yBase = FLOOR_Y(floor);

  // Definición de tramos: [from, to, eje].
  // Cada punto es { x, z } en coordenadas world.
  // Los tramos cubren el perímetro EXTERIOR completo de la U,
  // incluyendo las caras que dan al patio (vano frontal abierto).
  const SEGS = [
    // Frente del ala izquierda (Z = +13.5, de X=-16 a X=-3)
    { x1: -16, z1: 13.5, x2: -3, z2: 13.5, axis: "x" },
    // Cara izquierda del vano del patio (X = -3, de Z=-2.5 a Z=+13.5)
    { x1: -3, z1: -2.5, x2: -3, z2: 13.5, axis: "z" },
    // Cara derecha del vano del patio (X = +3, de Z=+13.5 a Z=-2.5)
    { x1: 3, z1: 13.5, x2: 3, z2: -2.5, axis: "z" },
    // Frente del conector (Z = -2.5, de X=-3 a X=+3) — cierra el fondo del patio
    { x1: -3, z1: -2.5, x2: 3, z2: -2.5, axis: "x" },
    // Frente del ala derecha (Z = +13.5, de X=+3 a X=+16)
    { x1: 3, z1: 13.5, x2: 16, z2: 13.5, axis: "x" },
    // Lado exterior derecho (X = +16, de Z=+13.5 a Z=-13.5)
    { x1: 16, z1: 13.5, x2: 16, z2: -13.5, axis: "z" },
    // Fondo ala derecha (Z = -13.5, de X=+16 a X=+3)
    { x1: 16, z1: -13.5, x2: 3, z2: -13.5, axis: "x" },
    // Lado interior derecho del conector (X = +3, de Z=-2.5 a Z=-13.5)
    { x1: 3, z1: -2.5, x2: 3, z2: -13.5, axis: "z" },
    // Fondo del conector (Z = -13.5, de X=+3 a X=-3) — cierra el fondo del conector
    { x1: 3, z1: -13.5, x2: -3, z2: -13.5, axis: "x" },
    // Lado interior izquierdo del conector (X = -3, de Z=-13.5 a Z=-2.5)
    { x1: -3, z1: -13.5, x2: -3, z2: -2.5, axis: "z" },
    // Fondo ala izquierda (Z = -13.5, de X=-3 a X=-16)
    { x1: -3, z1: -13.5, x2: -16, z2: -13.5, axis: "x" },
    // Lado exterior izquierdo (X = -16, de Z=-13.5 a Z=+13.5)
    { x1: -16, z1: -13.5, x2: -16, z2: 13.5, axis: "z" },
  ];

  for (const seg of SEGS) {
    const from = new THREE.Vector3(seg.x1, yBase, seg.z1);
    const to = new THREE.Vector3(seg.x2, yBase, seg.z2);
    const segGroup = createWallSegment(from, to, seg.axis, yBase);
    group.add(segGroup);
  }

  return group;
};

/**
 * Ajusta la visibilidad y opacidad de la escena según el nivel de zoom semántico.
 *
 * @param {Map<number, THREE.Group>} floorGroups  — mapa floor → Group del edificio
 * @param {Map<string, THREE.Mesh>}  roomMeshes   — mapa roomId → Mesh de área
 * @param {'building'|'floor'|'area'} level       — nivel de detalle
 * @param {{ activeFloor?: number, focusedAreaId?: string }} [opts]
 */
export const setViewLevel = (floorGroups, roomMeshes, level, opts = {}) => {
  const { activeFloor = -1, focusedAreaId = null } = opts;

  for (const [floor, group] of floorGroups) {
    const isActiveFloor = activeFloor === -1 || floor === activeFloor;

    // Modos floor/area: pisos no activos completamente ocultos (group.visible=false
    // es más barato que recorrer todo el contenido y atenuar objeto por objeto).
    // En modo building se restauran todos a visible=true.
    if (level === "building") {
      group.visible = true;
    } else {
      group.visible = isActiveFloor;
      // Si el grupo queda oculto no hay nada más que procesar en él.
      if (!isActiveFloor) continue;
    }

    group.traverse((obj) => {
      // ── Muros perimetrales ─────────────────────────────────────────────────
      // El Group raíz (isWall) y sus hijos directos (isWallPanel, isWindowPanel,
      // isEdge dentro del muro) se gestionan juntos aquí.
      // - building / floor → visible (dan estructura al volumen)
      // - area             → ocultos para no estorbar la vista del área enfocada
      //
      // Detectar si este objeto pertenece a un grupo isWall (el propio grupo o
      // un hijo de él) subiendo por la cadena de padres hasta el floorGroup.
      {
        let _ancestor = obj;
        let _inWall = false;
        while (_ancestor && _ancestor !== group) {
          if (_ancestor.userData?.isWall) {
            _inWall = true;
            break;
          }
          _ancestor = _ancestor.parent;
        }
        if (_inWall) {
          obj.visible = level !== "area";
          return;
        }
      }

      // ── Losa ──────────────────────────────────────────────────────────────
      if (obj.userData?.isSlab) {
        obj.visible = true;
        if (level === "building") {
          // Vista general: todas las losas a opacidad completa
          obj.material.opacity = OPA.SLAB_FULL;
          obj.material.transparent = false;
          obj.renderOrder = 0;
        } else {
          // Modos floor / area: solo el piso activo llega aquí (los demás ya
          // quedaron ocultos por group.visible = false arriba).
          obj.material.opacity = OPA.SLAB_FULL;
          obj.material.transparent = false;
          obj.renderOrder = 0;
        }
        return;
      }

      // ── Pasillo (isEdge dashed, hijo directo del group de piso, no de un área)
      // Discriminador: el padre NO tiene roomId (no es un room mesh).
      if (obj.userData?.isEdge && !obj.parent?.userData?.roomId) {
        // Pasillos y bordes de losa: solo visibles en floor / area del piso activo
        if (level === "building") {
          obj.visible = false;
        } else {
          // El grupo ya está visible (isActiveFloor=true), mostrar pasillo
          obj.visible = true;
          if (obj.material) {
            obj.material.opacity = obj.material.userData?.baseOpacity ?? OPA.CORRIDOR_ACTIVE;
          }
        }
        return;
      }

      // ── Borde de área (isEdge hijo de un room mesh) ───────────────────────
      // Se gestiona dentro del bloque roomId de abajo a través de obj.traverse,
      // así que saltar aquí para evitar doble procesamiento.
      if (obj.userData?.isEdge && obj.parent?.userData?.roomId) {
        return;
      }

      // ── Mesh de área ──────────────────────────────────────────────────────
      if (obj.isMesh && obj.userData?.roomId) {
        // En floor/area solo llegamos aquí si isActiveFloor=true (el continue
        // de arriba descarta grupos de pisos no activos antes de traverse).
        const isFocused = focusedAreaId && obj.userData.roomId === focusedAreaId;

        if (level === "building") {
          // Vista edificio: áreas ocultas
          obj.visible = false;
          obj.traverse((child) => {
            if (child.userData?.isEdge) child.visible = false;
          });
          return;
        }

        if (level === "floor") {
          // Piso activo: cuerpo casi transparente (delimitador), borde fuerte
          obj.visible = true;
          obj.material.opacity = OPA.AREA_FLOOR_BOX;
          obj.material.transparent = true;
          obj.renderOrder = 1;
          obj.traverse((child) => {
            if (!child.userData?.isEdge) return;
            child.visible = true;
            child.material.opacity = OPA.AREA_FLOOR_EDGE;
          });
          return;
        }

        if (level === "area") {
          if (isFocused) {
            // Área enfocada: vidrio normal
            obj.visible = true;
            obj.material.opacity = obj.userData.baseOpacity ?? ROOM_BASE_OPACITY;
            obj.material.transparent = true;
            obj.renderOrder = 1;
            obj.traverse((child) => {
              if (!child.userData?.isEdge) return;
              child.visible = true;
              child.material.opacity = OPA.AREA_FOCUSED_EDGE;
            });
          } else {
            // Resto del piso: muy atenuado
            obj.visible = true;
            obj.material.opacity = OPA.AREA_DIM_BOX;
            obj.material.transparent = true;
            obj.renderOrder = 0;
            obj.traverse((child) => {
              if (!child.userData?.isEdge) return;
              child.visible = true;
              child.material.opacity = OPA.AREA_DIM_EDGE;
            });
          }
          return;
        }
      }
    });
  }
};

/**
 * Actualiza el color de un mesh de cuarto para mostrar estado de ticket.
 */
export const setRoomTicketState = (mesh, state) => {
  if (!mesh) return;
  const color =
    state === "activo"
      ? AREA_COLORS.ticket_activo
      : state === "asignado"
        ? AREA_COLORS.ticket_asignado
        : mesh.userData.baseColor;
  mesh.material.color.setHex(color);
};

// ════════════════════════════════════════════════════════════
// ESTILO HOLOGRÁFICO (tema oscuro) — recorre la escena y
// ajusta opacidades y colores emisivos para dar look de
// proyección holográfica. En tema claro restaura los valores
// base guardados en userData.
// ════════════════════════════════════════════════════════════

/**
 * Color guinda/rosa de las aristas en modo holograma.
 * Coincide con la paleta institucional del sistema (guinda #9d2449 → rosa #c44e71).
 * El emissive alto hace que UnrealBloomPass las capture y genere halo.
 */
const HOLO_EDGE_COLOR = new THREE.Color(0xc44e71);
const HOLO_EDGE_COLOR_HEX = 0xc44e71;

/**
 * Guarda en userData los valores originales de un material de línea
 * para poder restaurarlos al volver a tema claro.
 * Solo guarda si aún no se ha guardado (idempotente).
 *
 * @param {THREE.Material} mat
 */
const _guardarBaseLinea = (mat) => {
  if (mat.userData._holoBaseColor !== undefined) return;
  mat.userData._holoBaseColor = mat.color.getHex();
  mat.userData._holoBaseOpacity = mat.opacity;
};

/**
 * Guarda en userData los valores originales de un MeshMaterial (losa/área/muro).
 *
 * @param {THREE.Material} mat
 */
const _guardarBaseMesh = (mat) => {
  if (mat.userData._holoBaseOpacity !== undefined) return;
  mat.userData._holoBaseOpacity = mat.opacity;
  mat.userData._holoBaseTransparent = mat.transparent;
  mat.userData._holoBaseEmissive = mat.emissive ? mat.emissive.getHex() : 0x000000;
  mat.userData._holoBaseEmissiveIntensity = mat.emissiveIntensity ?? 0;
};

/**
 * Restaura los valores base de un material de línea desde userData.
 *
 * @param {THREE.Material} mat
 */
const _restaurarLinea = (mat) => {
  if (mat.userData._holoBaseColor === undefined) return;
  mat.color.setHex(mat.userData._holoBaseColor);
  mat.opacity = mat.userData._holoBaseOpacity;
  mat.needsUpdate = true;
};

/**
 * Restaura los valores base de un MeshMaterial desde userData.
 *
 * @param {THREE.Material} mat
 */
const _restaurarMesh = (mat) => {
  if (mat.userData._holoBaseOpacity === undefined) return;
  mat.opacity = mat.userData._holoBaseOpacity;
  mat.transparent = mat.userData._holoBaseTransparent;
  if (mat.emissive) mat.emissive.setHex(mat.userData._holoBaseEmissive);
  mat.emissiveIntensity = mat.userData._holoBaseEmissiveIntensity;
  mat.needsUpdate = true;
};

/**
 * Aplica o quita el estilo holográfico en toda la escena.
 *
 * En modo holograma (enabled=true):
 *   - Aristas (isEdge) de losas, áreas y muros → color guinda emisivo brillante,
 *     opacity 0.95. El UnrealBloomPass las detecta y genera halo.
 *   - Losas (isSlab) → casi etéreas, opacity 0.10 + leve emissive guinda.
 *   - Áreas (roomId) → opacity muy baja 0.06 + emissive guinda tenue.
 *   - Muros (isWall*) → opacity 0.08 + emissive tenue.
 *   - Ventanas (isWindowPanel) → emissive azul más fuerte (puntos que brillan).
 *   - Huella del suelo (isFootprint) → casi invisible.
 *
 * En modo claro (enabled=false) restaura todos los valores base guardados.
 *
 * IMPORTANTE: esta función NO toca las opacidades que gestiona setViewLevel.
 * setViewLevel recorre la escena DESPUÉS de applyHologramStyle y sobrescribe
 * opacity según el nivel (building/floor/area). Para que el holograma persista
 * en cada nivel, los valores emisivos y de color SE QUEDAN en el material;
 * solo la opacity la gestiona setViewLevel (que ya respeta baseOpacity).
 * La solución: guardar los valores emisivos/color en el material directamente
 * (no en baseOpacity, que setViewLevel usa para restaurar vidrio).
 *
 * @param {THREE.Scene} scene
 * @param {boolean}     enabled — true = holograma, false = look claro
 */
export const applyHologramStyle = (scene, enabled) => {
  scene.traverse((obj) => {
    // ── Aristas (LineSegments / Line) ──────────────────────────────────────
    // Aplica a bordes de losas, áreas y muros perimetrales.
    if (obj.userData?.isEdge && obj.material) {
      if (enabled) {
        _guardarBaseLinea(obj.material);
        obj.material.color.setHex(HOLO_EDGE_COLOR_HEX);
        obj.material.opacity = 0.95;
        obj.material.needsUpdate = true;
      } else {
        _restaurarLinea(obj.material);
      }
      return;
    }

    if (!obj.isMesh || !obj.material) return;

    // ── Paneles de ventana ─────────────────────────────────────────────────
    if (obj.userData?.isWindowPanel) {
      if (enabled) {
        _guardarBaseMesh(obj.material);
        if (obj.material.emissive) obj.material.emissive.setHex(0x2288ff);
        obj.material.emissiveIntensity = 0.6;
        obj.material.opacity = 0.55;
        obj.material.needsUpdate = true;
      } else {
        _restaurarMesh(obj.material);
      }
      return;
    }

    // ── Paneles de muro ────────────────────────────────────────────────────
    if (obj.userData?.isWallPanel) {
      if (enabled) {
        _guardarBaseMesh(obj.material);
        obj.material.opacity = 0.08;
        obj.material.transparent = true;
        if (obj.material.emissive) obj.material.emissive.setHex(0xc44e71);
        obj.material.emissiveIntensity = 0.04;
        obj.material.needsUpdate = true;
      } else {
        _restaurarMesh(obj.material);
      }
      return;
    }

    // ── Losas (isSlab) ─────────────────────────────────────────────────────
    if (obj.userData?.isSlab) {
      if (enabled) {
        _guardarBaseMesh(obj.material);
        obj.material.opacity = 0.1;
        obj.material.transparent = true;
        // emissive solo si el material lo soporta (MeshStandard lo tiene)
        if (obj.material.emissive) obj.material.emissive.setHex(0x9d2449);
        obj.material.emissiveIntensity = 0.12;
        obj.material.needsUpdate = true;
      } else {
        // Restaurar: opaco de nuevo, sin emissive
        _restaurarMesh(obj.material);
        // setViewLevel asigna transparent=false para losas — aquí simplemente
        // restauramos los valores originales; setViewLevel hará lo suyo.
        obj.material.needsUpdate = true;
      }
      return;
    }

    // ── Meshes de área (roomId) ────────────────────────────────────────────
    if (obj.userData?.roomId) {
      if (enabled) {
        _guardarBaseMesh(obj.material);
        // Cuerpo muy etéreo — las aristas (hijos isEdge) son lo que brilla
        obj.material.opacity = 0.06;
        obj.material.transparent = true;
        if (obj.material.emissive) obj.material.emissive.setHex(0xc44e71);
        obj.material.emissiveIntensity = 0.08;
        obj.material.needsUpdate = true;
      } else {
        _restaurarMesh(obj.material);
        obj.material.needsUpdate = true;
      }
      return;
    }

    // ── Huella del suelo (ShadowMaterial / MeshStandard de footprint) ──────
    if (obj.parent?.userData?.isFootprint) {
      if (enabled) {
        _guardarBaseMesh(obj.material);
        obj.material.opacity = Math.min(
          (obj.material.userData._holoBaseOpacity ?? 0.12) * 0.3,
          0.04,
        );
        obj.material.transparent = true;
        obj.material.needsUpdate = true;
      } else {
        _restaurarMesh(obj.material);
      }
    }
  });
};

/**
 * Crea la rejilla holográfica en el plano del suelo.
 * Solo visible en tema oscuro — en tema claro se oculta.
 * Líneas guinda muy sutiles que con el bloom dan sensación de
 * rejilla de proyección holográfica.
 *
 * Se añade a la escena una sola vez; la visibilidad la gestiona
 * setHoloGridVisible().
 *
 * @param {THREE.Scene} scene
 * @returns {THREE.Group} grupo del grid (para guardar referencia y ocultar/mostrar)
 */
export const createHoloGrid = (scene) => {
  const group = new THREE.Group();
  group.name = "holo_grid";
  group.userData = { isHoloGrid: true };

  // Dimensiones: cubre el footprint del edificio (32×27 celdas).
  // Espaciado de líneas cada 4 celdas para que sea sutil, no ruidoso.
  const W = 32;
  const D = 27;
  const STEP = 4;
  const Y = -0.02; // justo bajo la losa de PB para evitar z-fighting

  const mat = new THREE.LineBasicMaterial({
    color: 0x9d2449, // guinda institucional — el bloom lo amplificará
    transparent: true,
    opacity: 0.18, // muy sutil; el bloom lo hace visible sin sobrecargarlo
  });

  const points = [];

  // Líneas paralelas al eje X (franjas en Z)
  for (let z = -Math.floor(D / 2); z <= Math.ceil(D / 2); z += STEP) {
    points.push(new THREE.Vector3(-W / 2, Y, z));
    points.push(new THREE.Vector3(W / 2, Y, z));
  }

  // Líneas paralelas al eje Z (franjas en X)
  for (let x = -Math.floor(W / 2); x <= Math.ceil(W / 2); x += STEP) {
    points.push(new THREE.Vector3(x, Y, -D / 2));
    points.push(new THREE.Vector3(x, Y, D / 2));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  // LineSegments dibuja pares de puntos consecutivos (sin conectar el final
  // de una línea con el inicio de la siguiente).
  const grid = new THREE.LineSegments(geo, mat);
  group.add(grid);

  group.visible = false; // inicia oculto; setHoloGridVisible lo activa
  scene.add(group);

  return group;
};

/**
 * Muestra u oculta la rejilla holográfica del suelo.
 *
 * @param {THREE.Group | null} gridGroup — referencia devuelta por createHoloGrid
 * @param {boolean}            visible
 */
export const setHoloGridVisible = (gridGroup, visible) => {
  if (gridGroup) gridGroup.visible = visible;
};
