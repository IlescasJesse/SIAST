/**
 * AreaGridEditor — SVG editor de cuadrícula para pisos del edificio.
 *
 * Props:
 *   areas          — array de AreaEdificio filtradas por piso + zona
 *   allAreas       — todas las áreas del piso (para guías de alineación)
 *   selectedId     — id del área seleccionada (string | null)
 *   onSelect       — (area) => void
 *   onResize       — (id, { gridX1, gridY1, gridX2, gridY2 }) => void
 *   onMove         — (id, { gridX1, gridY1, gridX2, gridY2 }) => void
 *   floorLabel     — texto del piso + zona
 *   colStart       — columna absoluta de inicio de la zona (0-based)
 *   colCount       — número de columnas a mostrar en esta zona
 *   pendingChanges — objeto { [areaId]: {...} } para resaltar pendientes con borde ámbar
 *   compact        — bool — celdas más pequeñas (vista completa 32 cols)
 */

import { useRef, useCallback, useState } from "react";

// ── Color primario institucional ──────────────────────────────────────────────
const PRIMARY_H = 342;
const PRIMARY_S = 62;
const PRIMARY_L = 38;

function hsl(dH = 0, dS = 0, dL = 0, a = 1) {
  const h = (((PRIMARY_H + dH) % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, PRIMARY_S + dS));
  const l = Math.max(0, Math.min(100, PRIMARY_L + dL));
  return a < 1 ? `hsla(${h},${s}%,${l}%,${a})` : `hsl(${h},${s}%,${l}%)`;
}

const PRIMARY_MAIN = hsl();
const PRIMARY_ALPHA = (a) => hsl(0, 0, 0, a);

// ── Constantes fijas de la cuadrícula ────────────────────────────────────────
const COLS = 32;
const ROWS = 27;
const CELL_NORMAL = 24;
const CELL_COMPACT = 14; // usado en vista completa
const HANDLE_R = 9;
const MOVE_HANDLE_R = 13;

// Columnas relativas que son pasillo (para zonas de 14 cols)
const CORRIDOR_COLS = [4, 9];

// ── Paleta de 12 colores por área ─────────────────────────────────────────────
const palette = [
  hsl(0, 0, 0),
  hsl(-20, -15, +18),
  hsl(+20, +10, -10),
  hsl(-40, -20, +28),
  hsl(+15, -5, +12),
  hsl(-60, -8, +20),
  hsl(+30, +15, -8),
  hsl(0, +18, +22),
  hsl(-80, -15, +30),
  hsl(+40, -5, -5),
  hsl(-10, -8, +38),
  hsl(+25, +20, +8),
];

const colorForIndex = (idx) => palette[idx % palette.length];

// Zona de conector inicia en fila 14
const CONNECTOR_ROW_START = 14;

// ── Componente principal ──────────────────────────────────────────────────────

