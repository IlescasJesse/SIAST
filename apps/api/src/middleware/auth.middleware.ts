import type { Response, NextFunction } from "express";
import { verifyToken } from "../config/jwt.js";
import { verificarSesion } from "../services/sesiones.service.js";
import type { AuthRequest } from "../types/index.js";

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token requerido" });
      return;
    }
    const token = header.replace("Bearer ", "");
    const payload = verifyToken(token);

    // Si el token incluye jti, verificar que la sesión siga activa
    if (payload.jti) {
      const activa = await verificarSesion(payload.jti);
      if (!activa) {
        res.status(401).json({ error: "Sesión cerrada. Por favor inicia sesión de nuevo." });
        return;
      }
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
};
