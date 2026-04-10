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
    transparent: true,
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
  const geo = new THREE.BoxGeometry(32 * CELL, 0.3, 27 * CELL);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc8d8e8,
    roughness: 0.85,
    metalness: 0.02,
    transparent: true,
    opacity: 1,
  });
  const slab = new THREE.Mesh(geo, mat);
  slab.position.set(0, FLOOR_Y(floor) - 0.15, 0);
  slab.receiveShadow = true;
  return slab;
};

/**
 * Construye todos los pisos del edificio.
 * Retorna { floorGroups: Map<floor, Group>, roomMeshes: Map<roomId, Mesh> }
 */
export const buildBuilding = () => {
  const floorGroups = new Map();
  const roomMeshes = new Map();

  const floorData = [
    { key: "pb",     floor: 0 },
    { key: "nivel1", floor: 1 },
    { key: "nivel2", floor: 2 },
    { key: "nivel3", floor: 3 },
  ];

  for (const { key, floor } of floorData) {
    const group = new THREE.Group();
    group.name = `floor_${floor}`;

    // Losa
    group.add(createSlab(floor));

    // Cuartos
    for (const room of ROOMS[key] ?? []) {
      const mesh = createRoomMesh(room);
      group.add(mesh);
      roomMeshes.set(room.id, mesh);
    }

    floorGroups.set(floor, group);
  }

  return { floorGroups, roomMeshes };
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
