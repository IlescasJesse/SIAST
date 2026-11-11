import * as THREE from "three";
import { ROOM_BASE_OPACITY } from "./building.js";

// ============================================================
// ÁREA LEVANTADA — señala "aquí es" en solicitudes (nueva y detalle).
// · El volumen sube con un leve rebote y luego flota suave arriba/abajo.
// · Sincronizado con la altura: arriba se aclara (mismo tono), abajo se
//   oscurece; su sombra en el piso crece y se difumina al subir, y se
//   encoge y marca al bajar (como una sombra real).
// · La sombra usa el tono oscuro del área, para que se lea como sombra.
// · Siempre a opacidad normal aunque el nivel de vista atenúe las demás.
// ============================================================

const RAISE_H = 1.4; // cuánto sube (unidades = celdas)
const START_DELAY = 60; // ms — inmediato
const FOOTPRINT_FADE = 350; // ms — aparición de la huella en el piso
const DURATION = 1100; // ms — subida
const FOOTPRINT_OPACITY = 0.38;

const BOB_AMP = 0.16; // flotación: recorre 2·amp hacia abajo desde lo alto
const BOB_SPEED = 1.6; // rad/s (~4 s por ciclo)
const TONO_CLARO = 0.14; // + luminosidad (HSL) arriba
const TONO_OSCURO = -0.1; // − luminosidad (HSL) abajo
const SATURACION_EXTRA = 0.22; // + saturación (HSL) del área levantada
const SOMBRA_CRECE = 0.08; // la sombra crece hasta 8 % al estar arriba
const SOMBRA_ATENUA = 0.35; // y se aclara hasta 35 % (se difumina)

let _raised = null;
// { mesh, baseY, footprint, t0, onFrame, claro: Color, oscuro: Color, base: Color }

/** Ease-out con rebote leve (easeOutBack suavizado). */
const easeOutBack = (t) => {
  const c1 = 0.9; // rebote apenas perceptible
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const crearHuella = (mesh) => {
  const color = new THREE.Color(mesh.userData.baseColor ?? 0x9d2449).offsetHSL(0, 0, -0.15);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  // Misma geometría del área (sirve también para polígonos), aplastada al piso
  // (copia propia: el editor puede reemplazar la geometría del área)
  const huella = new THREE.Mesh(mesh.geometry.clone(), mat);
  huella.scale.set(1, 0.01, 1);
  huella.position.copy(mesh.position);
  mesh.geometry.computeBoundingBox();
  const minY = mesh.geometry.boundingBox.min.y;
  huella.position.y = mesh.position.y + minY + 0.03;
  huella.renderOrder = 0;
  huella.userData = { isRaiseFootprint: true };
  return huella;
};

/**
 * Baja el área levantada (si hay), le devuelve su color y quita su huella.
 */
export const lowerRaised = () => {
  if (!_raised) return;
  const { mesh, baseY, footprint, base } = _raised;
  mesh.position.y = baseY;
  mesh.material.color.copy(base);
  mesh.material.emissive?.setHex(0x000000);
  footprint.parent?.remove(footprint);
  footprint.geometry.dispose();
  footprint.material.dispose();
  _raised = null;
};

/**
 * Levanta un área. La animación avanza con updateRaised() en el loop de render.
 * @param {THREE.Mesh} mesh  mesh del área
 * @param {(mesh: THREE.Mesh) => void} onFrame  se llama cada frame (reanclar
 *   la etiqueta al área mientras se mueve)
 */
export const raiseRoom = (mesh, onFrame) => {
  if (!mesh) return;
  if (_raised?.mesh === mesh) {
    applyRaisedStyle();
    return;
  }
  lowerRaised();

  const base = new THREE.Color(mesh.userData.baseColor ?? mesh.material.color);
  // Más saturado que su color normal: destaca aunque el piso tenga muchas áreas
  const vivo = base.clone().offsetHSL(0, SATURACION_EXTRA, 0);
  const claro = vivo.clone().offsetHSL(0, 0, TONO_CLARO);
  const oscuro = vivo.clone().offsetHSL(0, 0, TONO_OSCURO);
  const footprint = crearHuella(mesh);
  mesh.parent?.add(footprint);
  _raised = {
    mesh,
    baseY: mesh.position.y,
    footprint,
    t0: performance.now() + START_DELAY,
    onFrame,
    base,
    claro,
    oscuro,
  };
  // Brillo propio muy tenue del mismo tono (sin el pulso fuerte del resaltado)
  mesh.material.emissive?.copy(vivo);
  mesh.material.emissiveIntensity = 0.32;
  applyRaisedStyle();
};

/**
 * Llamar cada frame. Devuelve true si hay un área levantada (el visor debe
 * seguir dibujando para que se vea la flotación y el cambio de tono).
 */
export const updateRaised = (now = performance.now()) => {
  if (!_raised) return false;
  const { mesh, baseY, footprint, t0, onFrame, claro, oscuro } = _raised;
  const dt = now - t0;
  if (dt < 0) return true;

  // b = qué tan arriba está (0 abajo … 1 arriba). Todo va sincronizado con b:
  //   arriba → tono más claro, sombra más grande y tenue
  //   abajo  → tono más oscuro, sombra más chica y marcada
  const t = Math.min(dt / DURATION, 1);
  const top = baseY + RAISE_H;
  let y;
  let b;
  if (t < 1) {
    // Subida: se va aclarando conforme sube
    y = baseY + RAISE_H * easeOutBack(t);
    b = Math.min(1, t * 1.1);
  } else {
    // Flotación: arranca en lo alto (sin salto) y baja/sube entre top y top − 2·amp
    const fase = ((dt - DURATION) / 1000) * BOB_SPEED + Math.PI / 2;
    b = (Math.sin(fase) + 1) / 2;
    y = top - (1 - b) * 2 * BOB_AMP;
  }
  mesh.position.y = y;
  mesh.material.color.copy(oscuro).lerp(claro, b);

  // Sombra (huella en el piso)
  const aparicion = Math.min(1, dt / FOOTPRINT_FADE);
  const escala = 1 + SOMBRA_CRECE * b;
  footprint.scale.set(escala, 0.01, escala);
  footprint.material.opacity = FOOTPRINT_OPACITY * aparicion * (1 - SOMBRA_ATENUA * b);

  onFrame?.(mesh);
  return true;
};

/**
 * Reaplica el estilo del área levantada. Llamar después de setViewLevel, que
 * atenúa u oculta las áreas según el nivel (building/floor/area).
 */
export const applyRaisedStyle = () => {
  if (!_raised) return;
  const { mesh, footprint } = _raised;
  const visibleFloor = mesh.parent?.visible !== false;
  mesh.visible = true;
  mesh.material.transparent = true;
  mesh.material.opacity = Math.max(ROOM_BASE_OPACITY, 0.86);
  mesh.renderOrder = 2;
  mesh.traverse((child) => {
    if (!child.userData?.isEdge) return;
    child.visible = true;
    child.material.opacity = 0.9;
  });
  footprint.visible = visibleFloor;
};

export const getRaisedId = () => _raised?.mesh.userData.roomId ?? null;
