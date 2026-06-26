import * as THREE from "three";
import { FLOOR_Y } from "./building.js";

const _labels = new Map(); // roomId → sprite

// Resolución interna del canvas — 4× para nitidez a baja distancia (HiDPI/zoom).
const LABEL_W = 1024;
const LABEL_H = 256;

const makeSprite = (text, floor) => {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = "rgba(10,18,40,0.82)";
  ctx.roundRect(8, 8, LABEL_W - 16, LABEL_H - 16, 20);
  ctx.fill();

  ctx.font = "bold 72px Segoe UI, sans-serif";
  ctx.fillStyle = "#e2f0fb";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, LABEL_W / 2, LABEL_H / 2, LABEL_W - 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8; // filtrado anisotrópico para lectura en ángulo
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(8, 2, 1);
  return { sprite, canvas };
};

const redrawSpriteText = (sprite, text) => {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = "rgba(10,18,40,0.82)";
  ctx.roundRect(8, 8, LABEL_W - 16, LABEL_H - 16, 20);
  ctx.fill();

  ctx.font = "bold 72px Segoe UI, sans-serif";
  ctx.fillStyle = "#e2f0fb";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, LABEL_W / 2, LABEL_H / 2, LABEL_W - 40);

  // Dispose old texture and replace
  if (sprite.material.map) sprite.material.map.dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  sprite.material.map = tex;
  sprite.material.needsUpdate = true;
};

export const addLabels = (scene, roomMeshes, rooms) => {
  for (const room of rooms) {
    const mesh = roomMeshes.get(room.id);
    if (!mesh) continue;

    const { sprite } = makeSprite(room.label, room.floor);
    const pos = mesh.position.clone();
    pos.y += 2.2;
    sprite.position.copy(pos);
    sprite.userData.roomId = room.id;
    sprite.renderOrder = 10;
    scene.add(sprite);
    _labels.set(room.id, sprite);
  }
};

/**
 * Actualiza el texto del sprite de etiqueta de un cuarto en tiempo real.
 * Si el sprite no existe aún (cuarto sin mesh cargado), la función retorna sin error.
 *
 * @param {string} roomId  - id del cuarto (mismo que en rooms.js, p.ej. 'n2_nominas')
 * @param {string} newLabel - texto nuevo a mostrar
 */
export const updateRoomLabel = (roomId, newLabel) => {
  const sprite = _labels.get(roomId);
  if (!sprite) {
    console.warn(`[labels] updateRoomLabel: sprite not found for roomId="${roomId}"`);
    return;
  }
  redrawSpriteText(sprite, newLabel);
};

/**
 * Crea (o actualiza) la etiqueta flotante de un cuarto.
 * Necesario cuando el mesh se crea dinámicamente desde la API
 * y aún no tiene sprite registrado.
 *
 * @param {THREE.Scene} scene
 * @param {string}      roomId
 * @param {string}      label
 * @param {THREE.Mesh}  mesh   — mesh ya agregado a la escena
 */
export const ensureRoomLabel = (scene, roomId, label, mesh) => {
  if (_labels.has(roomId)) {
    // Solo actualizar el texto
    redrawSpriteText(_labels.get(roomId), label);
    return;
  }
  const { sprite } = makeSprite(label, 0);
  const pos = mesh.position.clone();
  pos.y += 2.2;
  sprite.position.copy(pos);
  sprite.userData.roomId = roomId;
  sprite.renderOrder = 10;
  scene.add(sprite);
  _labels.set(roomId, sprite);
};

export const updateLabelVisibility = (camera, floorGroups, activeFloor) => {
  for (const [roomId, sprite] of _labels) {
    const floor =
      sprite.position.y > FLOOR_Y(3)
        ? 3
        : sprite.position.y > FLOOR_Y(2)
          ? 2
          : sprite.position.y > FLOOR_Y(1)
            ? 1
            : 0;

    const isActive = activeFloor === -1 || floor === activeFloor;
    const dist = camera.position.distanceTo(sprite.position);
    sprite.visible = isActive && dist < 55;
  }
};
