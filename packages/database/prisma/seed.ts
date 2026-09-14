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
  await prisma.pasoTicket.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.usuario.deleteMany({});

  console.log(
    "Tablas limpiadas: notificaciones, comentarios, historial_tickets, tickets, usuarios",
  );

  // ──────────────────────────────────────────────────────────────
  // 2. AREA DE FALLBACK MINIMA (upsert)
  // Las áreas reales las define Jesse desde /admin/areas.
  // sin_asignar es necesaria porque Empleado.areaId es NOT NULL
  // y el sync SIRH necesita un destino válido.
  // ──────────────────────────────────────────────────────────────
  await prisma.areaEdificio.upsert({
    where: { id: "sin_asignar" },
    update: { label: "Sin Asignar", activo: true },
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
  });
  console.log("Area de fallback 'sin_asignar' lista");

  // ──────────────────────────────────────────────────────────────
  // 2.5. ÁREAS DE SOPORTE (Phase 3)
  // ──────────────────────────────────────────────────────────────
  const areasSoporteData = [
    {
      nombre: "TI",
      subcategorias: ["EQUIPOS_DISPOSITIVOS", "CUENTAS_DOMINIO", "CORREO_OUTLOOK"],
      rolesIncluidos: ["RESPONSABLE_TI", "TECNICO_TI"],
    },
    {
      nombre: "SISTEMAS",
      subcategorias: ["SISTEMAS_INSTITUCIONALES"],
      rolesIncluidos: ["RESPONSABLE_SISTEMAS", "TECNICO_SISTEMAS"],
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
  // 3.5 USUARIOS DE PRUEBA (uno por cada rol de staff)
  // Sin esto era imposible probar los 19 roles restantes sin crearlos
  // a mano. Usuario = rol en minúsculas, password común de pruebas.
  // Los RESPONSABLE_* necesitan areaSoporteId para que
  // requireResponsableDeArea los deje ver tickets de su área.
  // ──────────────────────────────────────────────────────────────
  const areaSoporteIdPorNombre = Object.fromEntries(
    (await prisma.areaSoporte.findMany()).map((a) => [a.nombre, a.id]),
  );

  const testPassword = await bcrypt.hash("Test2026!", 10);

  const usuariosPrueba: { rol: Rol; areaSoporte?: string }[] = [
    { rol: Rol.MESA_AYUDA },
    { rol: Rol.TECNICO_TI },
    { rol: Rol.TECNICO_REDES },
    { rol: Rol.TECNICO_SISTEMAS },
    { rol: Rol.TECNICO_ELECTRICISTA },
    { rol: Rol.TECNICO_PLOMERO },
    { rol: Rol.TECNICO_MOVILIDAD },
    { rol: Rol.RESPONSABLE_TI, areaSoporte: "TI" },
    { rol: Rol.RESPONSABLE_REDES, areaSoporte: "REDES" },
    { rol: Rol.RESPONSABLE_SISTEMAS, areaSoporte: "SISTEMAS" },
    { rol: Rol.RESPONSABLE_MANTENIMIENTO, areaSoporte: "MANTENIMIENTO" },
    { rol: Rol.RESPONSABLE_RECURSOS_MATERIALES, areaSoporte: "RECURSOS_MATERIALES" },
    { rol: Rol.GESTOR_RECURSOS_MATERIALES },
    { rol: Rol.GESTOR_SALAS_JUNTA },
    { rol: Rol.GESTOR_RECURSOS },
    { rol: Rol.GESTOR_INVENTARIO },
  ];

  for (const { rol, areaSoporte } of usuariosPrueba) {
    await prisma.usuario.create({
      data: {
        nombre: "Prueba",
        apellidos: rol.replace(/_/g, " "),
        usuario: rol.toLowerCase(),
        password: testPassword,
        rol,
        activo: true,
        esEmpleadoEstructura: false,
        ...(areaSoporte && { areaSoporteId: areaSoporteIdPorNombre[areaSoporte] }),
      },
    });
  }
  console.log(
    `${usuariosPrueba.length} usuarios de prueba creados (uno por rol staff, usuario=<rol_minusculas>, password: Test2026!)`,
  );

  // ──────────────────────────────────────────────────────────────
  // 4. PROCESOS DE FLUJO MULTI-PASO
  // ──────────────────────────────────────────────────────────────
  await seedProcesos(prisma);

  console.log("Seed completado exitosamente");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
