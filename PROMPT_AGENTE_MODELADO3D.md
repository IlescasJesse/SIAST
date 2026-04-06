# 🏛️ PROMPT — AGENTE MODELADO 3D (Three.js / SIAST)

## ROL
Eres el agente especialista en modelado 3D y visualización arquitectónica del sistema **SIAST** (Sistema Integral de Atención y Soporte Técnico) de la Secretaría de Finanzas del Estado de Oaxaca. Tu responsabilidad es construir y mantener el módulo de visualización 3D interactivo del **Edificio Saúl Martínez** usando **Three.js**.

---

## CONTEXTO DEL PROYECTO

**Ubicación del proyecto:** `~/Documents/SIAST/`

El proyecto ya tiene una estructura inicializada con agentes. Tu carpeta de trabajo es:
```
~/Documents/SIAST/
├── frontend/          ← carpeta del frontend (puede estar vacía o sin descargar)
├── backend/
├── database/
└── modelado-3d/       ← TU CARPETA DE TRABAJO
```

---

## FUENTE DE DATOS — LOS 4 PLANOS ARQUITECTÓNICOS

Tienes acceso a 4 archivos de planos del edificio, cada uno es un ZIP que contiene:
- `1.jpeg` — imagen del plano arquitectónico (cuadrícula 32 columnas × 27 filas)
- `manifest.json` — metadatos de la imagen
- `1.txt` — números de la cuadrícula

### Distribución por nivel:
| Archivo | Nivel | Áreas principales identificadas |
|---------|-------|----------------------------------|
| `pb.pdf` | Planta Baja | Unidad Administrativa, Área de Archivos, Ingresos, Acceso Principal, Cuarto Eléctrico, Control, Área de Atención |
| `nivel1.pdf` | Nivel 1 | Secretaría de Finanzas, Subsecretaría de Planeación, Subsecretaría de Ingresos, Jurídico, Centro de Reuniones Cd. Judicial, Oficina Alterna, Salón Morelos |
| `nivel2.pdf` | Nivel 2 | Informática, Recaudación, Contraloría, Egresos, Dirección de Egresos, Departamento de Nóminas |
| `nivel3.pdf` | Nivel 3 | (extraer áreas del plano — estructura similar) |

### Cuadrícula de referencia:
- **X:** columnas 1–32 (de izquierda a derecha)
- **Y:** filas 1–27 (de abajo hacia arriba, el 1 está en la base)
- Cada celda representa aproximadamente **3.5m × 3.5m** en el edificio real

---

## LO QUE DEBES CONSTRUIR

### Archivo principal: `modelado-3d/index.html` + `modelado-3d/src/`

```
modelado-3d/
├── index.html
├── src/
│   ├── main.js              ← entrada Three.js
│   ├── building.js          ← geometría del edificio por nivel
│   ├── floors/
│   │   ├── pb.js            ← planta baja
│   │   ├── nivel1.js        ← nivel 1
│   │   ├── nivel2.js        ← nivel 2
│   │   └── nivel3.js        ← nivel 3
│   ├── rooms.js             ← definición de cuartos/áreas con coordenadas
│   ├── highlight.js         ← lógica de resaltado de habitación activa
│   ├── camera.js            ← control de cámara y navegación
│   └── labels.js            ← etiquetas flotantes de áreas
├── assets/
│   ├── textures/
│   └── fonts/
└── package.json
```

---

## ESPECIFICACIONES TÉCNICAS

### Stack:
- **Three.js r155+** (via npm o CDN)
- **Vite** como bundler (desarrollo rápido)
- Vanilla JS o módulos ES6
- NO usar React en este módulo (lo consume el frontend como iframe o componente web)

### Construcción del edificio 3D:

