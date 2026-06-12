/**
 * clampAreas.ts — Limpieza única de geometrías de áreas.
 *
 * Mueve (y si es necesario encoge) las áreas que quedaron fuera de la huella
 * del edificio para que entren en el ala/conector más cercano, y reporta los
 * solapes entre áreas del mismo piso (esos se corrigen a mano en /admin/areas).
 *
 * Uso: cd packages/database && npm run db:clamp-areas
 */

import { PrismaClient } from "@prisma/client";
import { ZONAS_EDIFICIO, dentroDelEdificio, seSolapan, type RectGrid } from "@stf/shared";

const prisma = new PrismaClient();

/** Acerca el rect a la zona más cercana preservando tamaño (encoge si no cabe). */
const clampAlEdificio = (r: RectGrid): RectGrid => {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  let mejor: RectGrid | null = null;
  let mejorCosto = Infinity;

  for (const z of ZONAS_EDIFICIO) {
    const w = Math.min(r.x2 - r.x1, z.x2 - z.x1);
    const h = Math.min(r.y2 - r.y1, z.y2 - z.y1);
    const x1 = clamp(r.x1, z.x1, z.x2 - w);
    const y1 = clamp(r.y1, z.y1, z.y2 - h);
    const candidato = { x1, y1, x2: x1 + w, y2: y1 + h };
    const encogido = r.x2 - r.x1 - w + (r.y2 - r.y1 - h);
    const costo = Math.abs(x1 - r.x1) + Math.abs(y1 - r.y1) + encogido * 3;
    if (costo < mejorCosto) {
      mejorCosto = costo;
      mejor = candidato;
    }
  }
  return mejor as RectGrid;
};

const main = async () => {
  const areas = await prisma.areaEdificio.findMany({
    where: {
      activo: true,
      gridX1: { not: null },
      gridY1: { not: null },
      gridX2: { not: null },
      gridY2: { not: null },
    },
    select: {
      id: true,
      label: true,
      floor: true,
      gridX1: true,
      gridY1: true,
      gridX2: true,
      gridY2: true,
    },
  });

  console.log(`Áreas activas con coordenadas: ${areas.length}\n`);

  const finales: Array<RectGrid & { id: string; label: string; floor: number }> = [];
  let corregidas = 0;

  for (const a of areas) {
    const rect: RectGrid = { x1: a.gridX1!, y1: a.gridY1!, x2: a.gridX2!, y2: a.gridY2! };

    if (dentroDelEdificio(rect)) {
      finales.push({ ...rect, id: a.id, label: a.label, floor: a.floor });
      continue;
    }

    const fixed = clampAlEdificio(rect);
    await prisma.areaEdificio.update({
      where: { id: a.id },
      data: { gridX1: fixed.x1, gridY1: fixed.y1, gridX2: fixed.x2, gridY2: fixed.y2 },
    });
    corregidas++;
    console.log(
      `✔ "${a.label}" (piso ${a.floor}): (${rect.x1},${rect.y1})→(${rect.x2},${rect.y2})  ⇒  (${fixed.x1},${fixed.y1})→(${fixed.x2},${fixed.y2})`,
    );
    finales.push({ ...fixed, id: a.id, label: a.label, floor: a.floor });
  }

  console.log(`\n${corregidas} área(s) reubicadas dentro del edificio.`);

  // Solapes restantes — solo reporte, se corrigen a mano en el editor
  let solapes = 0;
  for (let i = 0; i < finales.length; i++) {
    for (let j = i + 1; j < finales.length; j++) {
      if (finales[i].floor !== finales[j].floor) continue;
      if (seSolapan(finales[i], finales[j])) {
        solapes++;
        console.log(
          `⚠ Solape en piso ${finales[i].floor}: "${finales[i].label}" ↔ "${finales[j].label}"`,
        );
      }
    }
  }
  console.log(
    solapes === 0
      ? "Sin solapes entre áreas. ✔"
      : `\n${solapes} solape(s) — corrígelos en /admin/areas (se marcan en rojo).`,
  );
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
