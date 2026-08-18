import { prisma } from "../config/database.js";
import { SubcategoriaTicket, CategoriaTicket } from "@prisma/client";
import type { JwtPayload } from "../types/index.js";
import * as notif from "./notificaciones.service.js";
import { enviarNotifTicketCreado } from "./whatsapp.service.js";
import { FOLIO_PREFIX } from "@stf/shared";

const SUBCATEGORIAS_VALIDAS = new Set(Object.values(SubcategoriaTicket));
const CATEGORIAS_VALIDAS = new Set(Object.values(CategoriaTicket));

function computeAutoPriority(ticket: { createdAt: Date | string; estado: string }): string {
  if (["RESUELTO", "CANCELADO"].includes(ticket.estado)) return "BAJA";
  const hours = (Date.now() - new Date(ticket.createdAt).getTime()) / 3_600_000;
  if (hours > 24) return "URGENTE";
  if (hours > 6) return "MEDIA";
  return "BAJA";
}

/** Prioridad efectiva: el override manual (Mesa de Ayuda / Responsable) gana sobre el cálculo automático. */
function resolvePrioridad(ticket: {
  createdAt: Date | string;
  estado: string;
  prioridadManual?: string | null;
}): string {
  return ticket.prioridadManual ?? computeAutoPriority(ticket);
}

const PRIORIDADES_VALIDAS = new Set(["BAJA", "MEDIA", "ALTA", "URGENTE"]);
const ROLES_PRIORIDAD_MANUAL = [
  "ADMIN",
  "MESA_AYUDA",
  "RESPONSABLE_TI",
  "RESPONSABLE_SISTEMAS",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
] as const;

const PRIORIDAD_ORDER: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

async function generarFolio(categoria: string, subcategoria: string): Promise<string> {
  const key = `${categoria}-${subcategoria}`;
  const prefix = FOLIO_PREFIX[key] ?? "TIC";
  const count = await prisma.ticket.count({
    where: { folio: { startsWith: prefix } },
  });
  const num = String(count + 1).padStart(4, "0");
  return `${prefix}-${num}`;
}

async function generarPasosParaTicket(
  ticketId: number,
  categoria: string,
  subcategoria: string,
  subTipo: string | null,
): Promise<void> {
  if (!["TECNOLOGIAS", "SERVICIOS"].includes(categoria)) return;
  const proceso = await prisma.procesoDefinicion.findFirst({
    where: { subcategoria: subcategoria as never, subTipo, activo: true },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });
  if (proceso && proceso.tipoFlujo !== "PENDIENTE" && proceso.pasos.length > 0) {
    await prisma.pasoTicket.createMany({
      data: proceso.pasos.map((paso) => ({
        ticketId,
        orden: paso.orden,
        rolRequerido: paso.rolRequerido,
        nombre: paso.nombre,
        labelUnidades: paso.labelUnidades ?? null,
        estado: "PENDIENTE",
      })),
    });
  }
}

const TRANSICIONES: Record<string, string[]> = {
  ABIERTO: ["ASIGNADO", "CANCELADO"],
  ASIGNADO: ["EN_PROGRESO", "CANCELADO"],
  EN_PROGRESO: ["RESUELTO", "CANCELADO"],
  RESUELTO: [],
  CANCELADO: [],
};

const ticketInclude = {
  area: true,
  empleado: { select: { rfc: true, nombreCompleto: true, areaId: true } },
  tecnico: { select: { id: true, nombre: true, apellidos: true } },
  creadoPor: { select: { id: true, nombre: true, rol: true } },
  aceptadoPor: { select: { id: true, nombre: true, apellidos: true, rol: true } },
  historial: { orderBy: { createdAt: "asc" as const } },
  comentarios: {
    orderBy: { createdAt: "asc" as const },
    include: { usuario: { select: { nombre: true, apellidos: true, rol: true } } },
  },
  pasos: {
    orderBy: { orden: "asc" as const },
    include: { tecnico: { select: { id: true, nombre: true, apellidos: true, rol: true } } },
  },
};

