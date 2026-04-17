import * as THREE from "three";

// ── Constantes del edificio (igual que building.js) ──────────────────────────
const FLOOR_H = 4;
const TOTAL_H = FLOOR_H * 4;   // 16 unidades — 4 pisos completos

// Grid 32×27 centrado en (0,0):
//   Ala izquierda : cols  0-14 → X: -16 a  -2 → cx=-9,  half-w=7
//   Conector      : cols 14-18 → X:  -2 a  +2 → cx= 0,  w=4
//   Ala derecha   : cols 18-32 → X:  +2 a +16 → cx=+9,  half-w=7
//   Frente edificio: Z = +13.5   Fondo: Z = -13.5

const WING_W_HALF = 7;
const WING_D      = 27;   // profundidad total del ala (filas 0-27)

// Conector: pared trasera que une las dos alas (parte trasera del edificio).
// El conector ocupa la pared del FONDO, no el centro.
// Vista desde arriba: U-shape (dos alas + pared trasera)
const CON_W        = 4;
const CON_D        = 13;      // 13 unidades de profundidad (igual que antes)
const CON_BACK_Z   = -13.5;  // alineado con el fondo de las alas
const CON_FRONT_Z  = CON_BACK_Z + CON_D;  // -0.5 — frente del conector
const CON_CENTER_Z = (CON_FRONT_Z + CON_BACK_Z) / 2;  // -7.0

// ── Texturas de alta calidad ──────────────────────────────────────────────────

/** Fachada crema — frente y fondo de alas
 *  Cada piso: franja sólida crema arriba + banda horizontal oscura (ventana corrida) + zócalo crema abajo.
 *  Las ventanas son HORIZONTALES (entre niveles), no cuadrícula vertical.
 */
