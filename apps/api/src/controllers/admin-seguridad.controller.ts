import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";

// ── Logs de acceso ────────────────────────────────────────────────────────────
export const listarLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query["limit"] as string) || 200, 500);
    const offset = parseInt(req.query["offset"] as string) || 0;
    const resultado = req.query["resultado"] as string | undefined;
    const tipo = req.query["tipo"] as string | undefined;
    const desde = req.query["desde"] as string | undefined;
    const hasta = req.query["hasta"] as string | undefined;

    const where: Record<string, unknown> = {};
    if (resultado) where.resultado = resultado;
    if (tipo) where.tipo = tipo;
    if (desde || hasta) {
      where.createdAt = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.logAcceso.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          usuario: { select: { id: true, nombre: true, apellidos: true, usuario: true, rol: true } },
        },
      }),
      prisma.logAcceso.count({ where }),
    ]);

    res.json({ data: logs, total, limit, offset });
  } catch (err) {
    next(err);
  }
};

// ── Sesiones activas ──────────────────────────────────────────────────────────
export const listarSesiones = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sesiones = await prisma.sesion.findMany({
      where: { activa: true, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: {
        usuario: { select: { id: true, nombre: true, apellidos: true, usuario: true, rol: true } },
        empleado: { select: { rfc: true, nombreCompleto: true } },
      },
    });
    res.json({ data: sesiones });
  } catch (err) {
    next(err);
  }
};

// ── Cerrar sesión específica (forzar desde admin) ─────────────────────────────
export const cerrarSesionAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await prisma.sesion.update({ where: { id }, data: { activa: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
