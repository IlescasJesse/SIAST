import * as THREE from "three";
import { FLOOR_Y } from "./building.js";

// ============================================================
// ETIQUETAS DE ÁREA — tarjeta flotante con el nombre del área.
// · El canvas se ajusta al texto (hasta 2 renglones): la letra nunca se
//   comprime aunque el nombre sea largo.
// · Tamaño constante en pantalla (sizeAttenuation:false): igual de legible
//   cerca o lejos.
// · Las que se enciman se ocultan con un fundido; gana el área más grande.
// ============================================================

const _labels = new Map(); // roomId → sprite

const DPR = 2; // resolución del canvas: 2× para nitidez en pantallas HiDPI
const FONT_PX = 30; // tamaño de letra en px CSS
const LINE_H = 36;
const PAD_X = 16;
const PAD_Y = 10;
const STRIPE_W = 5; // franja guinda a la izquierda
const TIP_H = 9; // piquito que apunta al área
const MAX_LINE_W = 300; // ancho máximo de renglón antes de partirlo
const MAX_LINES = 2;
const RADIUS = 9;
const SHADOW = 10; // margen para la sombra
// En pantalla se ve a la mitad del tamaño de dibujo (letra ≈ 15 px): junto con
// DPR=2 el canvas queda a 4× la resolución mostrada, nítido aun con zoom del SO.
const SCREEN_SCALE = 0.5;
const LABEL_OFFSET_Y = 2.2; // altura sobre el centro del área
const MAX_DIST = 55;
const FADE_SPEED = 8; // opacidad por segundo
const OVERLAP_GAP_PX = 4;

const THEMES = {
  light: {
    card: "rgba(255,255,255,0.95)",
    text: "#3a1422",
    stripe: "#9d2449",
    border: "rgba(157,36,73,0.18)",
    shadow: "rgba(40,10,22,0.28)",
  },
  dark: {
    card: "rgba(30,12,20,0.9)",
    text: "#eedfe5",
    stripe: "#c44e71",
    border: "rgba(196,78,113,0.45)",
    shadow: "rgba(0,0,0,0.5)",
  },
};
let _theme = THEMES.light;

const FONT = `600 ${FONT_PX}px "Segoe UI", system-ui, sans-serif`;

/** Parte el texto en renglones de ancho ≤ MAX_LINE_W; el último se recorta con "…". */
const wrapText = (ctx, text) => {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= MAX_LINE_W || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES;
    lines[MAX_LINES - 1] += "…";
  }
  // Un renglón (o palabra) más ancho que el máximo se recorta con "…"
  return lines.map((l) => {
    if (ctx.measureText(l).width <= MAX_LINE_W) return l;
    let s = l;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > MAX_LINE_W) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  });
};

/** Dibuja la tarjeta en un canvas del tamaño justo para el texto. */
const drawLabel = (text) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = FONT;
  const lines = wrapText(ctx, text);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));

  const cardW = Math.ceil(textW + PAD_X * 2 + STRIPE_W);
  const cardH = lines.length * LINE_H + PAD_Y * 2;
  const w = cardW + SHADOW * 2;
  const h = cardH + TIP_H + SHADOW * 2;
  canvas.width = w * DPR;
  canvas.height = h * DPR;
  ctx.scale(DPR, DPR);

  const x = SHADOW;
  const y = SHADOW;
  const t = _theme;

  // Silueta: tarjeta redondeada + piquito centrado abajo
  const shape = () => {
    const cx = x + cardW / 2;
    const r = RADIUS;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + cardW - r, y);
    ctx.arcTo(x + cardW, y, x + cardW, y + r, r);
    ctx.lineTo(x + cardW, y + cardH - r);
    ctx.arcTo(x + cardW, y + cardH, x + cardW - r, y + cardH, r);
    ctx.lineTo(cx + TIP_H, y + cardH);
    ctx.lineTo(cx, y + cardH + TIP_H);
    ctx.lineTo(cx - TIP_H, y + cardH);
    ctx.lineTo(x + r, y + cardH);
    ctx.arcTo(x, y + cardH, x, y + cardH - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  ctx.save();
  ctx.shadowColor = t.shadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  shape();
  ctx.fillStyle = t.card;
  ctx.fill();
  ctx.restore();

  shape();
  ctx.lineWidth = 1;
  ctx.strokeStyle = t.border;
  ctx.stroke();

  // Franja institucional a la izquierda (recortada a la silueta)
  ctx.save();
  shape();
  ctx.clip();
  ctx.fillStyle = t.stripe;
  ctx.fillRect(x, y, STRIPE_W, cardH);
  ctx.restore();

  ctx.font = FONT;
  ctx.fillStyle = t.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textCx = x + STRIPE_W + (cardW - STRIPE_W) / 2;
  lines.forEach((l, i) => ctx.fillText(l, textCx, y + PAD_Y + LINE_H * (i + 0.5)));

  return { canvas, w, h };
};