function makeFacadeTexture() {
  const W = 2048, H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const floorH = H / 4;

  for (let f = 0; f < 4; f++) {
    const fy = f * floorH;

    // Paramento de hormigón/piedra crema
    ctx.fillStyle = "#ddd0b4";
    ctx.fillRect(0, fy, W, floorH);

    // Variación de textura — ruido sutil
    for (let i = 0; i < 180; i++) {
      const rx = Math.random() * W, ry = fy + Math.random() * floorH;
      const tone = Math.floor(Math.random() * 18) - 9;
      const v = 200 + tone;
      ctx.fillStyle = `rgba(${v},${v - 10},${v - 28},0.08)`;
      ctx.fillRect(rx, ry, Math.random() * 60 + 20, Math.random() * 10 + 4);
    }

    // Banda de ventanas corridas (franja oscura horizontal) — 48% del piso
    const winTop = fy + floorH * 0.22;
    const winH   = floorH * 0.48;
    ctx.fillStyle = "#16202c";
    ctx.fillRect(0, winTop, W, winH);

    // Reflexión/brillo en el vidrio
    const glassGrad = ctx.createLinearGradient(0, winTop, 0, winTop + winH);
    glassGrad.addColorStop(0,   "rgba(180,210,240,0.18)");
    glassGrad.addColorStop(0.3, "rgba(100,150,200,0.06)");
    glassGrad.addColorStop(1,   "rgba(10,20,40,0.00)");
    ctx.fillStyle = glassGrad;
    ctx.fillRect(0, winTop, W, winH);

    // Marco superior de la ventana (línea crema)
    ctx.fillStyle = "#c8ba9c";
    ctx.fillRect(0, winTop - 3, W, 6);
    // Marco inferior de la ventana
    ctx.fillRect(0, winTop + winH - 2, W, 5);

    // Montantes verticales del vidrio (cada 120px) — muy finos
    ctx.fillStyle = "rgba(210,195,165,0.55)";
    for (let x = 0; x < W; x += 120) {
      ctx.fillRect(x, winTop + 3, 3, winH - 6);
    }

    // Cornisa entre pisos
    ctx.fillStyle = "#b8aa8e";
    ctx.fillRect(0, fy + floorH * 0.88, W, floorH * 0.10);
    // Perfil metálico de la cornisa
    ctx.fillStyle = "#a09080";
    ctx.fillRect(0, fy + floorH * 0.88, W, 4);
  }

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Paneles oscuros para LADOS de alas (plafones lisos, SIN ventanas) */
function makeSidePanelTexture() {
  const W = 1024, H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Base grafito oscura
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   "#1a1816");
  grad.addColorStop(0.4, "#201e1a");
  grad.addColorStop(0.7, "#1c1a16");
  grad.addColorStop(1,   "#161412");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Paneles rectangulares (plafones) — juntas horizontales cada piso
  ctx.strokeStyle = "rgba(60,55,45,0.70)"; ctx.lineWidth = 2.5;
  for (let y = 0; y < H; y += H / 4) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Juntas verticales de panel (cada 96px)
  ctx.strokeStyle = "rgba(50,45,38,0.50)"; ctx.lineWidth = 1.5;
  for (let x = 0; x < W; x += 96) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  // Leve reflejo metálico diagonal para dar profundidad
  ctx.fillStyle = "rgba(90,82,68,0.07)";
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W * 0.55, 0); ctx.lineTo(W * 0.25, H); ctx.lineTo(0, H);
  ctx.fill();

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Paneles oscuros del conector — más oscuros y con franjas de anodizado */
function makeConnectorPanelTexture() {
  const W = 1024, H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Base muy oscura antracita
  ctx.fillStyle = "#111010";
  ctx.fillRect(0, 0, W, H);

  // Paneles por piso
  const floorH = H / 4;
  for (let f = 0; f < 4; f++) {
    const fy = f * floorH;

    // Franja horizontal de separación entre pisos (reflejo metálico)
    const sepGrad = ctx.createLinearGradient(0, fy, 0, fy + 16);
    sepGrad.addColorStop(0,   "rgba(120,105,80,0.45)");
    sepGrad.addColorStop(0.5, "rgba(80,70,55,0.20)");
    sepGrad.addColorStop(1,   "rgba(20,18,14,0.00)");
    ctx.fillStyle = sepGrad;
    ctx.fillRect(0, fy, W, 18);

    // Paneles verticales dentro de cada piso
    for (let x = 0; x < W; x += 80) {
      // Junta de panel
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, fy + 16, 2, floorH - 16);
      // Leve diferencia de tono entre paneles
      if ((x / 80 + f) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.025)";
        ctx.fillRect(x + 2, fy + 16, 78, floorH - 16);
      }
    }
  }

  // Faja de reflejo central (simula material anodizado)
  const centerGrad = ctx.createLinearGradient(W * 0.20, 0, W * 0.55, H);
  centerGrad.addColorStop(0,   "rgba(0,0,0,0)");
  centerGrad.addColorStop(0.3, "rgba(100,90,70,0.10)");
  centerGrad.addColorStop(0.7, "rgba(80,72,56,0.08)");
  centerGrad.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = centerGrad;
  ctx.fillRect(0, 0, W, H);

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Piso tipo azulejo marrón cálido */
function makeFloorTileTexture() {
  const W = 1024, H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const TILE = 64;
  for (let row = 0; row * TILE < H; row++) {
    for (let col = 0; col * TILE < W; col++) {
      const tone = Math.random() * 20 - 10;
      const r = Math.round(148 + tone);
      const g = Math.round(102 + tone * 0.7);
      const b = Math.round(60  + tone * 0.4);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2);
    }
  }
  // Juntas de azulejo
  ctx.strokeStyle = "#5a3e28"; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += TILE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 12);
  return t;
}

/** Sky sphere — degradado de azul profundo a horizonte claro */
function makeSkyTexture() {
  const W = 4, H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, "#0d2a5e"); // azul profundo en el cénit
  grad.addColorStop(0.25, "#1a4a9a"); // azul medio
  grad.addColorStop(0.55, "#4a88cc"); // azul cielo
  grad.addColorStop(0.78, "#7ab0e0"); // azul claro
  grad.addColorStop(0.90, "#a8cce8"); // horizonte pálido
  grad.addColorStop(0.97, "#c8dff0"); // banda de horizonte
  grad.addColorStop(1.00, "#d8eaf6"); // neblina baja
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const t = new THREE.CanvasTexture(canvas);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// ── Helper: plano con material ────────────────────────────────────────────────

function makePanel(w, h, mat) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Letrero de texto usando canvas — dorado sobre fondo oscuro semitransparente */
function makeTextSprite(text, fontSize = 32, textColor = "#f0d870", bgAlpha = 0.0) {
  const CW = 768, CH = 96;
  const canvas = document.createElement("canvas");
  canvas.width = CW; canvas.height = CH;
  const ctx = canvas.getContext("2d");
  if (bgAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, CW, CH);
  }
  ctx.font = `900 ${fontSize}px 'Arial Narrow', Arial, sans-serif`;
  ctx.letterSpacing = "4px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor  = "rgba(0,0,0,0.80)"; ctx.shadowBlur = 6;
  ctx.fillStyle = textColor;
  ctx.fillText(text, CW / 2, CH / 2);

  const tex = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry((CW / CH) * 1.0, 1.0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}

