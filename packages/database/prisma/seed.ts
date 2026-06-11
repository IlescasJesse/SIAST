import { PrismaClient, PisoEdificio, TipoAreaComun, Rol } from "@prisma/client";
import bcrypt from "bcrypt";
import { seedProcesos } from "./seed_procesos.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed SIAST...");

  // ──────────────────────────────────────────────────────────────
  // 1. LIMPIAR DATOS TRANSACCIONALES
  // ──────────────────────────────────────────────────────────────
  console.log("Eliminando datos existentes...");

  await prisma.notificacion.deleteMany({});
  await prisma.comentario.deleteMany({});
  await prisma.historialTicket.deleteMany({});
  await prisma.pasoTicket.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.usuario.deleteMany({});

  console.log(
    "Tablas limpiadas: notificaciones, comentarios, historial_tickets, tickets, usuarios",
  );

  // ──────────────────────────────────────────────────────────────
  // 2. AREAS DEL EDIFICIO (upsert — no se eliminan)
  // Nomenclatura: pb_* / n1_* / n2_* / n3_*
  // Coordenadas: null — se mapean en /admin/areas
  // ──────────────────────────────────────────────────────────────
  const areas = [
    // === PLANTA BAJA (PB, floor: 0) ===
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

    // === NIVEL 1 (floor: 1) ===
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

    // === NIVEL 2 (floor: 2) ===
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

    // === NIVEL 3 (floor: 3) ===
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

  for (const area of areas) {
    await prisma.areaEdificio.upsert({
      where: { id: area.id },
      update: area,
      create: area,
    });
  }
  console.log(`${areas.length} areas del edificio sincronizadas`);

  // ──────────────────────────────────────────────────────────────
  // 2.5. ÁREAS DE SOPORTE (Phase 3)
  // ──────────────────────────────────────────────────────────────
  const areasSoporteData = [
    {
      nombre: "TI",
      subcategorias: [
        "SISTEMAS_INSTITUCIONALES",
        "EQUIPOS_DISPOSITIVOS",
        "CUENTAS_DOMINIO",
        "CORREO_OUTLOOK",
      ],
      rolesIncluidos: ["RESPONSABLE_TI", "TECNICO_TI"],
    },
    {
      nombre: "REDES",
      subcategorias: ["RED_INTERNET"],
      rolesIncluidos: ["RESPONSABLE_REDES", "TECNICO_REDES"],
    },
    {
      nombre: "MANTENIMIENTO",
      subcategorias: ["SANITARIOS", "ILUMINACION", "MOVILIDAD"],
      rolesIncluidos: [
        "RESPONSABLE_MANTENIMIENTO",
        "TECNICO_ELECTRICISTA",
        "TECNICO_PLOMERO",
        "TECNICO_MOVILIDAD",
      ],
    },
    {
      nombre: "RECURSOS_MATERIALES",
      subcategorias: [
        "SALA_JUNTAS",
        "EQUIPO_AUDIOVISUAL",
        "PRESTAMO_EQUIPO",
        "MOBILIARIO",
        "PAPELERIA",
      ],
      rolesIncluidos: ["RESPONSABLE_RECURSOS_MATERIALES", "GESTOR_RECURSOS_MATERIALES"],
    },
  ];

  for (const area of areasSoporteData) {
    await prisma.areaSoporte.upsert({
      where: { nombre: area.nombre },
      update: { subcategorias: area.subcategorias, rolesIncluidos: area.rolesIncluidos },
      create: { ...area, activo: true },
    });
  }
  console.log(`${areasSoporteData.length} áreas de soporte sincronizadas`);

  // ──────────────────────────────────────────────────────────────
  // 3. USUARIO ADMIN (único)
  // ──────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Admin2026!", 10);

  const admin = await prisma.usuario.create({
    data: {
      nombre: "Administrador",
      apellidos: "SIAST",
      usuario: "admin",
      password: hashedPassword,
      rol: Rol.ADMIN,
      activo: true,
      esEmpleadoEstructura: false,
    },
  });

  console.log(`Usuario ADMIN creado: ${admin.usuario} (id=${admin.id})`);

  // ──────────────────────────────────────────────────────────────
  // 4. PROCESOS DE FLUJO MULTI-PASO
  // ──────────────────────────────────────────────────────────────
  await seedProcesos(prisma);

  console.log("Seed completado exitosamente");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