export const listarTickets = async (
  user: JwtPayload,
  query: {
    estado?: string;
    categoria?: string;
    tecnicoId?: string;
    rfc?: string;
    page?: string;
    limit?: string;
  },
) => {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { activo: true };

  if (user.rol === "EMPLEADO") {
    where.empleadoRfc = user.rfc;
  } else if (
    user.rol === "TECNICO_TI" ||
    user.rol === "TECNICO_REDES" ||
    user.rol === "TECNICO_ELECTRICISTA" ||
    user.rol === "TECNICO_PLOMERO" ||
    user.rol === "TECNICO_MOVILIDAD"
  ) {
    where.tecnicoId = user.id;
  } else if (
    user.rol === "GESTOR_RECURSOS_MATERIALES" ||
    user.rol === "GESTOR_SALAS_JUNTA" ||
    user.rol === "GESTOR_RECURSOS" ||
    user.rol === "GESTOR_INVENTARIO" ||
    user.rol === "RESPONSABLE_RECURSOS_MATERIALES"
  ) {
    where.categoria = "RECURSOS_MATERIALES";
  } else if (ROLES_RESPONSABLE.includes(user.rol as any)) {
    const usuarioDb = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { areaSoporteId: true },
    });
    if (usuarioDb?.areaSoporteId) {
      const areaSoporte = await prisma.areaSoporte.findUnique({
        where: { id: usuarioDb.areaSoporteId },
      });
      if (areaSoporte) {
        where.subcategoria = { in: areaSoporte.subcategorias as string[] };
      }
    }
  }

  if (query.estado) where.estado = query.estado;
  if (query.categoria) where.categoria = query.categoria;
  if (query.tecnicoId && user.rol === "ADMIN") where.tecnicoId = parseInt(query.tecnicoId, 10);
  if (query.rfc && user.rol !== "EMPLEADO") where.empleadoRfc = query.rfc;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      // El orden final se aplica en JS después de calcular auto-prioridad
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  // Aplicar prioridad efectiva (override manual o auto-cálculo) a cada ticket
  const ticketsConPrioridad = tickets.map((t) => ({
    ...t,
    prioridad: resolvePrioridad(t) as typeof t.prioridad,
  }));

  const ESTADOS_FINALES = ["RESUELTO", "CANCELADO"];

  // Separar activos de finales
  const activos = ticketsConPrioridad.filter((t) => !ESTADOS_FINALES.includes(t.estado));
  const finales = ticketsConPrioridad.filter((t) => ESTADOS_FINALES.includes(t.estado));

  // Activos: URGENTE > ALTA > MEDIA > BAJA, luego por createdAt ASC (más antiguos primero)
  activos.sort((a, b) => {
    const pDiff = (PRIORIDAD_ORDER[a.prioridad] ?? 3) - (PRIORIDAD_ORDER[b.prioridad] ?? 3);
    if (pDiff !== 0) return pDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Finales: más recientemente resueltos/cancelados primero
  finales.sort((a, b) => {
    const fechaA = a.fechaResolucion ?? a.createdAt;
    const fechaB = b.fechaResolucion ?? b.createdAt;
    return new Date(fechaB).getTime() - new Date(fechaA).getTime();
  });

  const ticketsOrdenados = [...activos, ...finales];

  return { tickets: ticketsOrdenados, total, page, totalPages: Math.ceil(total / limit) };
};

export const crearTicket = async (
  user: JwtPayload,
  body: {
    asunto: string;
    descripcion: string;
    categoria: string;
    subcategoria: string;
    prioridad?: string;
    ubicacionAreaId?: string;
    areaId?: string; // alias alternativo
    piso?: string; // opcional — se deriva del área
    rfcSolicitante?: string;
    recursosAdicionales?: string | Record<string, unknown>; // objeto del frontend o JSON string — se serializa antes de persistir
    subTipo?: string; // subtipo dentro de EQUIPOS_DISPOSITIVOS
  },
) => {
  // EMPLEADO crea por sí mismo; todo el staff debe enviar rfcSolicitante
  const empleadoRfc = user.rol === "EMPLEADO" ? user.rfc! : body.rfcSolicitante;

  if (!empleadoRfc) {
    throw Object.assign(new Error("El RFC del solicitante es obligatorio"), { status: 400 });
  }

  if (user.rol === "EMPLEADO") {
    const activos = await prisma.ticket.count({
      where: {
        empleadoRfc,
        activo: true,
        estado: { notIn: ["RESUELTO", "CANCELADO"] },
      },
    });
    if (activos >= 2) {
      throw Object.assign(new Error("Límite de solicitudes activas alcanzado (máximo 2)"), {
        status: 403,
      });
    }
  }

  // Resolver área: puede venir como 'ubicacionAreaId' o 'areaId'
  const areaIdResuelto = body.ubicacionAreaId || body.areaId;
  if (!areaIdResuelto) {
    throw Object.assign(new Error("El campo ubicacionAreaId es obligatorio"), { status: 400 });
  }

  const area = await prisma.areaEdificio.findUnique({ where: { id: areaIdResuelto } });
  if (!area) {
    throw Object.assign(new Error("Área no encontrada"), { status: 404 });
  }

  // El piso se deriva siempre del área para evitar inconsistencias
  const pisoResuelto = area.piso;

  const categoriaVal = (body.categoria ?? "").toString().trim();
  const subcategoriaVal = (body.subcategoria ?? "").toString().trim();

  if (!categoriaVal || !subcategoriaVal) {
    throw Object.assign(new Error("Categoría y subcategoría son obligatorias"), { status: 400 });
  }
  if (!CATEGORIAS_VALIDAS.has(categoriaVal as CategoriaTicket)) {
    throw Object.assign(new Error(`Categoría inválida: "${categoriaVal}"`), { status: 400 });
  }
  if (!SUBCATEGORIAS_VALIDAS.has(subcategoriaVal as SubcategoriaTicket)) {
    throw Object.assign(
      new Error(
        `Subcategoría inválida: "${subcategoriaVal}". Valores aceptados: ${[...SUBCATEGORIAS_VALIDAS].join(", ")}`,
      ),
      { status: 400 },
    );
  }

  const folio = await generarFolio(categoriaVal, subcategoriaVal);

  // Verificar que el usuario staff existe en DB (JWT puede ser stale si se re-seeded)
  let creadoPorId: number | undefined;
  if (user.rol !== "EMPLEADO") {
    const existe = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!existe) {
      throw Object.assign(
        new Error("Sesión expirada — por favor cierra sesión y vuelve a ingresar"),
        { status: 401 },
      );
    }
    creadoPorId = existe.id;
  }

  // El frontend envía recursosAdicionales como objeto; la columna es JSON string (Text)
  const recursosAdicionales =
    body.recursosAdicionales == null
      ? null
      : typeof body.recursosAdicionales === "string"
        ? body.recursosAdicionales
        : JSON.stringify(body.recursosAdicionales);

  const ticket = await prisma.ticket.create({
    data: {
      folio,
      asunto: body.asunto,
      descripcion: body.descripcion,
      categoria: categoriaVal as never,
      subcategoria: subcategoriaVal as never,
      categoriaOriginal: categoriaVal as never,
      subcategoriaOriginal: subcategoriaVal as never,
      prioridad: "MEDIA" as never,
      empleadoRfc,
      areaId: areaIdResuelto,
      piso: pisoResuelto,
      creadoPorId,
      recursosAdicionales,
      subTipo: body.subTipo ?? null,
    },
    include: ticketInclude,
  });

  // Generar pasos del flujo de trabajo según el proceso definido
  await generarPasosParaTicket(ticket.id, categoriaVal, subcategoriaVal, body.subTipo ?? null);

  await prisma.historialTicket.create({
    data: {
      ticketId: ticket.id,
      estadoNuevo: "ABIERTO",
      usuarioId: user.rol !== "EMPLEADO" ? user.id : undefined,
      empleadoRfc: user.rol === "EMPLEADO" ? empleadoRfc : undefined,
      comentario: "Solicitud creada",
    },
  });

  await notif.emitirTicketNuevo({
    id: ticket.id,
    asunto: ticket.asunto,
    categoria: ticket.categoria,
    prioridad: ticket.prioridad,
    empleadoRfc,
    areaLabel: area.label,
  });

  // Enviar WA al empleado con liga directa al ticket (no bloquea la respuesta)
  prisma.empleado
    .findUnique({ where: { rfc: empleadoRfc }, select: { telefono: true, nombreCompleto: true } })
    .then((emp) => {
      if (!emp?.telefono) return;
      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      return enviarNotifTicketCreado({
        telefono: emp.telefono,
        nombre: emp.nombreCompleto,
        folio: ticket.folio,
        asunto: ticket.asunto,
        prioridad: ticket.prioridad,
        url: `${frontendUrl}/solicitudes/${ticket.id}`,
      });
    })
    .catch((err) => console.error("[WhatsApp] Error al notificar ticket creado:", err));

  return ticket;
};

