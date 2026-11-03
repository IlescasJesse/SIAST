// ============================================================
// GEOMETRÍA DEL EDIFICIO — Edificio Saúl Martínez
// Fuente de verdad para la huella del edificio en la cuadrícula
// 32×27 del plano. Usada por la API (validación) y el editor 2D.
// El visor 3D (apps/modelado-3d/src/building.js) mantiene un
// espejo de estas constantes — si cambian aquí, actualizar allá.
// ============================================================

export const GRID_COLS = 32;
export const GRID_ROWS = 27;

/** Máximo de vértices de un área poligonal. */
export const MAX_VERTICES_AREA = 12;

/** Punto de la cuadrícula: [columna, fila]. */
export type PuntoGrid = [number, number];

export interface RectGrid {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /**
   * Polígono del área: de 3 a MAX_VERTICES_AREA vértices en orden de recorrido
   * (el editor permite mover cada esquina por separado y agregar vértices).
   * null/ausente = el rectángulo x1..y2. Con vértices, x1..y2 es solo la caja
   * envolvente.
   */
  vertices?: ReadonlyArray<PuntoGrid> | null;
}

/**
 * Zonas que componen la huella del edificio (forma de U).
 * fila 0 = frente; el conector solo existe al fondo (filas 14–27).
 */
export const ZONAS_EDIFICIO: ReadonlyArray<RectGrid> = [
  { x1: 0, y1: 0, x2: 14, y2: 27 }, // ala izquierda
  { x1: 18, y1: 0, x2: 32, y2: 27 }, // ala derecha
  { x1: 14, y1: 14, x2: 18, y2: 27 }, // conector (solo fondo)
];

/**
 * Franjas de pasillo (1 celda de ancho, profundidad completa) por ala.
 * Espejo de CORRIDOR_COLS = [4, 9] del editor 2D (cols relativas al ala).
 */
export const PASILLOS: ReadonlyArray<RectGrid> = [
  { x1: 4, y1: 0, x2: 5, y2: 27 }, // ala izquierda, pasillo 1
  { x1: 9, y1: 0, x2: 10, y2: 27 }, // ala izquierda, pasillo 2
  { x1: 22, y1: 0, x2: 23, y2: 27 }, // ala derecha, pasillo 1
  { x1: 27, y1: 0, x2: 28, y2: 27 }, // ala derecha, pasillo 2
];

/** Rango de filas permitido para una columna de celda dada (o null fuera del edificio). */
const rangoFilasPorColumna = (col: number): { y1: number; y2: number } | null => {
  for (const z of ZONAS_EDIFICIO) {
    if (col >= z.x1 && col < z.x2) return { y1: z.y1, y2: z.y2 };
  }
  return null;
};

// ── Polígonos (áreas con vértices movidos) ───────────────────────────────────

/** Hueco de la U: columnas del conector que NO existen al frente (filas 0–14). */
const HUECO_EDIFICIO: RectGrid = { x1: 14, y1: 0, x2: 18, y2: 14 };

/** Vértices de un rect en el orden del editor: (x1,y1) → (x2,y1) → (x2,y2) → (x1,y2). */
export const verticesDeRect = (r: RectGrid): PuntoGrid[] => [
  [r.x1, r.y1],
  [r.x2, r.y1],
  [r.x2, r.y2],
  [r.x1, r.y2],
];

/** Vértices efectivos de un área: los propios o las esquinas de su rectángulo. */
export const verticesDeArea = (r: RectGrid): PuntoGrid[] =>
  r.vertices && r.vertices.length >= 3
    ? r.vertices.map(([x, y]) => [x, y] as PuntoGrid)
    : verticesDeRect(r);

/** Caja envolvente de un polígono. */
export const cajaDeVertices = (v: ReadonlyArray<PuntoGrid>): RectGrid => ({
  x1: Math.min(...v.map((p) => p[0])),
  y1: Math.min(...v.map((p) => p[1])),
  x2: Math.max(...v.map((p) => p[0])),
  y2: Math.max(...v.map((p) => p[1])),
});

/** true si el polígono es exactamente su caja envolvente (o sea, un rectángulo). */
export const esRectangulo = (v: ReadonlyArray<PuntoGrid>): boolean => {
  if (v.length !== 4) return false;
  const c = cajaDeVertices(v);
  // Las 4 esquinas de la caja, y además bien recorridas (cruzadas serían un "moño")
  return (
    esPoligonoValido(v) &&
    verticesDeRect(c).every((e) => v.some((p) => p[0] === e[0] && p[1] === e[1]))
  );
};

