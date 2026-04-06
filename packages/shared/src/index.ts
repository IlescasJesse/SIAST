import { z } from "zod";

// ============================================================
// ENUMS
// ============================================================

export const RolSchema = z.enum([
  "ADMIN",
  "TECNICO_INFORMATICO",
  "TECNICO_SERVICIOS",
  "MESA_AYUDA",
  "EMPLEADO",
]);

export const CategoriaTicketSchema = z.enum(["TECNOLOGIAS", "SERVICIOS"]);

export const SubcategoriaTicketSchema = z.enum([
  "SISTEMAS",
  "SOPORTE_TECNICO",
  "REDES",
  "INTERNET",
  "IMPRESORAS_OTROS",
  "SANITARIOS",
  "ILUMINACION",
  "MOVILIDAD",
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
  TECNOLOGIAS: ["SISTEMAS", "SOPORTE_TECNICO", "REDES", "INTERNET", "IMPRESORAS_OTROS"],
  SERVICIOS: ["SANITARIOS", "ILUMINACION", "MOVILIDAD"],
};

export const LABEL_SUBCATEGORIA: Record<SubcategoriaTicket, string> = {
  SISTEMAS: "Sistemas",
  SOPORTE_TECNICO: "Soporte Técnico",
  REDES: "Redes",
  INTERNET: "Internet",
  IMPRESORAS_OTROS: "Impresoras u Otros",
  SANITARIOS: "Sanitarios",
  ILUMINACION: "Iluminación",
  MOVILIDAD: "Movilidad",
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
