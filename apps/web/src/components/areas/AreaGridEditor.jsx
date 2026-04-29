/**
 * AreaGridEditor — SVG editor de cuadrícula para pisos del edificio.
 *
 * Props:
 *   areas      — array de AreaEdificio filtradas por piso + zona
 *   selectedId — id del área seleccionada (string | null)
 *   onSelect   — (area) => void
 *   onResize   — (id, { gridX1, gridY1, gridX2, gridY2 }) => void
 *   onMove     — (id, { gridX1, gridY1, gridX2, gridY2 }) => void
 *   floorLabel — texto del piso + zona (ej: "PISO PB — ALA IZQUIERDA")
 *   colStart   — columna absoluta de inicio de la zona (0-based)
 *   colCount   — número de columnas a mostrar en esta zona
 */

import { useRef, useCallback } from "react";

// ── Color primario institucional (guinda Secretaría de Finanzas Oaxaca) ──────
const PRIMARY_H = 342;
const PRIMARY_S = 62;
const PRIMARY_L = 38;

function hsl(dH = 0, dS = 0, dL = 0, a = 1) {
  const h = ((PRIMARY_H + dH) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, PRIMARY_S + dS));
  const l = Math.max(0, Math.min(100, PRIMARY_L + dL));
  return a < 1 ? `hsla(${h},${s}%,${l}%,${a})` : `hsl(${h},${s}%,${l}%)`;
}

const PRIMARY_MAIN  = hsl();
const PRIMARY_ALPHA = (a) => hsl(0, 0, 0, a);

// ── Constantes fijas de la cuadrícula ────────────────────────────────────────
const COLS = 32;
const ROWS = 27;
const CELL = 24;
const HANDLE_R = 9;
const MOVE_HANDLE_R = 13;

// Columnas RELATIVAS que son pasillo (solo se usan cuando colCount >= 14)
// Con colCount=14: secciones 0-3 | pasillo 4 | 5-8 | pasillo 9 | 10-13 → equidistante (4+4+4)
const CORRIDOR_COLS = [4, 9];

const SVG_H = ROWS * CELL;

// ── Paleta de 12 colores ──────────────────────────────────────────────────────
const palette = [
  hsl(  0,   0,   0),
  hsl(-20, -15, +18),
  hsl(+20, +10, -10),
  hsl(-40, -20, +28),
  hsl(+15,  -5, +12),
  hsl(-60,  -8, +20),
  hsl(+30, +15,  -8),
  hsl(  0, +18, +22),
  hsl(-80, -15, +30),
  hsl(+40,  -5,  -5),
  hsl(-10,  -8, +38),
  hsl(+25, +20,  +8),
];

const colorForIndex = (idx) => palette[idx % palette.length];

// ── Componente principal ──────────────────────────────────────────────────────

// Fila donde empieza el conector en el eje Y (parte posterior del edificio)
const CONNECTOR_ROW_START = 14;

