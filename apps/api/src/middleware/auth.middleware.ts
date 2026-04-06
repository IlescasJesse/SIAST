import type { Response, NextFunction } from "express";
import { verifyToken } from "../config/jwt.js";
import type { AuthRequest } from "../types/index.js";

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token requerido" });
      return;
    }
    const token = header.replace("Bearer ", "");
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
};
