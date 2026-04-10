import * as THREE from "three";
import { buildBuilding, setFloorVisibility, setRoomTicketState, FLOOR_Y } from "./building.js";
import { highlightRoom, updateHighlight, clearHighlight } from "./highlight.js";
import { createCamera, flyToFloor, setLoginMode as setCameraLoginMode, updateLoginCamera } from "./camera.js";
import { addLabels, updateLabelVisibility } from "./labels.js";
import { ALL_ROOMS, ROOM_MAP, FLOOR_LABELS } from "./rooms.js";

const API_BASE = `http://${window.location.hostname}:5101`;

// Token JWT recibido desde el frontend React vía postMessage
let _jwtToken = null;

// ════════════════════════════════════════════════════════════
// RENDERER
// ════════════════════════════════════════════════════════════
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById("canvas-container").appendChild(renderer.domElement);

// ════════════════════════════════════════════════════════════
// ESCENA
// ════════════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f4f8);
scene.fog = new THREE.Fog(0xf0f4f8, 80, 180);

// Luces
const ambient = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff8f0, 1.4);
dirLight.position.set(30, 60, 40);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 200;
dirLight.shadow.camera.left = -70;
dirLight.shadow.camera.right = 70;
dirLight.shadow.camera.top = 70;
dirLight.shadow.camera.bottom = -70;
scene.add(dirLight);

const hemi = new THREE.HemisphereLight(0xc9dff5, 0xddecd0, 0.6);
scene.add(hemi);

// Grid del suelo
const gridHelper = new THREE.GridHelper(80, 80, 0xb0c4d8, 0xdce8f2);
gridHelper.position.y = -0.2;
scene.add(gridHelper);

// ════════════════════════════════════════════════════════════
// EDIFICIO
// ════════════════════════════════════════════════════════════
const { floorGroups, roomMeshes } = buildBuilding();
for (const group of floorGroups.values()) {
  scene.add(group);
}

// ════════════════════════════════════════════════════════════
// CÁMARA
// ════════════════════════════════════════════════════════════
const { camera, controls } = createCamera(renderer);

// ════════════════════════════════════════════════════════════
// LABELS
// ════════════════════════════════════════════════════════════
addLabels(scene, roomMeshes, ALL_ROOMS);

// ════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════
let activeFloor = -1; // -1 = todos
let embedMode = false;
let loginMode = false;
const ticketPins = new Map(); // roomId → ticketData

// ════════════════════════════════════════════════════════════
// RAYCASTING (click en cuartos)
// ════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickableMeshes = [...roomMeshes.values()];

const onPointerClick = (e) => {
  if (embedMode) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickableMeshes);
  if (!hits.length) { hideInfoPanel(); return; }

  const mesh = hits[0].object;
  const { roomId, label, floor, x1, y1, x2, y2 } = mesh.userData;
  highlightRoom(roomMeshes, roomId);
  showInfoPanel({ roomId, label, floor, x1, y1, x2, y2 });

  // Notificar al parent (postMessage)
  parent?.postMessage({ type: "ROOM_CLICKED", payload: { floor, roomId, label } }, "*");
};

renderer.domElement.addEventListener("click", onPointerClick);

// ════════════════════════════════════════════════════════════
// PANEL DE INFO
// ════════════════════════════════════════════════════════════
const panel = document.getElementById("info-panel");

const showInfoPanel = ({ roomId, label, floor, x1, y1, x2, y2 }) => {
  document.getElementById("panel-area-name").textContent = label;
  document.getElementById("panel-floor").textContent = FLOOR_LABELS[floor] ?? floor;
  document.getElementById("panel-id").textContent = roomId;
  document.getElementById("panel-grid").textContent = `(${x1},${y1}) → (${x2},${y2})`;

  const ticketsEl = document.getElementById("panel-tickets");
  const pin = ticketPins.get(roomId);
  if (pin) {
    ticketsEl.textContent = `🎫 ${pin.count ?? 1} ticket(s) activo(s)`;
    ticketsEl.classList.add("visible");
  } else {
    ticketsEl.classList.remove("visible");
  }

  panel.classList.add("visible");
};

const hideInfoPanel = () => {
  panel.classList.remove("visible");
  clearHighlight(roomMeshes);
};

// ════════════════════════════════════════════════════════════
// CONTROLES DE PISO (botones)
// ════════════════════════════════════════════════════════════
document.querySelectorAll(".floor-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const f = btn.dataset.floor;
    document.querySelectorAll(".floor-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (f === "all") {
      window.SIAST3D.goToFloor(-1);
    } else {
      window.SIAST3D.goToFloor(parseInt(f, 10));
    }
  });
});

