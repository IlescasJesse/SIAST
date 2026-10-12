/**
 * resetAreasExceptoRH.ts — Reset de áreas del edificio conservando Recursos Humanos
 *
 * Igual que resetAreas.ts, pero NO desactiva las áreas de AREAS_CONSERVADAS
 * (RH ya tiene tickets y empleados reales asignados).
 *
 *   1. Desactiva (soft delete) todas las áreas activas excepto las conservadas.
 *   2. Crea/reactiva el área de fallback `sin_asignar`.
 *   3. NO toca Empleado.areaId, Ticket.areaId ni muebles.
 *
 * Ejecutar:  cd packages/database && npx tsx prisma/resetAreasExceptoRH.ts
 */

import { PrismaClient, PisoEdificio } from "@prisma/client";

const prisma = new PrismaClient();

const AREAS_CONSERVADAS = ["recursos_humanos", "sin_asignar"];

async function main() {
  console.log("Iniciando reset de áreas (conservando Recursos Humanos)...");

  const { count: desactivadas } = await prisma.areaEdificio.updateMany({
    where: { activo: true, id: { notIn: AREAS_CONSERVADAS } },
    data: { activo: false },
  });
  console.log(`Desactivadas (soft delete): ${desactivadas} áreas`);

  await prisma.areaEdificio.upsert({
    where: { id: "sin_asignar" },
    create: {
      id: "sin_asignar",
      label: "Sin Asignar",
      piso: PisoEdificio.PB,
      floor: 0,
      activo: true,
    },
    update: { activo: true },
  });
  console.log("Área de fallback 'sin_asignar' creada/reactivada");

  const activas = await prisma.areaEdificio.findMany({
    where: { activo: true },
    select: { id: true, label: true },
  });
  console.log("Áreas activas ahora:", activas.map((a) => a.id).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