/** Aplica texto + textura nueva a un sprite (también fija su ancla y proporción). */
const paintSprite = (sprite, text) => {
  const { canvas, w, h } = drawLabel(text);
  sprite.material.map?.dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  sprite.material.map = tex;
  sprite.material.needsUpdate = true;
  sprite.userData.text = text;
  sprite.userData.pxW = w * SCREEN_SCALE;
  sprite.userData.pxH = h * SCREEN_SCALE;
  // Ancla en la punta del piquito (abajo al centro, sin contar la sombra)
  sprite.center.set(0.5, SHADOW / h);
};

const makeSprite = (text) => {
  const mat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false, // tamaño fijo en pantalla
    toneMapped: false, // colores exactos, sin que la luz de la escena los altere
    opacity: 0,
  });
  const sprite = new THREE.Sprite(mat);
  paintSprite(sprite, text);
  return sprite;
};

/** Huella del área (celdas) → prioridad: las grandes se muestran primero. */
const areaPriority = (mesh) => {
  const { x1, y1, x2, y2 } = mesh?.userData ?? {};
  return x1 != null ? Math.abs((x2 - x1) * (y2 - y1)) : 0;
};

const anchorTo = (sprite, mesh) => {
  sprite.position.copy(mesh.position);
  sprite.position.y += LABEL_OFFSET_Y;
  sprite.userData.priority = areaPriority(mesh);
};

const addSprite = (scene, roomId, label, mesh) => {
  const sprite = makeSprite(label);
  anchorTo(sprite, mesh);
  sprite.userData.roomId = roomId;
  sprite.renderOrder = 10;
  scene.add(sprite);
  _labels.set(roomId, sprite);
};