// ── Función principal ─────────────────────────────────────────────────────────

export function buildExterior(scene) {
  // Texturas
  const facadeTex = makeFacadeTexture();
  const sideTex   = makeSidePanelTexture();
  const conTex    = makeConnectorPanelTexture();
  const floorTex  = makeFloorTileTexture();

  // Materiales
  const matFacade  = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.78, metalness: 0.03 });
  const matSide    = new THREE.MeshStandardMaterial({ map: sideTex,   roughness: 0.82, metalness: 0.14 });
  const matCon     = new THREE.MeshStandardMaterial({ map: conTex,    roughness: 0.72, metalness: 0.18 });
  const matRoofDark = new THREE.MeshStandardMaterial({ color: 0x1e1c18, roughness: 0.88 });
  const matFloor   = new THREE.MeshStandardMaterial({ map: floorTex,  roughness: 0.80, metalness: 0.02 });

  const cy = TOTAL_H / 2;

  // ── SKY SPHERE ──────────────────────────────────────────────────────────────
  const skyTex = makeSkyTexture();
  const skyGeo = new THREE.SphereGeometry(280, 48, 24);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ── SUELO — azulejo marrón cálido ────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const ground = new THREE.Mesh(groundGeo, matFloor);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  // ── ALAS ─────────────────────────────────────────────────────────────────
  // Ala izquierda: cx=-9   Ala derecha: cx=+9
  const wings = [
    { cx: -9, side: "left"  },
    { cx:  9, side: "right" },
  ];

  wings.forEach(({ cx, side }) => {
    const outerX = side === "left" ? cx - WING_W_HALF : cx + WING_W_HALF;
    const innerX = side === "left" ? cx + WING_W_HALF : cx - WING_W_HALF;

    // Frente (+Z) — fachada crema con ventanas corridas
    const fFront = makePanel(WING_W_HALF * 2, TOTAL_H, matFacade);
    fFront.position.set(cx, cy, 13.5);
    scene.add(fFront);

    // Fondo (−Z) — fachada crema con ventanas corridas
    const fBack = makePanel(WING_W_HALF * 2, TOTAL_H, matFacade);
    fBack.rotation.y = Math.PI;
    fBack.position.set(cx, cy, -13.5);
    scene.add(fBack);

    // Cara lateral exterior — PLAFONES OSCUROS, sin ventanas
    const fOuter = makePanel(WING_D, TOTAL_H, matSide);
    fOuter.rotation.y = side === "left" ? -Math.PI / 2 : Math.PI / 2;
    fOuter.position.set(outerX, cy, 0);
    scene.add(fOuter);

    // Cara lateral interior (hacia conector) — PLAFONES OSCUROS, sin ventanas
    const fInner = makePanel(WING_D, TOTAL_H, matSide);
    fInner.rotation.y = side === "left" ? Math.PI / 2 : -Math.PI / 2;
    fInner.position.set(innerX, cy, 0);
    scene.add(fInner);

    // Techo plano oscuro
    const roof = new THREE.Mesh(new THREE.BoxGeometry(WING_W_HALF * 2 + 0.3, 0.45, WING_D + 0.3), matRoofDark);
    roof.position.set(cx, TOTAL_H + 0.22, 0);
    scene.add(roof);

    // Parapeto exterior (borde del techo)
    const par = new THREE.Mesh(new THREE.BoxGeometry(0.40, 1.0, WING_D + 0.3), matSide);
    par.position.set(outerX + (side === "left" ? -0.20 : 0.20), TOTAL_H + 0.72, 0);
    scene.add(par);
  });

  // ── CONECTOR — alineado al frente, oscuro y alto ──────────────────────────

  // Fachada FRONTAL del conector (+Z alineado con las alas)
  const conFront = makePanel(CON_W, TOTAL_H, matCon);
  conFront.position.set(0, cy, CON_FRONT_Z);
  scene.add(conFront);

  // Fachada trasera
  const conBack = makePanel(CON_W, TOTAL_H, matCon);
  conBack.rotation.y = Math.PI;
  conBack.position.set(0, cy, CON_BACK_Z);
  scene.add(conBack);

  // Caras laterales del conector (plafones oscuros)
  [-2, 2].forEach((x, i) => {
    const fSide = makePanel(CON_D, TOTAL_H, matCon);
    fSide.rotation.y = i === 0 ? -Math.PI / 2 : Math.PI / 2;
    fSide.position.set(x, cy, CON_CENTER_Z);
    scene.add(fSide);
  });

  // Techo del conector
  const conRoof = new THREE.Mesh(new THREE.BoxGeometry(CON_W + 0.3, 0.50, CON_D + 0.3), matRoofDark);
  conRoof.position.set(0, TOTAL_H + 0.25, CON_CENTER_Z);
  scene.add(conRoof);

  // Parapeto frontal del conector (más pronunciado)
  const conPar = new THREE.Mesh(new THREE.BoxGeometry(CON_W + 0.3, 1.3, 0.40), matRoofDark);
  conPar.position.set(0, TOTAL_H + 0.90, CON_FRONT_Z + 0.20);
  scene.add(conPar);

  // Cornisas horizontales en cada piso de la fachada frontal del conector
  for (let f = 1; f <= 4; f++) {
    const cornisa = new THREE.Mesh(
      new THREE.BoxGeometry(CON_W + 0.12, 0.14, 0.20),
      new THREE.MeshStandardMaterial({ color: 0x0c0b09, roughness: 0.7 }),
    );
    cornisa.position.set(0, f * FLOOR_H - 0.07, CON_FRONT_Z + 0.10);
    scene.add(cornisa);
  }

  // ── LETRERO "SAÚL MARTÍNEZ" ──────────────────────────────────────────────
  const letrero = makeTextSprite("SAÚL MARTÍNEZ", 36, "#f0d860", 0.12);
  letrero.scale.set(6.5, 6.5 / (768 / 96), 1);
  letrero.position.set(0, TOTAL_H - 1.1, CON_FRONT_Z + 0.10);
  scene.add(letrero);

  const subtitulo = makeTextSprite("EDIFICIO", 22, "#cfc050", 0.0);
  subtitulo.scale.set(3.2, 3.2 / (768 / 96), 1);
  subtitulo.position.set(0, TOTAL_H - 0.05, CON_FRONT_Z + 0.10);
  scene.add(subtitulo);

  // ── PORTAL DE ENTRADA (puerta principal del conector) ───────────────────
  const jambaMat = new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 0.70, metalness: 0.20 });
  const DOOR_H = FLOOR_H * 0.85, DOOR_W = 1.8, FRAME_T = 0.22;

  // Jamba izquierda
  scene.add(Object.assign(
    new THREE.Mesh(new THREE.BoxGeometry(FRAME_T, DOOR_H, FRAME_T), jambaMat),
    { position: new THREE.Vector3(-DOOR_W / 2, DOOR_H / 2, CON_FRONT_Z + 0.04) },
  ));
  // Jamba derecha
  scene.add(Object.assign(
    new THREE.Mesh(new THREE.BoxGeometry(FRAME_T, DOOR_H, FRAME_T), jambaMat),
    { position: new THREE.Vector3( DOOR_W / 2, DOOR_H / 2, CON_FRONT_Z + 0.04) },
  ));
  // Dintel
  scene.add(Object.assign(
    new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + FRAME_T * 2, FRAME_T, FRAME_T), jambaMat),
    { position: new THREE.Vector3(0, DOOR_H + FRAME_T / 2, CON_FRONT_Z + 0.04) },
  ));
  // Vidrio de puerta
  scene.add(Object.assign(
    new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_W - 0.05, DOOR_H - 0.05),
      new THREE.MeshStandardMaterial({ color: 0x3a5870, transparent: true, opacity: 0.45, metalness: 0.15, roughness: 0.04 }),
    ),
    { position: new THREE.Vector3(0, DOOR_H / 2, CON_FRONT_Z + 0.05) },
  ));

  // ── ILUMINACIÓN ──────────────────────────────────────────────────────────
  // Sol principal — mediodía oaxaqueño desde sureste
  const sunLight = new THREE.DirectionalLight(0xfff5d8, 2.6);
  sunLight.position.set(14, 42, 32);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096);
  sunLight.shadow.camera.left   = -80;
  sunLight.shadow.camera.right  =  80;
  sunLight.shadow.camera.top    =  80;
  sunLight.shadow.camera.bottom = -80;
  sunLight.shadow.camera.far    = 350;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  // Relleno desde el cielo (azul suave)
  const skyFill = new THREE.DirectionalLight(0x90b8d8, 0.55);
  skyFill.position.set(-22, 22, -18);
  scene.add(skyFill);

  // Relleno frontal (ilumina fachadas que dan a la plaza)
  const frontFill = new THREE.DirectionalLight(0xffd890, 0.38);
  frontFill.position.set(0, 8, 70);
  scene.add(frontFill);

  return { sunLight };
}