export const obtenerTicket = async (id: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id, activo: true },
    include: ticketInclude,
  });

  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  if (user.rol === "EMPLEADO" && ticket.empleadoRfc !== user.rfc) {
    throw Object.assign(new Error("Sin acceso a esta solicitud"), { status: 403 });
  }

  return {
    ...ticket,
    prioridad: resolvePrioridad(ticket) as typeof ticket.prioridad,
  };
};

/** Override manual de prioridad — Mesa de Ayuda y Responsables de área (feedback de staff 2026-08-12). */
export const actualizarPrioridad = async (id: number, prioridad: string, user: JwtPayload) => {
  if (!ROLES_PRIORIDAD_MANUAL.includes(user.rol as (typeof ROLES_PRIORIDAD_MANUAL)[number])) {
    throw Object.assign(new Error("Sin permisos para cambiar la prioridad"), { status: 403 });
  }
  if (!PRIORIDADES_VALIDAS.has(prioridad)) {
    throw Object.assign(new Error(`Prioridad inválida: "${prioridad}"`), { status: 400 });
  }

  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  await verificarAccesoAreaTicket(ticket.subcategoria, user);

  await prisma.ticket.update({
    where: { id },
    data: { prioridadManual: prioridad as never },
  });

  await prisma.historialTicket.create({
    data: {
      ticketId: id,
      estadoAnterior: ticket.estado,
      estadoNuevo: ticket.estado,
      usuarioId: user.id,
      comentario: `Prioridad ajustada manualmente a ${prioridad} por ${user.nombre}`,
    },
  });

  const updated = await prisma.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
  return { ...updated, prioridad: resolvePrioridad(updated) as typeof updated.prioridad };
};

