import type { Request, Response, NextFunction } from "express";
import { syncEmpleados, syncStatus } from "../services/sirh.service.js";
import { getWaStatus } from "../services/whatsapp.service.js";
import { prisma } from "../config/database.js";
import { getIo } from "../services/notificaciones.service.js";

/**
 * GET /api/admin/sirh/status
 * Devuelve el estado de la última sincronización con SIRH.
 */
export const sirhSyncStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const totalEmpleados = await prisma.empleado.count({ where: { activo: true } });
    const sincronizados  = await prisma.empleado.count({ where: { activo: true, sincronizadoSIRH: true } });

    res.json({
      data: {
        ...syncStatus,
        habilitado: process.env.SIRH_ENABLED === "true",
        totalEmpleadosDB: totalEmpleados,
        sincronizadosSIRH: sincronizados,
        whatsapp: getWaStatus(),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/sirh/sync
 * Dispara una sincronización completa con SIRH en background.
 */
export const sirhSyncNow = async (_req: Request, res: Response) => {
  if (syncStatus.enProgreso) {
    res.status(409).json({ error: "Ya hay una sincronización en progreso" });
    return;
  }

  const io = getIo();
  io?.to("admins").emit("sirh:sync_iniciada");

  syncEmpleados()
    .then(() => {
      io?.to("admins").emit("sirh:sync_completada", { ...syncStatus });
    })
    .catch((e) => {
      console.error("[SIRH] Error en sync manual:", e.message);
      io?.to("admins").emit("sirh:sync_error", { error: e.message });
    });

  res.json({ ok: true, mensaje: "Sincronización iniciada en background" });
};

/**
 * GET /api/admin/sirh/empleados
 * Lista empleados sincronizados desde SIRH con filtros y paginación.
 */
export const sirhEmpleados = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = "1", limit = "50", search = "", activo } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const where: { sincronizadoSIRH: boolean; activo?: boolean; OR?: object[] } = {
      sincronizadoSIRH: true,
    };
    if (activo === "true")  where.activo = true;
    if (activo === "false") where.activo = false;
    if (search) {
      const term = search.trim();
      where.OR = [
        { rfc:            { contains: term } },
        { nombreCompleto: { contains: term } },
        { departamento:   { contains: term } },
        { puesto:         { contains: term } },
        { email:          { contains: term } },
      ];
    }

    const [total, empleados] = await Promise.all([
      prisma.empleado.count({ where }),
      prisma.empleado.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { nombreCompleto: "asc" },
        select: {
          id:            true,
          rfc:           true,
          nombreCompleto:true,
          departamento:  true,
          puesto:        true,
          email:         true,
          telefono:      true,
          activo:        true,
          piso:          true,
          numEmpleado:   true,
          updatedAt:     true,
        },
      }),
    ]);

    res.json({
      data: empleados,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};
