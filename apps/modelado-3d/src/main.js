import * as THREE from "three";
import {
  buildBuilding,
  buildBuildingFromData,
  setFloorVisibility,
  setRoomTicketState,
  rebuildRoomGeometry,
  createConnectorMesh,
  createBuildingFootprint,
} from "./building.js";
import { highlightRoom, updateHighlight, clearHighlight } from "./highlight.js";
import {
  createCamera,
  flyToFloor,
  setLoginMode as setCameraLoginMode,
  updateLoginCamera,
} from "./camera.js";
import { addLabels, updateLabelVisibility, updateRoomLabel, ensureRoomLabel } from "./labels.js";
import { ALL_ROOMS, FLOOR_LABELS } from "./rooms.js";
import { FurnitureManager, loadMuebles } from "./furniture.js";

const API_BASE = `http://${window.location.hostname}:5101`;

// Color fallback por piso cuando la API no trae colorHex
const FLOOR_COLORS = {
  0: 0xe65100,
  1: 0x1565c0,
  2: 0x2e7d32,
  3: 0x4a148c,
};

/** Convierte "#rrggbb" a número entero 0xrrggbb para Three.js */
const hexStrToInt = (hex) => {
  if (!hex) return null;
  return parseInt(hex.replace("#", ""), 16);
};

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
scene.background = new THREE.Color(0xdce8f2);
scene.fog = new THREE.Fog(0xdce8f2, 80, 200);

// Luces
const ambient = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff8f0, 0.6);
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
// EDIFICIO — construido inmediatamente desde rooms.js
// Se actualiza desde la API en segundo plano
// ════════════════════════════════════════════════════════════

const liveRoomMap = {};

// Construir desde rooms.js de inmediato (sin esperar la API)
let { floorGroups, roomMeshes } = buildBuilding();

for (const room of ALL_ROOMS) {
  liveRoomMap[room.id] = { ...room };
}

for (const group of floorGroups.values()) {
  scene.add(group);
}

// El conector no se muestra como mesh estático — sus áreas se definen
// en el editor 2D y aparecen como cualquier otra área en el visor 3D.

// Huella del edificio en el suelo
const footprint = createBuildingFootprint();
scene.add(footprint);

// ── Muebles/cubículos dentro de las áreas (LOD) ──────────────────────────────
const furniture = new FurnitureManager(scene);

/**
 * Carga los muebles de las áreas dadas desde la API y (re)construye sus meshes.
 * Degradación elegante: si la API falla, el visor sigue funcionando sin muebles.
 * @param {Array} rooms - lista de rooms con { id } presentes en liveRoomMap
 */
const refreshMuebles = async (rooms) => {
  try {
    const mueblesByArea = await loadMuebles(rooms, API_BASE, _jwtToken);
    const total = Object.values(mueblesByArea).reduce((n, arr) => n + arr.length, 0);
    if (total === 0) {
      furniture.clear();
      return;
    }
    furniture.build(mueblesByArea, liveRoomMap);
    console.info(`[SIAST3D] ${total} muebles cargados en ${rooms.length} áreas`);
  } catch (err) {
    console.warn("[SIAST3D] No se pudieron cargar muebles:", err.message);
  }
};

// ── Actualización asíncrona desde la API (sin bloquear el render) ────────────
const apiAreaToRoom = (area) => ({
  id: area.id,
  label: area.label,
  floor: area.floor ?? 0,
  x1: area.gridX1,
  y1: area.gridY1,
  x2: area.gridX2,
  y2: area.gridY2,
  // Usar colorHex de la API si está disponible; fallback a color por piso
  color: hexStrToInt(area.colorHex) ?? FLOOR_COLORS[area.floor ?? 0] ?? 0x78909c,
});