const CATEGORIA_ROL_MAP: Record<string, string[]> = {
  TECNOLOGIAS: ["TECNICO_TI", "TECNICO_REDES", "TECNICO_SISTEMAS"],
  SERVICIOS: ["TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD"],
  RECURSOS_MATERIALES: [
    "GESTOR_RECURSOS_MATERIALES",
    "GESTOR_SALAS_JUNTA",
    "GESTOR_RECURSOS",
    "GESTOR_INVENTARIO",
    "RESPONSABLE_RECURSOS_MATERIALES",
  ],
};

const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
  "RESPONSABLE_SISTEMAS",
] as const;

// Deriva la categoría a partir de una subcategoría (para reasignaciones de área)
const CATEGORIA_POR_SUBCATEGORIA: Record<string, string> = {
  SISTEMAS_INSTITUCIONALES: "TECNOLOGIAS",
  EQUIPOS_DISPOSITIVOS: "TECNOLOGIAS",
  RED_INTERNET: "TECNOLOGIAS",
  CUENTAS_DOMINIO: "TECNOLOGIAS",
  CORREO_OUTLOOK: "TECNOLOGIAS",
  SANITARIOS: "SERVICIOS",
  ILUMINACION: "SERVICIOS",
  MOVILIDAD: "SERVICIOS",
  SALA_JUNTAS: "RECURSOS_MATERIALES",
  EQUIPO_AUDIOVISUAL: "RECURSOS_MATERIALES",
  PRESTAMO_EQUIPO: "RECURSOS_MATERIALES",
  MOBILIARIO: "RECURSOS_MATERIALES",
  PAPELERIA: "RECURSOS_MATERIALES",
};

// Verifica que el usuario pueda actuar (aceptar/reasignar) sobre el área actual del ticket:
// ADMIN/MESA_AYUDA sin restricción; RESPONSABLE_* solo si el ticket pertenece a su área.
async function verificarAccesoAreaTicket(ticketSubcategoria: string, user: JwtPayload) {
  if (user.rol === "ADMIN" || user.rol === "MESA_AYUDA") return;
  if (!ROLES_RESPONSABLE.includes(user.rol as any)) {
    throw Object.assign(new Error("Sin permisos para esta acción"), { status: 403 });
  }
  const usuarioDb = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { areaSoporteId: true },
  });
  const areaSoporte = usuarioDb?.areaSoporteId
    ? await prisma.areaSoporte.findUnique({ where: { id: usuarioDb.areaSoporteId } })
    : null;
  if (!areaSoporte) {
    throw Object.assign(new Error("Responsable sin área asignada"), { status: 403 });
  }
  const subcategorias = areaSoporte.subcategorias as string[];
  if (!subcategorias.includes(ticketSubcategoria)) {
    throw Object.assign(new Error("Solicitud fuera del área de soporte asignada"), {
      status: 403,
    });
  }
}

