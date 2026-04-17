/**
 * resetAreas.ts
 *
 * Vacía las coordenadas de cuadrícula de TODAS las áreas en la DB.
 * Los registros (id, label, piso, floor) se conservan para no romper
 * las FK de empleados y tickets.
 *
 * Ejecutar:  cd packages/database && npm run db:reset-areas
 *
 * Después, mapear las áreas desde el editor 2D en /admin/areas.
 * Sistema de coordenadas: 0-based  (col 0..31, fila 0..26).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Reseteando coordenadas de áreas...");

  const { count } = await prisma.areaEdificio.updateMany({
    data: {
      gridX1: null,
      gridY1: null,
      gridX2: null,
      gridY2: null,
    },
  });

  console.log(`✅ ${count} área(s) reseteadas — coordenadas ahora son NULL`);
  console.log("   Sistema de coordenadas: 0-based (col 0..31, fila 0..26)");
  console.log("   Mapea desde el editor 2D en /admin/areas → Guardar todo → Generar Render");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
