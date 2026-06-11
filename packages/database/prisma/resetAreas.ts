/**
 * resetAreas.ts — Seed completo de áreas del edificio con nomenclatura coherente
 *
 * Comportamiento:
 *   1. Desactiva (soft delete) TODAS las áreas existentes que no estén en la nueva lista.
 *   2. Upsert de las nuevas áreas por ID: crea si no existe, actualiza si ya existe.
 *   3. NO toca Empleado.areaId ni Ticket.areaId — las FKs se preservan.
 *   4. Coordenadas gridX1/Y1/X2/Y2 se ponen a null — el usuario las mapea en /admin/areas.
 *
 * Ejecutar:  cd packages/database && npm run db:reset-areas
 *
 * Nomenclatura de IDs:
 *   pb_*   → Planta Baja  (floor: 0, piso: PB)
 *   n1_*   → Nivel 1      (floor: 1, piso: NIVEL_1)
 *   n2_*   → Nivel 2      (floor: 2, piso: NIVEL_2)
 *   n3_*   → Nivel 3      (floor: 3, piso: NIVEL_3)
 */

import { PrismaClient, PisoEdificio, TipoAreaComun } from "@prisma/client";

const prisma = new PrismaClient();

type AreaInput = {
  id: string;
  label: string;
  piso: PisoEdificio;
  floor: number;
  esComun?: boolean;
  tipoComun?: TipoAreaComun;
  nombrePropio?: string;
  esSalaJuntas?: boolean;
};

const AREAS: AreaInput[] = [
  // ================================================================
  // PLANTA BAJA (PB)
  // ================================================================
  {
    id: "pb_recepcion",
    label: "Recepción",
    piso: PisoEdificio.PB,
    floor: 0,
    esComun: true,
    tipoComun: TipoAreaComun.RECEPCION,
    nombrePropio: "Recepción General",
  },
  {
    id: "pb_sala_espera",
    label: "Sala de Espera",
    piso: PisoEdificio.PB,
    floor: 0,
  },
  {
    id: "pb_caja",
    label: "Caja / Tesorería",
    piso: PisoEdificio.PB,
    floor: 0,
  },
  {
    id: "pb_atencion_ciudadana",
    label: "Área de Atención Ciudadana",
    piso: PisoEdificio.PB,
    floor: 0,
  },
  {
    id: "pb_unidad_administrativa",
    label: "Unidad Administrativa",
    piso: PisoEdificio.PB,
    floor: 0,
  },
  {
    id: "pb_ingresos",
    label: "Ingresos",
    piso: PisoEdificio.PB,
    floor: 0,
  },
  {
    id: "pb_cuarto_electrico",
    label: "Cuarto Eléctrico PB",
    piso: PisoEdificio.PB,
    floor: 0,
  },
  {
    id: "pb_bano",
    label: "Baño PB",
    piso: PisoEdificio.PB,
    floor: 0,
    esComun: true,
    tipoComun: TipoAreaComun.BANO,
    nombrePropio: "Baño Planta Baja",
  },
  {
    id: "pb_sala_juntas",
    label: "Sala Oaxaca",
    piso: PisoEdificio.PB,
    floor: 0,
    esComun: true,
    tipoComun: TipoAreaComun.SALA_JUNTAS,
    esSalaJuntas: true,
    nombrePropio: "Sala Oaxaca",
  },
  {
    id: "pb_archivo_general",
    label: "Archivo General",
    piso: PisoEdificio.PB,
    floor: 0,
    esComun: true,
    tipoComun: TipoAreaComun.ARCHIVO,
  },
  {
    id: "pb_bodega",
    label: "Bodega PB",
    piso: PisoEdificio.PB,
    floor: 0,
    esComun: true,
    tipoComun: TipoAreaComun.BODEGA,
  },

  // ================================================================
  // NIVEL 1 (N1)
  // ================================================================
  {
    id: "n1_informatica",
    label: "Dirección de Informática",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_rh",
    label: "Recursos Humanos",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_contabilidad",
    label: "Contabilidad",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_juridico",
    label: "Área Jurídica",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_subsec_planeacion",
    label: "Subsecretaría de Planeación",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_subsec_ingresos",
    label: "Subsecretaría de Ingresos",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_oficina_alterna",
    label: "Oficina Alterna",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
  },
  {
    id: "n1_bano",
    label: "Baño N1",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
    esComun: true,
    tipoComun: TipoAreaComun.BANO,
    nombrePropio: "Baño Nivel 1",
  },
  {
    id: "n1_sala_juntas",
    label: "Sala Xochimilco",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
    esComun: true,
    tipoComun: TipoAreaComun.SALA_JUNTAS,
    esSalaJuntas: true,
    nombrePropio: "Sala Xochimilco",
  },
  {
    id: "n1_copiado",
    label: "Área de Copiado N1",
    piso: PisoEdificio.NIVEL_1,
    floor: 1,
    esComun: true,
    tipoComun: TipoAreaComun.COPIADO,
  },

  // ================================================================
  // NIVEL 2 (N2)
  // ================================================================
  {
    id: "n2_informatica",
    label: "Informática",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_presupuesto",
    label: "Dirección de Presupuesto",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_auditoria",
    label: "Auditoría",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_recaudacion",
    label: "Recaudación",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_contraloria",
    label: "Contraloría",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_egresos",
    label: "Egresos",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_nominas",
    label: "Departamento de Nóminas",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_almacen",
    label: "Almacén Informática",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
  },
  {
    id: "n2_bano",
    label: "Baño N2",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
    esComun: true,
    tipoComun: TipoAreaComun.BANO,
    nombrePropio: "Baño Nivel 2",
  },
  {
    id: "n2_sala_juntas",
    label: "Sala Monte Albán",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
    esComun: true,
    tipoComun: TipoAreaComun.SALA_JUNTAS,
    esSalaJuntas: true,
    nombrePropio: "Sala Monte Albán",
  },
  {
    id: "n2_copiado",
    label: "Área de Copiado N2",
    piso: PisoEdificio.NIVEL_2,
    floor: 2,
    esComun: true,
    tipoComun: TipoAreaComun.COPIADO,
  },

  // ================================================================
  // NIVEL 3 (N3)
  // ================================================================
  {
    id: "n3_secretaria",
    label: "Despacho del Secretario",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
  },
  {
    id: "n3_subsecretaria",
    label: "Subsecretaría",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
  },
  {
    id: "n3_comunicacion",
    label: "Comunicación Social",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
  },
  {
    id: "n3_asesores",
    label: "Asesores",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
  },
  {
    id: "n3_bano",
    label: "Baño N3",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
    esComun: true,
    tipoComun: TipoAreaComun.BANO,
    nombrePropio: "Baño Nivel 3",
  },
  {
    id: "n3_sala_juntas",
    label: "Sala Tlacolula",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
    esComun: true,
    tipoComun: TipoAreaComun.SALA_JUNTAS,
    esSalaJuntas: true,
    nombrePropio: "Sala Tlacolula",
  },
  {
    id: "n3_sala_conferencias",
    label: "Sala de Conferencias N3",
    piso: PisoEdificio.NIVEL_3,
    floor: 3,
    esComun: true,
    tipoComun: TipoAreaComun.SALA_CONFERENCIAS,
    nombrePropio: "Sala de Conferencias",
  },
];

