import { PrismaClient, PisoEdificio, Rol } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed SIAST...");

  // 1. ÁREAS DEL EDIFICIO (desde planos arquitectónicos)
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
  console.log(`✅ ${areas.length} áreas del edificio creadas`);

  // 2. USUARIOS DEL SISTEMA
  const usuariosData = [
    {
      nombre: "Administrador",
      apellidos: "SIAST",
      usuario: "admin",
      password: "Admin2025!",
      rol: Rol.ADMIN,
      email: "admin@finanzas.oaxaca.gob.mx",
    },
    {
      nombre: "Juan Carlos",
      apellidos: "Técnico Sistemas",
      usuario: "jc.tecnico",
      password: "Tech2025!",
      rol: Rol.TECNICO_INFORMATICO,
      email: "jc.tecnico@finanzas.oaxaca.gob.mx",
    },
    {
      nombre: "Pedro",
      apellidos: "Técnico Servicios",
      usuario: "p.servicios",
      password: "Serv2025!",
      rol: Rol.TECNICO_SERVICIOS,
      email: "p.servicios@finanzas.oaxaca.gob.mx",
    },
    {
      nombre: "María Elena",
      apellidos: "Mesa de Ayuda",
      usuario: "me.mesa",
      password: "Mesa2025!",
      rol: Rol.MESA_AYUDA,
      email: "me.mesa@finanzas.oaxaca.gob.mx",
    },
  ];

  for (const u of usuariosData) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { ...u, password: hashedPassword },
    });
  }
  console.log(`✅ ${usuariosData.length} usuarios del sistema creados`);

  // 3. EMPLEADOS DE PRUEBA (mientras SIRH está pendiente)
  const empleadosData = [
    {
      rfc: "PELJ850312HDF",
      nombre: "Juan",
      apellidos: "Pérez López",
      nombreCompleto: "Juan Pérez López",
      areaId: "n2_informatica",
      piso: PisoEdificio.NIVEL_2,
      departamento: "Informática",
    },
    {
      rfc: "GOMM920518MOC",
      nombre: "María",
      apellidos: "Gómez Martínez",
      nombreCompleto: "María Gómez Martínez",
      areaId: "pb_ingresos",
      piso: PisoEdificio.PB,
      departamento: "Ingresos",
    },
    {
      rfc: "RAMC780901OAX",
      nombre: "Carlos",
      apellidos: "Ramírez Méndez",
      nombreCompleto: "Carlos Ramírez Méndez",
      areaId: "n1_juridico",
      piso: PisoEdificio.NIVEL_1,
      departamento: "Jurídico",
    },
    {
      rfc: "HERF951220OAX",
      nombre: "Fernanda",
      apellidos: "Hernández Ruiz",
      nombreCompleto: "Fernanda Hernández Ruiz",
      areaId: "n2_recaudacion",
      piso: PisoEdificio.NIVEL_2,
      departamento: "Recaudación",
    },
    {
      rfc: "LOPG880714MOC",
      nombre: "Gabriela",
      apellidos: "López Pérez",
      nombreCompleto: "Gabriela López Pérez",
      areaId: "n1_secretaria",
      piso: PisoEdificio.NIVEL_1,
      departamento: "Secretaría",
    },
  ];

  for (const emp of empleadosData) {
    await prisma.empleado.upsert({
      where: { rfc: emp.rfc },
      update: {},
      create: emp,
    });
  }
  console.log(`✅ ${empleadosData.length} empleados de prueba creados`);

  // 4. TICKETS DE EJEMPLO
  const tecnico = await prisma.usuario.findUnique({ where: { usuario: "jc.tecnico" } });

  const ticketsEjemplo = [
    {
      asunto: "PC no enciende en Informática",
      descripcion: "El equipo de escritorio no responde al botón de encendido desde esta mañana",
      categoria: "TECNOLOGIAS" as const,
      subcategoria: "SOPORTE_TECNICO" as const,
      estado: "ABIERTO" as const,
      prioridad: "ALTA" as const,
      empleadoRfc: "PELJ850312HDF",
      areaId: "n2_informatica",
      piso: PisoEdificio.NIVEL_2,
    },
    {
      asunto: "Fuga de agua en baños planta baja",
      descripcion: "Hay una fuga visible en el lavabo del baño de hombres cerca del acceso principal",
      categoria: "SERVICIOS" as const,
      subcategoria: "SANITARIOS" as const,
      estado: "ASIGNADO" as const,
      prioridad: "URGENTE" as const,
      empleadoRfc: "GOMM920518MOC",
      areaId: "pb_acceso_principal",
      piso: PisoEdificio.PB,
      tecnicoId: tecnico?.id,
      fechaAsignacion: new Date(),
    },
  ];

  for (const ticket of ticketsEjemplo) {
    await prisma.ticket.create({ data: ticket });
  }
  console.log(`✅ ${ticketsEjemplo.length} tickets de ejemplo creados`);

  console.log("🎉 Seed completado exitosamente");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