fetch(`${API_BASE}/api/catalogos/areas`)
  .then((r) => r.json())
  .then((json) => {
    const areas = (json.data ?? []).filter(
      (a) =>
        a.activo !== false &&
        a.gridX1 != null &&
        a.gridY1 != null &&
        a.gridX2 != null &&
        a.gridY2 != null,
    );
    if (areas.length === 0) return;

    console.info(`[SIAST3D] Actualizando ${areas.length} áreas desde API`);

    for (const area of areas) {
      const room = apiAreaToRoom(area);
      // Actualizar label en el mapa
      if (liveRoomMap[room.id]) {
        liveRoomMap[room.id].label = room.label;
      }
      // Si las coordenadas difieren del rooms.js, reconstruir el mesh
      const existing = liveRoomMap[room.id];
      const coordsChanged =
        !existing ||
        existing.x1 !== room.x1 ||
        existing.y1 !== room.y1 ||
        existing.x2 !== room.x2 ||
        existing.y2 !== room.y2;

      if (coordsChanged) {
        rebuildRoomGeometry({
          areaId: room.id,
          gridX1: room.x1,
          gridY1: room.y1,
          gridX2: room.x2,
          gridY2: room.y2,
          floor: room.floor,
          color: room.color, // color desde la API
          roomMeshes,
          floorGroups,
          roomMap: liveRoomMap,
        });
        liveRoomMap[room.id] = { ...room };
      }
      // Crear o actualizar la etiqueta flotante del cuarto
      const mesh = roomMeshes.get(room.id);
      if (mesh) ensureRoomLabel(scene, room.id, room.label, mesh);
      else updateRoomLabel(room.id, room.label);
    }

    // Cargar muebles de las áreas ya posicionadas (coords reales en liveRoomMap)
    refreshMuebles(areas.map((a) => ({ id: a.id })));
  })
  .catch((err) => console.warn("[SIAST3D] No se pudo cargar áreas desde API:", err.message));

// Lista de rooms actualmente en memoria para labels e info panel
const allRoomsLive = () => Object.values(liveRoomMap);

// ════════════════════════════════════════════════════════════
// CÁMARA
// ════════════════════════════════════════════════════════════
const { camera, controls } = createCamera(renderer);

// ════════════════════════════════════════════════════════════
// LABELS
// ════════════════════════════════════════════════════════════
addLabels(scene, roomMeshes, allRoomsLive());

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
// clickableMeshes es un array vivo: se regenera en onPointerClick para incluir meshes nuevos
let clickableMeshes = [...roomMeshes.values()];

