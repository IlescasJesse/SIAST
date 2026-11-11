import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FLOOR_Y } from "./building.js";

// Centro de la cuadrícula global (igual que building.js / furniture.js)
const CX = 16;
const CY = 13.5;
const CELL = 1;

// Todas las vistas miran el edificio desde el lado del FONDO (conector, −Z):
// en pantalla el patio queda arriba/al fondo y el conector abajo/al frente,
// igual que el minimapa 2D. LADO = −1 gira 180° cada posición de cámara.
const LADO = -1;

export const createCamera = (renderer) => {
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(50 * LADO, 40, 60 * LADO);
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
 * Anima la cámara hacia una vista isométrica consistente del piso indicado.
 *
 * Target: centro del piso en (0, FLOOR_Y+2, 0).
 * Posición: offset diagonal 45° en azimut y ~32° de elevación respecto al target.
 *   offset = (+34, +24, +34)  →  distancia ≈ 53.7 u (dentro de [minDist=10, maxDist=160]).
 *
 * El ángulo resultante permite leer la planta (32×27 u) con perspectiva isométrica
 * sin caer en vista cenital ni casi lateral.
 * Duración y easing cúbico idénticos a flyToBuilding / flyToArea.
 */
export const flyToFloor = (camera, controls, floor) => {
  // Centro del piso destino
  const lookY = FLOOR_Y(floor) + 2;
  const targetLook = new THREE.Vector3(0, lookY, 0);

  // Posición isométrica: diagonal 45°, elevación moderada
  const targetPos = new THREE.Vector3(
    34 * LADO, // X: offset diagonal
    lookY + 24, // Y: altura sobre el target (~32° de elevación)
    34 * LADO, // Z: offset diagonal simétrico al X
  );

  const duration = 600;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();

  const animate = (now) => {
    const t = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

/**
 * Aleja la cámara para mostrar el edificio completo (vista 'building').
 * Posición elevada que encuadra los 4 pisos con margen.
 */
export const flyToBuilding = (camera, controls) => {
  const targetPos = new THREE.Vector3(50 * LADO, 55, 65 * LADO);
  const targetLook = new THREE.Vector3(0, 6, 0);
  const duration = 700;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();

  const animate = (now) => {
    const t = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

/**
 * Acerca la cámara sobre el bounding center de un área para activar el LOD
 * de muebles y dar contexto visual del área enfocada.
 *
 * @param {THREE.Camera} camera
 * @param {OrbitControls} controls
 * @param {{ x1: number, y1: number, x2: number, y2: number, floor: number }} area
 *   Coordenadas de cuadrícula del área (vienen de liveRoomMap).
 */
export const flyToArea = (camera, controls, area) => {
  const { x1, y1, x2, y2, floor } = area;

  // Centro world-space del área (misma transformación que gridToScene en building.js)
  const worldX = ((x1 + x2) / 2 - CX) * CELL;
  const worldZ = -(((y1 + y2) / 2 - CY) * CELL);
  const worldY = FLOOR_Y(floor) + 2;

  // Distancia de visualización proporcional al tamaño del área (mínimo 14 u)
  const areaW = Math.abs(x2 - x1) * CELL;
  const areaD = Math.abs(y2 - y1) * CELL;
  const dist = Math.max(14, Math.max(areaW, areaD) * 1.8);

  const targetPos = new THREE.Vector3(
    worldX + dist * 0.6 * LADO,
    worldY + dist * 0.75,
    worldZ + dist * 0.6 * LADO,
  );
  const targetLook = new THREE.Vector3(worldX, worldY - 1, worldZ);
  const duration = 650;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();

  const animate = (now) => {
    const t = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

/**
 * Vista cenital (desde arriba, botón "Cenital" del editor de áreas).
 * Cámara casi vertical con un mínimo desplazamiento hacia −Z (lado del fondo):
 * así OrbitControls no queda en un ángulo indefinido y la planta se ve girada
 * 180°: frente/patio (fila 0) ARRIBA, conector/fondo ABAJO, columna 0 a la
 * derecha. Igual que el minimapa 2D (FloorPlanMobile).
 *
 * @param {number} floor  piso a encuadrar (-1 = edificio completo, se usa PB)
 * @param {{ x1:number, y1:number, x2:number, y2:number }} [area]  si se pasa,
 *   se centra sobre esa área en lugar de todo el piso
 */
export const flyToCenital = (camera, controls, floor, area = null) => {
  const lookY = FLOOR_Y(floor < 0 ? 0 : floor);
  let cx = 0;
  let cz = 0;
  // Altura para que quepan las 27 filas (+ margen) con el FOV vertical de 45°
  let span = 27 + 6;
  if (area) {
    cx = ((area.x1 + area.x2) / 2 - CX) * CELL;
    cz = -(((area.y1 + area.y2) / 2 - CY) * CELL);
    span = Math.max(14, Math.max(Math.abs(area.x2 - area.x1), Math.abs(area.y2 - area.y1)) * 2);
  }
  const h = span / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const targetPos = new THREE.Vector3(cx, lookY + h, cz + 0.01 * LADO);
  const targetLook = new THREE.Vector3(cx, lookY, cz);
  const duration = 600;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();

  const animate = (now) => {
    const t = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

/**
 * Ajusta los controles al modo de cámara: en cenital no se rota (solo
 * desplazar y zoom) para que la planta no se gire por accidente.
 */
export const setControlsMode = (controls, mode) => {
  const cenital = mode === "cenital";
  controls.enableRotate = !cenital;
  // En planta, arrastrar con clic izquierdo desplaza (no hay nada que rotar)
  controls.mouseButtons.LEFT = cenital ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  controls.touches.ONE = cenital ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
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