export const aceptarTicket = async (id: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  await verificarAccesoAreaTicket(ticket.subcategoria, user);

  const updated = await prisma.ticket.update({
    where: { id },
    data: { aceptadoPorId: user.id, aceptadoEn: new Date() },
    include: ticketInclude,
  });

  await prisma.historialTicket.create({
    data: {
      ticketId: id,
      estadoAnterior: ticket.estado,
      estadoNuevo: ticket.estado,
      usuarioId: user.id,
      comentario: `Solicitud aceptada por ${user.nombre}`,
    },
  });

  return updated;
};

export const reasignarArea = async (id: number, nuevaSubcategoria: string, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  if (!SUBCATEGORIAS_VALIDAS.has(nuevaSubcategoria as SubcategoriaTicket)) {
    throw Object.assign(new Error(`Subcategoría inválida: "${nuevaSubcategoria}"`), {
      status: 400,
    });
  }
  if (nuevaSubcategoria === ticket.subcategoria) {
    throw Object.assign(new Error("El ticket ya pertenece a esa subcategoría"), { status: 400 });
  }

  // Guard: no reasignar si ya hay técnico trabajando en ella (evita huérfanos de pasos en curso)
  if (ticket.estado !== "ABIERTO") {
    throw Object.assign(
      new Error("Solo se puede reasignar mientras la solicitud está en estado ABIERTO"),
      { status: 400 },
    );
  }

  await verificarAccesoAreaTicket(ticket.subcategoria, user);

  const nuevaCategoria = CATEGORIA_POR_SUBCATEGORIA[nuevaSubcategoria];
  if (!nuevaCategoria) {
    throw Object.assign(new Error(`No se pudo derivar la categoría para "${nuevaSubcategoria}"`), {
      status: 400,
    });
  }

  const [areaAnterior, areaNueva] = await Promise.all([
    prisma.areaSoporte.findFirst({
      where: { subcategorias: { array_contains: ticket.subcategoria } },
    }),
    prisma.areaSoporte.findFirst({
      where: { subcategorias: { array_contains: nuevaSubcategoria } },
    }),
  ]);
  if (!areaNueva) {
    throw Object.assign(
      new Error(`Ninguna área de soporte cubre la subcategoría "${nuevaSubcategoria}"`),
      { status: 400 },
    );
  }

  // Los pasos generados por el proceso anterior ya no aplican al nuevo área/subcategoría
  await prisma.pasoTicket.deleteMany({ where: { ticketId: id } });

  await prisma.ticket.update({
    where: { id },
    data: {
      categoria: nuevaCategoria as never,
      subcategoria: nuevaSubcategoria as never,
      // El subTipo original era específico de la subcategoría anterior — ya no aplica
      subTipo: null,
      // La nueva área también debe pasar por triage
      aceptadoPorId: null,
      aceptadoEn: null,
    },
  });

  // Regenerar pasos del flujo según el proceso de la nueva subcategoría (si aplica)
  await generarPasosParaTicket(id, nuevaCategoria, nuevaSubcategoria, null);

  const updated = await prisma.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });

  await prisma.historialTicket.create({
    data: {
      ticketId: id,
      estadoAnterior: ticket.estado,
      estadoNuevo: ticket.estado,
      usuarioId: user.id,
      comentario: `Reasignado de ${areaAnterior?.nombre ?? ticket.subcategoria} a ${areaNueva.nombre} por ${user.nombre}`,
    },
  });

  await notif.emitirTicketReasignado({
    ticketId: id,
    asunto: ticket.asunto,
    empleadoRfc: ticket.empleadoRfc,
    areaAnteriorNombre: areaAnterior?.nombre ?? ticket.subcategoria,
    areaNuevaNombre: areaNueva.nombre,
    reasignadoPorNombre: user.nombre,
  });

  return updated;
};

