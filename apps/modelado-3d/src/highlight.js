import * as THREE from "three";

let _activeRoomId = null;
let _pulseTime = 0;
let _pulseMesh = null;
let _originalColor = null;

/**
 * Resalta un cuarto con animación pulse.
 */
export const highlightRoom = (roomMeshes, roomId) => {
  // Quitar highlight anterior
  if (_pulseMesh && _originalColor !== null) {
    _pulseMesh.material.color.setHex(_originalColor);
    _pulseMesh.material.emissive?.setHex(0x000000);
    _pulseMesh.scale.set(1, 1, 1);
  }

  _activeRoomId = roomId;
  _pulseMesh = roomMeshes.get(roomId) ?? null;

  if (_pulseMesh) {
    _originalColor = _pulseMesh.userData.baseColor;
    // Emissive teñido del color del área pero elevado: glow propio que
    // resalta sobre el vidrio sin cambiar el color base (UX consistente).
    _pulseMesh.material.emissive = new THREE.Color(_originalColor);
    _pulseMesh.material.emissiveIntensity = 0.9;
    _pulseTime = 0;
  }
};

/**
 * Llama en cada frame para animar el pulse (respiración suave del glow).
 */
export const updateHighlight = (delta) => {
  if (!_pulseMesh) return;
  _pulseTime += delta;
  const pulse = 1.1 + Math.sin(_pulseTime * 3) * 0.45;
  _pulseMesh.material.emissiveIntensity = pulse;
};

export const clearHighlight = (roomMeshes) => {
  highlightRoom(roomMeshes, null);
  _pulseMesh = null;
  _activeRoomId = null;
};

export const getActiveRoomId = () => _activeRoomId;
