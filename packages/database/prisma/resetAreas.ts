/**
 * resetAreas.ts — Reset mínimo de áreas del edificio
 *
 * Comportamiento:
 *   1. Desactiva (soft delete) TODAS las áreas existentes.
 *   2. Crea/reactiva únicamente el área de fallback `sin_asignar`.
 *   3. NO toca Empleado.areaId ni Ticket.areaId.
 *
 * Ejecutar:  cd packages/database && npm run db:reset-areas
 *
 * Nota: Jesse definirá las áreas reales desde /admin/areas.
 */

import { PrismaClient, PisoEdificio } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando reset-areas...");

  // ── 1. Soft delete de TODAS las áreas existentes ──────────────────────────
  const { count: desactivadas } = await prisma.areaEdificio.updateMany({
    where: { activo: true },
    data: { activo: false },
  });
  console.log(`Desactivadas (soft delete): ${desactivadas} áreas`);

  // ── 2. Upsert del área de fallback mínima ─────────────────────────────────
  await prisma.areaEdificio.upsert({
    where: { id: "sin_asignar" },
    create: {
      id: "sin_asignar",
      label: "Sin Asignar",
      piso: PisoEdificio.PB,
      floor: 0,
      esComun: false,
      tipoComun: null,
      nombrePropio: null,
      esSalaJuntas: false,
      gridX1: null,
      gridY1: null,
      gridX2: null,
      gridY2: null,
      activo: true,
    },
    update: {
      label: "Sin Asignar",
      activo: true,
    },
  });

  console.log("Área de fallback 'sin_asignar' creada/reactivada");
  console.log("");
  console.log("NOTA: Las áreas reales se definen en /admin/areas.");
  console.log("NOTA: Empleado.areaId y Ticket.areaId NO fueron modificados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
