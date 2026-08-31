import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as authService from "../services/auth.service.js";
import * as otpService from "../services/otp.service.js";
import { cerrarSesion, verificarSesion } from "../services/sesiones.service.js";
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";
import { signToken } from "../config/jwt.js";
import type { JwtPayload } from "../types/index.js";

const getMeta = (req: Request) => ({
  ipAddress:
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    undefined,
  userAgent: req.headers["user-agent"]?.slice(0, 300) ?? undefined,
});

// ── OTP ──────────────────────────────────────────────────────

export const solicitarOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc, telefono, canal, email } = req.body as {
      rfc: string;
      telefono?: string;
      canal?: "whatsapp" | "email";
      email?: string;
    };
    if (!rfc) {
      res.status(400).json({ error: "RFC requerido" });
      return;
    }

    const result = await otpService.solicitarOtp(rfc.toUpperCase(), telefono, canal, email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const verificarOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc, codigo } = req.body as { rfc: string; codigo: string };
    if (!rfc || !codigo) {
      res.status(400).json({ error: "RFC y código requeridos" });
      return;
    }

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
    const u = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
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

// ── Preferencia de notificaciones por WhatsApp (Perfil, solo EMPLEADO) ────────

export const actualizarNotificacionesWhatsapp = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    if (user.rol !== "EMPLEADO") {
      res.status(403).json({ error: "Solo empleados tienen esta preferencia" });
      return;
    }
    const { enabled, telefono } = req.body as { enabled: boolean; telefono?: string };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "'enabled' es requerido (boolean)" });
      return;
    }
    const result = await otpService.actualizarNotificacionesWhatsapp(user.rfc!, enabled, telefono);
    res.json(result);
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

    let payload: JwtPayload & { iat?: number; exp?: number };
    try {
      // Permitir tokens expirados para poder renovarlos
      payload = jwt.verify(token, process.env.JWT_SECRET!, {
        ignoreExpiration: true,
      }) as JwtPayload & {
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

    // ── SEC-05: verificar que la sesión no fue revocada ──────────────────────
    if (payload.jti) {
      const sesionActiva = await verificarSesion(payload.jti);
      if (!sesionActiva) {
        res.status(401).json({ error: "Sesión revocada. Por favor inicia sesión de nuevo." });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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

// ── Completar perfil (primer acceso — feedback staff P3-9, 2026-08-31) ────────
// correoInstitucional y emailPersonal son opcionales en DB, pero se exige al
// menos uno de los dos al completar el perfil (muchos empleados no tienen
// correo institucional asignado).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const completarPerfil = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (user.rol !== "EMPLEADO") {
      res.status(403).json({ error: "Solo empleados completan este perfil" });
      return;
    }

    const { correoInstitucional, emailPersonal, extension, areaId } = req.body as {
      correoInstitucional?: string | null;
      emailPersonal?: string | null;
      extension?: string | null;
      areaId?: string;
    };

    const ci = correoInstitucional?.trim().toLowerCase() || null;
    const ep = emailPersonal?.trim().toLowerCase() || null;
    if (ci && !EMAIL_REGEX.test(ci)) {
      res.status(400).json({ error: "Correo institucional inválido" });
      return;
    }
    if (ep && !EMAIL_REGEX.test(ep)) {
      res.status(400).json({ error: "Correo personal inválido" });
      return;
    }
    if (!ci && !ep) {
      res
        .status(400)
        .json({ error: "Captura tu correo institucional o, en su defecto, tu correo personal" });
      return;
    }

    if (areaId) {
      const area = await prisma.areaEdificio.findUnique({ where: { id: areaId } });
      if (!area || !area.activo) {
        res.status(400).json({ error: "Ubicación inválida" });
        return;
      }
    }

    const empleado = await prisma.empleado.update({
      where: { rfc: user.rfc! },
      data: {
        correoInstitucional: ci,
        emailPersonal: ep,
        extension: extension?.trim() || null,
        ...(areaId ? { areaId } : {}),
        perfilCompleto: true,
      },
      include: { area: true },
    });
    res.json(empleado);
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
