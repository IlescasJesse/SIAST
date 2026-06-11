import { z } from "zod";

// ============================================================
// ENUMS
// ============================================================

export const RolSchema = z.enum([
  "ADMIN",
  "MESA_AYUDA",
  "EMPLEADO",
  // Área TI
  "RESPONSABLE_TI",
  "TECNICO_TI",
  // Área Redes
  "RESPONSABLE_REDES",
  "TECNICO_REDES",
  // Área Mantenimiento
  "RESPONSABLE_MANTENIMIENTO",
  "TECNICO_ELECTRICISTA",
  "TECNICO_PLOMERO",
  "TECNICO_MOVILIDAD",
  // Área Recursos Materiales
  "RESPONSABLE_RECURSOS_MATERIALES",
  "GESTOR_RECURSOS_MATERIALES",
  "GESTOR_SALAS_JUNTA",
  "GESTOR_RECURSOS",
  "GESTOR_INVENTARIO",
]);

export const CategoriaTicketSchema = z.enum(["TECNOLOGIAS", "SERVICIOS", "RECURSOS_MATERIALES"]);

export const SubcategoriaTicketSchema = z.enum([
  // Tecnologías
  "SISTEMAS_INSTITUCIONALES",
  "EQUIPOS_DISPOSITIVOS",
  "RED_INTERNET",
  "CUENTAS_DOMINIO",
  "CORREO_OUTLOOK",
  // Servicios Generales
  "SANITARIOS",
  "ILUMINACION",
  "MOVILIDAD",
  // Recursos Materiales
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

export const TipoAreaComunSchema = z.enum([
  "SALA_JUNTAS",
  "SALA_CONFERENCIAS",
  "BANO",
  "LACTANCIA",
  "COPIADO",
  "COMEDOR",
  "RECEPCION",
  "ARCHIVO",
  "BODEGA",
  "OTRO",
]);

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
  // @deprecated — usar esComun + tipoComun = "SALA_JUNTAS"
  esSalaJuntas: z.boolean().optional(),
  esComun: z.boolean().optional(),
  tipoComun: TipoAreaComunSchema.nullable().optional(),
  nombrePropio: z.string().nullable().optional(),
  activo: z.boolean(),
});

// ============================================================
// MUEBLES (cubículos, escritorios, salas dentro de un área)
// ============================================================

export const MuebleSchema = z.object({
  id: z.number().int(),
  areaId: z.string(),
  label: z.string(),
  tipo: z.string(),
  gridX: z.number(),
  gridY: z.number(),
  ancho: z.number(),
  alto: z.number(),
  activo: z.boolean(),
  createdAt: z.string(),
});