/** Producto cruz (b−a)×(c−a): >0 giro a un lado, <0 al otro, 0 colineales. */
const cruz = (a: PuntoGrid, b: PuntoGrid, c: PuntoGrid): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const dentroDeCaja = (a: PuntoGrid, b: PuntoGrid, p: PuntoGrid): boolean =>
  Math.min(a[0], b[0]) <= p[0] &&
  p[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= p[1] &&
  p[1] <= Math.max(a[1], b[1]);

/** Los segmentos ab y cd se tocan o se cruzan (incluye extremos y colineales). */
const segmentosSeTocan = (a: PuntoGrid, b: PuntoGrid, c: PuntoGrid, d: PuntoGrid): boolean => {
  const d1 = cruz(a, b, c);
  const d2 = cruz(a, b, d);
  const d3 = cruz(c, d, a);
  const d4 = cruz(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true;
  return (
    (d1 === 0 && dentroDeCaja(a, b, c)) ||
    (d2 === 0 && dentroDeCaja(a, b, d)) ||
    (d3 === 0 && dentroDeCaja(c, d, a)) ||
    (d4 === 0 && dentroDeCaja(c, d, b))
  );
};

/** Doble del área con signo del polígono (fórmula del cordón). */
const dobleArea = (v: ReadonlyArray<PuntoGrid>): number =>
  v.reduce((s, p, i) => {
    const q = v[(i + 1) % v.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);

/**
 * Un polígono es válido si tiene de 3 a MAX_VERTICES_AREA vértices enteros,
 * área (≥ 1 celda) y es simple: lados no contiguos no se tocan y lados
 * contiguos no se doblan sobre sí mismos. Puede ser cóncavo (formas en L, etc.)
 * y tener vértices alineados sobre un mismo lado.
 */
export const esPoligonoValido = (v: ReadonlyArray<PuntoGrid>): boolean => {
  const n = v.length;
  if (n < 3 || n > MAX_VERTICES_AREA) return false;
  if (!v.every((p) => Number.isInteger(p[0]) && Number.isInteger(p[1]))) return false;
  if (Math.abs(dobleArea(v)) < 2) return false;
  for (let i = 0; i < n; i++) {
    const a = v[i];
    const b = v[(i + 1) % n];
    const c = v[(i + 2) % n];
    if (a[0] === b[0] && a[1] === b[1]) return false; // vértices encimados
    // Lados contiguos a-b y b-c: no pueden regresar sobre sí mismos
    const punto = (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]);
    if (cruz(a, b, c) === 0 && punto > 0) return false;
    // Lados no contiguos: no pueden tocarse
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // el último lado es contiguo al primero
      if (segmentosSeTocan(a, b, v[j], v[(j + 1) % n])) return false;
    }
  }
  return true;
};

type Triangulo = [PuntoGrid, PuntoGrid, PuntoGrid];

/** p cae dentro o en el borde del triángulo abc (recorrido antihorario). */
const enTriangulo = (p: PuntoGrid, a: PuntoGrid, b: PuntoGrid, c: PuntoGrid, estricto: boolean) => {
  const d1 = cruz(a, b, p);
  const d2 = cruz(b, c, p);
  const d3 = cruz(c, a, p);
  return estricto ? d1 > 0 && d2 > 0 && d3 > 0 : d1 >= 0 && d2 >= 0 && d3 >= 0;
};

/**
 * Parte un polígono simple en triángulos recortando "orejas" (vértices
 * convexos cuyo triángulo no contiene a ningún otro vértice). Los vértices
 * alineados sobre un lado no aportan área y se descartan.
 */
const triangular = (v: ReadonlyArray<PuntoGrid>): Triangulo[] => {
  const pts = dobleArea(v) < 0 ? [...v].reverse() : [...v]; // recorrido antihorario
  const tris: Triangulo[] = [];
  const recortar = (estricto: boolean): boolean => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const giro = cruz(a, b, c);
      if (giro < 0) continue; // vértice cóncavo: no es oreja
      if (giro > 0) {
        const ocupado = pts.some(
          (q) => q !== a && q !== b && q !== c && enTriangulo(q, a, b, c, estricto),
        );
        if (ocupado) continue;
        tris.push([a, b, c]);
      }
      pts.splice(i, 1); // giro === 0: alineado, se quita sin triángulo
      return true;
    }
    return false;
  };
  // Si ningún vértice pasa la prueba con borde incluido (otro vértice justo
  // sobre la diagonal), se reintenta contando solo los estrictamente dentro.
  while (pts.length > 3 && (recortar(false) || recortar(true)));
  if (pts.length === 3 && cruz(pts[0], pts[1], pts[2]) !== 0) tris.push([pts[0], pts[1], pts[2]]);
  return tris;
};