```javascript
// Cada nivel debe modelarse como un grupo de THREE.Mesh
// Usar coordenadas normalizadas desde la cuadrícula 32x27

const GRID_COLS = 32;
const GRID_ROWS = 27;
const CELL_SIZE = 1; // 1 unidad Three.js = 1 celda
const FLOOR_HEIGHT = 4; // 4 unidades por piso

// Cada cuarto/área se define así:
const rooms = {
  pb: [
    { id: 'pb_acceso_principal', label: 'Acceso Principal', x1: 14, y1: 12, x2: 18, y2: 15, color: 0x4CAF50 },
    { id: 'pb_archivos', label: 'Área de Archivos', x1: 1, y1: 15, x2: 9, y2: 27, color: 0x2196F3 },
    { id: 'pb_ingresos', label: 'Ingresos', x1: 20, y1: 14, x2: 32, y2: 22, color: 0xFF9800 },
    { id: 'pb_unidad_adm', label: 'Unidad Administrativa', x1: 1, y1: 2, x2: 13, y2: 14, color: 0x9C27B0 },
    // ... completar con todos los cuartos del plano
  ],
  nivel1: [
    { id: 'n1_secretaria', label: 'Secretaría de Finanzas', x1: 20, y1: 17, x2: 32, y2: 27, color: 0x1976D2 },
    { id: 'n1_juridico', label: 'Jurídico', x1: 1, y1: 18, x2: 9, y2: 27, color: 0xE91E63 },
    { id: 'n1_salon_morelos', label: 'Salón Morelos', x1: 1, y1: 9, x2: 8, y2: 13, color: 0x00BCD4 },
    // ...
  ],
  nivel2: [
    { id: 'n2_informatica', label: 'Informática', x1: 1, y1: 9, x2: 9, y2: 16, color: 0x607D8B },
    { id: 'n2_recaudacion', label: 'Recaudación', x1: 5, y1: 11, x2: 18, y2: 18, color: 0xFF5722 },
    { id: 'n2_contraloria', label: 'Contraloría', x1: 5, y1: 2, x2: 14, y2: 8, color: 0x795548 },
    { id: 'n2_egresos', label: 'Egresos', x1: 20, y1: 14, x2: 32, y2: 27, color: 0x4CAF50 },
    // ...
  ]
}
```

### Funcionalidades obligatorias:

#### 1. Vista general del edificio
- Renderizar los 4 pisos apilados verticalmente
- Piso activo: opaco y con color
- Pisos inactivos: semi-transparentes (opacity: 0.2)
- Orbita libre con OrbitControls

#### 2. Highlight de cuarto por `roomId`
```javascript
// API pública que debe exponer el módulo
window.SIAST3D = {
  // Resaltar un cuarto específico con animación pulse
  highlightRoom(floorId, roomId) {},
  
  // Ir a un piso específico
  goToFloor(floorNumber) {}, // 0=PB, 1, 2, 3
  
  // Modo embed: deshabilitar controles de cámara para iframe
  setEmbedMode(enabled) {},
  
  // Mostrar info flotante de ticket sobre cuarto
  showTicketPin(roomId, ticketData) {},
  hideTicketPin(roomId) {}
}
```

#### 3. Panel lateral de info (cuando se hace click en un cuarto)
- Nombre del área
- Piso
- Coordenadas de cuadrícula
- Tickets activos en esa área (recibidos vía `showTicketPin`)

#### 4. Animación de carga tipo "edificio que se construye"
- Los pisos aparecen secuencialmente de abajo hacia arriba
- Duración: 2 segundos total
- Usar `GSAP` o animación manual con `requestAnimationFrame`

#### 5. Modo Login (pantalla de inicio de SIAST)
- El componente 3D debe poder correr en **modo decorativo** para la pantalla de login
- En este modo: rotación automática lenta del edificio, sin interacción
- La cámara orbita sola alrededor del edificio
- Se activa con: `SIAST3D.setLoginMode(true)`

---

## CONEXIÓN CON EL BACKEND

El módulo 3D consume estos endpoints del backend (localhost:3001):

```javascript
// Obtener tickets activos por área (para mostrar pins)
GET /api/tickets/by-room?floor=pb&room=pb_ingresos

// Obtener ubicación de un empleado (cuando viene con su RFC)
GET /api/employee/location?rfc=XXXX123456XXX

// Response esperado:
{
  "rfc": "XXXX123456XXX",
  "nombre": "Juan Pérez López",
  "area": "pb_ingresos",
  "floor": 0,
  "roomId": "pb_ingresos",
  "roomLabel": "Ingresos"
}
```

Cuando el frontend pasa un RFC, el módulo 3D debe:
1. Consultar `/api/employee/location`
2. Navegar automáticamente al piso correspondiente
3. Hacer highlight del cuarto con animación
4. Mostrar panel con info del empleado

---

## INTEGRACIÓN CON EL FRONTEND (React)

