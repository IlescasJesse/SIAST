import type { Response, NextFunction } from "express";
import type { Rol } from "@stf/shared";
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";

export const ROLES_RESPONSABLE = [
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
  "RESPONSABLE_SISTEMAS",
] as const;

export const requireRol =
  (...roles: Rol[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: "Sin permisos para esta acción" });
      return;
    }
    next();
  };

export const requireResponsableDeArea =
  (getTicketSubcategoria: (req: AuthRequest) => Promise<string | null>) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    if (req.user.rol === "ADMIN" || req.user.rol === "MESA_AYUDA") {
      next();
      return;
    }

    if (!(ROLES_RESPONSABLE as readonly string[]).includes(req.user.rol)) {
      res.status(403).json({ error: "Sin permisos para esta acción" });
      return;
    }

    try {
      const usuarioDb = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        select: { areaSoporteId: true, activo: true },
      });

      if (!usuarioDb?.activo || !usuarioDb.areaSoporteId) {
        res.status(403).json({ error: "Responsable sin área asignada" });
        return;
      }

      const areaSoporte = await prisma.areaSoporte.findUnique({
        where: { id: usuarioDb.areaSoporteId },
      });

      if (!areaSoporte) {
        res.status(403).json({ error: "Área de soporte no encontrada" });
        return;
      }

      const subcategoriaTicket = await getTicketSubcategoria(req);
      const subcategorias = areaSoporte.subcategorias as string[];

      if (subcategoriaTicket && !subcategorias.includes(subcategoriaTicket)) {
        res.status(403).json({ error: "Solicitud fuera del área de soporte asignada" });
        return;
      }

      (req as any).areaSoporte = areaSoporte;
      next();
    } catch (err) {
      next(err);
    }
  };
