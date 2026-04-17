import { z } from "zod";

// ============================================================
// ENUMS
// ============================================================

export const RolSchema = z.enum([
  "ADMIN",
  "TECNICO_INFORMATICO",
  "TECNICO_SERVICIOS",
  "MESA_AYUDA",
  "GESTOR_RECURSOS_MATERIALES",
  "EMPLEADO",
]);

export const CategoriaTicketSchema = z.enum(["TECNOLOGIAS", "SERVICIOS", "RECURSOS_MATERIALES"]);

export const SubcategoriaTicketSchema = z.enum([
  "SISTEMAS",
  "SOPORTE_TECNICO",
  "IMPRESORAS",
  "REDES_INTERNET",
  "CONFIGURACION_CORREO_OUTLOOK",
  "SANITARIOS",
  "ILUMINACION",
  "MOVILIDAD",
  "SALA_JUNTAS",
  "EQUIPO_AUDIOVISUAL",
  "PRESTAMO_EQUIPO",
  "MOBILIARIO",
  "PAPELERIA",
]);

export const EstadoTicketSchema = z.enum([
  "ABIERTO",
  "ASIGNADO",
  "EN_PROGRESO",
  "RESUELTO",
  "CANCELADO",
]);

export const PrioridadTicketSchema = z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]);

export const PisoEdificioSchema = z.enum(["PB", "NIVEL_1", "NIVEL_2", "NIVEL_3"]);

export const TipoNotificacionSchema = z.enum([
  "TICKET_CREADO",
  "TICKET_ASIGNADO",
  "TICKET_ACTUALIZADO",
  "TICKET_RESUELTO",
  "TICKET_CANCELADO",
  "TICKET_URGENTE",
]);

// ============================================================
// AUTENTICACIÓN
// ============================================================

// Login para staff (usuario + contraseña)
export const LoginSchema = z.object({
  usuario: z.string().min(3),
  password: z.string().min(4),
});

// Login para empleados (solo RFC)
export const LoginEmpleadoSchema = z.object({
  rfc: z.string().length(13),
});

// ============================================================
// ÁREAS DEL EDIFICIO
// ============================================================

export const AreaEdificioSchema = z.object({
  id: z.string(),
  label: z.string(),
  piso: PisoEdificioSchema,
  floor: z.number().int().min(0).max(3),
  gridX1: z.number().int().nullable().optional(),
  gridY1: z.number().int().nullable().optional(),
  gridX2: z.number().int().nullable().optional(),
  gridY2: z.number().int().nullable().optional(),
  activo: z.boolean(),
});

// ============================================================
// EMPLEADOS
// ============================================================

export const EmpleadoSchema = z.object({
  id: z.number().int(),
  rfc: z.string(),
  nombre: z.string(),
  apellidos: z.string(),
  nombreCompleto: z.string(),
  email: z.string().nullable().optional(),
  departamento: z.string().nullable().optional(),
  puesto: z.string().nullable().optional(),
  areaId: z.string(),
  piso: PisoEdificioSchema,
  activo: z.boolean(),
  sincronizadoSIRH: z.boolean(),
});

// ============================================================
// TICKETS
// ============================================================