const NUEVOS_IDS = new Set(AREAS.map((a) => a.id));

async function main() {
  console.log("Iniciando reset-areas...");

  // ── 1. Soft delete de áreas que ya no están en la nueva lista ──
  const { count: desactivadas } = await prisma.areaEdificio.updateMany({
    where: { id: { notIn: Array.from(NUEVOS_IDS) } },
    data: { activo: false },
  });
  console.log(`Desactivadas (soft delete): ${desactivadas} áreas obsoletas`);

  // ── 2. Upsert de todas las áreas de la nueva lista ──
  let creadas = 0;
  let actualizadas = 0;

  for (const area of AREAS) {
    const data = {
      label: area.label,
      piso: area.piso,
      floor: area.floor,
      esComun: area.esComun ?? false,
      tipoComun: area.tipoComun ?? null,
      nombrePropio: area.nombrePropio ?? null,
      esSalaJuntas: area.esSalaJuntas ?? false,
      // Coordenadas a null — se mapean en /admin/areas
      gridX1: null,
      gridY1: null,
      gridX2: null,
      gridY2: null,
      activo: true,
    };

    const existing = await prisma.areaEdificio.findUnique({ where: { id: area.id } });

    await prisma.areaEdificio.upsert({
      where: { id: area.id },
      create: { id: area.id, ...data },
      update: data,
    });

    if (existing) {
      actualizadas++;
    } else {
      creadas++;
    }
  }

  console.log(`Creadas: ${creadas} | Actualizadas: ${actualizadas}`);
  console.log(`Total áreas activas: ${AREAS.length}`);
  console.log("");
  console.log("Resumen por piso:");
  const porPiso: Record<string, number> = {};
  for (const a of AREAS) {
    porPiso[a.piso] = (porPiso[a.piso] ?? 0) + 1;
  }
  for (const [piso, cant] of Object.entries(porPiso)) {
    console.log(`  ${piso}: ${cant} áreas`);
  }
  console.log("");
  console.log("NOTA: Coordenadas grid son NULL. Mapear en /admin/areas -> Guardar todo.");
  console.log("NOTA: Empleado.areaId y Ticket.areaId NO fueron modificados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
