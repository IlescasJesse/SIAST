import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import * as authService from "../services/auth.service.js";
import * as otpService from "../services/otp.service.js";
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";

export const loginRFC = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc } = req.body as { rfc: string };
    const result = await authService.loginRFC(rfc);
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
    const result = await authService.loginRFC(rfc.toUpperCase());
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const loginStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { usuario, password } = req.body as { usuario: string; password: string };
    const result = await authService.loginStaff(usuario, password);
    res.json(result);
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
