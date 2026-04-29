import { randomUUID } from "crypto";
import { prisma } from "../config/database.js";

const MAX_SESIONES = 2;

interface CrearSesionOpts {
  usuarioId?: number;
  empleadoRfc?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresInMs: number; // milisegundos hasta expiración
}

/**
 * Crea una sesión nueva y hace cumplir el límite de MAX_SESIONES.
 * Si ya hay MAX_SESIONES activas, cierra la más antigua.
 * Retorna el jti generado.
 */
export async function crearSesion(opts: CrearSesionOpts): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + opts.expiresInMs);

  const where = opts.usuarioId
    ? { usuarioId: opts.usuarioId, activa: true }
    : { empleadoRfc: opts.empleadoRfc, activa: true };

  // Contar sesiones activas actuales
  const activas = await prisma.sesion.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  // Cerrar las más antiguas si se supera el límite
  const sobrantes = activas.length - MAX_SESIONES + 1;
  if (sobrantes > 0) {
    const idsACerrar = activas.slice(0, sobrantes).map((s) => s.id);
    await prisma.sesion.updateMany({
      where: { id: { in: idsACerrar } },
      data: { activa: false },
    });
  }

  await prisma.sesion.create({
    data: {
      jti,
      ...(opts.usuarioId ? { usuarioId: opts.usuarioId } : {}),
      ...(opts.empleadoRfc ? { empleadoRfc: opts.empleadoRfc } : {}),
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      expiresAt,
    },
  });

  return jti;
}

/** Verifica que el jti exista, esté activo y no haya expirado. */
export async function verificarSesion(jti: string): Promise<boolean> {
  const sesion = await prisma.sesion.findUnique({
    where: { jti },
    select: { activa: true, expiresAt: true },
  });
  if (!sesion || !sesion.activa) return false;
  if (sesion.expiresAt < new Date()) {
    // Expirada — marcar inactiva
    await prisma.sesion.update({ where: { jti }, data: { activa: false } });
    return false;
  }
  return true;
}

/** Cierra una sesión por su jti. */
export async function cerrarSesion(jti: string): Promise<void> {
  await prisma.sesion.updateMany({
    where: { jti },
    data: { activa: false },
  });
}

/** Registra un intento de acceso en el log. */
export async function registrarAcceso(opts: {
  tipo: "STAFF" | "EMPLEADO";
  identifier: string;
  resultado: "OK" | "FAIL_PASSWORD" | "FAIL_NOT_FOUND" | "FAIL_INACTIVE";
  usuarioId?: number;
  empleadoRfc?: string;
  ipAddress?: string;
  userAgent?: string;
  detalle?: string;
}): Promise<void> {
  await prisma.logAcceso.create({
    data: {
      tipo: opts.tipo,
      identifier: opts.identifier,
      resultado: opts.resultado,
      usuarioId: opts.usuarioId ?? null,
      empleadoRfc: opts.empleadoRfc ?? null,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      detalle: opts.detalle ?? null,
    },
  });
}
