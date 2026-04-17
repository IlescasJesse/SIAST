import type { Request, Response, NextFunction } from "express";
import { syncEmpleados, syncStatus } from "../services/sirh.service.js";
import { getWaStatus } from "../services/whatsapp.service.js";
import { prisma } from "../config/database.js";

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

  // Lanzar en background — no await para no bloquear la respuesta
  syncEmpleados().catch((e) => console.error("[SIRH] Error en sync manual:", e.message));

  res.json({ ok: true, mensaje: "Sincronización iniciada en background" });
};
