import type { Response, NextFunction } from "express";
import type { Rol } from "@stf/shared";
import type { AuthRequest } from "../types/index.js";

export const requireRol =
  (...roles: Rol[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: "Sin permisos para esta acción" });
      return;
    }
    next();
  };
