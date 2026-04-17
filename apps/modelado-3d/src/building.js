import * as THREE from "three";
import { ROOMS, AREA_COLORS } from "./rooms.js";

const CELL = 1;         // 1 unidad Three.js = 1 celda del plano
const FLOOR_H = 4;      // altura por piso en unidades
const ROOM_H = 3.4;     // altura de cuarto (deja espacio para losa)
const WALL_T = 0.08;    // grosor de bordes

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
export const createRoomMesh = (room) => {
  const { w, d, px, pz } = gridToScene(room.x1, room.y1, room.x2, room.y2);
  const yBase = FLOOR_Y(room.floor);

  const geo = new THREE.BoxGeometry(w - WALL_T, ROOM_H, d - WALL_T);
  const mat = new THREE.MeshStandardMaterial({
    color: room.color,
    roughness: 0.7,
    metalness: 0.1,
    transparent: false,
    opacity: 1,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, yBase + ROOM_H / 2, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    roomId: room.id,
    floor: room.floor,
    label: room.label,
    x1: room.x1, y1: room.y1, x2: room.x2, y2: room.y2,
    baseColor: room.color,
  };

  // Borde/wireframe
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x7a90a8, transparent: true, opacity: 0.55 }),
  );
  mesh.add(line);

  return mesh;
};

/**
 * Crea la losa del piso (plataforma base de cada nivel).
 */
const createSlab = (floor) => {
  // Losa con la forma real del edificio (U-shape vista desde arriba):
  //   Ala izquierda : X de -16 a -2 (14 u), profundidad completa Z: -13.5 a +13.5
  //   Ala derecha   : X de  +2 a+16 (14 u), profundidad completa Z: -13.5 a +13.5
  //   Conector      : X de  -2 a  +2 ( 4 u), solo al fondo       Z: -13.5 a  -0.5
  // Así las losas NO cruzan el vano abierto entre las alas.
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc8d8e8,
    roughness: 0.85,
    metalness: 0.02,
  });
  const yPos = FLOOR_Y(floor) - 0.15;
  const group = new THREE.Group();

  const addSlab = (w, d, cx, cz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * CELL, 0.3, d * CELL), mat);
    mesh.position.set(cx, yPos, cz);
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  addSlab(14, 27, -9,   0);   // ala izquierda  (cx=-9,  cz=0)
  addSlab(14, 27,  9,   0);   // ala derecha    (cx=+9,  cz=0)
  addSlab( 4, 13,  0,  -7);   // conector fondo (cx=0,   cz=-7 → Z: -0.5 a -13.5)

  return group;
};

/**
 * Construye todos los pisos del edificio a partir de los datos de rooms.js (fallback).
 * Retorna { floorGroups: Map<floor, Group>, roomMeshes: Map<roomId, Mesh> }
 */
export const buildBuilding = () => {
  const floorData = [
    { key: "pb",     floor: 0 },
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
export const rebuildRoomGeometry = ({ areaId, gridX1, gridY1, gridX2, gridY2, floor, roomMeshes, floorGroups, roomMap, color }) => {
  const oldMesh = roomMeshes.get(areaId);
  const existingRoom = roomMap[areaId];

  // Determinar color: prioridad color param → baseColor del mesh → color del roomMap → gris
  const resolvedColor = color
    ?? oldMesh?.userData?.baseColor
    ?? existingRoom?.color
    ?? 0x78909c;

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
    Object.assign(roomMap[areaId], { x1: gridX1, y1: gridY1, x2: gridX2, y2: gridY2, floor, color: resolvedColor });
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
      if (obj.isMesh) {
        obj.material.opacity = isActive ? 1 : 0.12;
        obj.material.transparent = !isActive;
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
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, yBase + ROOM_H / 2, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    isConnector: true,
    label: "Conector",
    floor,
  };

  // Borde/wireframe igual que createRoomMesh
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x7a90a8, transparent: true, opacity: 0.55 }),
  );
  mesh.add(line);

  return mesh;
};

/**
 * Crea la huella/sombra del edificio como plano semitransparente en el suelo.
 * Cubre todo el footprint del edificio (32×27 grid).
 */
export const createBuildingFootprint = () => {
  const geo = new THREE.BoxGeometry(32 * CELL, 0.08, 27 * CELL);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x607d8b,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.15,
  });
  const footprint = new THREE.Mesh(geo, mat);
  footprint.position.set(0, -0.04, 0);
  footprint.receiveShadow = true;
  footprint.castShadow = false;
  footprint.userData = { isFootprint: true };
  return footprint;
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
