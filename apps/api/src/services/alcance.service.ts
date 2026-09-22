import type { Prisma, SubcategoriaTicket } from "@prisma/client";
import { prisma } from "../config/database.js";
import type { JwtPayload } from "../types/index.js";

// ============================================================
// ALCANCE POR ROL — qué solicitudes puede ver/operar cada rol.
// Fuente única para evitar IDOR: toda lectura/mutación de un ticket por id
// debe pasar por aquí en lugar de reimplementar el filtro por rol.
// ============================================================

export const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
  "RESPONSABLE_SISTEMAS",
] as const;

// TECNICO_SERVICIOS es deprecated pero puede existir en filas viejas — se trata
// como técnico (solo lo asignado a él) en vez de dejarlo sin filtro.
export const ROLES_TECNICO = [
  "TECNICO_TI",
  "TECNICO_REDES",
  "TECNICO_SISTEMAS",
  "TECNICO_ELECTRICISTA",
  "TECNICO_PLOMERO",
  "TECNICO_MOVILIDAD",
  "TECNICO_SERVICIOS",
] as const;

export const ROLES_GESTOR = [
  "GESTOR_RECURSOS_MATERIALES",
  "GESTOR_SALAS_JUNTA",
  "GESTOR_RECURSOS",
  "GESTOR_INVENTARIO",
] as const;

// Cada gestor específico se limita a su subcategoría; GESTOR_RECURSOS_MATERIALES
// es el gestor general y ve/opera toda la categoría sin restricción de subcategoría.
const SUBCATEGORIAS_GESTOR: Record<string, string[] | null> = {
  GESTOR_RECURSOS_MATERIALES: null,
  GESTOR_SALAS_JUNTA: ["SALA_JUNTAS"],
  GESTOR_RECURSOS: ["EQUIPO_AUDIOVISUAL", "PRESTAMO_EQUIPO"],
  GESTOR_INVENTARIO: ["MOBILIARIO", "PAPELERIA"],
};

/** null = sin restricción de subcategoría (gestor general). */
export const subcategoriasGestor = (rol: string): string[] | null =>
  SUBCATEGORIAS_GESTOR[rol] ?? null;

export const esResponsable = (rol: string) =>
  (ROLES_RESPONSABLE as readonly string[]).includes(rol);
export const esTecnico = (rol: string) => (ROLES_TECNICO as readonly string[]).includes(rol);
export const esGestor = (rol: string) => (ROLES_GESTOR as readonly string[]).includes(rol);
export const esStaffGlobal = (rol: string) => rol === "ADMIN" || rol === "MESA_AYUDA";

/** Filtro que no coincide con ningún ticket (default-deny). */
const NINGUNO: Prisma.TicketWhereInput = { id: { in: [] } };

export interface AreaSoporteUsuario {
  id: number;
  nombre: string;
  subcategorias: string[];
  rolesIncluidos: string[];
}

/**
 * Área de soporte del usuario staff. Se lee de DB por user.id (no del body ni
 * del JWT, que puede quedar desactualizado si el admin le cambió el área).
 */
export async function obtenerAreaSoporteUsuario(
  userId: number,
): Promise<AreaSoporteUsuario | null> {
  const usuarioDb = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { areaSoporteId: true },
  });
  if (!usuarioDb?.areaSoporteId) return null;
  const area = await prisma.areaSoporte.findFirst({
    where: { id: usuarioDb.areaSoporteId, activo: true },
  });
  if (!area) return null;
  return {
    id: area.id,
    nombre: area.nombre,
    subcategorias: (area.subcategorias as string[]) ?? [],
    rolesIncluidos: (area.rolesIncluidos as string[]) ?? [],
  };
}

/**
 * Filtro Prisma con las solicitudes que el usuario puede VER.
 *  - ADMIN / MESA_AYUDA: todas.
 *  - EMPLEADO: solo las propias (por RFC).
 *  - TECNICO_*: las asignadas a él (ticket.tecnicoId) o donde atendió/atiende un paso.
 *  - GESTOR_*: categoría RECURSOS_MATERIALES.
 *  - RESPONSABLE_*: subcategorías de su área, o tickets de otra área con un paso
 *    que requiere un rol de su área (flujos multi-área, p. ej. TI → Redes).
 *  - Cualquier otro rol / responsable sin área: ninguna.
 */
export async function alcanceLecturaTickets(user: JwtPayload): Promise<Prisma.TicketWhereInput> {
  if (esStaffGlobal(user.rol)) return {};
  if (user.rol === "EMPLEADO") return user.rfc ? { empleadoRfc: user.rfc } : NINGUNO;
  if (esTecnico(user.rol)) {
    return { OR: [{ tecnicoId: user.id }, { pasos: { some: { tecnicoId: user.id } } }] };
  }
  if (esGestor(user.rol)) {
    const subcats = subcategoriasGestor(user.rol);
    return subcats
      ? { categoria: "RECURSOS_MATERIALES", subcategoria: { in: subcats as SubcategoriaTicket[] } }
      : { categoria: "RECURSOS_MATERIALES" };
  }
  if (esResponsable(user.rol)) {
    const area = await obtenerAreaSoporteUsuario(user.id);
    if (!area) return NINGUNO;
    return {
      OR: [
        { subcategoria: { in: area.subcategorias as SubcategoriaTicket[] } },
        { pasos: { some: { rolRequerido: { in: area.rolesIncluidos } } } },
      ],
    };
  }
  return NINGUNO;
}

/** Lanza 403 si el ticket (activo) no está dentro del alcance de lectura del usuario. */
export async function verificarLecturaTicket(ticketId: number, user: JwtPayload): Promise<void> {
  const alcance = await alcanceLecturaTickets(user);
  const visible = await prisma.ticket.count({
    where: { AND: [{ id: ticketId, activo: true }, alcance] },
  });
  if (visible === 0) {
    throw Object.assign(new Error("Sin acceso a esta solicitud"), { status: 403 });
  }
}
