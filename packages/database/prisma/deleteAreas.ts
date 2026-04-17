/**
 * deleteAreas.ts
 *
 * Elimina TODAS las áreas del edificio y deja solo un área placeholder
 * "sin_asignar" a la que se reasignan empleados y tickets para respetar las FKs.
 *
 * Ejecutar: cd packages/database && npm run db:delete-areas
 *
 * Después mapea las áreas reales desde el editor 2D en /admin/areas.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER_ID = "sin_asignar";

async function main() {
  console.log("🗑️  Borrando todas las áreas del edificio...");

  // 1. Crear (o asegurar) área placeholder
  await prisma.areaEdificio.upsert({
    where: { id: PLACEHOLDER_ID },
    update: {},
    create: {
      id: PLACEHOLDER_ID,
      label: "Sin asignar",
      piso: "PB",
      floor: 0,
      activo: false,
    },
  });
  console.log(`   ✅ Placeholder "${PLACEHOLDER_ID}" asegurado`);

  // 2. Reasignar empleados al placeholder
  const { count: empCount } = await prisma.empleado.updateMany({
    where: { areaId: { not: PLACEHOLDER_ID } },
    data: { areaId: PLACEHOLDER_ID, piso: "PB" },
  });
  console.log(`   ✅ ${empCount} empleado(s) reasignados a sin_asignar`);

  // 3. Reasignar tickets al placeholder
  const { count: ticketCount } = await prisma.ticket.updateMany({
    where: { areaId: { not: PLACEHOLDER_ID } },
    data: { areaId: PLACEHOLDER_ID, piso: "PB" },
  });
  console.log(`   ✅ ${ticketCount} ticket(s) reasignados a sin_asignar`);

  // 4. Borrar todas las áreas excepto el placeholder
  const { count: areaCount } = await prisma.areaEdificio.deleteMany({
    where: { id: { not: PLACEHOLDER_ID } },
  });
  console.log(`   ✅ ${areaCount} área(s) eliminadas`);

  console.log("");
  console.log("✅ Listo — solo queda el placeholder \"sin_asignar\"");
  console.log("   Crea las áreas reales desde el editor 2D en /admin/areas");
  console.log("   Sistema de coordenadas: 0-based (col 0..31, fila 0..26)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
