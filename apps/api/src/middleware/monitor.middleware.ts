import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

// Autoriza al monitor del servidor con un token fijo (header X-Monitor-Token).
// Sin MONITOR_TOKEN en el .env los endpoints quedan deshabilitados.
export const monitorAuth = (req: Request, res: Response, next: NextFunction): void => {
  const esperado = process.env.MONITOR_TOKEN ?? "";
  if (esperado.length < 32) {
    res.status(503).json({ error: "MONITOR_TOKEN no configurado (mínimo 32 caracteres)" });
    return;
  }
  const recibido = String(req.header("x-monitor-token") ?? "");
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Token de monitor inválido" });
    return;
  }
  next();
};
