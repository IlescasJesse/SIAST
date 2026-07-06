/**
 * FloorPlanMobile — Planta 2D SVG de solo lectura para mobile/tablet.
 *
 * Dibuja la huella en U completa del piso activo con las áreas coloreadas.
 * Tap en un área → dispara onSelect(area), misma firma que AreaGridEditor.
 *
 * Intencionalmente NO importa Three.js ni el visor 3D.
 * El componente es puro SVG en-línea; cero dependencias pesadas.
 *
 * Props:
 *   areas      — array de AreaEdificio del piso activo (ya filtradas por floor)
 *   selectedId — id del área seleccionada (string | null)
 *   onSelect   — (area) => void
 */

// ── Constantes de grid (idénticas a AreaGridEditor) ──────────────────────────
const COLS = 32;
const ROWS = 27;

// Celda en px: 14 px da un SVG de 448 × 378, manejable en mobile
const CELL = 14;

const SVG_W = COLS * CELL; // 448
const SVG_H = ROWS * CELL; // 378

// Misma lógica de flip que AreaGridEditor con flipY=true
// y=0 → fila 0 (frente/entrada), y crece hacia abajo (filas altas = posterior)
// flipY=true ⟹ svgY = gridY1 * CELL  (sin invertir)
const toSvgY = (gridY) => gridY * CELL;
const toSvgX = (gridX) => gridX * CELL;

// ── Huella U del edificio ─────────────────────────────────────────────────────
// Ala Izq: cols 0→14, filas 0→27
// Conector: cols 14→19, filas 14→27  (fondo)
// Ala Der:  cols 19→32, filas 0→27
// Patio:    cols 14→19, filas 0→14  (frente — vacío)
const BUILDING_PATH = (() => {
  const c = (x, y) => `${x * CELL},${y * CELL}`;
  // Recorre el perímetro exterior en U, sentido horario
  return [
    `M ${c(0, 0)}`,
    `L ${c(14, 0)}`,
    `L ${c(14, 14)}`, // bajamos hasta inicio del conector (frente del patio)
    `L ${c(19, 14)}`,
    `L ${c(19, 0)}`,
    `L ${c(32, 0)}`,
    `L ${c(32, 27)}`,
    `L ${c(0, 27)}`,
    "Z",
  ].join(" ");
})();

// ── Paleta de 12 colores institucionales (mirror de AreaGridEditor) ───────────
const PRIMARY_H = 342;
const PRIMARY_S = 62;
const PRIMARY_L = 38;

function hslStr(dH = 0, dS = 0, dL = 0) {
  const h = (((PRIMARY_H + dH) % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, PRIMARY_S + dS));
  const l = Math.max(0, Math.min(100, PRIMARY_L + dL));
  return `hsl(${h},${s}%,${l}%)`;
}

const PALETTE = [
  hslStr(0, 0, 0),
  hslStr(-20, -15, +18),
  hslStr(+20, +10, -10),
  hslStr(-40, -20, +28),
  hslStr(+15, -5, +12),
  hslStr(-60, -8, +20),
  hslStr(+30, +15, -8),
  hslStr(0, +18, +22),
  hslStr(-80, -15, +30),
  hslStr(+40, -5, -5),
  hslStr(-10, -8, +38),
  hslStr(+25, +20, +8),
];

const colorForIdx = (i) => PALETTE[i % PALETTE.length];

