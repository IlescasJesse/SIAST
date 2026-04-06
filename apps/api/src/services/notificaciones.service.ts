import type { Server } from "socket.io";
import { prisma } from "../config/database.js";
import type { TipoNotificacion } from "@stf/shared";

let io: Server | null = null;

export const setIo = (socketServer: Server) => {
  io = socketServer;
};

export const crearNotificacion = async (params: {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  usuarioId?: number;
  empleadoRfc?: string;
  ticketId?: number;
}) => {
  return prisma.notificacion.create({ data: params });
};

export const emitirTicketNuevo = async (ticket: {
  id: number;
  asunto: string;
  categoria: string;
  prioridad: string;
  empleadoRfc: string;
  areaLabel: string;
}) => {
  // Crear notificaciones en BD para todos los admins
  const admins = await prisma.usuario.findMany({
    where: { rol: "ADMIN", activo: true },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      crearNotificacion({
        tipo: "TICKET_CREADO",
        titulo: `Nuevo ticket #${ticket.id}`,
        mensaje: `${ticket.asunto} — ${ticket.areaLabel} (${ticket.prioridad})`,
        usuarioId: admin.id,
        ticketId: ticket.id,
      }),
    ),
  );

  // Emitir socket a sala admins
  io?.to("admins").emit("ticket:nuevo", {
    id: ticket.id,
    asunto: ticket.asunto,
    categoria: ticket.categoria,
    prioridad: ticket.prioridad,
    area: ticket.areaLabel,
    timestamp: new Date(),
  });
};

export const emitirTicketAsignado = async (params: {
  ticketId: number;
  asunto: string;
  tecnicoId: number;
  tecnicoNombre: string;
  adminNombre: string;
  empleadoRfc: string;
}) => {
  // Notificación al técnico
  await crearNotificacion({
    tipo: "TICKET_ASIGNADO",
    titulo: `Ticket #${params.ticketId} asignado a ti`,
    mensaje: `Se te asignó el ticket: ${params.asunto}`,
    usuarioId: params.tecnicoId,
    ticketId: params.ticketId,
  });

  // Notificación al empleado
  await crearNotificacion({
    tipo: "TICKET_ASIGNADO",
    titulo: `Tu ticket #${params.ticketId} fue asignado`,
    mensaje: `Tu ticket fue asignado a ${params.tecnicoNombre}`,
    empleadoRfc: params.empleadoRfc,
    ticketId: params.ticketId,
  });

  io?.to(`user:${params.tecnicoId}`).emit("ticket:asignado", {
    ticketId: params.ticketId,
    asunto: params.asunto,
    asignadoPor: params.adminNombre,
  });

  io?.to(`emp:${params.empleadoRfc}`).emit("ticket:asignado_empleado", {
    ticketId: params.ticketId,
    asunto: params.asunto,
    tecnico: params.tecnicoNombre,
    mensaje: `Tu ticket #${params.ticketId} ha sido asignado a ${params.tecnicoNombre}`,
  });
};

export const emitirCambioEstado = async (params: {
  ticketId: number;
  estadoAnterior: string;
  estadoNuevo: string;
  empleadoRfc: string;
  tecnicoId?: number;
}) => {
  const tipo =
    params.estadoNuevo === "RESUELTO"
      ? ("TICKET_RESUELTO" as TipoNotificacion)
      : ("TICKET_ACTUALIZADO" as TipoNotificacion);

  await crearNotificacion({
    tipo,
    titulo: `Ticket #${params.ticketId} — ${params.estadoNuevo}`,
    mensaje: `El estado cambió de ${params.estadoAnterior} a ${params.estadoNuevo}`,
    empleadoRfc: params.empleadoRfc,
    ticketId: params.ticketId,
  });

  io?.to(`emp:${params.empleadoRfc}`).emit("ticket:estado_cambiado", {
    ticketId: params.ticketId,
    estadoAnterior: params.estadoAnterior,
    estadoNuevo: params.estadoNuevo,
    mensaje: `Tu ticket #${params.ticketId} cambió a estado: ${params.estadoNuevo}`,
  });
};
