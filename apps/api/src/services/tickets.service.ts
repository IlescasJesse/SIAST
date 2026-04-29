import { prisma } from "../config/database.js";
import { SubcategoriaTicket, CategoriaTicket } from "@prisma/client";
import type { JwtPayload } from "../types/index.js";
import * as notif from "./notificaciones.service.js";
import { enviarNotifTicketCreado } from "./whatsapp.service.js";
import { FOLIO_PREFIX, getProcesoInfo } from "@stf/shared";

const SUBCATEGORIAS_VALIDAS = new Set(Object.values(SubcategoriaTicket));
const CATEGORIAS_VALIDAS    = new Set(Object.values(CategoriaTicket));

function computeAutoPriority(ticket: { createdAt: Date | string; estado: string }): string {
  if (["RESUELTO", "CANCELADO"].includes(ticket.estado)) return "BAJA";
  const hours = (Date.now() - new Date(ticket.createdAt).getTime()) / 3_600_000;
  if (hours > 24) return "URGENTE";
  if (hours > 6)  return "MEDIA";
  return "BAJA";
}

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
    user.rol === "TECNICO_SERVICIOS"
  ) {
    where.tecnicoId = user.id;
  } else if (user.rol === "GESTOR_RECURSOS_MATERIALES") {
    // El gestor ve todos los tickets de su categoría (RECURSOS_MATERIALES),
    // incluyendo los nuevos sin asignar
    where.categoria = "RECURSOS_MATERIALES";
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

  // Aplicar auto-prioridad a cada ticket
  const ticketsConPrioridad = tickets.map((t) => ({
    ...t,
    prioridad: computeAutoPriority(t) as typeof t.prioridad,
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
    recursosAdicionales?: string; // JSON string con equipamiento/materiales extra
    subTipo?: string; // subtipo dentro de EQUIPOS_DISPOSITIVOS
  },
) => {
  // EMPLEADO crea por sí mismo; todo el staff debe enviar rfcSolicitante
  const empleadoRfc = user.rol === "EMPLEADO" ? user.rfc! : body.rfcSolicitante;

  if (!empleadoRfc) {
    throw Object.assign(
      new Error("El RFC del solicitante es obligatorio"),
      { status: 400 },
    );
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
      throw Object.assign(
        new Error("Límite de solicitudes activas alcanzado (máximo 2)"),
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

  const categoriaVal    = (body.categoria    ?? "").toString().trim();
  const subcategoriaVal = (body.subcategoria ?? "").toString().trim();

  if (!categoriaVal || !subcategoriaVal) {
    throw Object.assign(
      new Error("Categoría y subcategoría son obligatorias"),
      { status: 400 },
    );
  }
  if (!CATEGORIAS_VALIDAS.has(categoriaVal as CategoriaTicket)) {
    throw Object.assign(
      new Error(`Categoría inválida: "${categoriaVal}"`),
      { status: 400 },
    );
  }
  if (!SUBCATEGORIAS_VALIDAS.has(subcategoriaVal as SubcategoriaTicket)) {
    throw Object.assign(
      new Error(`Subcategoría inválida: "${subcategoriaVal}". Valores aceptados: ${[...SUBCATEGORIAS_VALIDAS].join(", ")}`),
      { status: 400 },
    );
  }

  const folio = await generarFolio(categoriaVal, subcategoriaVal);

  // Verificar que el usuario staff existe en DB (JWT puede ser stale si se re-seeded)
  let creadoPorId: number | undefined;
  if (user.rol !== "EMPLEADO") {
    const existe = await prisma.usuario.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!existe) {
      throw Object.assign(
        new Error("Sesión expirada — por favor cierra sesión y vuelve a ingresar"),
        { status: 401 },
      );
    }
    creadoPorId = existe.id;
  }

  const ticket = await prisma.ticket.create({
    data: {
      folio,
      asunto: body.asunto,
      descripcion: body.descripcion,
      categoria: categoriaVal as never,
      subcategoria: subcategoriaVal as never,
      prioridad: "MEDIA" as never,
      empleadoRfc,
      areaId: areaIdResuelto,
      piso: pisoResuelto,
      creadoPorId,
      recursosAdicionales: body.recursosAdicionales ?? null,
      subTipo: body.subTipo ?? null,
    },
    include: ticketInclude,
  });

  // Generar pasos del flujo de trabajo para TECNOLOGIAS según el proceso definido
  if (categoriaVal === "TECNOLOGIAS") {
    const proceso = getProcesoInfo(subcategoriaVal, body.subTipo);
    if (proceso && proceso.tipoFlujo !== "PENDIENTE" && proceso.pasos.length > 0) {
      await prisma.pasoTicket.createMany({
        data: proceso.pasos.map((paso) => ({
          ticketId: ticket.id,
          orden: paso.orden,
          rolRequerido: paso.rolRequerido,
          nombre: paso.nombre,
          labelUnidades: paso.labelUnidades ?? null,
          estado: "PENDIENTE",
        })),
      });
    }
  }

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
        ticketId: ticket.id,
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
    prioridad: computeAutoPriority(ticket) as typeof ticket.prioridad,
  };
};

const CATEGORIA_ROL_MAP: Record<string, string[]> = {
  TECNOLOGIAS: ["TECNICO_TI", "TECNICO_REDES"],
  SERVICIOS: ["TECNICO_SERVICIOS"],
  RECURSOS_MATERIALES: ["GESTOR_RECURSOS_MATERIALES"],
};

export const asignarTicket = async (id: number, tecnicoId: number, user: JwtPayload) => {
  const ticket = await prisma.ticket.findFirst({ where: { id, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

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
  if (paso.estado === "COMPLETADO") {
    throw Object.assign(new Error("El paso ya fue completado"), { status: 400 });
  }
  if (paso.rolRequerido !== user.rol) {
    throw Object.assign(
      new Error("No tienes el rol requerido para completar este paso"),
      { status: 403 },
    );
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

  // Verificar si hay más pasos pendientes
  const siguientePaso = await prisma.pasoTicket.findFirst({
    where: { ticketId, orden: paso.orden + 1, estado: "PENDIENTE" },
  });

  if (!siguientePaso) {
    // Todos los pasos completados → resolver ticket
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: "RESUELTO", fechaResolucion: new Date() },
      include: ticketInclude,
    });
    await prisma.historialTicket.create({
      data: {
        ticketId,
        estadoAnterior: "EN_PROGRESO",
        estadoNuevo: "RESUELTO",
        usuarioId: user.id,
        comentario: "Todos los pasos completados",
      },
    });
    await notif.emitirCambioEstado({
      ticketId,
      estadoAnterior: "EN_PROGRESO",
      estadoNuevo: "RESUELTO",
      empleadoRfc: ticket.empleadoRfc,
      tecnicoId: ticket.tecnicoId ?? undefined,
    });
    return ticket;
  } else {
    // Hay siguiente paso → notificar a admins y mesa de ayuda para asignar
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketInclude });
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

  const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
  if (!tecnico) throw Object.assign(new Error("Técnico no encontrado"), { status: 404 });
  if (tecnico.rol !== paso.rolRequerido) {
    throw Object.assign(
      new Error(`Este paso requiere un ${paso.rolRequerido}`),
      { status: 400 },
    );
  }

  const estadoAnteriorTicket = (
    await prisma.ticket.findUnique({ where: { id: ticketId }, select: { estado: true } })
  )?.estado ?? "ASIGNADO";

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
