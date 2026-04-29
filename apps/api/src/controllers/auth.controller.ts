import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as authService from "../services/auth.service.js";
import * as otpService from "../services/otp.service.js";
import { cerrarSesion } from "../services/sesiones.service.js";
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";
import { signToken } from "../config/jwt.js";
import type { JwtPayload } from "../types/index.js";

const getMeta = (req: Request) => ({
  ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? undefined,
  userAgent: req.headers["user-agent"]?.slice(0, 300) ?? undefined,
});

export const loginRFC = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc } = req.body as { rfc: string };
    const result = await authService.loginRFC(rfc, getMeta(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── OTP ──────────────────────────────────────────────────────

export const solicitarOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc, telefono } = req.body as { rfc: string; telefono?: string };
    if (!rfc) { res.status(400).json({ error: "RFC requerido" }); return; }

    const result = await otpService.solicitarOtp(rfc.toUpperCase(), telefono);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const verificarOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc, codigo } = req.body as { rfc: string; codigo: string };
    if (!rfc || !codigo) { res.status(400).json({ error: "RFC y código requeridos" }); return; }

    await otpService.verificarOtp(rfc.toUpperCase(), codigo);

    // OTP válido → emitir sesión JWT (reutiliza la lógica existente de loginRFC)
    const result = await authService.loginRFC(rfc.toUpperCase(), getMeta(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const loginStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { usuario, password } = req.body as { usuario: string; password: string };
    const result = await authService.loginStaff(usuario, password, getMeta(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.jti) await cerrarSesion(req.user.jti);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (user.rol === "EMPLEADO") {
      res.status(403).json({ error: "Los empleados no tienen contraseña" });
      return;
    }
    const { actual, nueva } = req.body as { actual: string; nueva: string };
    if (!actual || !nueva || nueva.length < 8) {
      res.status(400).json({ error: "Datos de contraseña inválidos" });
      return;
    }
    const u = await prisma.usuario.findUnique({ where: { id: user.id }, select: { password: true } });
    if (!u || !(await bcrypt.compare(actual, u.password))) {
      res.status(401).json({ error: "La contraseña actual no es correcta" });
      return;
    }
    await prisma.usuario.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(nueva, 10) },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ── Renovación de token ───────────────────────────────────────
// Acepta tokens expirados recientemente (hasta 7 días después de expirar)
// para evitar que el usuario pierda la sesión por inactividad.
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token requerido" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const SECRET = process.env.JWT_SECRET ?? "siast_dev_secret";

    let payload: JwtPayload & { iat?: number; exp?: number };
    try {
      // Permitir tokens expirados para poder renovarlos
      payload = jwt.verify(token, SECRET, { ignoreExpiration: true }) as JwtPayload & {
        iat?: number;
        exp?: number;
      };
    } catch {
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    // Período de gracia: 7 días desde expiración
    const now = Math.floor(Date.now() / 1000);
    const GRACE_PERIOD_SECS = 7 * 24 * 60 * 60;
    if (payload.exp && now - payload.exp > GRACE_PERIOD_SECS) {
      res.status(401).json({ error: "Sesión expirada. Por favor inicia sesión de nuevo." });
      return;
    }

    // Emitir nuevo token con el mismo payload (sin iat/exp anteriores)
    const { iat, exp, ...restPayload } = payload;
    const expiresIn =
      restPayload.rol === "EMPLEADO"
        ? (process.env.EMPLEADO_JWT_EXPIRES_IN ?? "30d")
        : (process.env.JWT_EXPIRES_IN ?? "8h");

    const newToken = signToken(restPayload as Omit<JwtPayload, "iat" | "exp">, expiresIn);
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (user.rol === "EMPLEADO") {
      const empleado = await prisma.empleado.findUnique({
        where: { rfc: user.rfc! },
        include: { area: true },
      });
      res.json(empleado);
    } else {
      const u = await prisma.usuario.findUnique({
        where: { id: user.id },
        select: { id: true, nombre: true, apellidos: true, usuario: true, rol: true, email: true },
      });
      res.json(u);
    }
  } catch (err) {
    next(err);
  }
};