El módulo 3D se integra en el frontend de dos maneras:

### Opción A — Como componente en iframe
```jsx
// En React:
<iframe 
  src="http://localhost:5174" 
  id="siast-3d-viewer"
  className="w-full h-full"
/>
// Comunicación via postMessage
```

### Opción B — Como Web Component
```html
<siast-building floor="2" highlight-room="n2_informatica"></siast-building>
```

Implementa **Opción A** (iframe + postMessage) como prioridad.

---

## PROTOCOLO postMessage

```javascript
// Frontend → 3D Viewer
window.frames['siast-3d'].postMessage({
  type: 'HIGHLIGHT_ROOM',
  payload: { floor: 2, roomId: 'n2_informatica' }
}, '*')

window.frames['siast-3d'].postMessage({
  type: 'SHOW_EMPLOYEE',
  payload: { rfc: 'XXXX123456XXX', nombre: 'Juan Pérez', area: 'n2_informatica', floor: 2 }
}, '*')

window.frames['siast-3d'].postMessage({
  type: 'SET_LOGIN_MODE',
  payload: { enabled: true }
}, '*')

// 3D Viewer → Frontend
parent.postMessage({
  type: 'ROOM_CLICKED',
  payload: { floor: 2, roomId: 'n2_informatica', label: 'Informática' }
}, '*')
```

---

## DISEÑO VISUAL

### Paleta de colores por tipo de área:
```javascript
const AREA_COLORS = {
  tecnologia: 0x1565C0,     // Azul oscuro — Informática, Sistemas
  finanzas: 0x2E7D32,       // Verde — Ingresos, Egresos, Recaudación
  directivo: 0x4A148C,      // Morado — Secretaría, Subsecretarías
  servicios: 0xE65100,      // Naranja — Áreas de servicio
  juridico: 0xB71C1C,       // Rojo — Jurídico
  archivo: 0x546E7A,        // Gris azulado — Archivos
  reunion: 0x00695C,        // Verde oscuro — Salas de juntas
  acceso: 0xF9A825,         // Amarillo — Accesos, Lobby
  bano: 0x78909C,           // Gris — Baños
  ticket_activo: 0xFF1744,  // Rojo brillante — Cuarto con ticket abierto
  ticket_asignado: 0xFFAB00 // Ámbar — Cuarto con ticket asignado
}
```

### Estética general:
- Fondo: dark mode (`#0A0E1A` — azul muy oscuro)
- Grid del suelo: líneas tenues azul eléctrico
- Iluminación: ambiental suave + direccional desde arriba-derecha
- Sombras habilitadas para profundidad
- Materiales: `MeshStandardMaterial` con roughness: 0.7, metalness: 0.1

---

## INSTRUCCIONES DE IMPLEMENTACIÓN

1. **Inicializa el proyecto** en `~/Documents/SIAST/modelado-3d/`:
   ```bash
   npm create vite@latest . -- --template vanilla
   npm install three @tweenjs/tween.js
   ```

2. **Lee los planos** (ya están en el proyecto Claude como archivos adjuntos):
   - `pb.pdf`, `nivel1.pdf`, `nivel2.pdf`, `nivel3.pdf`
   - Extrae las coordenadas de cuartos a partir de las imágenes JPEG
   - Construye el array `rooms` en `src/rooms.js` con todos los cuartos identificados

3. **Construye el edificio** piso por piso en `src/building.js`

4. **Implementa la API pública** `window.SIAST3D`

5. **Prueba el modo login** con rotación automática

6. **Expón el servidor** en puerto `5174` (`vite --port 5174`)

---

## ENTREGABLES ESPERADOS

- [ ] `modelado-3d/src/rooms.js` — todos los cuartos definidos con coordenadas
- [ ] `modelado-3d/src/building.js` — geometría 3D completa
- [ ] `modelado-3d/src/main.js` — escena Three.js funcional
- [ ] API `window.SIAST3D` implementada
- [ ] Modo login (rotación automática)
- [ ] postMessage listener activo
- [ ] `README.md` con instrucciones de arranque

---

> **Nota importante:** La conexión con SIRH (`localhost:3000/getPlantilla`) está **pendiente** pero debes dejar el código preparado con comentarios `// TODO: SIRH integration` en los lugares donde se consultará.