// ════════════════════════════════════════════════════════════
// API PÚBLICA — window.SIAST3D
// ════════════════════════════════════════════════════════════
window.SIAST3D = {
  highlightRoom(floorId, roomId) {
    highlightRoom(roomMeshes, roomId);
    const room = ROOM_MAP[roomId];
    if (room) showInfoPanel(room);
    if (floorId !== undefined && floorId !== -1) {
      this.goToFloor(typeof floorId === "string" ? parseInt(floorId, 10) : floorId);
    }
  },

  goToFloor(floorNumber) {
    activeFloor = floorNumber;
    setFloorVisibility(floorGroups, activeFloor);
    updateLabelVisibility(camera, floorGroups, activeFloor);
    if (floorNumber >= 0) flyToFloor(camera, controls, floorNumber);
  },

  setEmbedMode(enabled) {
    embedMode = enabled;
    controls.enabled = !enabled;
  },

  setLoginMode(enabled) {
    loginMode = enabled;
    setCameraLoginMode(enabled);
    controls.enabled = !enabled;
    document.getElementById("login-overlay").classList.toggle("visible", enabled);
    document.getElementById("floor-controls").style.display = enabled ? "none" : "flex";
  },

  showTicketPin(roomId, ticketData) {
    ticketPins.set(roomId, ticketData);
    const mesh = roomMeshes.get(roomId);
    setRoomTicketState(
      mesh,
      ticketData.estado === "ASIGNADO" || ticketData.estado === "EN_PROGRESO"
        ? "asignado"
        : "activo",
    );
  },

  hideTicketPin(roomId) {
    ticketPins.delete(roomId);
    const mesh = roomMeshes.get(roomId);
    if (mesh) {
      mesh.material.color.setHex(mesh.userData.baseColor);
    }
  },

  async showEmployee(rfc) {
    try {
      const headers = _jwtToken ? { Authorization: `Bearer ${_jwtToken}` } : {};
      const res = await fetch(`${API_BASE}/api/employee/location?rfc=${rfc}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      this.highlightRoom(data.floor, data.areaId);
      flyToFloor(camera, controls, data.floor);
    } catch (e) {
      console.warn("SIAST3D.showEmployee error:", e);
    }
  },
};

// ════════════════════════════════════════════════════════════
// postMessage listener (integración con frontend React)
// ════════════════════════════════════════════════════════════
window.addEventListener("message", (e) => {
  const { type, payload } = e.data ?? {};
  if (!type) return;

  switch (type) {
    case "SET_TOKEN":
      _jwtToken = payload.token ?? null;
      break;
    case "HIGHLIGHT_ROOM":
      window.SIAST3D.highlightRoom(payload.floor, payload.roomId);
      break;
    case "SHOW_EMPLOYEE":
      window.SIAST3D.highlightRoom(payload.floor, payload.area);
      flyToFloor(camera, controls, payload.floor);
      showInfoPanel({
        roomId: payload.area,
        label: payload.nombre,
        floor: payload.floor,
        ...ROOM_MAP[payload.area],
      });
      break;
    case "SET_LOGIN_MODE":
      window.SIAST3D.setLoginMode(payload.enabled);
      break;
    case "GO_TO_FLOOR":
      window.SIAST3D.goToFloor(payload.floor);
      break;
    case "SHOW_TICKET_PIN":
      window.SIAST3D.showTicketPin(payload.roomId, payload.ticketData);
      break;
    case "HIDE_TICKET_PIN":
      window.SIAST3D.hideTicketPin(payload.roomId);
      break;
  }
});

// ════════════════════════════════════════════════════════════
// ANIMACIÓN DE ENTRADA — pisos aparecen de abajo hacia arriba
// ════════════════════════════════════════════════════════════
const animateEntry = () => {
  const bar = document.getElementById("loader-bar");
  const loader = document.getElementById("loader");

  // Ocultar todos los pisos inicialmente
  for (const group of floorGroups.values()) {
    group.visible = false;
  }

  const floors = [0, 1, 2, 3];
  let shown = 0;

  const showNextFloor = () => {
    if (shown >= floors.length) {
      setTimeout(() => {
        loader.classList.add("hidden");
        setTimeout(() => { loader.style.display = "none"; }, 700);
      }, 300);
      return;
    }
    const floor = floors[shown];
    const group = floorGroups.get(floor);
    if (group) {
      group.visible = true;
      // Animar desde abajo
      const targetY = 0;
      group.position.y = -8;
      const t0 = performance.now();
      const rise = (now) => {
        const t = Math.min((now - t0) / 500, 1);
        const ease = 1 - Math.pow(1 - t, 2);
        group.position.y = -8 + 8 * ease;
        if (t < 1) requestAnimationFrame(rise);
      };
      requestAnimationFrame(rise);
    }
    shown++;
    bar.style.width = `${(shown / floors.length) * 100}%`;
    setTimeout(showNextFloor, 480);
  };

  showNextFloor();
};

// ════════════════════════════════════════════════════════════
// LOOP DE RENDER
// ════════════════════════════════════════════════════════════
const clock = new THREE.Clock();

const render = () => {
  requestAnimationFrame(render);
  const delta = clock.getDelta();

  controls.update();
  updateHighlight(delta);
  updateLoginCamera(camera, controls, delta);
  updateLabelVisibility(camera, floorGroups, activeFloor);

  renderer.render(scene, camera);
};

// ════════════════════════════════════════════════════════════
// RESIZE
// ════════════════════════════════════════════════════════════
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ════════════════════════════════════════════════════════════
// INICIO
// ════════════════════════════════════════════════════════════
animateEntry();
render();
