import { z } from "zod";

// ============================================================
// AVISOS DEL SISTEMA — mensajes globales que se lanzan desde el
// monitor del servidor (mantenimiento, versión nueva, etc.)
// ============================================================

export const TipoAvisoSistemaSchema = z.enum([
  "MANTENIMIENTO", // servidor en mantenimiento (programado o en curso)
  "VERSION", // hay una versión nueva — ofrece recargar la página
  "INFO", // aviso general
  "URGENTE", // incidente / caída
]);
export type TipoAvisoSistema = z.infer<typeof TipoAvisoSistemaSchema>;

export const CrearAvisoSistemaSchema = z.object({
  tipo: TipoAvisoSistemaSchema,
  titulo: z.string().trim().min(1).max(120),
  mensaje: z.string().trim().max(1000).default(""),
  // Para MANTENIMIENTO: ventana programada (ISO 8601). Solo informativo en el banner.
  inicio: z.string().datetime({ offset: true }).optional(),
  // Fecha en que el aviso desaparece solo (ISO 8601). Sin fin = hasta que se quite.
  fin: z.string().datetime({ offset: true }).optional(),
  // Para VERSION: número de versión a mostrar (ej. "1.0.3").
  version: z.string().trim().max(30).optional(),
  // true = el usuario no puede cerrar el banner (por defecto: MANTENIMIENTO y URGENTE).
  fijo: z.boolean().optional(),
});
export type CrearAvisoSistema = z.infer<typeof CrearAvisoSistemaSchema>;

export type AvisoSistema = CrearAvisoSistema & {
  id: string;
  fijo: boolean;
  creadoEn: string;
};

// ============================================================
// NOVEDADES DE VERSIÓN — "¿Qué hay de nuevo?" para todos los usuarios
// ============================================================

export const AudienciaNovedadSchema = z.enum(["TODOS", "EMPLEADOS", "STAFF"]);
export type AudienciaNovedad = z.infer<typeof AudienciaNovedadSchema>;

export const CrearNovedadSchema = z.object({
  version: z.string().trim().max(30).optional(),
  titulo: z.string().trim().min(1).max(120),
  mensaje: z.string().trim().max(2000).default(""),
  // Lista de cambios en lenguaje sencillo, ej. "Ya puedes adjuntar fotos a tus solicitudes".
  puntos: z.array(z.string().trim().min(1).max(300)).min(1).max(15),
  audiencia: AudienciaNovedadSchema.default("TODOS"),
});
export type CrearNovedad = z.infer<typeof CrearNovedadSchema>;

export type Novedad = CrearNovedad & {
  id: number;
  createdAt: string;
};
