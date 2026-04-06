import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FLOOR_Y } from "./building.js";

export const createCamera = (renderer) => {
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(50, 40, 60);
  camera.lookAt(0, 6, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 160;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.target.set(0, 6, 0);

  return { camera, controls };
};

/**
 * Anima la cámara hacia el piso indicado.
 */
export const flyToFloor = (camera, controls, floor) => {
  const targetY = FLOOR_Y(floor) + 10;
  const duration = 600;
  const startY = camera.position.y;
  const startTargetY = controls.target.y;
  const endTargetY = FLOOR_Y(floor) + 2;
  const t0 = performance.now();

  const animate = (now) => {
    const t = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.y = startY + (targetY - startY) * ease;
    controls.target.y = startTargetY + (endTargetY - startTargetY) * ease;
    controls.update();
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

let _loginMode = false;
let _loginAngle = 0;

export const setLoginMode = (enabled) => {
  _loginMode = enabled;
};

export const updateLoginCamera = (camera, controls, delta) => {
  if (!_loginMode) return;
  _loginAngle += delta * 0.15;
  const r = 80;
  camera.position.set(Math.cos(_loginAngle) * r, 45, Math.sin(_loginAngle) * r);
  controls.target.set(0, 8, 0);
  camera.lookAt(controls.target);
};
