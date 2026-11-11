import * as THREE from "three";

// ============================================================
// ENFOQUE DE ÁREA — deja destacada una sola área del piso.
// Las demás pasan a un mismo gris tenue (cuerpo casi transparente y borde
// suave): se sigue viendo cómo está distribuido el piso, pero no compiten
// con el área enfocada.
// Se usa en solicitudes (área levantada, con transición) y en el Mapa de
// Áreas mientras se edita un área (inmediato).
// ============================================================

const GRIS = new THREE.Color(0xb6bdc5);
const CUERPO_OPACITY = 0.04; // cuerpo de las demás áreas
const BORDE_OPACITY = 0.22; // borde de las demás áreas (se ve la distribución)
const FOCO_OPACITY = 0.4; // cuerpo mínimo del área enfocada

let _roomMeshes = null;
let _focusId = null;
let _t0 = 0;
let _duration = 0;
// Opacidades al iniciar el enfoque (de ahí parte la transición)
let _desde = new WeakMap();

const opacidades = (mesh) => ({
  cuerpo: mesh.material.opacity,
  borde: mesh.children.find((c) => c.userData?.isEdge)?.material.opacity ?? BORDE_OPACITY,
});

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Enfoca un área: las demás se apagan a gris.
 * @param {Map<string, THREE.Mesh>} roomMeshes
 * @param {string} areaId
 * @param {{ duration?: number, delay?: number }} [opts]  transición (0 = inmediato)
 */
export const setFocus = (roomMeshes, areaId, { duration = 0, delay = 0 } = {}) => {
  if (_focusId === areaId && _roomMeshes === roomMeshes) return;
  _roomMeshes = roomMeshes;
  _focusId = areaId;
  _t0 = performance.now() + delay;
  _duration = duration;
  _desde = new WeakMap();
  for (const mesh of roomMeshes.values()) _desde.set(mesh, opacidades(mesh));
};

/**
 * Quita el enfoque y devuelve su color a las áreas. Las opacidades las
 * restaura quien llama (volviendo a aplicar el nivel de vista).
 */
export const clearFocus = () => {
  if (!_focusId || !_roomMeshes) {
    _focusId = null;
    return false;
  }
  for (const mesh of _roomMeshes.values()) {
    if (mesh.userData.baseColor != null) mesh.material.color.set(mesh.userData.baseColor);
  }
  _focusId = null;
  return true;
};

export const getFocusId = () => _focusId;

/**
 * Llamar cada frame dibujado. Aplica el gris a las demás áreas (también a
 * las que se reconstruyeron después). Devuelve true mientras dura la
 * transición, para que el visor siga dibujando.
 */
export const updateFocus = (now = performance.now()) => {
  if (!_focusId || !_roomMeshes) return false;
  const t = _duration > 0 ? Math.min(Math.max(0, (now - _t0) / _duration), 1) : 1;
  const k = easeOut(t);
  for (const [id, mesh] of _roomMeshes) {
    if (id === _focusId) {
      // El área enfocada siempre con cuerpo visible (a nivel piso es casi
      // transparente); el área levantada usa más (raise.js lo sube a 0.86).
      if (mesh.material.opacity < FOCO_OPACITY) mesh.material.opacity = FOCO_OPACITY;
      mesh.renderOrder = 2;
      continue;
    }
    const base = mesh.userData.baseColor;
    if (base != null) mesh.material.color.set(base).lerp(GRIS, k);
    // Áreas reconstruidas a medio enfoque: parten de su opacidad actual
    if (!_desde.has(mesh)) _desde.set(mesh, opacidades(mesh));
    const desde = _desde.get(mesh);
    mesh.material.transparent = true;
    mesh.material.opacity = desde.cuerpo + (CUERPO_OPACITY - desde.cuerpo) * k;
    mesh.renderOrder = 0;
    for (const child of mesh.children) {
      if (!child.userData?.isEdge) continue;
      child.material.opacity = desde.borde + (BORDE_OPACITY - desde.borde) * k;
    }
  }
  return t < 1;
};