const onPointerClick = (e) => {
  if (embedMode) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // Prioridad: muebles visibles (LOD) por estar en primer plano al hacer zoom
  const muebleHits = raycaster.intersectObjects(furniture.visibleMeshes());
  if (muebleHits.length) {
    const m = muebleHits[0].object;
    const { muebleId, areaId, label, tipo } = m.userData;
    parent?.postMessage(
      { type: "MUEBLE_CLICKED", payload: { muebleId, areaId, label, tipo } },
      "*",
    );
    return;
  }

  // Regenerar la lista de meshes clickeables para reflejar reconstrucciones de geometría
  clickableMeshes = [...roomMeshes.values()];
  const hits = raycaster.intersectObjects(clickableMeshes);
  if (!hits.length) {
    hideInfoPanel();
    return;
  }

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
    const room = liveRoomMap[roomId];
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

  /**
   * Actualiza el label de un cuarto en tiempo real.
   * Modifica liveRoomMap en memoria y re-dibuja el sprite de texto.
   *
   * @param {string} areaId   - id del cuarto
   * @param {string} newLabel - nuevo texto a mostrar
   */
  updateAreaLabel(areaId, newLabel) {
    if (!areaId || !newLabel) return;

    // Actualizar el mapa vivo en memoria
    if (liveRoomMap[areaId]) {
      liveRoomMap[areaId].label = newLabel;
    }

    // Actualizar la malla del cuarto (userData) para que el panel de click sea consistente
    const mesh = roomMeshes.get(areaId);
    if (mesh) {
      mesh.userData.label = newLabel;
    }

    // Re-dibujar el sprite flotante
    updateRoomLabel(areaId, newLabel);
  },

  /**
   * Destruye el mesh de un área y lo reconstruye con nuevas coordenadas de cuadrícula.
   * Actualiza liveRoomMap en memoria.
   *
   * @param {string} areaId
   * @param {number} gridX1
   * @param {number} gridY1
   * @param {number} gridX2
   * @param {number} gridY2
   * @param {number} floor
   */
  updateAreaGeometry(areaId, gridX1, gridY1, gridX2, gridY2, floor) {
    if (!areaId || gridX1 == null || gridY1 == null || gridX2 == null || gridY2 == null) return;

    const resolvedFloor = floor ?? liveRoomMap[areaId]?.floor ?? 0;

    rebuildRoomGeometry({
      areaId,
      gridX1,
      gridY1,
      gridX2,
      gridY2,
      floor: resolvedFloor,
      roomMeshes,
      floorGroups,
      roomMap: liveRoomMap,
    });

    console.info(
      `[SIAST3D] Geometría de "${areaId}" actualizada: (${gridX1},${gridY1})→(${gridX2},${gridY2}) piso ${resolvedFloor}`,
    );

    // Reposicionar los muebles del área editada para que sigan alineados
    refreshMuebles(Object.keys(liveRoomMap).map((id) => ({ id })));
  },

  /**
   * Resalta un mueble específico: cambia al piso del área, coloca el pin de
   * ticket sobre el mueble y hace zoom suave hacia él.
   * @param {number} muebleId
   * @param {string} [areaId] - opcional; si se omite se infiere del registro del mueble
   */
  highlightMueble(muebleId, areaId) {
    const entry = furniture.getEntry(muebleId);
    if (!entry) {
      console.warn(`[SIAST3D] Mueble ${muebleId} no encontrado`);
      return;
    }
    const resolvedAreaId = areaId ?? entry.areaId;
    const room = liveRoomMap[resolvedAreaId];
    const floor = room?.floor ?? 0;

    // Asegurar que el piso del mueble esté visible
    if (activeFloor !== -1 && activeFloor !== floor) {
      this.goToFloor(floor);
    } else if (floor >= 0) {
      flyToFloor(camera, controls, floor);
    }

    // Colocar pin sobre el mueble (se muestra cuando el LOD lo hace visible)
    furniture.showPin(muebleId);

    // Resaltar también el área padre para contexto
    highlightRoom(roomMeshes, resolvedAreaId);
  },

  /** Oculta el pin de ticket de muebles. */
  hideMueblePin() {
    furniture.hidePin();
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
  const allowed = ["http://localhost:5173", "http://localhost:5101", window.location.origin];
  if (!allowed.includes(e.origin)) return;
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
        ...liveRoomMap[payload.area],
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
    case "HIGHLIGHT_MUEBLE": {
      // Soporta { type, payload: { muebleId, areaId } } y { type, muebleId, areaId }
      const p = payload ?? e.data;
      window.SIAST3D.highlightMueble(p.muebleId, p.areaId);
      break;
    }
    case "HIDE_MUEBLE_PIN":
      window.SIAST3D.hideMueblePin();
      break;
  }
});

// Listener separado para eventos del módulo de Áreas del Edificio.
// Formatos:
//   { type: 'siast:updateAreaLabel',    areaId, label }
//   { type: 'siast:updateAreaGeometry', areaId, gridX1, gridY1, gridX2, gridY2, floor }
window.addEventListener("message", (event) => {
  const allowedOrigins = ["http://localhost:5173", "http://localhost:5101", window.location.origin];
  if (!allowedOrigins.includes(event.origin)) return;
  const msg = event.data ?? {};

  if (msg.type === "siast:updateAreaLabel" && msg.areaId && msg.label) {
    window.SIAST3D?.updateAreaLabel(msg.areaId, msg.label);
    return;
  }

  if (msg.type === "siast:updateAreaGeometry" && msg.areaId) {
    window.SIAST3D?.updateAreaGeometry(
      msg.areaId,
      msg.gridX1,
      msg.gridY1,
      msg.gridX2,
      msg.gridY2,
      msg.floor,
    );
    return;
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
        setTimeout(() => {
          loader.style.display = "none";
        }, 700);
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
let _rafId = null;

const render = () => {
  _rafId = requestAnimationFrame(render);
  const delta = clock.getDelta();

  controls.update();
  updateHighlight(delta);
  updateLoginCamera(camera, controls, delta);
  updateLabelVisibility(camera, floorGroups, activeFloor);
  furniture.updateVisibility(camera, activeFloor);

  renderer.render(scene, camera);
};

// Pausar render cuando la pestaña/iframe no está visible
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  } else {
    if (_rafId === null) {
      clock.getDelta(); // descartar delta acumulado durante la pausa
      render();
    }
  }
});

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
