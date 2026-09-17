import type { Request, Response, NextFunction } from "express";
import * as ipLockout from "../services/ip-lockout.service.js";

/**
 * Bloqueo progresivo por IP en endpoints de autenticación.
 * SEC-04: protección contra brute-force de OTP y contraseñas de staff.
 *
 * 5 intentos fallidos (status >= 400) disparan un bloqueo de 3 minutos.
 * Cada bloqueo posterior de la misma IP suma 2 minutos (3, 5, 7, 9...).
 * Ver `services/ip-lockout.service.ts` para la lógica y el criterio de
 * expiración de la reincidencia (24h sin nuevos bloqueos reinicia a 3 min).
 *
 * Reemplaza el rate limiter anterior (express-rate-limit, ventana fija de
 * 15 min) porque este último no soporta duración de bloqueo dinámica por IP.
 */
export const authRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip ?? "unknown";

  const estado = ipLockout.verificarBloqueo(ip);
  if (estado.bloqueado) {
    const minutos = estado.minutosRestantes ?? 1;
    res.setHeader("Retry-After", String(minutos * 60));
    res.status(429).json({
      error: `Demasiados intentos. Tu IP quedó bloqueada temporalmente. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
    });
    return;
  }

  // Header compatible con el parseo existente en el frontend (store/auth.js:
  // parseIntentosRestantes espera un token "r=<n>" separado por ";").
  const restantes = ipLockout.intentosRestantes(ip);
  res.setHeader("RateLimit", `"auth-progresivo"; r=${restantes}`);

  res.once("finish", () => {
    const fallido = res.statusCode >= 400;
    ipLockout.registrarIntento(ip, fallido);
  });

  next();
};
