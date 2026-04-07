import { prisma } from "../config/database.js";
import type { JwtPayload } from "../types/index.js";
import * as notif from "./notificaciones.service.js";

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
  historial: { orderBy: { createdAt: "asc" as const } },
  comentarios: {
    orderBy: { createdAt: "asc" as const },
    include: { usuario: { select: { nombre: true, apellidos: true, rol: true } } },
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
  } else if (user.rol === "TECNICO_INFORMATICO" || user.rol === "TECNICO_SERVICIOS") {
    where.tecnicoId = user.id;
  }

  if (query.estado) where.estado = query.estado;
  if (query.categoria) where.categoria = query.categoria;
  if (query.tecnicoId && user.rol === "ADMIN") where.tecnicoId = parseInt(query.tecnicoId, 10);
  if (query.rfc && user.rol !== "EMPLEADO") where.empleadoRfc = query.rfc;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, total, page, totalPages: Math.ceil(total / limit) };
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
  },
) => {
  const empleadoRfc = user.rol === "MESA_AYUDA" ? body.rfcSolicitante! : user.rfc!;

  if (user.rol === "EMPLEADO") {
    const activos = await prisma.ticket.count({
      where: {
        empleadoRfc,
        activo: true,
        estado: { notIn: ["RESUELTO", "CANCELADO"] },
      },
    });
    if (activos >= 2) {
      throw Object.assign(
        new Error("Límite de tickets activos alcanzado (máximo 2)"),
        { status: 403 },
      );
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

  const ticket = await prisma.ticket.create({
    data: {
      asunto: body.asunto,
      descripcion: body.descripcion,
      categoria: body.categoria as never,
      subcategoria: body.subcategoria as never,
      prioridad: (body.prioridad ?? "MEDIA") as never,
      empleadoRfc,
      areaId: areaIdResuelto,
      piso: pisoResuelto,
      creadoPorId: user.rol !== "EMPLEADO" ? user.id : undefined,
    },
    include: ticketInclude,
  });

  await prisma.historialTicket.create({
    data: {
      ticketId: ticket.id,
      estadoNuevo: "ABIERTO",
      usuarioId: user.rol !== "EMPLEADO" ? user.id : undefined,
      empleadoRfc: user.rol === "EMPLEADO" ? empleadoRfc : undefined,
      comentario: "Ticket creado",
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

  return ticket;
};

export const obtenerTicket = async (id: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id, activo: true },
    include: ticketInclude,
  });

  if (!ticket) throw Object.assign(new Error("Ticket no encontrado"), { status: 404 });

  if (user.rol === "EMPLEADO" && ticket.empleadoRfc !== user.rfc) {
    throw Object.assign(new Error("Sin acceso a este ticket"), { status: 403 });
  }

  return ticket;
};

export const asignarTicket = async (id: number, tecnicoId: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Ticket no encontrado"), { status: 404 });

  const tecnico = await prisma.usuario.findFirst({
    where: { id: tecnicoId, activo: true },
  });
  if (!tecnico) throw Object.assign(new Error("Técnico no encontrado"), { status: 404 });

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

  await notif.emitirTicketAsignado({
    ticketId: id,
    asunto: ticket.asunto,
    tecnicoId,
    tecnicoNombre: `${tecnico.nombre} ${tecnico.apellidos}`,
    adminNombre: user.nombre,
    empleadoRfc: ticket.empleadoRfc,
  });

  return updated;
};

export const cambiarEstado = async (
  id: number,
  body: { estado: string; comentario?: string },
  user: JwtPayload,
) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Ticket no encontrado"), { status: 404 });

  const permitidos = TRANSICIONES[ticket.estado] ?? [];
  if (!permitidos.includes(body.estado)) {
    throw Object.assign(
      new Error(`Transición no permitida: ${ticket.estado} → ${body.estado}`),
      { status: 400 },
    );
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
  if (!ticket) throw Object.assign(new Error("Ticket no encontrado"), { status: 404 });

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
  if (!ticket) throw Object.assign(new Error("Ticket no encontrado"), { status: 404 });

  if (user.rol === "EMPLEADO" && ticket.empleadoRfc !== user.rfc) {
    throw Object.assign(new Error("Sin permisos"), { status: 403 });
  }

  await prisma.ticket.update({ where: { id }, data: { activo: false } });
  return { ok: true };
};