export const MuebleCreateSchema = z.object({
  areaId: z.string().min(1),
  label: z.string().min(1).max(100),
  tipo: z.string().min(1).max(50),
  gridX: z.number(),
  gridY: z.number(),
  ancho: z.number().positive().optional().default(1.0),
  alto: z.number().positive().optional().default(1.0),
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
  muebleId: z.number().int().nullable().optional(),
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
  muebleId: z.number().int().optional(),
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
export type TipoAreaComun = z.infer<typeof TipoAreaComunSchema>;
export type TipoNotificacion = z.infer<typeof TipoNotificacionSchema>;

export type LoginInput = z.infer<typeof LoginSchema>;
export type LoginEmpleadoInput = z.infer<typeof LoginEmpleadoSchema>;
export type AreaEdificio = z.infer<typeof AreaEdificioSchema>;
export type Mueble = z.infer<typeof MuebleSchema>;
export type MuebleCreateInput = z.infer<typeof MuebleCreateSchema>;
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
  TECNOLOGIAS: [
    "SISTEMAS_INSTITUCIONALES",
    "EQUIPOS_DISPOSITIVOS",
    "RED_INTERNET",
    "CUENTAS_DOMINIO",
    "CORREO_OUTLOOK",
  ],
  SERVICIOS: ["SANITARIOS", "ILUMINACION", "MOVILIDAD"],
  RECURSOS_MATERIALES: [
    "SALA_JUNTAS",
    "EQUIPO_AUDIOVISUAL",
    "PRESTAMO_EQUIPO",
    "MOBILIARIO",
    "PAPELERIA",
  ],
};

export const LABEL_CATEGORIA: Record<CategoriaTicket, string> = {
  TECNOLOGIAS: "Tecnologías de la Información",
  SERVICIOS: "Servicios Generales",
  RECURSOS_MATERIALES: "Recursos Materiales",
};

export const LABEL_SUBCATEGORIA: Record<SubcategoriaTicket, string> = {
  // Tecnologías
  SISTEMAS_INSTITUCIONALES: "Sistemas Institucionales",
  EQUIPOS_DISPOSITIVOS: "Equipos y Dispositivos",
  RED_INTERNET: "Red e Internet",
  CUENTAS_DOMINIO: "Cuentas y Dominio Institucional",
  CORREO_OUTLOOK: "Correo Institucional (Outlook)",
  // Servicios Generales
  SANITARIOS: "Sanitarios",
  ILUMINACION: "Iluminación",
  MOVILIDAD: "Movilidad",
  // Recursos Materiales
  SALA_JUNTAS: "Sala de Juntas",
  EQUIPO_AUDIOVISUAL: "Equipo Audiovisual",
  PRESTAMO_EQUIPO: "Préstamo de Equipo",
  MOBILIARIO: "Mobiliario",
  PAPELERIA: "Papelería y Suministros",
};

export const DESCRIPCION_SUBCATEGORIA: Record<SubcategoriaTicket, string> = {
  // Tecnologías
  SISTEMAS_INSTITUCIONALES:
    "Problemas o dudas con los sistemas internos de la Secretaría de Finanzas (SIRH, SIAST u otros).",
  EQUIPOS_DISPOSITIVOS:
    "Solicitudes relacionadas con el equipo de cómputo, impresoras y dispositivos asignados: configuración, mantenimiento preventivo/correctivo, reinstalación y formateo.",
  RED_INTERNET:
    "Sin acceso a Internet, conexión lenta o solicitud para habilitar acceso en tu equipo o área de trabajo.",
  CUENTAS_DOMINIO:
    "Problemas con tu cuenta institucional: contraseña bloqueada, no puedes iniciar sesión, permisos incorrectos o creación de usuario de dominio.",
  CORREO_OUTLOOK:
    "Configuración del correo oficial de la Secretaría de Finanzas en la aplicación Outlook.",
  // Servicios Generales
  SANITARIOS:
    "Reporte de fallas en sanitarios, lavabos, cisternas u otras instalaciones hidráulicas del edificio.",
  ILUMINACION:
    "Reporte de luminarias fundidas, parpadeos, falta de iluminación o fallas eléctricas en áreas comunes.",
  MOVILIDAD:
    "Solicitudes relacionadas con elevadores, escaleras, rampas u obstáculos que afecten el desplazamiento dentro del edificio.",
  // Recursos Materiales
  SALA_JUNTAS:
    "Reservación de sala de juntas para reuniones de trabajo, capacitaciones o eventos institucionales.",
  EQUIPO_AUDIOVISUAL:
    "Préstamo o reservación de proyectores, pantallas, bocinas o cables HDMI para presentaciones.",
  PRESTAMO_EQUIPO:
    "Solicitud de préstamo temporal de equipos de cómputo, tablets u otros dispositivos tecnológicos.",
  MOBILIARIO:
    "Solicitud de préstamo, reubicación o reparación de sillas, escritorios, archiveros u otros muebles de oficina.",
  PAPELERIA:
    "Solicitud de papelería y suministros de oficina: hojas, folders, tóner, plumas u otros materiales.",
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
  PB: "PLANTA BAJA",
  NIVEL_1: "NIVEL 2",
  NIVEL_2: "NIVEL 3",
  NIVEL_3: "NIVEL 4",
};

export const LABEL_ROL: Record<string, string> = {
  ADMIN: "Administrador",
  MESA_AYUDA: "Mesa de Ayuda",
  EMPLEADO: "Empleado",
  RESPONSABLE_TI: "Responsable de TI",
  TECNICO_TI: "Técnico TI",
  RESPONSABLE_REDES: "Responsable de Redes",
  TECNICO_REDES: "Técnico de Redes",
  RESPONSABLE_MANTENIMIENTO: "Responsable de Mantenimiento",
  TECNICO_ELECTRICISTA: "Técnico Electricista",
  TECNICO_PLOMERO: "Técnico Plomero",
  TECNICO_MOVILIDAD: "Técnico de Movilidad",
  RESPONSABLE_RECURSOS_MATERIALES: "Responsable de Recursos Materiales",
  GESTOR_RECURSOS_MATERIALES: "Gestor de Recursos Materiales",
  GESTOR_SALAS_JUNTA: "Gestor de Salas de Junta",
  GESTOR_RECURSOS: "Gestor de Recursos",
  GESTOR_INVENTARIO: "Gestor de Inventario",
};

// Subtipos para EQUIPOS_DISPOSITIVOS — usados en el formulario de nueva solicitud
export const SUB_TIPO_EQUIPOS = [
  { value: "EQUIPO_NUEVO_CON_RED", label: "Equipo nuevo / Configuración inicial (con red)" },
  { value: "EQUIPO_NUEVO_SIN_RED", label: "Equipo nuevo / Configuración inicial (sin internet)" },
  { value: "REINSTALACION_FORMATEO", label: "Reinstalación y formateo" },
  { value: "FALLA_IMPRESORA", label: "Falla de impresora o periférico" },
  { value: "INSTALAR_SOFTWARE", label: "Instalar software" },
  { value: "IMPRESORA_NUEVA_EN_RED", label: "Impresora nueva (configurar en red)" },
  {
    value: "MANTENIMIENTO_PREVENTIVO",
    label: "Mantenimiento preventivo (Antivirus, revisión periódica)",
  },
  { value: "MANTENIMIENTO_CORRECTIVO", label: "Mantenimiento correctivo (Reparación de fallas)" },
];

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
  requiereHorario: z.boolean().optional().default(false),
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
  requiereHorario: z.boolean().optional().default(false),
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
  // Tecnologías — keys corregidos para SubcategoriaTicket actual
  "TECNOLOGIAS-SISTEMAS_INSTITUCIONALES": "TEC-SIS",
  "TECNOLOGIAS-EQUIPOS_DISPOSITIVOS": "TEC-EQP",
  "TECNOLOGIAS-RED_INTERNET": "TEC-RED",
  "TECNOLOGIAS-CUENTAS_DOMINIO": "TEC-DOM",
  "TECNOLOGIAS-CORREO_OUTLOOK": "TEC-COR",
  // Servicios Generales
  "SERVICIOS-SANITARIOS": "SER-SAN",
  "SERVICIOS-ILUMINACION": "SER-ILU",
  "SERVICIOS-MOVILIDAD": "SER-MOV",
  // Recursos Materiales
  "RECURSOS_MATERIALES-SALA_JUNTAS": "REC-SAL",
  "RECURSOS_MATERIALES-EQUIPO_AUDIOVISUAL": "REC-AUD",
  "RECURSOS_MATERIALES-PRESTAMO_EQUIPO": "REC-PRE",
  "RECURSOS_MATERIALES-MOBILIARIO": "REC-MOB",
  "RECURSOS_MATERIALES-PAPELERIA": "REC-PAP",
};