export const asignarTicket = async (id: number, tecnicoId: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  // Guard: el área receptora debe aceptar el ticket antes de poder asignar técnico
  if (!ticket.aceptadoEn) {
    throw Object.assign(new Error("Debe aceptar el ticket antes de asignar técnico"), {
      status: 400,
    });
  }

  // Guard: tickets con flujo de pasos no se asignan manualmente (D-12)
  const pasosExistentes = await prisma.pasoTicket.findMany({ where: { ticketId: id } });
  if (pasosExistentes.length > 0) {
    throw Object.assign(
      new Error("Este ticket usa flujo de pasos. Asignar técnico desde el panel de pasos."),
      { status: 400 },
    );
  }

  const tecnico = await prisma.usuario.findFirst({
    where: { id: tecnicoId, activo: true },
  });
  if (!tecnico) throw Object.assign(new Error("Técnico no encontrado"), { status: 404 });

  // Validar que el rol del técnico corresponde a la categoría del ticket
  const rolesPermitidos = CATEGORIA_ROL_MAP[ticket.categoria] ?? [];
  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(tecnico.rol)) {
    throw Object.assign(
      new Error(
        `El usuario seleccionado no tiene el rol adecuado para solicitudes de ${ticket.categoria}. ` +
          `Se requiere: ${rolesPermitidos.join(", ")}`,
      ),
      { status: 400 },
    );
  }

  // Guard: si el usuario es RESPONSABLE_*, verificar que el técnico pertenece a su área
  if (ROLES_RESPONSABLE.includes(user.rol as any)) {
    const usuarioDb = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { areaSoporteId: true },
    });
    const areaSoporte = usuarioDb?.areaSoporteId
      ? await prisma.areaSoporte.findUnique({ where: { id: usuarioDb.areaSoporteId } })
      : null;
    if (!areaSoporte) {
      throw Object.assign(new Error("Responsable sin área asignada"), { status: 403 });
    }
    const rolesArea = areaSoporte.rolesIncluidos as string[];
    if (!rolesArea.includes(tecnico.rol)) {
      throw Object.assign(new Error("El técnico no pertenece al área de soporte del responsable"), {
        status: 403,
      });
    }
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { tecnicoId, estado: "ASIGNADO", fechaAsignacion: new Date() },
    include: ticketInclude,
  });

  await prisma.historialTicket.create({
    data: {
      ticketId: id,
      estadoAnterior: ticket.estado,
      estadoNuevo: "ASIGNADO",
      usuarioId: user.id,
      comentario: `Asignado a ${tecnico.nombre} ${tecnico.apellidos}`,
    },
  });

  // Obtener datos del empleado para el mensaje WA al técnico
  const empleado = await prisma.empleado.findUnique({
    where: { rfc: ticket.empleadoRfc },
    select: { nombreCompleto: true },
  });

  await notif.emitirTicketAsignado({
    ticketId: id,
    folio: ticket.folio,
    asunto: ticket.asunto,
    prioridad: ticket.prioridad,
    tecnicoId,
    tecnicoNombre: `${tecnico.nombre} ${tecnico.apellidos}`,
    adminNombre: user.nombre,
    empleadoRfc: ticket.empleadoRfc,
    empleadoNombre: empleado?.nombreCompleto ?? ticket.empleadoRfc,
    areaLabel: updated.area?.label ?? "",
  });

  return updated;
};

