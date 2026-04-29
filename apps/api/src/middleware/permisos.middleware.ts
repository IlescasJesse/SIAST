import type { Response, NextFunction } from "express";
import type { Permiso } from "@stf/shared";
import { tienePermiso } from "@stf/shared";
import { prisma } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";

export const requirePermiso =
  (perm: Permiso) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // ADMIN siempre pasa (optimización: evita query innecesaria)
    if (req.user.rol === "ADMIN") {
      next();
      return;
    }

    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        select: { permisos: true, activo: true },
      });

      if (!usuario?.activo) {
        res.status(403).json({ error: "Usuario inactivo" });
        return;
      }

      const permisosExtra = (usuario.permisos as Permiso[] | null) ?? [];

      if (!tienePermiso(req.user.rol, permisosExtra, perm)) {
        res.status(403).json({ error: "Sin permiso para esta acción" });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