// ============================================================
// PROCESOS DE FLUJO MULTI-PASO
// ============================================================

// Sub-tipos para EQUIPOS_DISPOSITIVOS
export const SUBTIPO_EQUIPOS = {
  EQUIPO_NUEVO_CON_RED: "EQUIPO_NUEVO_CON_RED",
  EQUIPO_NUEVO_SIN_RED: "EQUIPO_NUEVO_SIN_RED",
  REINSTALACION_FORMATEO: "REINSTALACION_FORMATEO",
  FALLA_IMPRESORA: "FALLA_IMPRESORA",
  INSTALAR_SOFTWARE: "INSTALAR_SOFTWARE",
  IMPRESORA_NUEVA_EN_RED: "IMPRESORA_NUEVA_EN_RED",
  MANTENIMIENTO_PREVENTIVO: "MANTENIMIENTO_PREVENTIVO",
  MANTENIMIENTO_CORRECTIVO: "MANTENIMIENTO_CORRECTIVO",
} as const;

// Sub-tipos para RED_INTERNET
export const SUBTIPO_RED = {
  SIN_ACCESO_INTERNET: "SIN_ACCESO_INTERNET",
  SOLICITUD_ACCESO_INTERNET: "SOLICITUD_ACCESO_INTERNET",
} as const;

// Sub-tipos para CUENTAS_DOMINIO
export const SUBTIPO_CUENTAS = {
  CREACION_USUARIO: "CREACION_USUARIO",
  SOPORTE_DOMINIO: "SOPORTE_DOMINIO",
} as const;

// Sub-tipos para SISTEMAS_INSTITUCIONALES
export const SUBTIPO_SISTEMAS = {
  SIRH: "SIRH",
  SIAST: "SIAST",
} as const;

// Arrays con labels para el formulario de nueva solicitud
export const SUB_TIPO_SISTEMAS = [
  { value: "SIRH", label: "SIRH — Sistema Integral de Recursos Humanos" },
  { value: "SIAST", label: "SIAST — Sistema de Atención y Seguimiento de Tickets" },
];