export function AreaGridEditor({
  areas = [],
  selectedId,
  onSelect,
  onResize,
  onMove,
  floorLabel,
  colStart = 0,
  colCount = 16,
  flipY = false,
  zoneKey = null,
}) {
  const svgRef   = useRef(null);
  const dragRef  = useRef(null);
  const didDragRef = useRef(false);
  const flipYRef = useRef(flipY);
  flipYRef.current = flipY;

  const colOffset = colStart;
  const SVG_W     = colCount * CELL;

  // Color por área
  const colorMap = {};
  areas.forEach((a, i) => { colorMap[a.id] = colorForIndex(i); });

  // ── Líneas de cuadrícula ─────────────────────────────────────────────────
  const gridLines = [];
  for (let c = 0; c <= colCount; c++) {
    gridLines.push(
      <line key={`v${c}`} x1={c * CELL} y1={0} x2={c * CELL} y2={SVG_H}
        stroke="#e0e0e0" strokeWidth={0.5} />,
    );
  }
  for (let r = 0; r <= ROWS; r++) {
    gridLines.push(
      <line key={`h${r}`} x1={0} y1={r * CELL} x2={SVG_W} y2={r * CELL}
        stroke="#e0e0e0" strokeWidth={0.5} />,
    );
  }

  // ── Pasillos (solo para zonas anchas: alas) ──────────────────────────────
  const corridorStripes = colCount >= 14 ? CORRIDOR_COLS.map((cc) => {
    const svgX = cc * CELL;
    const midY = SVG_H / 2;
    return (
      <g key={`pasillo-${cc}`} style={{ pointerEvents: "none" }}>
        <rect x={svgX} y={0} width={CELL} height={SVG_H}
          fill="rgba(155,155,195,0.20)" stroke="none" />
        <line x1={svgX}        y1={0} x2={svgX}        y2={SVG_H}
          stroke="rgba(100,100,160,0.45)" strokeWidth={1} strokeDasharray="5,4" />
        <line x1={svgX + CELL} y1={0} x2={svgX + CELL} y2={SVG_H}
          stroke="rgba(100,100,160,0.45)" strokeWidth={1} strokeDasharray="5,4" />
        <text x={svgX + CELL / 2} y={midY} fontSize={7} textAnchor="middle"
          dominantBaseline="middle" fill="rgba(70,70,130,0.60)" fontWeight={700}
          letterSpacing={2.5} transform={`rotate(-90 ${svgX + CELL / 2} ${midY})`}
          style={{ userSelect: "none" }}>
          PASILLO
        </text>
      </g>
    );
  }) : [];

  // ── Indicadores de orientación y conexión por zona ──────────────────────
  const orientationOverlays = (() => {
    const shadeY = CONNECTOR_ROW_START * CELL;           // svgY donde empieza el conector
    const midShadeY = shadeY / 2;                        // centro de la zona solo-alas
    const midActiveY = shadeY + (SVG_H - shadeY) / 2;   // centro de la zona conector

    // Labels FRENTE/POSTERIOR comunes
    const labelFrente = (
      <text key="frente" x={SVG_W / 2} y={-14} fontSize={7} textAnchor="middle"
        dominantBaseline="auto" fill="rgba(120,120,160,0.65)" fontWeight={700}
        letterSpacing={1} style={{ userSelect: "none" }}>
        ▲ FRENTE
      </text>
    );
    const labelPosterior = (
      <text key="posterior" x={SVG_W / 2} y={SVG_H + 22} fontSize={7} textAnchor="middle"
        dominantBaseline="auto" fill="rgba(120,120,160,0.65)" fontWeight={700}
        letterSpacing={1} style={{ userSelect: "none" }}>
        ▼ POSTERIOR
      </text>
    );

    if (zoneKey === "conector") {
      return (
        <g style={{ pointerEvents: "none" }}>
          {/* Sombreado filas 0-13: solo existen las alas aquí */}
          <rect x={0} y={0} width={SVG_W} height={shadeY}
            fill="rgba(160,160,200,0.20)" />
          <text x={SVG_W / 2} y={midShadeY} fontSize={7.5} textAnchor="middle"
            dominantBaseline="middle" fill="rgba(90,90,140,0.45)" fontWeight={700}
            letterSpacing={2} style={{ userSelect: "none" }}
            transform={`rotate(-90 ${SVG_W / 2} ${midShadeY})`}>
            SOLO ALAS
          </text>

          {/* Línea divisoria zona conector */}
          <line x1={0} y1={shadeY} x2={SVG_W} y2={shadeY}
            stroke="rgba(80,80,160,0.50)" strokeWidth={1.5} strokeDasharray="5,3" />
          <text x={SVG_W / 2} y={shadeY - 2} fontSize={6} textAnchor="middle"
            dominantBaseline="auto" fill="rgba(80,80,160,0.60)" fontWeight={700}
            style={{ userSelect: "none" }}>
            ── INICIO DEL CONECTOR ──
          </text>

          {/* Etiquetas laterales: alas izquierda y derecha */}
          <text x={3} y={midActiveY} fontSize={7} textAnchor="middle"
            dominantBaseline="middle" fill="rgba(60,80,160,0.75)" fontWeight={700}
            style={{ userSelect: "none" }}
            transform={`rotate(-90 3 ${midActiveY})`}>
            ← ALA IZQUIERDA
          </text>
          <text x={SVG_W - 3} y={midActiveY} fontSize={7} textAnchor="middle"
            dominantBaseline="middle" fill="rgba(60,80,160,0.75)" fontWeight={700}
            style={{ userSelect: "none" }}
            transform={`rotate(90 ${SVG_W - 3} ${midActiveY})`}>
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
          {/* Sutil tinte en filas 14-26 (posterior donde llega el conector) */}
          <rect x={0} y={shadeY} width={SVG_W} height={SVG_H - shadeY}
            fill="rgba(130,180,130,0.07)" />
          <line x1={0} y1={shadeY} x2={SVG_W} y2={shadeY}
            stroke="rgba(60,130,60,0.28)" strokeWidth={1} strokeDasharray="4,3" />

          {/* Etiqueta conector en el borde de conexión */}
          <text x={connX} y={midConY} fontSize={6.5} textAnchor="middle"
            dominantBaseline="middle" fill="rgba(40,110,40,0.65)" fontWeight={700}
            style={{ userSelect: "none" }}
            transform={`rotate(${rot} ${connX} ${midConY})`}>
            {connLabel}
          </text>

          {labelFrente}
          {labelPosterior}
        </g>
      );
    }

    return null;
  })();

  // ── Etiquetas de ejes ────────────────────────────────────────────────────
  const colLabels = [];
  for (let c = 0; c < colCount; c += Math.max(1, Math.floor(colCount / 4))) {
    colLabels.push(
      <text key={`cl${c}`} x={c * CELL + CELL / 2} y={SVG_H + 12}
        fontSize={8} textAnchor="middle" fill="#9e9e9e">
        {c + colOffset}
      </text>,
    );
  }
  const rowLabels = [];
  for (let r = 0; r < ROWS; r += 4) {
    rowLabels.push(
      <text key={`rl${r}`} x={-4}
        y={flipY ? r * CELL + CELL / 2 + 3 : (ROWS - 1 - r) * CELL + CELL / 2 + 3}
        fontSize={8} textAnchor="end" fill="#9e9e9e">
        {r}
      </text>,
    );
  }

  // ── Rectángulos de áreas ──────────────────────────────────────────────────
  const areaRects = areas.map((area) => {
    if (area.gridX1 == null || area.gridY1 == null || area.gridX2 == null || area.gridY2 == null) {
      return null;
    }

    const relX1 = (area.gridX1 ?? 0) - colOffset;
    const relX2 = (area.gridX2 ?? 0) - colOffset;
    const x = relX1 * CELL;
    const y = flipY
      ? (area.gridY1 ?? 0) * CELL
      : (ROWS - 1 - (area.gridY2 ?? 0)) * CELL;
    const w = Math.max(CELL, (relX2 - relX1) * CELL);
    const h = Math.max(CELL, ((area.gridY2 ?? 0) - (area.gridY1 ?? 0)) * CELL);
    const color    = colorMap[area.id];
    const isSelected = area.id === selectedId;

    return (
      <g
        key={area.id}
        onClick={() => { if (didDragRef.current) return; onSelect(area); }}
        style={{ cursor: isSelected ? "move" : "pointer" }}
      >
        <rect
          x={x} y={y} width={w} height={h}
          fill={color ?? "#9d2449"}
          fillOpacity={isSelected ? 0.85 : 0.65}
          stroke={color ?? "#9d2449"}
          strokeWidth={isSelected ? 2.5 : 1.5}
          rx={3}
          style={{ touchAction: "none" }}
          onMouseDown={(e) => handleMoveStart(e, area)}
          onTouchStart={(e) => handleMoveStart(e, area)}
        />

        {w > 20 && h > 12 && (
          <text
            x={x + w / 2} y={y + h / 2 + 3}
            fontSize={Math.min(9, w / 5, h / 2.5)}
            textAnchor="middle" fill="#ffffff"
            fontWeight={isSelected ? "700" : "600"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {area.label.length > 20 ? area.label.slice(0, 18) + "…" : area.label}
          </text>
        )}

        {isSelected && (
          <>
            <circle cx={x + w / 2} cy={y + h / 2} r={MOVE_HANDLE_R}
              fill={color} stroke="#ffffff" strokeWidth={2}
              style={{ pointerEvents: "none" }} />
            <text x={x + w / 2} y={y + h / 2 + 3} fontSize={9}
              textAnchor="middle" fill="#ffffff" fontWeight={700}
              style={{ pointerEvents: "none", userSelect: "none" }}>✥</text>

            {[
              { corner: "tl", cx: x,     cy: y },
              { corner: "tr", cx: x + w, cy: y },
              { corner: "bl", cx: x,     cy: y + h },
              { corner: "br", cx: x + w, cy: y + h },
            ].map(({ corner, cx, cy }) => (
              <circle key={corner} cx={cx} cy={cy} r={HANDLE_R}
                fill="#ffffff" stroke={color} strokeWidth={2}
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

  // ── Helpers SVG ──────────────────────────────────────────────────────────

  function getSvgPoint(e) {
    const svg = svgRef.current;
    const src = e.touches ? e.touches[0] : e;
    const clientX = src?.clientX ?? e.clientX;
    const clientY = src?.clientY ?? e.clientY;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SVG_W,
      y: ((clientY - rect.top)  / rect.height) * SVG_H,
    };
  }

  function svgToCellAbs(svgX, svgY) {
    const col = Math.floor(svgX / CELL) + colOffset;
    const row = flipYRef.current
      ? Math.floor(svgY / CELL)
      : ROWS - 1 - Math.floor(svgY / CELL);
    return {
      col: Math.max(colOffset, Math.min(colOffset + colCount - 1, col)),
      row: Math.max(0, Math.min(ROWS - 1, row)),
    };
  }

  // ── Listeners de drag (mouse + touch) ────────────────────────────────────

  function addDragListeners() {
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup",   handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend",  handleDragEnd);
  }

  function handleResizeStart(e, area, corner) {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      type: "resize", areaId: area.id, corner,
      startSvg: getSvgPoint(e),
      startGrid: { gridX1: area.gridX1, gridY1: area.gridY1, gridX2: area.gridX2, gridY2: area.gridY2 },
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
      type: "move", areaId: area.id,
      startCell: { col, row },
      startGrid: { gridX1: area.gridX1, gridY1: area.gridY1, gridX2: area.gridX2, gridY2: area.gridY2 },
    };
    addDragListeners();
  }

  const handleDragMove = useCallback((e) => {
    if (!dragRef.current) return;
    didDragRef.current = true;
    const { type, areaId, corner, startCell, startGrid } = dragRef.current;
    const svgPt = getSvgPoint(e);
    const { col, row } = svgToCellAbs(svgPt.x, svgPt.y);

    if (type === "resize") {
      let { gridX1, gridY1, gridX2, gridY2 } = startGrid;
      if (flipYRef.current) {
        switch (corner) {
          case "tl": gridX1 = Math.min(col, gridX2 - 1); gridY1 = Math.min(row, gridY2 - 1); break;
          case "tr": gridX2 = Math.max(col, gridX1 + 1); gridY1 = Math.min(row, gridY2 - 1); break;
          case "bl": gridX1 = Math.min(col, gridX2 - 1); gridY2 = Math.max(row, gridY1 + 1); break;
          case "br": gridX2 = Math.max(col, gridX1 + 1); gridY2 = Math.max(row, gridY1 + 1); break;
        }
      } else {
        switch (corner) {
          case "tl": gridX1 = Math.min(col, gridX2 - 1); gridY2 = Math.max(row, gridY1 + 1); break;
          case "tr": gridX2 = Math.max(col, gridX1 + 1); gridY2 = Math.max(row, gridY1 + 1); break;
          case "bl": gridX1 = Math.min(col, gridX2 - 1); gridY1 = Math.min(row, gridY2 - 1); break;
          case "br": gridX2 = Math.max(col, gridX1 + 1); gridY1 = Math.min(row, gridY2 - 1); break;
        }
      }
      onResize(areaId, { gridX1, gridY1, gridX2, gridY2 });
    } else if (type === "move") {
      const deltaCol = col - startCell.col;
      const deltaRow = row - startCell.row;
      const { gridX1, gridY1, gridX2, gridY2 } = startGrid;
      const width  = gridX2 - gridX1;
      const height = gridY2 - gridY1;
      const newX1  = Math.max(0, Math.min(COLS - 1 - width,  gridX1 + deltaCol));
      const newY1  = Math.max(0, Math.min(ROWS - 1 - height, gridY1 + deltaRow));
      onMove(areaId, { gridX1: newX1, gridY1: newY1, gridX2: newX1 + width, gridY2: newY1 + height });
    }
  }, [onResize, onMove]);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup",   handleDragEnd);
    window.removeEventListener("touchmove", handleDragMove);
    window.removeEventListener("touchend",  handleDragEnd);
    setTimeout(() => { didDragRef.current = false; }, 50);
  }, [handleDragMove]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative" }}>
      {floorLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", paddingLeft: "20px" }}>
          <span style={{
            fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px",
            color: PRIMARY_MAIN, textTransform: "uppercase",
            background: PRIMARY_ALPHA(0.08), borderRadius: "4px",
            padding: "2px 8px", border: `1px solid ${PRIMARY_ALPHA(0.22)}`,
          }}>
            {floorLabel}
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto", overflowY: "auto" }}>
        <svg
          ref={svgRef}
          width={SVG_W + 30}
          height={SVG_H + 46}
          viewBox={`-20 -20 ${SVG_W + 30} ${SVG_H + 46}`}
          style={{ display: "block", fontFamily: "Inter, Roboto, sans-serif", background: "#ffffff", touchAction: "none" }}
        >
          <rect x={-20} y={-20} width={SVG_W + 30} height={SVG_H + 46} fill="#ffffff" />

          {gridLines}
          {corridorStripes}
          {orientationOverlays}
          {colLabels}
          {rowLabels}
          {areaRects}
        </svg>
      </div>
    </div>
  );
}
