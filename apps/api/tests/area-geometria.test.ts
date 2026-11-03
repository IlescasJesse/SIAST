/**
 * Pruebas unitarias — Geometría de áreas del edificio (packages/shared/src/areaGeometry.ts).
 * Valida la huella en "U", polígonos, solapes y el mensaje de validación del editor.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dentroDelEdificio,
  esPoligonoValido,
  esRectangulo,
  seSolapan,
  poligonoDentroDelEdificio,
  cajaDeVertices,
  verticesDeRect,
  validarGeometriaArea,
  type PuntoGrid,
} from "@stf/shared";

describe("dentroDelEdificio (rectángulos)", () => {
  it("acepta un área dentro del ala izquierda", () => {
    assert.equal(dentroDelEdificio({ x1: 0, y1: 0, x2: 4, y2: 5 }), true);
  });
  it("rechaza un área en el hueco frontal de la U (conector, filas 0–14)", () => {
    assert.equal(dentroDelEdificio({ x1: 14, y1: 2, x2: 18, y2: 6 }), false);
  });
  it("acepta un área que cruza ala ↔ conector en las filas del fondo", () => {
    assert.equal(dentroDelEdificio({ x1: 12, y1: 20, x2: 20, y2: 25 }), true);
  });
  it("rechaza coordenadas fuera de la cuadrícula 32×27 o invertidas", () => {
    assert.equal(dentroDelEdificio({ x1: 30, y1: 0, x2: 33, y2: 4 }), false);
    assert.equal(dentroDelEdificio({ x1: 5, y1: 5, x2: 3, y2: 8 }), false);
  });
});

describe("Polígonos", () => {
  const L: PuntoGrid[] = [
    [0, 0],
    [4, 0],
    [4, 2],
    [2, 2],
    [2, 4],
    [0, 4],
  ];
  it("un polígono en forma de L es válido", () => {
    assert.equal(esPoligonoValido(L), true);
  });
  it("un polígono cruzado (moño) no es válido", () => {
    const mono: PuntoGrid[] = [
      [0, 0],
      [4, 4],
      [4, 0],
      [0, 4],
    ];
    assert.equal(esPoligonoValido(mono), false);
  });
  it("rechaza menos de 3 o más de 12 vértices", () => {
    assert.equal(
      esPoligonoValido([
        [0, 0],
        [1, 1],
      ]),
      false,
    );
    const trece = Array.from({ length: 13 }, (_, i) => [i, i % 2] as PuntoGrid);
    assert.equal(esPoligonoValido(trece), false);
  });
  it("esRectangulo y cajaDeVertices reconocen un rectángulo", () => {
    const v = verticesDeRect({ x1: 1, y1: 1, x2: 3, y2: 4 });
    assert.equal(esRectangulo(v), true);
    assert.deepEqual(cajaDeVertices(L), { x1: 0, y1: 0, x2: 4, y2: 4 });
    assert.equal(esRectangulo(L), false);
  });
  it("un polígono que invade el hueco de la U queda fuera del edificio", () => {
    const invade: PuntoGrid[] = [
      [12, 10],
      [16, 10],
      [16, 13],
      [12, 13],
    ];
    assert.equal(poligonoDentroDelEdificio(invade), false);
  });
});

describe("seSolapan", () => {
  it("compartir solo un borde NO es solape", () => {
    assert.equal(seSolapan({ x1: 0, y1: 0, x2: 2, y2: 2 }, { x1: 2, y1: 0, x2: 4, y2: 2 }), false);
  });
  it("dos rectángulos encimados sí se solapan", () => {
    assert.equal(seSolapan({ x1: 0, y1: 0, x2: 3, y2: 3 }, { x1: 2, y1: 2, x2: 4, y2: 4 }), true);
  });
  it("el hueco de una L no cuenta como solape aunque las cajas se crucen", () => {
    const L = {
      x1: 0,
      y1: 0,
      x2: 4,
      y2: 4,
      vertices: [
        [0, 0],
        [4, 0],
        [4, 2],
        [2, 2],
        [2, 4],
        [0, 4],
      ] as PuntoGrid[],
    };
    assert.equal(seSolapan(L, { x1: 2, y1: 2, x2: 4, y2: 4 }), false);
  });
});

describe("validarGeometriaArea", () => {
  const base = { id: "a1", label: "Caja", floor: 1, x1: 0, y1: 0, x2: 3, y2: 3 };
  it("devuelve null para un área válida sin vecinos", () => {
    assert.equal(validarGeometriaArea(base, []), null);
  });
  it("informa el solape con otra área del mismo piso", () => {
    const otra = { id: "a2", label: "Archivo", floor: 1, x1: 2, y1: 2, x2: 4, y2: 4 };
    assert.match(validarGeometriaArea(base, [otra]) ?? "", /se solapa con "Archivo"/);
  });
  it("ignora áreas de otro piso", () => {
    const otra = { id: "a2", label: "Archivo", floor: 2, x1: 2, y1: 2, x2: 4, y2: 4 };
    assert.equal(validarGeometriaArea(base, [otra]), null);
  });
  it("informa cuando el área queda fuera del edificio", () => {
    const fuera = { ...base, x1: 14, y1: 0, x2: 17, y2: 3 };
    assert.match(validarGeometriaArea(fuera, []) ?? "", /fuera del edificio/);
  });
});