// ── Zonas para etiquetas contextuales ─────────────────────────────────────────
const ZONE_LABELS = [
  { label: "Ala Izquierda", x: 7 * CELL, y: 6 * CELL, color: "#3f51b5" },
  { label: "Conector", x: 16.5 * CELL, y: 22 * CELL, color: "#7b1fa2" },
  { label: "Ala Derecha", x: 25.5 * CELL, y: 6 * CELL, color: "#0277bd" },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function FloorPlanMobile({ areas = [], selectedId = null, onSelect }) {
  // Construir mapa de colores estables ordenando por id para consistencia
  const sorted = [...areas].sort((a, b) => a.id.localeCompare(b.id));
  const colorMap = {};
  sorted.forEach((a, i) => {
    colorMap[a.id] = colorForIdx(i);
  });

  const handleTap = (area) => {
    if (onSelect) onSelect(area);
  };

  const areaRects = areas
    .filter((a) => a.gridX1 != null && a.gridY1 != null && a.gridX2 != null && a.gridY2 != null)
    .map((area) => {
      const x = toSvgX(area.gridX1);
      const y = toSvgY(area.gridY1);
      const w = Math.max(CELL, (area.gridX2 - area.gridX1) * CELL);
      const h = Math.max(CELL, (area.gridY2 - area.gridY1) * CELL);
      const isSelected = area.id === selectedId;
      const isCommon = area.esComun ?? false;
      const fillColor = isCommon ? "#00bcd4" : (colorMap[area.id] ?? "#9d2449");
      const fillOpacity = isSelected ? 0.92 : isCommon ? 0.55 : 0.68;
      const labelText = area.label.length > 14 ? area.label.slice(0, 12) + "…" : area.label;
      const fontSize = Math.min(9, w / 5, h / 2.2);

      return (
        <g
          key={area.id}
          onClick={() => handleTap(area)}
          style={{ cursor: "pointer" }}
          role="button"
          aria-label={area.label}
          aria-pressed={isSelected}
        >
          {/* Halo de selección */}
          {isSelected && (
            <rect
              x={x - 2}
              y={y - 2}
              width={w + 4}
              height={h + 4}
              rx={5}
              fill="none"
              stroke={fillColor}
              strokeWidth={3}
              strokeOpacity={0.45}
              style={{ pointerEvents: "none" }}
            />
          )}

          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={isSelected ? fillColor : isCommon ? "#00838f" : fillColor}
            strokeWidth={isSelected ? 2.5 : 1.5}
            rx={2}
            style={{ touchAction: "manipulation" }}
          />

          {/* Label — solo si hay espacio */}
          {w > 18 && h > 10 && fontSize > 4 && (
            <text
              x={x + w / 2}
              y={y + h / 2 + 3}
              fontSize={fontSize}
              textAnchor="middle"
              fill="#ffffff"
              fontWeight={isSelected ? "800" : "600"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {labelText}
            </text>
          )}

          {/* Punto indicador área común */}
          {isCommon && w > 10 && h > 10 && (
            <circle
              cx={x + w - 4}
              cy={y + 4}
              r={3}
              fill="#00bcd4"
              stroke="#ffffff"
              strokeWidth={0.8}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      );
    });

  // Padding alrededor del SVG para etiquetas de zona
  const PAD = 8;
  const viewBox = `-${PAD} -${PAD} ${SVG_W + PAD * 2} ${SVG_H + PAD * 2}`;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        fontFamily: "Inter, Roboto, sans-serif",
        background: "transparent",
        touchAction: "manipulation",
      }}
      aria-label="Planta del edificio"
      role="img"
    >
      {/* Fondo blanco del área de dibujo */}
      <rect x={-PAD} y={-PAD} width={SVG_W + PAD * 2} height={SVG_H + PAD * 2} fill="#fafafa" />

      {/* Cuadrícula ligera */}
      {Array.from({ length: COLS + 1 }, (_, c) => (
        <line
          key={`v${c}`}
          x1={c * CELL}
          y1={0}
          x2={c * CELL}
          y2={SVG_H}
          stroke="#e0e0e0"
          strokeWidth={0.4}
        />
      ))}
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line
          key={`h${r}`}
          x1={0}
          y1={r * CELL}
          x2={SVG_W}
          y2={r * CELL}
          stroke="#e0e0e0"
          strokeWidth={0.4}
        />
      ))}

      {/* Huella U del edificio — relleno gris muy suave */}
      <path
        d={BUILDING_PATH}
        fill="rgba(200,200,220,0.18)"
        stroke="rgba(90,90,140,0.45)"
        strokeWidth={1.5}
        fillRule="nonzero"
      />

      {/* Patio abierto — relleno diferenciado */}
      <rect
        x={14 * CELL}
        y={0}
        width={5 * CELL}
        height={14 * CELL}
        fill="rgba(180,220,180,0.25)"
        stroke="rgba(80,140,80,0.30)"
        strokeWidth={1}
        strokeDasharray="4,3"
      />
      <text
        x={16.5 * CELL}
        y={7 * CELL}
        fontSize={7}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(60,120,60,0.65)"
        fontWeight={700}
        letterSpacing={1}
        style={{ userSelect: "none", pointerEvents: "none" }}
        transform={`rotate(-90 ${16.5 * CELL} ${7 * CELL})`}
      >
        PATIO
      </text>

      {/* Etiquetas de zona */}
      {ZONE_LABELS.map((z) => (
        <text
          key={z.label}
          x={z.x}
          y={z.y}
          fontSize={6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={z.color + "66"}
          fontWeight={800}
          letterSpacing={0.8}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {z.label.toUpperCase()}
        </text>
      ))}

      {/* Áreas del piso activo */}
      {areaRects}

      {/* Indicador de orientación */}
      <text
        x={SVG_W / 2}
        y={-PAD + 1}
        fontSize={6}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="rgba(120,120,160,0.60)"
        fontWeight={700}
        letterSpacing={1}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        ▲ FRENTE / ENTRADA
      </text>
      <text
        x={SVG_W / 2}
        y={SVG_H + PAD - 1}
        fontSize={6}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(120,120,160,0.60)"
        fontWeight={700}
        letterSpacing={1}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        ▼ POSTERIOR
      </text>
    </svg>
  );
}