export const ComentarioSchema = z.object({
  id: z.number().int(),
  ticketId: z.number().int(),
  texto: z.string(),
  esInterno: z.boolean(),
  usuarioId: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TicketSchema = z.object({
  id: z.number().int(),
  folio: z.string(),
  asunto: z.string(),
  descripcion: z.string(),
  categoria: CategoriaTicketSchema,
  subcategoria: SubcategoriaTicketSchema,
  estado: EstadoTicketSchema,
  prioridad: PrioridadTicketSchema,
  empleadoRfc: z.string(),
  areaId: z.string(),
  piso: PisoEdificioSchema,
  creadoPorId: z.number().int().nullable().optional(),
  tecnicoId: z.number().int().nullable().optional(),
  fechaAsignacion: z.string().nullable().optional(),
  fechaInicio: z.string().nullable().optional(),
  fechaResolucion: z.string().nullable().optional(),
  activo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TicketCreateSchema = z.object({
  asunto: z.string().min(5).max(100),
  descripcion: z.string().min(10),
  categoria: CategoriaTicketSchema,
  subcategoria: SubcategoriaTicketSchema,
  prioridad: PrioridadTicketSchema.optional().default("MEDIA"),
  empleadoRfc: z.string().length(13),
  areaId: z.string().min(1),
  piso: PisoEdificioSchema,
  creadoPorId: z.number().int().optional(),
});

export const TicketPatchSchema = z.object({
  estado: EstadoTicketSchema.optional(),
  prioridad: PrioridadTicketSchema.optional(),
  tecnicoId: z.number().int().nullable().optional(),
  fechaAsignacion: z.string().nullable().optional(),
  fechaInicio: z.string().nullable().optional(),
  fechaResolucion: z.string().nullable().optional(),
});

// ============================================================
// USUARIOS (staff)
// ============================================================

export const UsuarioPublicoSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  apellidos: z.string(),
  usuario: z.string(),
  email: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  rol: RolSchema,
  activo: z.boolean(),
});

// ============================================================
// NOTIFICACIONES
// ============================================================

export const NotificacionSchema = z.object({
  id: z.number().int(),
  tipo: TipoNotificacionSchema,
  titulo: z.string(),
  mensaje: z.string(),
  leida: z.boolean(),
  usuarioId: z.number().int().nullable().optional(),
  empleadoRfc: z.string().nullable().optional(),
  ticketId: z.number().int().nullable().optional(),
  createdAt: z.string(),
});

// ============================================================
// TIPOS INFERIDOS
// ============================================================

export type Rol = z.infer<typeof RolSchema>;
export type CategoriaTicket = z.infer<typeof CategoriaTicketSchema>;
export type SubcategoriaTicket = z.infer<typeof SubcategoriaTicketSchema>;
export type EstadoTicket = z.infer<typeof EstadoTicketSchema>;
export type PrioridadTicket = z.infer<typeof PrioridadTicketSchema>;
export type PisoEdificio = z.infer<typeof PisoEdificioSchema>;
export type TipoNotificacion = z.infer<typeof TipoNotificacionSchema>;

export type LoginInput = z.infer<typeof LoginSchema>;
export type LoginEmpleadoInput = z.infer<typeof LoginEmpleadoSchema>;
export type AreaEdificio = z.infer<typeof AreaEdificioSchema>;
export type Empleado = z.infer<typeof EmpleadoSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketCreateInput = z.infer<typeof TicketCreateSchema>;
export type TicketPatchInput = z.infer<typeof TicketPatchSchema>;
export type Comentario = z.infer<typeof ComentarioSchema>;
export type UsuarioPublico = z.infer<typeof UsuarioPublicoSchema>;
export type Notificacion = z.infer<typeof NotificacionSchema>;

// ============================================================
// CONSTANTES — CATÁLOGO DE SUBCATEGORÍAS POR CATEGORÍA
// ============================================================

export const SUBCATEGORIAS_POR_CATEGORIA: Record<CategoriaTicket, SubcategoriaTicket[]> = {
  TECNOLOGIAS: ["SISTEMAS", "SOPORTE_TECNICO", "IMPRESORAS", "REDES_INTERNET", "CONFIGURACION_CORREO_OUTLOOK"],
  SERVICIOS: ["SANITARIOS", "ILUMINACION", "MOVILIDAD"],
  RECURSOS_MATERIALES: ["SALA_JUNTAS", "EQUIPO_AUDIOVISUAL", "PRESTAMO_EQUIPO", "MOBILIARIO", "PAPELERIA"],
};

export const LABEL_SUBCATEGORIA: Record<SubcategoriaTicket, string> = {
  SISTEMAS: "Sistemas",
  SOPORTE_TECNICO: "Soporte Técnico",
  IMPRESORAS: "Impresoras",
  REDES_INTERNET: "Redes / Internet",
  CONFIGURACION_CORREO_OUTLOOK: "Configuración Correo Outlook",
  SANITARIOS: "Sanitarios",
  ILUMINACION: "Iluminación",
  MOVILIDAD: "Movilidad",
  SALA_JUNTAS: "Sala de Juntas",
  EQUIPO_AUDIOVISUAL: "Equipo Audiovisual",
  PRESTAMO_EQUIPO: "Préstamo de Equipo",
  MOBILIARIO: "Mobiliario",
  PAPELERIA: "Papelería y Suministros",
};

export const LABEL_ESTADO: Record<EstadoTicket, string> = {
  ABIERTO: "Abierto",
  ASIGNADO: "Asignado",
  EN_PROGRESO: "En Progreso",
  RESUELTO: "Resuelto",
  CANCELADO: "Cancelado",
};

export const LABEL_PRIORIDAD: Record<PrioridadTicket, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const LABEL_PISO: Record<PisoEdificio, string> = {
  PB: "Planta Baja",
  NIVEL_1: "Nivel 1",
  NIVEL_2: "Nivel 2",
  NIVEL_3: "Nivel 3",
};

// ============================================================
// RECURSOS MATERIALES
// ============================================================

export const TipoRecursoSchema = z.enum(["TECNOLOGICO", "INMOBILIARIO"]);
export const EstadoAsignacionSchema = z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "DEVUELTA"]);

