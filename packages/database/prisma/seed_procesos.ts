import { PrismaClient, SubcategoriaTicket } from "@prisma/client";
import { PROCESO_MAP } from "@stf/shared";

/**
 * Siembra (upsert idempotente) todos los procesos de flujo multi-paso
 * definidos en PROCESO_MAP de @stf/shared en las tablas:
 *   - procesos_definicion
 *   - pasos_definicion
 *
 * Se puede llamar desde el seed principal o ejecutarse de forma independiente:
 *   npx tsx packages/database/prisma/seed_procesos.ts
 */
export async function seedProcesos(prisma: PrismaClient): Promise<void> {
  console.log("Sembrando procesos de flujo (ProcesoDefinicion + PasoDefinicion)...");

  for (const [key, procesoInfo] of Object.entries(PROCESO_MAP)) {
    // Descomponer la clave "SUBCATEGORIA" o "SUBCATEGORIA:SUBTIPO"
    const colonIdx = key.indexOf(":");
    const subcategoria = (colonIdx === -1 ? key : key.slice(0, colonIdx)) as SubcategoriaTicket;
    const subTipo = colonIdx === -1 ? null : key.slice(colonIdx + 1);

    // Prisma no admite upsert con un campo nullable como parte de la clave única
    // (@@unique([subcategoria, subTipo])) cuando subTipo es null.
    // Usamos findFirst + update/create para ese caso.
    const existing = await prisma.procesoDefinicion.findFirst({
      where: { subcategoria, subTipo: subTipo ?? null },
    });

    let procesoId: number;

    if (existing) {
      // Actualizar datos del proceso
      await prisma.procesoDefinicion.update({
        where: { id: existing.id },
        data: {
          tipoFlujo: procesoInfo.tipoFlujo,
          nombre: procesoInfo.nombre,
          descripcion: procesoInfo.descripcion ?? null,
          activo: true,
        },
      });
      procesoId = existing.id;

      // Eliminar pasos previos para re-crearlos frescos
      await prisma.pasoDefinicion.deleteMany({ where: { procesoId } });
    } else {
      // Crear proceso nuevo
      const created = await prisma.procesoDefinicion.create({
        data: {
          subcategoria,
          subTipo: subTipo ?? null,
          tipoFlujo: procesoInfo.tipoFlujo,
          nombre: procesoInfo.nombre,
          descripcion: procesoInfo.descripcion ?? null,
          activo: true,
        },
      });
      procesoId = created.id;
    }

    // Crear pasos del proceso
    for (const paso of procesoInfo.pasos) {
      await prisma.pasoDefinicion.create({
        data: {
          procesoId,
          orden: paso.orden,
          rolRequerido: paso.rolRequerido,
          nombre: paso.nombre,
          descripcion: paso.descripcion ?? null,
          registraUnidades: paso.registraUnidades ?? false,
          labelUnidades: paso.labelUnidades ?? null,
        },
      });
    }

    const subLabel = subTipo ? `:${subTipo}` : "";
    console.log(
      `  [${existing ? "UPDATED" : "CREATED"}] ${subcategoria}${subLabel} — "${procesoInfo.nombre}" (${procesoInfo.pasos.length} paso(s))`,
    );
  }

  const total = Object.keys(PROCESO_MAP).length;
  console.log(`Procesos sembrados: ${total} proceso(s) listos.`);
}

// Permite ejecutar este archivo de forma independiente
if (process.argv[1] && process.argv[1].includes("seed_procesos")) {
  const prisma = new PrismaClient();
  seedProcesos(prisma)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