export function AreaGridEditor({
  areas = [],
  allAreas = [],
  selectedId,
  onSelect,
  onResize,
  onMove,
  floorLabel,
  colStart = 0,
  colCount = 16,
  flipY = false,
  zoneKey = null,
  mueblesPorArea = {},
  pendingChanges = {},
  conflictIds = new Set(),
  compact = false,
}) {
  const CELL = compact ? CELL_COMPACT : CELL_NORMAL;
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const didDragRef = useRef(false);
  const flipYRef = useRef(flipY);
  flipYRef.current = flipY;

  // Shadow rect durante drag (coords SVG relativas)
  const [dragShadow, setDragShadow] = useState(null);
  // Guías de alineación activas durante drag
  const [alignGuides, setAlignGuides] = useState([]);

  const colOffset = colStart;
  const SVG_W = colCount * CELL;
  const SVG_H = ROWS * CELL;

  // Color por área
  const colorMap = {};
  areas.forEach((a, i) => {
    colorMap[a.id] = colorForIndex(i);
  });

  // ── Líneas de cuadrícula ──────────────────────────────────────────────────
  const gridLines = [];
  for (let c = 0; c <= colCount; c++) {
    gridLines.push(
      <line
        key={`v${c}`}
        x1={c * CELL}
        y1={0}
        x2={c * CELL}
        y2={SVG_H}
        stroke="#e0e0e0"
        strokeWidth={0.5}
      />,
    );
  }
  for (let r = 0; r <= ROWS; r++) {
    gridLines.push(
      <line
        key={`h${r}`}
        x1={0}
        y1={r * CELL}
        x2={SVG_W}
        y2={r * CELL}
        stroke="#e0e0e0"
        strokeWidth={0.5}
      />,
    );
  }

  // ── Pasillos ──────────────────────────────────────────────────────────────
  const corridorStripes =
    colCount >= 14 && zoneKey !== "full"
      ? CORRIDOR_COLS.map((cc) => {
          const svgX = cc * CELL;
          const midY = SVG_H / 2;
          return (
            <g key={`pasillo-${cc}`} style={{ pointerEvents: "none" }}>
              <rect
                x={svgX}
                y={0}
                width={CELL}
                height={SVG_H}
                fill="rgba(155,155,195,0.20)"
                stroke="none"
              />
              <line
                x1={svgX}
                y1={0}
                x2={svgX}
                y2={SVG_H}
                stroke="rgba(100,100,160,0.45)"
                strokeWidth={1}
                strokeDasharray="5,4"
              />
              <line
                x1={svgX + CELL}
                y1={0}
                x2={svgX + CELL}
                y2={SVG_H}
                stroke="rgba(100,100,160,0.45)"
                strokeWidth={1}
                strokeDasharray="5,4"
              />
              {!compact && (
                <text
                  x={svgX + CELL / 2}
                  y={midY}
                  fontSize={7}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(70,70,130,0.60)"
                  fontWeight={700}
                  letterSpacing={2.5}
                  transform={`rotate(-90 ${svgX + CELL / 2} ${midY})`}
                  style={{ userSelect: "none" }}
                >
                  PASILLO
                </text>
              )}
            </g>
          );
        })
      : [];

  // ── Indicadores de zona ───────────────────────────────────────────────────
  const orientationOverlays = (() => {
    if (compact) return null; // en vista completa no se muestran overlays de zona
    const shadeY = CONNECTOR_ROW_START * CELL;
    const midShadeY = shadeY / 2;
    const midActiveY = shadeY + (SVG_H - shadeY) / 2;

    const labelFrente = (
      <text
        key="frente"
        x={SVG_W / 2}
        y={-14}
        fontSize={7}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(120,120,160,0.65)"
        fontWeight={700}
        letterSpacing={1}
        style={{ userSelect: "none" }}
      >
        ▲ FRENTE
      </text>
    );
    const labelPosterior = (
      <text
        key="posterior"
        x={SVG_W / 2}
        y={SVG_H + 22}
        fontSize={7}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(120,120,160,0.65)"
        fontWeight={700}
        letterSpacing={1}
        style={{ userSelect: "none" }}
      >
        ▼ POSTERIOR
      </text>
    );

    if (zoneKey === "conector") {
      return (
        <g style={{ pointerEvents: "none" }}>
          <rect x={0} y={0} width={SVG_W} height={shadeY} fill="rgba(160,160,200,0.20)" />
          <text
            x={SVG_W / 2}
            y={midShadeY}
            fontSize={7.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(90,90,140,0.45)"
            fontWeight={700}
            letterSpacing={2}
            style={{ userSelect: "none" }}
            transform={`rotate(-90 ${SVG_W / 2} ${midShadeY})`}
          >
            SOLO ALAS
          </text>
          <line
            x1={0}
            y1={shadeY}
            x2={SVG_W}
            y2={shadeY}
            stroke="rgba(80,80,160,0.50)"
            strokeWidth={1.5}
            strokeDasharray="5,3"
          />
          <text
            x={SVG_W / 2}
            y={shadeY - 2}
            fontSize={6}
            textAnchor="middle"
            dominantBaseline="auto"
            fill="rgba(80,80,160,0.60)"
            fontWeight={700}
            style={{ userSelect: "none" }}
          >
            ── INICIO DEL CONECTOR ──
          </text>
          <text
            x={3}
            y={midActiveY}
            fontSize={7}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(60,80,160,0.75)"
            fontWeight={700}
            style={{ userSelect: "none" }}
            transform={`rotate(-90 3 ${midActiveY})`}
          >
            ← ALA IZQUIERDA
          </text>
          <text
            x={SVG_W - 3}
            y={midActiveY}
            fontSize={7}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(60,80,160,0.75)"
            fontWeight={700}
            style={{ userSelect: "none" }}
            transform={`rotate(90 ${SVG_W - 3} ${midActiveY})`}
          >
            ALA DERECHA →
          </text>
          {labelFrente}
          {labelPosterior}
        </g>
      );
    }

    if (zoneKey === "izq" || zoneKey === "der") {
      const isIzq = zoneKey === "izq";
      const connX = isIzq ? SVG_W - 3 : 3;
      const rot = isIzq ? 90 : -90;
      const connLabel = isIzq ? "CONECTOR →" : "← CONECTOR";
      const midConY = shadeY + (SVG_H - shadeY) / 2;
      return (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={0}
            y={shadeY}
            width={SVG_W}
            height={SVG_H - shadeY}
            fill="rgba(130,180,130,0.07)"
          />
          <line
            x1={0}
            y1={shadeY}
            x2={SVG_W}
            y2={shadeY}
            stroke="rgba(60,130,60,0.28)"
            strokeWidth={1}
            strokeDasharray="4,3"
          />
          <text
            x={connX}
            y={midConY}
            fontSize={6.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(40,110,40,0.65)"
            fontWeight={700}
            style={{ userSelect: "none" }}
            transform={`rotate(${rot} ${connX} ${midConY})`}
          >
            {connLabel}
          </text>
          {labelFrente}
          {labelPosterior}
        </g>
      );
    }

    return null;
  })();

  // ── Etiquetas de ejes ─────────────────────────────────────────────────────
  const colLabels = [];
  const colStep = compact
    ? Math.max(1, Math.floor(colCount / 6))
    : Math.max(1, Math.floor(colCount / 4));
  for (let c = 0; c < colCount; c += colStep) {
    colLabels.push(
      <text
        key={`cl${c}`}
        x={c * CELL + CELL / 2}
        y={SVG_H + 12}
        fontSize={compact ? 6 : 8}
        textAnchor="middle"
        fill="#9e9e9e"
      >
        {c + colOffset}
      </text>,
    );
  }
  const rowLabels = [];
  const rowStep = compact ? 6 : 4;
  for (let r = 0; r < ROWS; r += rowStep) {
    rowLabels.push(
      <text
        key={`rl${r}`}
        x={-4}
        y={flipY ? r * CELL + CELL / 2 + 3 : (ROWS - 1 - r) * CELL + CELL / 2 + 3}
        fontSize={compact ? 6 : 8}
        textAnchor="end"
        fill="#9e9e9e"
      >
        {r}
      </text>,
    );
  }

  // ── Guías de alineación ───────────────────────────────────────────────────
  const alignGuideLines = alignGuides.map((g, i) =>
    g.axis === "x" ? (
      <line
        key={`ag${i}`}
        x1={0}
        y1={g.value}
        x2={SVG_W}
        y2={g.value}
        stroke="rgba(255,152,0,0.7)"
        strokeWidth={1}
        strokeDasharray="4,3"
        style={{ pointerEvents: "none" }}
      />
    ) : (
      <line
        key={`ag${i}`}
        x1={g.value}
        y1={0}
        x2={g.value}
        y2={SVG_H}
        stroke="rgba(255,152,0,0.7)"
        strokeWidth={1}
        strokeDasharray="4,3"
        style={{ pointerEvents: "none" }}
      />
    ),
  );

  // ── Rectángulos de áreas ──────────────────────────────────────────────────
  const areaRects = areas.map((area) => {
    if (area.gridX1 == null || area.gridY1 == null || area.gridX2 == null || area.gridY2 == null) {
      return null;
    }

    const relX1 = (area.gridX1 ?? 0) - colOffset;
    const relX2 = (area.gridX2 ?? 0) - colOffset;
    const x = relX1 * CELL;
    const y = flipY ? (area.gridY1 ?? 0) * CELL : (ROWS - 1 - (area.gridY2 ?? 0)) * CELL;
    const w = Math.max(CELL, (relX2 - relX1) * CELL);
    const h = Math.max(CELL, ((area.gridY2 ?? 0) - (area.gridY1 ?? 0)) * CELL);
    const color = colorMap[area.id];
    const isSelected = area.id === selectedId;
    const isPending = !!pendingChanges[area.id];
    const isCommon = area.esComun ?? false;
    const isConflict = conflictIds.has(area.id);

    // Variante de color para área común: tinte cian sutil
    const fillColor = isCommon ? "#00bcd4" : (color ?? "#9d2449");
    const fillOpacity = isSelected ? 0.88 : isCommon ? 0.55 : 0.65;

    return (
      <g
        key={area.id}
        onClick={() => {
          if (didDragRef.current) return;
          onSelect(area);
        }}
        style={{ cursor: isSelected ? "move" : "pointer" }}
      >
        {/* Sombra de foco para seleccionada */}
        {isSelected && (
          <rect
            x={x - 3}
            y={y - 3}
            width={w + 6}
            height={h + 6}
            rx={6}
            fill="none"
            stroke={fillColor}
            strokeWidth={3}
            strokeOpacity={0.35}
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
          stroke={
            isConflict
              ? "#d32f2f"
              : isSelected
                ? fillColor
                : isPending
                  ? "#ed6c02"
                  : isCommon
                    ? "#00838f"
                    : fillColor
          }
          strokeWidth={isConflict ? 2.5 : isSelected ? 2.5 : isPending ? 2 : 1.5}
          strokeDasharray={isConflict ? "5,3" : isPending && !isSelected ? "4,2" : undefined}
          rx={3}
          style={{ touchAction: "none" }}
          onMouseDown={(e) => handleMoveStart(e, area)}
          onTouchStart={(e) => handleMoveStart(e, area)}
        />

        {/* Label del área */}
        {w > (compact ? 12 : 20) && h > (compact ? 8 : 12) && (
          <text
            x={x + w / 2}
            y={y + h / 2 + 3}
            fontSize={Math.min(compact ? 6 : 9, w / 5, h / 2.5)}
            textAnchor="middle"
            fill="#ffffff"
            fontWeight={isSelected ? "700" : "600"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {area.label.length > (compact ? 10 : 20)
              ? area.label.slice(0, compact ? 8 : 18) + "…"
              : area.label}
          </text>
        )}

        {/* Punto cian: área común */}
        {isCommon && !compact && (
          <circle
            cx={x + w - 5}
            cy={y + 5}
            r={4}
            fill="#00bcd4"
            stroke="#ffffff"
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Badge de muebles */}
        {(() => {
          const count = (mueblesPorArea[area.id] ?? []).length;
          if (count === 0 || w < (compact ? 14 : 20) || h < (compact ? 10 : 16)) return null;
          const bx = x + w - 2;
          const by = y + h - 2;
          const text = count > 9 ? "9+" : String(count);
          const rBadge = compact ? 5 : 7;
          return (
            <g style={{ pointerEvents: "none" }}>
              <circle
                cx={bx - rBadge}
                cy={by - rBadge}
                r={rBadge}
                fill="#1565c0"
                stroke="#fff"
                strokeWidth={1}
              />
              <text
                x={bx - rBadge}
                y={by - rBadge + (compact ? 2 : 3)}
                fontSize={compact ? 5 : 7}
                textAnchor="middle"
                fill="#ffffff"
                fontWeight={700}
                style={{ userSelect: "none" }}
              >
                {text}
              </text>
            </g>
          );
        })()}

        {/* Handles de resize solo cuando está seleccionada */}
        {isSelected && (
          <>
            <circle
              cx={x + w / 2}
              cy={y + h / 2}
              r={MOVE_HANDLE_R}
              fill={fillColor}
              stroke="#ffffff"
              strokeWidth={2}
              style={{ pointerEvents: "none" }}
            />
            <text
              x={x + w / 2}
              y={y + h / 2 + 3}
              fontSize={9}
              textAnchor="middle"
              fill="#ffffff"
              fontWeight={700}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              ✥
            </text>

            {[
              { corner: "tl", cx: x, cy: y },
              { corner: "tr", cx: x + w, cy: y },
              { corner: "bl", cx: x, cy: y + h },
              { corner: "br", cx: x + w, cy: y + h },
            ].map(({ corner, cx, cy }) => (
              <circle
                key={corner}
                cx={cx}
                cy={cy}
                r={HANDLE_R}
                fill="#ffffff"
                stroke={fillColor}
                strokeWidth={2}
                style={{ cursor: "nwse-resize", touchAction: "none" }}
                onMouseDown={(e) => handleResizeStart(e, area, corner)}
                onTouchStart={(e) => handleResizeStart(e, area, corner)}
              />
            ))}
          </>
        )}
      </g>
    );
  });

  // ── Shadow rect durante drag ──────────────────────────────────────────────
  const dragShadowEl = dragShadow && (
    <rect
      x={dragShadow.x}
      y={dragShadow.y}
      width={dragShadow.w}
      height={dragShadow.h}
      rx={4}
      fill="rgba(157,36,73,0.18)"
      stroke="#9d2449"
      strokeWidth={2}
      strokeDasharray="6,3"
      style={{ pointerEvents: "none" }}
    />
  );

  // ── Helpers SVG ───────────────────────────────────────────────────────────

  function getSvgPoint(e) {
    const svg = svgRef.current;
    const src = e.touches ? e.touches[0] : e;
    const clientX = src?.clientX ?? e.clientX;
    const clientY = src?.clientY ?? e.clientY;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SVG_W,
      y: ((clientY - rect.top) / rect.height) * SVG_H,
    };
  }

  function svgToCellAbs(svgX, svgY) {
    const col = Math.floor(svgX / CELL) + colOffset;
    const row = flipYRef.current ? Math.floor(svgY / CELL) : ROWS - 1 - Math.floor(svgY / CELL);
    return {
      col: Math.max(colOffset, Math.min(colOffset + colCount - 1, col)),
      row: Math.max(0, Math.min(ROWS - 1, row)),
    };
  }

  // Calcula guías de alineación respecto a otras áreas (bordes compartidos)
  function computeAlignGuides(gridX1, gridY1, gridX2, gridY2) {
    const guides = [];
    const others = (allAreas.length > 0 ? allAreas : areas).filter(
      (a) => a.id !== dragRef.current?.areaId && a.gridX1 != null,
    );
    for (const o of others) {
      // Coincidencia vertical (columnas): borde izquierdo/derecho
      if (Math.abs(o.gridX1 - gridX1) === 0) {
        guides.push({ axis: "y", value: (o.gridX1 - colOffset) * CELL });
      }
      if (Math.abs(o.gridX2 - gridX2) === 0) {
        guides.push({ axis: "y", value: (o.gridX2 - colOffset) * CELL });
      }
      // Coincidencia horizontal (filas): borde superior/inferior
      const svgY1 = flipY ? gridY1 * CELL : (ROWS - 1 - gridY2) * CELL;
      const svgY2 = flipY ? gridY2 * CELL : (ROWS - 1 - gridY1) * CELL;
      const oSvgY1 = flipY ? o.gridY1 * CELL : (ROWS - 1 - o.gridY2) * CELL;
      const oSvgY2 = flipY ? o.gridY2 * CELL : (ROWS - 1 - o.gridY1) * CELL;
      if (Math.abs(oSvgY1 - svgY1) < CELL / 2) guides.push({ axis: "x", value: oSvgY1 });
      if (Math.abs(oSvgY2 - svgY2) < CELL / 2) guides.push({ axis: "x", value: oSvgY2 });
    }
    return guides;
  }

  // ── Listeners de drag ─────────────────────────────────────────────────────

  function addDragListeners() {
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
  }

  function handleResizeStart(e, area, corner) {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      type: "resize",
      areaId: area.id,
      corner,
      startSvg: getSvgPoint(e),
      startGrid: {
        gridX1: area.gridX1,
        gridY1: area.gridY1,
        gridX2: area.gridX2,
        gridY2: area.gridY2,
      },
    };
    addDragListeners();
  }

  function handleMoveStart(e, area) {
    e.stopPropagation();
    e.preventDefault();
    if (area.id !== selectedId) onSelect(area);
    const svgPt = getSvgPoint(e);
    const { col, row } = svgToCellAbs(svgPt.x, svgPt.y);
    dragRef.current = {
      type: "move",
      areaId: area.id,
      startCell: { col, row },
      startGrid: {
        gridX1: area.gridX1,
        gridY1: area.gridY1,
        gridX2: area.gridX2,
        gridY2: area.gridY2,
      },
    };
    addDragListeners();
  }

  const handleDragMove = useCallback(
    (e) => {
      if (!dragRef.current) return;
      didDragRef.current = true;
      const { type, areaId, corner, startCell, startGrid } = dragRef.current;
      const svgPt = getSvgPoint(e);
      const { col, row } = svgToCellAbs(svgPt.x, svgPt.y);

      let newCoords;

      if (type === "resize") {
        let { gridX1, gridY1, gridX2, gridY2 } = startGrid;
        if (flipYRef.current) {
          switch (corner) {
            case "tl":
              gridX1 = Math.min(col, gridX2 - 1);
              gridY1 = Math.min(row, gridY2 - 1);
              break;
            case "tr":
              gridX2 = Math.max(col, gridX1 + 1);
              gridY1 = Math.min(row, gridY2 - 1);
              break;
            case "bl":
              gridX1 = Math.min(col, gridX2 - 1);
              gridY2 = Math.max(row, gridY1 + 1);
              break;
            case "br":
              gridX2 = Math.max(col, gridX1 + 1);
              gridY2 = Math.max(row, gridY1 + 1);
              break;
          }
        } else {
          switch (corner) {
            case "tl":
              gridX1 = Math.min(col, gridX2 - 1);
              gridY2 = Math.max(row, gridY1 + 1);
              break;
            case "tr":
              gridX2 = Math.max(col, gridX1 + 1);
              gridY2 = Math.max(row, gridY1 + 1);
              break;
            case "bl":
              gridX1 = Math.min(col, gridX2 - 1);
              gridY1 = Math.min(row, gridY2 - 1);
              break;
            case "br":
              gridX2 = Math.max(col, gridX1 + 1);
              gridY1 = Math.min(row, gridY2 - 1);
              break;
          }
        }
        newCoords = { gridX1, gridY1, gridX2, gridY2 };
        onResize(areaId, newCoords);
      } else if (type === "move") {
        const deltaCol = col - startCell.col;
        const deltaRow = row - startCell.row;
        const { gridX1, gridY1, gridX2, gridY2 } = startGrid;
        const width = gridX2 - gridX1;
        const height = gridY2 - gridY1;
        const newX1 = Math.max(0, Math.min(COLS - 1 - width, gridX1 + deltaCol));
        const newY1 = Math.max(0, Math.min(ROWS - 1 - height, gridY1 + deltaRow));
        newCoords = { gridX1: newX1, gridY1: newY1, gridX2: newX1 + width, gridY2: newY1 + height };
        onMove(areaId, newCoords);
      }

      // Actualizar shadow + guías
      if (newCoords) {
        const relX1 = newCoords.gridX1 - colOffset;
        const relX2 = newCoords.gridX2 - colOffset;
        const svgX = relX1 * CELL;
        const svgY = flipYRef.current
          ? newCoords.gridY1 * CELL
          : (ROWS - 1 - newCoords.gridY2) * CELL;
        const w = Math.max(CELL, (relX2 - relX1) * CELL);
        const h = Math.max(CELL, (newCoords.gridY2 - newCoords.gridY1) * CELL);
        setDragShadow({ x: svgX, y: svgY, w, h });
        setAlignGuides(
          computeAlignGuides(
            newCoords.gridX1,
            newCoords.gridY1,
            newCoords.gridX2,
            newCoords.gridY2,
          ),
        );
      }
    },
    [onResize, onMove],
  );

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragShadow(null);
    setAlignGuides([]);
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
    window.removeEventListener("touchmove", handleDragMove);
    window.removeEventListener("touchend", handleDragEnd);
    setTimeout(() => {
      didDragRef.current = false;
    }, 50);
  }, [handleDragMove]);

  // ── Render ────────────────────────────────────────────────────────────────

  const svgPad = compact ? 16 : 30;
  const svgTopPad = compact ? 4 : 20;

  return (
    <div style={{ position: "relative" }}>
      {floorLabel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: compact ? "4px" : "6px",
            paddingLeft: compact ? "12px" : "20px",
          }}
        >
          <span
            style={{
              fontSize: compact ? "9px" : "11px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              color: PRIMARY_MAIN,
              textTransform: "uppercase",
              background: PRIMARY_ALPHA(0.08),
              borderRadius: "4px",
              padding: compact ? "1px 6px" : "2px 8px",
              border: `1px solid ${PRIMARY_ALPHA(0.22)}`,
            }}
          >
            {floorLabel}
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto", overflowY: "auto" }}>
        <svg
          ref={svgRef}
          width={SVG_W + svgPad}
          height={SVG_H + svgPad + svgTopPad}
          viewBox={`-${compact ? 12 : 20} -${svgTopPad} ${SVG_W + svgPad} ${SVG_H + svgPad + svgTopPad}`}
          style={{
            display: "block",
            fontFamily: "Inter, Roboto, sans-serif",
            background: "#ffffff",
            touchAction: "none",
          }}
        >
          <rect
            x={-(compact ? 12 : 20)}
            y={-svgTopPad}
            width={SVG_W + svgPad}
            height={SVG_H + svgPad + svgTopPad}
            fill="#ffffff"
          />

          {gridLines}
          {corridorStripes}
          {orientationOverlays}
          {colLabels}
          {rowLabels}

          {/* Shadow durante drag — debajo de las áreas */}
          {dragShadowEl}

          {/* Áreas */}
          {areaRects}

          {/* Guías de alineación — encima de todo */}
          {alignGuideLines}
        </svg>
      </div>
    </div>
  );
}