/** Solape estricto entre triángulos (eje separador): tocarse en borde o punta NO cuenta. */
const triangulosSeSolapan = (t1: Triangulo, t2: Triangulo): boolean => {
  for (const t of [t1, t2]) {
    for (let i = 0; i < 3; i++) {
      const p = t[i];
      const q = t[(i + 1) % 3];
      // Normal del lado como eje de proyección
      const nx = q[1] - p[1];
      const ny = p[0] - q[0];
      const proy = (pts: Triangulo) => pts.map((r) => r[0] * nx + r[1] * ny);
      const a = proy(t1);
      const b = proy(t2);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
    }
  }
  return true;
};

/** Solape estricto entre dos polígonos simples (convexos o cóncavos). */
export const poligonosSeSolapan = (
  a: ReadonlyArray<PuntoGrid>,
  b: ReadonlyArray<PuntoGrid>,
): boolean => {
  const ta = triangular(a);
  const tb = triangular(b);
  return ta.some((x) => tb.some((y) => triangulosSeSolapan(x, y)));
};

/**
 * Un polígono está dentro del edificio si es válido, todos sus vértices caen
 * en la cuadrícula y no invade el hueco de la U (frente del conector).
 */
export const poligonoDentroDelEdificio = (v: ReadonlyArray<PuntoGrid>): boolean =>
  esPoligonoValido(v) &&
  v.every((p) => p[0] >= 0 && p[0] <= GRID_COLS && p[1] >= 0 && p[1] <= GRID_ROWS) &&
  !poligonosSeSolapan(v, verticesDeRect(HUECO_EDIFICIO));

/**
 * Un rectángulo está dentro del edificio si cada columna de celda que ocupa
 * pertenece a una zona cuyo rango de filas contiene al rectángulo completo.
 * (Permite áreas que cruzan ala↔conector siempre que queden en filas 14–27.)
 * Si el área trae `vertices` se valida el polígono.
 */
export const dentroDelEdificio = (r: RectGrid): boolean => {
  if (r.vertices?.length) return poligonoDentroDelEdificio(r.vertices);
  if (
    !Number.isInteger(r.x1) ||
    !Number.isInteger(r.y1) ||
    !Number.isInteger(r.x2) ||
    !Number.isInteger(r.y2)
  )
    return false;
  if (r.x1 < 0 || r.y1 < 0 || r.x2 > GRID_COLS || r.y2 > GRID_ROWS) return false;
  if (r.x1 >= r.x2 || r.y1 >= r.y2) return false;

  for (let col = r.x1; col < r.x2; col++) {
    const rango = rangoFilasPorColumna(col);
    if (!rango || r.y1 < rango.y1 || r.y2 > rango.y2) return false;
  }
  return true;
};

/**
 * Solape estricto entre dos áreas (compartir solo un borde NO es solape).
 * Primero las cajas envolventes; si alguna es polígono, se afina con sus vértices.
 */
export const seSolapan = (a: RectGrid, b: RectGrid): boolean => {
  if (!(a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1)) return false;
  if (!a.vertices?.length && !b.vertices?.length) return true;
  return poligonosSeSolapan(verticesDeArea(a), verticesDeArea(b));
};

export interface AreaConGeometria extends RectGrid {
  id: string;
  label?: string;
  floor: number;
}

/**
 * Valida la geometría de un área contra la huella del edificio y contra
 * las demás áreas del mismo piso. Devuelve null si es válida, o un
 * mensaje de error descriptivo si no.
 */
export const validarGeometriaArea = (
  area: AreaConGeometria,
  otras: ReadonlyArray<AreaConGeometria>,
): string | null => {
  if (area.vertices?.length && !esPoligonoValido(area.vertices)) {
    return "La forma del área no es válida: los lados no pueden cruzarse ni dejar el área sin superficie.";
  }
  if (!dentroDelEdificio(area)) {
    return `El área queda fuera del edificio: (${area.x1},${area.y1})→(${area.x2},${area.y2}). Las alas ocupan columnas 0–14 y 18–32 (filas 0–27); el conector, columnas 14–18 (filas 14–27).`;
  }
  for (const otra of otras) {
    if (otra.id === area.id || otra.floor !== area.floor) continue;
    if (seSolapan(area, otra)) {
      return `El área se solapa con "${otra.label ?? otra.id}" en el mismo piso.`;
    }
  }
  return null;
};