export const cambiarEstado = async (
  id: number,
  body: { estado: string; comentario?: string },
  user: JwtPayload,
) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  const permitidos = TRANSICIONES[ticket.estado] ?? [];
  if (!permitidos.includes(body.estado)) {
    throw Object.assign(new Error(`Transición no permitida: ${ticket.estado} → ${body.estado}`), {
      status: 400,
    });
  }

  // Guard: si el usuario es RESPONSABLE_*, verificar que el ticket pertenece a su área
  if (ROLES_RESPONSABLE.includes(user.rol as any)) {
    const usuarioDb = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { areaSoporteId: true },
    });
    const areaSoporte = usuarioDb?.areaSoporteId
      ? await prisma.areaSoporte.findUnique({ where: { id: usuarioDb.areaSoporteId } })
      : null;
    const subcategorias = (areaSoporte?.subcategorias as string[]) ?? [];
    if (!subcategorias.includes(ticket.subcategoria)) {
      throw Object.assign(new Error("Solicitud fuera del área de soporte asignada"), {
        status: 403,
      });
    }
  }

  // Guard: no resolver ticket con pasos pendientes (D-10)
  if (body.estado === "RESUELTO") {
    const pasosPendientes = await prisma.pasoTicket.findMany({
      where: { ticketId: id, estado: { not: "COMPLETADO" } },
    });
    if (pasosPendientes.length > 0) {
      throw Object.assign(
        new Error("El ticket tiene pasos pendientes. Completa todos los pasos para resolver."),
        { status: 400 },
      );
    }
  }

  const fechas: Record<string, Date> = {};
  if (body.estado === "EN_PROGRESO") fechas.fechaInicio = new Date();
  if (body.estado === "RESUELTO") fechas.fechaResolucion = new Date();

  const updated = await prisma.ticket.update({
    where: { id },
    data: { estado: body.estado as never, ...fechas },
    include: ticketInclude,
  });

  await prisma.historialTicket.create({
    data: {
      ticketId: id,
      estadoAnterior: ticket.estado,
      estadoNuevo: body.estado as never,
      usuarioId: user.rol !== "EMPLEADO" ? user.id : undefined,
      empleadoRfc: user.rol === "EMPLEADO" ? user.rfc : undefined,
      comentario: body.comentario,
    },
  });

  await notif.emitirCambioEstado({
    ticketId: id,
    estadoAnterior: ticket.estado,
    estadoNuevo: body.estado,
    empleadoRfc: ticket.empleadoRfc,
    tecnicoId: ticket.tecnicoId ?? undefined,
  });

  return updated;
};

export const agregarComentario = async (
  ticketId: number,
  body: { texto: string; esInterno?: boolean },
  user: JwtPayload,
) => {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  return prisma.comentario.create({
    data: {
      ticketId,
      texto: body.texto,
      esInterno: body.esInterno ?? false,
      usuarioId: user.id,
    },
    include: { usuario: { select: { nombre: true, apellidos: true, rol: true } } },
  });
};

export const eliminarTicket = async (id: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  if (user.rol === "EMPLEADO" && ticket.empleadoRfc !== user.rfc) {
    throw Object.assign(new Error("Sin permisos"), { status: 403 });
  }

  await prisma.ticket.update({ where: { id }, data: { activo: false } });
  return { ok: true };
};

export const completarPaso = async (
  ticketId: number,
  pasoId: number,
  body: { notas?: string; cantidadUnidades?: number },
  user: JwtPayload,
) => {
  const paso = await prisma.pasoTicket.findFirst({
    where: { id: pasoId, ticketId },
  });
  if (!paso) throw Object.assign(new Error("Paso no encontrado"), { status: 404 });
  const ticketActual = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { estado: true },
  });
  if (ticketActual?.estado === "CANCELADO") {
    throw Object.assign(new Error("No se puede completar un paso de una solicitud cancelada"), {
      status: 400,
    });
  }
  if (paso.estado === "COMPLETADO") {
    throw Object.assign(new Error("El paso ya fue completado"), { status: 400 });
  }
  // Validar identidad del técnico, no solo el rol (D-09)
  if (paso.tecnicoId !== null && paso.tecnicoId !== user.id) {
    throw Object.assign(new Error("Solo el técnico asignado puede completar este paso"), {
      status: 403,
    });
  }
  if (paso.rolRequerido !== user.rol) {
    throw Object.assign(new Error("No tienes el rol requerido para completar este paso"), {
      status: 403,
    });
  }

  await prisma.pasoTicket.update({
    where: { id: pasoId },
    data: {
      estado: "COMPLETADO",
      completadoAt: new Date(),
      notas: body.notas ?? null,
      cantidadUnidades: body.cantidadUnidades ?? null,
    },
  });

  // Verificar si hay más pasos pendientes (D-08: buscar por orden > actual, no por orden exacto)
  const siguientePaso = await prisma.pasoTicket.findFirst({
    where: { ticketId, orden: { gt: paso.orden }, estado: { not: "COMPLETADO" } },
    orderBy: { orden: "asc" },
  });

  if (!siguientePaso) {
    // Todos los pasos completados → resolver ticket
    // Leer estado real antes de actualizar (D-13)
    const ticketPreResolve = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { estado: true },
    });
    const estadoAnteriorReal = ticketPreResolve?.estado ?? "EN_PROGRESO";

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: "RESUELTO", fechaResolucion: new Date() },
      include: ticketInclude,
    });
    await prisma.historialTicket.create({
      data: {
        ticketId,
        estadoAnterior: estadoAnteriorReal,
        estadoNuevo: "RESUELTO",
        usuarioId: user.id,
        comentario: "Todos los pasos completados",
      },
    });
    await notif.emitirCambioEstado({
      ticketId,
      estadoAnterior: estadoAnteriorReal,
      estadoNuevo: "RESUELTO",
      empleadoRfc: ticket.empleadoRfc,
      tecnicoId: ticket.tecnicoId ?? undefined,
    });
    return ticket;
  } else {
    // Hay siguiente paso → notificar a admins y mesa de ayuda para asignar
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: ticketInclude,
    });
    await notif.emitirPasoListo({
      ticketId,
      pasoOrden: siguientePaso.orden,
      pasoNombre: siguientePaso.nombre ?? `Paso ${siguientePaso.orden}`,
      rolRequerido: siguientePaso.rolRequerido,
      asunto: ticket!.asunto,
      empleadoRfc: ticket!.empleadoRfc,
    });
    return ticket;
  }
};