export const SUB_TIPO_RED = [
  { value: "SIN_ACCESO_INTERNET", label: "Sin acceso a internet" },
  { value: "SOLICITUD_ACCESO_INTERNET", label: "Solicitud de acceso a internet" },
];

export const SUB_TIPO_CUENTAS = [
  { value: "CREACION_USUARIO", label: "Creación de usuario" },
  { value: "SOPORTE_DOMINIO", label: "Soporte de dominio" },
];

// ============================================================
// TIPOS DE RESPUESTA — MÉTRICAS
// ============================================================

export interface MetricasSolicitudesResponse {
  totalSolicitudes: number;
  porCategoria: { categoria: string; total: number }[];
  porSubcategoria: { subcategoria: string; subTipo: string | null; total: number }[];
  porEstado: { estado: string; total: number }[];
  porPiso: { piso: string; total: number }[];
}

export interface MetricaTecnico {
  tecnico: { id: number; nombre: string; apellidos: string; rol: string };
  totalPasosAsignados: number;
  totalPasosCompletados: number;
  unidadesAtendidas: number;
  tiempoPromedioCompletadoHoras: number | null;
}

export interface MetricaProceso {
  proceso: string;
  nombre: string;
  totalSolicitudes: number;
  resueltasATiempo: number;
  tiempoPromedioHoras: number | null;
  unidadesAtendidas: number;
}

// ============================================================
// PERMISOS GRANULARES
// ============================================================

export const PERMISOS_LIST = [
  "solicitudes.ver_todas",
  "solicitudes.crear_empleado",
  "solicitudes.asignar",
  "solicitudes.cancelar",
  "pasos.asignar",
  "pasos.completar_cualquiera",
  "recursos.gestionar",
  "procesos.configurar",
  "usuarios.gestionar",
  "metricas.ver",
  "admin.acceso",
  "reportes.generar",
] as const;

export type Permiso = (typeof PERMISOS_LIST)[number];

export const LABEL_PERMISO: Record<Permiso, string> = {
  "solicitudes.ver_todas": "Ver todas las solicitudes",
  "solicitudes.crear_empleado": "Crear solicitud por empleado",
  "solicitudes.asignar": "Asignar técnico a solicitud",
  "solicitudes.cancelar": "Cancelar cualquier solicitud",
  "pasos.asignar": "Asignar técnico a paso",
  "pasos.completar_cualquiera": "Completar pasos de otros técnicos",
  "recursos.gestionar": "Gestionar recursos materiales",
  "procesos.configurar": "Crear y editar procesos",
  "usuarios.gestionar": "Crear y editar usuarios",
  "metricas.ver": "Ver métricas y estadísticas",
  "admin.acceso": "Acceso al módulo de Administración",
  "reportes.generar": "Generar reportes y documentos",
};

export const PERMISOS_DEFAULT: Record<Rol, Permiso[]> = {
  ADMIN: [...PERMISOS_LIST],
  MESA_AYUDA: [
    "solicitudes.ver_todas",
    "solicitudes.crear_empleado",
    "solicitudes.asignar",
    "pasos.asignar",
    "metricas.ver",
  ],
  EMPLEADO: [],
  RESPONSABLE_TI: ["solicitudes.ver_todas", "solicitudes.asignar", "pasos.asignar", "metricas.ver"],
  TECNICO_TI: ["solicitudes.ver_todas", "metricas.ver"],
  RESPONSABLE_REDES: [
    "solicitudes.ver_todas",
    "solicitudes.asignar",
    "pasos.asignar",
    "metricas.ver",
  ],
  TECNICO_REDES: ["solicitudes.ver_todas"],
  RESPONSABLE_MANTENIMIENTO: [
    "solicitudes.ver_todas",
    "solicitudes.asignar",
    "pasos.asignar",
    "metricas.ver",
  ],
  TECNICO_ELECTRICISTA: ["solicitudes.ver_todas"],
  TECNICO_PLOMERO: ["solicitudes.ver_todas"],
  TECNICO_MOVILIDAD: ["solicitudes.ver_todas"],
  RESPONSABLE_RECURSOS_MATERIALES: [
    "solicitudes.ver_todas",
    "solicitudes.asignar",
    "pasos.asignar",
    "metricas.ver",
  ],
  GESTOR_RECURSOS_MATERIALES: ["solicitudes.ver_todas", "recursos.gestionar", "metricas.ver"],
  GESTOR_SALAS_JUNTA: ["solicitudes.ver_todas", "recursos.gestionar"],
  GESTOR_RECURSOS: ["solicitudes.ver_todas", "recursos.gestionar"],
  GESTOR_INVENTARIO: ["solicitudes.ver_todas", "recursos.gestionar", "metricas.ver"],
};

