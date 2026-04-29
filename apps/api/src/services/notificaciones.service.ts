import type { Server } from "socket.io";
import { prisma } from "../config/database.js";
import type { TipoNotificacion } from "@stf/shared";
import { LABEL_ROL } from "@stf/shared";
import { enviarNotifTicketAsignado } from "./whatsapp.service.js";

let io: Server | null = null;

export const setIo = (socketServer: Server) => {
  io = socketServer;
};

export const getIo = () => io;

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
        titulo: `Nueva solicitud #${ticket.id}`,
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
  prioridad: string;
  tecnicoId: number;
  tecnicoNombre: string;
  adminNombre: string;
  empleadoRfc: string;
  empleadoNombre: string;
  areaLabel: string;
}) => {
  // Notificaciones en BD
  await Promise.all([
    crearNotificacion({
      tipo: "TICKET_ASIGNADO",
      titulo: `Solicitud #${params.ticketId} asignada a ti`,
      mensaje: `Se te asignó la solicitud: ${params.asunto}`,
      usuarioId: params.tecnicoId,
      ticketId: params.ticketId,
    }),
    crearNotificacion({
      tipo: "TICKET_ASIGNADO",
      titulo: `Tu solicitud #${params.ticketId} fue asignada`,
      mensaje: `Tu solicitud fue asignada a ${params.tecnicoNombre}`,
      empleadoRfc: params.empleadoRfc,
      ticketId: params.ticketId,
    }),
  ]);

  // Socket.IO
  io?.to(`user:${params.tecnicoId}`).emit("ticket:asignado", {
    ticketId: params.ticketId,
    asunto: params.asunto,
    asignadoPor: params.adminNombre,
  });
  io?.to(`emp:${params.empleadoRfc}`).emit("ticket:asignado_empleado", {
    ticketId: params.ticketId,
    asunto: params.asunto,
    tecnico: params.tecnicoNombre,
    mensaje: `Tu solicitud #${params.ticketId} ha sido asignada a ${params.tecnicoNombre}`,
  });

  // WA al técnico si tiene teléfono registrado
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  prisma.usuario
    .findUnique({ where: { id: params.tecnicoId }, select: { telefono: true } })
    .then((tec) => {
      if (!tec?.telefono) return;
      return enviarNotifTicketAsignado({
        telefono: tec.telefono,
        nombreTecnico: params.tecnicoNombre,
        ticketId: params.ticketId,
        asunto: params.asunto,
        prioridad: params.prioridad,
        empleadoNombre: params.empleadoNombre,
        areaLabel: params.areaLabel,
        url: `${frontendUrl}/solicitudes/${params.ticketId}`,
      });
    })
    .catch((err) => console.error("[WhatsApp] Error al notificar técnico:", err));
};

export const emitirPasoAsignado = async (params: {
  ticketId: number;
  pasoId: number;
  pasoOrden: number;
  pasoNombre: string;
  tecnicoId: number;
  tecnicoNombre: string;
  asunto: string;
  empleadoRfc: string;
}) => {
  await crearNotificacion({
    tipo: "TICKET_ASIGNADO",
    titulo: `Paso ${params.pasoOrden} asignado — Solicitud #${params.ticketId}`,
    mensaje: `Se te asignó: "${params.pasoNombre}" en la solicitud: ${params.asunto}`,
    usuarioId: params.tecnicoId,
    ticketId: params.ticketId,
  });

  io?.to(`user:${params.tecnicoId}`).emit("ticket:paso_asignado", {
    ticketId: params.ticketId,
    pasoId: params.pasoId,
    pasoOrden: params.pasoOrden,
    pasoNombre: params.pasoNombre,
    asunto: params.asunto,
  });
};

export const emitirPasoListo = async (params: {
  ticketId: number;
  pasoOrden: number;
  pasoNombre: string;
  rolRequerido: string;
  asunto: string;
  empleadoRfc: string;
}) => {
  const rolLabel = LABEL_ROL[params.rolRequerido] ?? params.rolRequerido;

  const destinatarios = await prisma.usuario.findMany({
    where: { rol: { in: ["ADMIN", "MESA_AYUDA"] }, activo: true },
    select: { id: true },
  });

  await Promise.all(
    destinatarios.map((u) =>
      crearNotificacion({
        tipo: "TICKET_ACTUALIZADO",
        titulo: `Solicitud #${params.ticketId} — Paso ${params.pasoOrden} listo para asignar`,
        mensaje: `"${params.pasoNombre}" requiere un ${rolLabel}. Solicitud: ${params.asunto}`,
        usuarioId: u.id,
        ticketId: params.ticketId,
      }),
    ),
  );

  io?.to("admins").emit("ticket:paso_listo", {
    ticketId: params.ticketId,
    pasoOrden: params.pasoOrden,
    pasoNombre: params.pasoNombre,
    rolRequerido: params.rolRequerido,
    rolLabel,
    asunto: params.asunto,
    timestamp: new Date(),
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

  const notifPromises: Promise<unknown>[] = [
    crearNotificacion({
      tipo,
      titulo: `Solicitud #${params.ticketId} — ${params.estadoNuevo}`,
      mensaje: `El estado cambió de ${params.estadoAnterior} a ${params.estadoNuevo}`,
      empleadoRfc: params.empleadoRfc,
      ticketId: params.ticketId,
    }),
  ];

  // Notificación en BD al técnico asignado
  if (params.tecnicoId) {
    notifPromises.push(
      crearNotificacion({
        tipo,
        titulo: `Solicitud #${params.ticketId} — ${params.estadoNuevo}`,
        mensaje: `El estado de la solicitud cambió de ${params.estadoAnterior} a ${params.estadoNuevo}`,
        usuarioId: params.tecnicoId,
        ticketId: params.ticketId,
      }),
    );
  }

  await Promise.all(notifPromises);

  const payload = {
    ticketId: params.ticketId,
    estadoAnterior: params.estadoAnterior,
    estadoNuevo: params.estadoNuevo,
    mensaje: `Solicitud #${params.ticketId} cambió a: ${params.estadoNuevo}`,
  };

  // Notificar al empleado dueño del ticket
  io?.to(`emp:${params.empleadoRfc}`).emit("ticket:estado_cambiado", {
    ...payload,
    mensaje: `Tu solicitud #${params.ticketId} cambió a estado: ${params.estadoNuevo}`,
  });

  // Notificar al técnico asignado
  if (params.tecnicoId) {
    io?.to(`user:${params.tecnicoId}`).emit("ticket:estado_cambiado", payload);
  }

  // Notificar a admins / mesa de ayuda
  io?.to("admins").emit("ticket:estado_cambiado", payload);
};
