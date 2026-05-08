import { rateLimit } from "express-rate-limit";

/**
 * Rate limiter para endpoints de autenticación.
 * 5 intentos máximo por IP en una ventana de 15 minutos.
 * SEC-04: protección contra brute-force de OTP y contraseñas de staff.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5, // 5 intentos por IP (usar "limit", no "max" — renombrado en v7+)
  standardHeaders: "draft-8", // Emite header RateLimit estándar IETF
  legacyHeaders: false, // No emitir X-RateLimit-* headers legacy
  message: { error: "Demasiados intentos. Intenta en 15 minutos." },
});