export function tienePermiso(
  rol: Rol,
  permisosExtra: Permiso[] | null | undefined,
  perm: Permiso,
): boolean {
  if (PERMISOS_DEFAULT[rol]?.includes(perm)) return true;
  if (permisosExtra?.includes(perm)) return true;
  return false;
}

// ============================================================
// MÉTRICAS OPERACIONALES — Phase 4 (endpoint unificado)
// ============================================================

/** Rango de fechas para filtrado */
export interface MetricasDateRange {
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
}

/** Parámetros de consulta del endpoint unificado */
export interface MetricasQueryParams extends MetricasDateRange {
  tipo: "area" | "tecnico" | "proceso";
  areaId?: string;
  tecnicoId?: string;
}

/** Un punto de la tendencia diaria (para gráficas de línea) */
export interface TendenciaDia {
  dia: string; // "YYYY-MM-DD"
  creados: number;
  resueltos: number;
}

/** Resumen de eficiencia de un responsable (para tabla Tab Global) */
export interface EficienciaResponsable {
  id: number;
  nombre: string;
  apellidos: string;
  areaNombre: string;
  areaSoporteId: number;
  ticketsResueltos: number;
  tiempoPromedioHoras: number | null;
  slaGlobal: number | null; // porcentaje 0-100, null = sin datos en el período
}

/** Rendimiento de un técnico (para tabla Tab Por Responsable) */
export interface RendimientoTecnico {
  id: number;
  nombre: string;
  apellidos: string;
  rol: string;
  ticketsActivos: number;
  ticketsCompletados: number;
  tiempoPromedioHoras: number | null;
  tiemprimeraRespuestaHoras: number | null;
  ratioResueltosCancelados: number | null; // resueltos / (resueltos + cancelados)
}

/** Distribución de tickets por categoría (para gráfica de pastel) */
export interface DistribucionCategoria {
  categoria: string;
  total: number;
  color?: string;
}

/** Respuesta del endpoint unificado cuando tipo=area (Tab Global) */
export interface MetricasGlobalResponse {
  tipo: "area";
  // KPIs tarjetas
  totalTickets: number;
  ticketsActivos: number;
  ticketsResueltos: number;
  ticketsSinAsignar: number;
  slaGlobal: number | null; // %, null = sin datos en el período
  tiempoPromedioHoras: number | null;
  // Charts
  tendenciaDiaria: TendenciaDia[];
  distribucionCategoria: DistribucionCategoria[];
  distribucionEstado: DistribucionCategoria[];
  comparativoPorArea: Array<{
    areaNombre: string;
    areaSoporteId: number;
    total: number;
    resueltos: number;
    sinAsignar: number;
  }>;
  // Tabla
  eficienciaResponsables: EficienciaResponsable[];
}

/** Respuesta cuando tipo=tecnico (Tab Por Responsable) */
export interface MetricasPorAreaResponse {
  tipo: "tecnico";
  areaId: number;
  areaNombre: string;
  // KPIs tarjetas
  ticketsActivos: number;
  ticketsSinAsignar: number;
  tiempoPromedioHoras: number | null;
  slaGlobal: number | null; // null = sin datos en el período
  ticketsReabiertos: number;
  // Charts
  tendenciaDiaria: TendenciaDia[];
  distribucionSubcategoria: DistribucionCategoria[];
  distribucionEstado: DistribucionCategoria[];
  cargaTecnicos: Array<{
    tecnicoNombre: string;
    tecnicoId: number;
    activos: number;
    completados: number;
  }>;
  // Tabla
  rendimientoTecnicos: RendimientoTecnico[];
}

/** Respuesta cuando tipo=proceso (Tab Por Técnico) */
export interface MetricasPorTecnicoResponse {
  tipo: "proceso";
  tecnicoId: number;
  tecnicoNombre: string;
  // KPIs tarjetas
  ticketsCompletados: number;
  tiempoPromedioHoras: number | null;
  tiemprimeraRespuestaHoras: number | null;
  ratioResueltosCancelados: number | null;
  // Charts
  tendenciaProductividad: TendenciaDia[];
  comparativaVsArea: Array<{ label: string; tecnico: number; promedioArea: number }>;
  distribucionResultado: Array<{ name: string; value: number; color: string }>;
  distribucionEstado: DistribucionCategoria[];
}

export type MetricasResponse =
  | MetricasGlobalResponse
  | MetricasPorAreaResponse
  | MetricasPorTecnicoResponse;
