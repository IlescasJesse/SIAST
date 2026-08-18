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
  // 4. PROCESOS DE FLUJO MULTI-PASO
  // ──────────────────────────────────────────────────────────────
  await seedProcesos(prisma);

  console.log("Seed completado exitosamente");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