export const RecursoSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  descripcion: z.string().nullable().optional(),
  tipo: TipoRecursoSchema,
  numSerie: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  capacidad: z.number().int().nullable().optional(),
  piso: PisoEdificioSchema.nullable().optional(),
  areaId: z.string().nullable().optional(),
  disponible: z.boolean(),
  activo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RecursoCreateSchema = z.object({
  nombre: z.string().min(2).max(150),
  descripcion: z.string().optional(),
  tipo: TipoRecursoSchema,
  numSerie: z.string().optional(),
  marca: z.string().optional(),
  capacidad: z.number().int().positive().optional(),
  piso: PisoEdificioSchema.optional(),
  areaId: z.string().optional(),
  disponible: z.boolean().optional().default(true),
});

export const AsignacionRecursoCreateSchema = z.object({
  recursoId: z.number().int(),
  ticketId: z.number().int().optional(),
  empleadoRfc: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  saleDEdificio: z.boolean().optional().default(false),
  propositoSalida: z.string().optional(),
  comentario: z.string().optional(),
});

export type TipoRecurso = z.infer<typeof TipoRecursoSchema>;
export type EstadoAsignacion = z.infer<typeof EstadoAsignacionSchema>;
export type Recurso = z.infer<typeof RecursoSchema>;
export type RecursoCreateInput = z.infer<typeof RecursoCreateSchema>;

export const LABEL_TIPO_RECURSO: Record<TipoRecurso, string> = {
  TECNOLOGICO: "Tecnológico",
  INMOBILIARIO: "Inmobiliario",
};

export const LABEL_ESTADO_ASIGNACION: Record<EstadoAsignacion, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  DEVUELTA: "Devuelta",
};

// ============================================================
// CONSTANTES — FOLIO DE TICKETS
// ============================================================

export const FOLIO_PREFIX: Record<string, string> = {
  "TECNOLOGIAS-SISTEMAS": "TEC-SIS",
  "TECNOLOGIAS-SOPORTE_TECNICO": "TEC-SOP",
  "TECNOLOGIAS-IMPRESORAS": "TEC-IMP",
  "TECNOLOGIAS-REDES_INTERNET": "TEC-RED",
  "TECNOLOGIAS-CONFIGURACION_CORREO_OUTLOOK": "TEC-COR",
  "SERVICIOS-SANITARIOS": "SER-SAN",
  "SERVICIOS-ILUMINACION": "SER-ILU",
  "SERVICIOS-MOVILIDAD": "SER-MOV",
  "RECURSOS_MATERIALES-SALA_JUNTAS": "REC-SAL",
  "RECURSOS_MATERIALES-EQUIPO_AUDIOVISUAL": "REC-AUD",
  "RECURSOS_MATERIALES-PRESTAMO_EQUIPO": "REC-PRE",
  "RECURSOS_MATERIALES-MOBILIARIO": "REC-MOB",
  "RECURSOS_MATERIALES-PAPELERIA": "REC-PAP",
};