export const asignarPaso = async (
  ticketId: number,
  pasoId: number,
  tecnicoId: number,
  user: JwtPayload,
) => {
  const paso = await prisma.pasoTicket.findFirst({ where: { id: pasoId, ticketId } });
  if (!paso) throw Object.assign(new Error("Paso no encontrado"), { status: 404 });

  // Guard: el área receptora debe aceptar el ticket antes de asignar el primer paso
  const ticketPrevio = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { aceptadoEn: true },
  });
  if (!ticketPrevio?.aceptadoEn) {
    throw Object.assign(new Error("Debe aceptar el ticket antes de asignar técnico"), {
      status: 400,
    });
  }

  const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
  if (!tecnico) throw Object.assign(new Error("Técnico no encontrado"), { status: 404 });
  if (tecnico.rol !== paso.rolRequerido) {
    throw Object.assign(new Error(`Este paso requiere un ${paso.rolRequerido}`), { status: 400 });
  }

  const estadoAnteriorTicket =
    (await prisma.ticket.findUnique({ where: { id: ticketId }, select: { estado: true } }))
      ?.estado ?? "ASIGNADO";

  await prisma.pasoTicket.update({
    where: { id: pasoId },
    data: { tecnicoId, estado: "EN_PROGRESO" },
  });

  // Actualizar tecnicoId del ticket al técnico del paso activo
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      tecnicoId,
      estado: "EN_PROGRESO",
      fechaInicio: new Date(),
    },
    include: ticketInclude,
  });

  // Audit trail — NOT-02: registrar asignación de técnico a paso en historialTicket
  await prisma.historialTicket.create({
    data: {
      ticketId,
      estadoAnterior: estadoAnteriorTicket as never,
      estadoNuevo: "EN_PROGRESO",
      usuarioId: user.id,
      comentario: `Paso ${paso.orden} — ${paso.nombre ?? `Paso ${paso.orden}`}: asignado a ${tecnico.nombre} ${tecnico.apellidos}`,
    },
  });

  // Notificar al técnico que tiene un nuevo paso asignado
  await notif.emitirPasoAsignado({
    ticketId,
    pasoId,
    pasoOrden: paso.orden,
    pasoNombre: paso.nombre ?? `Paso ${paso.orden}`,
    tecnicoId,
    tecnicoNombre: `${tecnico.nombre} ${tecnico.apellidos}`,
    asunto: ticket.asunto,
    empleadoRfc: ticket.empleadoRfc,
  });

  // Si el ticket acaba de pasar a EN_PROGRESO, notificar al empleado
  if (estadoAnteriorTicket !== "EN_PROGRESO") {
    await notif.emitirCambioEstado({
      ticketId,
      estadoAnterior: estadoAnteriorTicket,
      estadoNuevo: "EN_PROGRESO",
      empleadoRfc: ticket.empleadoRfc,
      tecnicoId,
    });
  }

  return ticket;
};

export const obtenerMisPasos = async (user: JwtPayload) => {
  return prisma.pasoTicket.findMany({
    where: { tecnicoId: user.id, estado: "EN_PROGRESO" },
    include: {
      ticket: {
        include: {
          area: { select: { id: true, label: true, piso: true } },
          empleado: { select: { rfc: true, nombreCompleto: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};