export const addLabels = (scene, roomMeshes, rooms) => {
  for (const room of rooms) {
    const mesh = roomMeshes.get(room.id);
    if (mesh) addSprite(scene, room.id, room.label, mesh);
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
  paintSprite(sprite, newLabel);
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
  const existing = _labels.get(roomId);
  if (existing) {
    // Actualizar el texto y reanclar al mesh (pudo moverse o cambiar de piso)
    if (existing.userData.text !== label) paintSprite(existing, label);
    anchorTo(existing, mesh);
    return;
  }
  addSprite(scene, roomId, label, mesh);
};

/** Quita y libera la etiqueta flotante de un cuarto eliminado. */
export const removeRoomLabel = (scene, roomId) => {
  const sprite = _labels.get(roomId);
  if (!sprite) return;
  scene.remove(sprite);
  sprite.material.map?.dispose();
  sprite.material.dispose();
  _labels.delete(roomId);
};

/** Cambia la paleta de las etiquetas (tema claro / oscuro) y las redibuja. */
export const setLabelTheme = (theme) => {
  const next = THEMES[theme] ?? THEMES.light;
  if (next === _theme) return;
  _theme = next;
  for (const sprite of _labels.values()) paintSprite(sprite, sprite.userData.text);
};

// Interruptor global "Mostrar/Ocultar etiquetas" (botón del editor de áreas).
let _labelsEnabled = true;

/** Enciende o apaga todas las etiquetas de área (se desvanecen suavemente). */
export const setLabelsEnabled = (enabled) => {
  _labelsEnabled = Boolean(enabled);
};

const floorOf = (y) => (y > FLOOR_Y(3) ? 3 : y > FLOOR_Y(2) ? 2 : y > FLOOR_Y(1) ? 1 : 0);

const _proj = new THREE.Vector3();
let _lastT = performance.now();

/**
 * Llamar cada frame: decide qué etiquetas se ven (piso activo, distancia y
 * sin encimarse), fija su tamaño en pantalla y anima el fundido.
 * Devuelve true mientras alguna etiqueta sigue en fundido (hay que seguir
 * dibujando frames).
 */
export const updateLabelVisibility = (camera, floorGroups, activeFloor) => {
  const now = performance.now();
  const dt = Math.min((now - _lastT) / 1000, 0.1);
  _lastT = now;

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  // px de pantalla → escala del sprite con sizeAttenuation:false
  const pxToScale = camera.isPerspectiveCamera
    ? (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / viewH
    : 2 / viewH;

  // Candidatas: piso activo, cerca y frente a la cámara
  const candidatas = [];
  for (const sprite of _labels.values()) {
    sprite.scale.set(sprite.userData.pxW * pxToScale, sprite.userData.pxH * pxToScale, 1);
    let quiere = false;
    // Apagadas: no se proyecta nada, solo se desvanecen las que estaban visibles
    if (!_labelsEnabled) {
      sprite.userData.target = 0;
      continue;
    }
    const floor = floorOf(sprite.position.y);
    const dist = camera.position.distanceTo(sprite.position);
    if ((activeFloor === -1 || floor === activeFloor) && dist < MAX_DIST) {
      _proj.copy(sprite.position).project(camera);
      if (_proj.z < 1 && Math.abs(_proj.x) < 1.2 && Math.abs(_proj.y) < 1.2) {
        const sx = ((_proj.x + 1) / 2) * viewW;
        const sy = ((1 - _proj.y) / 2) * viewH;
        const { pxW, pxH } = sprite.userData;
        const tipFrac = sprite.center.y;
        candidatas.push({
          sprite,
          dist,
          rect: {
            l: sx - pxW / 2,
            r: sx + pxW / 2,
            t: sy - pxH * (1 - tipFrac),
            b: sy + pxH * tipFrac,
          },
        });
        quiere = true;
      }
    }
    sprite.userData.target = quiere ? 1 : 0;
  }

  // Sin encimarse: primero las áreas grandes; a igual tamaño, la más cercana
  candidatas.sort(
    (a, b) =>
      (b.sprite.userData.priority ?? 0) - (a.sprite.userData.priority ?? 0) || a.dist - b.dist,
  );
  const colocadas = [];
  for (const c of candidatas) {
    const choca = colocadas.some(
      (o) =>
        c.rect.l < o.r + OVERLAP_GAP_PX &&
        c.rect.r > o.l - OVERLAP_GAP_PX &&
        c.rect.t < o.b + OVERLAP_GAP_PX &&
        c.rect.b > o.t - OVERLAP_GAP_PX,
    );
    if (choca) c.sprite.userData.target = 0;
    else colocadas.push(c.rect);
  }

  // Fundido suave hacia el objetivo
  let animando = false;
  for (const sprite of _labels.values()) {
    const mat = sprite.material;
    const target = sprite.userData.target ?? 0;
    const step = FADE_SPEED * dt;
    mat.opacity =
      target > mat.opacity
        ? Math.min(target, mat.opacity + step)
        : Math.max(target, mat.opacity - step);
    sprite.visible = mat.opacity > 0.01;
    if (mat.opacity !== target) animando = true;
  }
  return animando;
};
