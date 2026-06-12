// ============================================================
// GEOMETRÍA DEL EDIFICIO — Edificio Saúl Martínez
// Fuente de verdad para la huella del edificio en la cuadrícula
// 32×27 del plano. Usada por la API (validación) y el editor 2D.
// El visor 3D (apps/modelado-3d/src/building.js) mantiene un
// espejo de estas constantes — si cambian aquí, actualizar allá.
// ============================================================

export const GRID_COLS = 32;
export const GRID_ROWS = 27;

export interface RectGrid {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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

/**
 * Un rectángulo está dentro del edificio si cada columna de celda que ocupa
 * pertenece a una zona cuyo rango de filas contiene al rectángulo completo.
 * (Permite áreas que cruzan ala↔conector siempre que queden en filas 14–27.)
 */
export const dentroDelEdificio = (r: RectGrid): boolean => {
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

/** Solape estricto entre dos rectángulos (compartir solo un borde NO es solape). */
export const seSolapan = (a: RectGrid, b: RectGrid): boolean =>
  a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

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
