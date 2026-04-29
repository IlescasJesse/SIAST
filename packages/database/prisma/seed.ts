import { PrismaClient, PisoEdificio, Rol } from "@prisma/client";
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
  await prisma.ticket.deleteMany({});
  await prisma.usuario.deleteMany({});

  console.log("Tablas limpiadas: notificaciones, comentarios, historial_tickets, tickets, usuarios");

  // ──────────────────────────────────────────────────────────────
  // 2. AREAS DEL EDIFICIO (upsert — no se eliminan)
  // ──────────────────────────────────────────────────────────────
  const areas = [
    // === PLANTA BAJA ===
    {
      id: "pb_acceso_principal",
      label: "Acceso Principal",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 14,
      gridY1: 12,
      gridX2: 18,
      gridY2: 15,
    },
    {
      id: "pb_archivos",
      label: "Área de Archivos",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 1,
      gridY1: 15,
      gridX2: 9,
      gridY2: 27,
    },
    {
      id: "pb_ingresos",
      label: "Ingresos",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 20,
      gridY1: 14,
      gridX2: 32,
      gridY2: 22,
    },
    {
      id: "pb_unidad_administrativa",
      label: "Unidad Administrativa",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 1,
      gridY1: 2,
      gridX2: 13,
      gridY2: 14,
    },
    {
      id: "pb_control",
      label: "Control / Caja",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 14,
      gridY1: 6,
      gridX2: 19,
      gridY2: 11,
    },
    {
      id: "pb_cuarto_electrico",
      label: "Cuarto Eléctrico PB",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 8,
      gridY1: 14,
      gridX2: 9,
      gridY2: 16,
    },
    {
      id: "pb_atencion_ciudadana",
      label: "Área de Atención Ciudadana",
      piso: PisoEdificio.PB,
      floor: 0,
      gridX1: 20,
      gridY1: 3,
      gridX2: 32,
      gridY2: 13,
    },

    // === NIVEL 1 ===
    {
      id: "n1_secretaria",
      label: "Secretaría de Finanzas",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 20,
      gridY1: 17,
      gridX2: 32,
      gridY2: 27,
    },
    {
      id: "n1_subsec_planeacion",
      label: "Subsecretaría de Planeación",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 24,
      gridY1: 20,
      gridX2: 32,
      gridY2: 27,
    },
    {
      id: "n1_subsec_ingresos",
      label: "Subsecretaría de Ingresos",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 24,
      gridY1: 8,
      gridX2: 32,
      gridY2: 18,
    },
    {
      id: "n1_juridico",
      label: "Área Jurídica",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 1,
      gridY1: 18,
      gridX2: 9,
      gridY2: 27,
    },
    {
      id: "n1_salon_morelos",
      label: "Salón Morelos",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 1,
      gridY1: 9,
      gridX2: 8,
      gridY2: 13,
    },
    {
      id: "n1_centro_reuniones",
      label: "Centro de Reuniones Cd. Judicial",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 1,
      gridY1: 2,
      gridX2: 13,
      gridY2: 8,
    },
    {
      id: "n1_oficina_alterna",
      label: "Oficina Alterna",
      piso: PisoEdificio.NIVEL_1,
      floor: 1,
      gridX1: 9,
      gridY1: 12,
      gridX2: 19,
      gridY2: 27,
    },

    // === NIVEL 2 ===
    {
      id: "n2_informatica",
      label: "Informática",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 1,
      gridY1: 9,
      gridX2: 9,
      gridY2: 16,
    },
    {
      id: "n2_recaudacion",
      label: "Recaudación",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 5,
      gridY1: 11,
      gridX2: 18,
      gridY2: 18,
    },
    {
      id: "n2_contraloria",
      label: "Contraloría",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 5,
      gridY1: 2,
      gridX2: 14,
      gridY2: 8,
    },
    {
      id: "n2_egresos",
      label: "Egresos",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 20,
      gridY1: 14,
      gridX2: 32,
      gridY2: 27,
    },
    {
      id: "n2_dir_egresos",
      label: "Dirección de Egresos",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 20,
      gridY1: 14,
      gridX2: 24,
      gridY2: 20,
    },
    {
      id: "n2_nominas",
      label: "Departamento de Nóminas",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 25,
      gridY1: 16,
      gridX2: 32,
      gridY2: 22,
    },
    {
      id: "n2_almacen",
      label: "Almacén Informática",
      piso: PisoEdificio.NIVEL_2,
      floor: 2,
      gridX1: 9,
      gridY1: 18,
      gridX2: 14,
      gridY2: 22,
    },

    // === NIVEL 3 ===
    {
      id: "n3_nivel3_general",
      label: "Nivel 3 — General",
      piso: PisoEdificio.NIVEL_3,
      floor: 3,
      gridX1: 1,
      gridY1: 1,
      gridX2: 32,
      gridY2: 27,
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
