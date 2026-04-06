import * as THREE from "three";
import { FLOOR_Y } from "./building.js";

const _labels = new Map(); // roomId → { sprite, canvas }

const makeSprite = (text, floor) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(10,18,40,0.78)";
  ctx.roundRect(4, 4, 248, 56, 8);
  ctx.fill();

  ctx.font = "bold 18px Segoe UI, sans-serif";
  ctx.fillStyle = "#90cdf4";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32, 240);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(8, 2, 1);
  return { sprite, canvas };
};

export const addLabels = (scene, roomMeshes, rooms) => {
  for (const room of rooms) {
    const mesh = roomMeshes.get(room.id);
    if (!mesh) continue;

    const { sprite } = makeSprite(room.label, room.floor);
    const pos = mesh.position.clone();
    pos.y += 2.2;
    sprite.position.copy(pos);
    sprite.renderOrder = 10;
    scene.add(sprite);
    _labels.set(room.id, sprite);
  }
};

export const updateLabelVisibility = (camera, floorGroups, activeFloor) => {
  for (const [roomId, sprite] of _labels) {
    const floor = sprite.position.y > FLOOR_Y(3) ? 3
      : sprite.position.y > FLOOR_Y(2) ? 2
      : sprite.position.y > FLOOR_Y(1) ? 1 : 0;

    const isActive = activeFloor === -1 || floor === activeFloor;
    const dist = camera.position.distanceTo(sprite.position);
    sprite.visible = isActive && dist < 55;
  }
};
