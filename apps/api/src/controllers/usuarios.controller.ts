import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";

const parseId = (param: string | string[]): number =>
  parseInt(Array.isArray(param) ? param[0] : param, 10);

const userSelect = {
  id: true,
  nombre: true,
  apellidos: true,
  usuario: true,
  email: true,
  telefono: true,
  rol: true,
  activo: true,
  permisos: true,
  esEmpleadoEstructura: true,
  empleadoId: true,
  rfc: true,
  createdAt: true,
};

export const listar = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarios = await prisma.usuario.findMany({ select: userSelect, orderBy: { nombre: "asc" } });
    res.json({ data: usuarios, total: usuarios.length });
  } catch (err) {
    next(err);
  }
};

export const crear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, esEmpleadoEstructura, empleadoId, rfc, permisos, ...rest } = req.body as {
      nombre: string; apellidos: string; usuario: string;
      password: string; rol: string; email?: string; telefono?: string;
      esEmpleadoEstructura?: boolean; empleadoId?: string; rfc?: string;
      permisos?: string[];
    };

    const hashedPassword = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        ...rest,
        rol: rest.rol as never,
        password: hashedPassword,
        esEmpleadoEstructura: esEmpleadoEstructura ?? false,
        empleadoId: esEmpleadoEstructura ? (empleadoId ?? null) : null,
        rfc: esEmpleadoEstructura ? (rfc ?? null) : null,
        ...(permisos !== undefined && { permisos: permisos ?? [] }),
      },
      select: userSelect,
    });
    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
};

export const obtener = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseId(req.params.id) },
      select: userSelect,
    });
    if (!usuario) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    res.json(usuario);
  } catch (err) {
    next(err);
  }
};

export const actualizar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, esEmpleadoEstructura, empleadoId, rfc, permisos, ...rest } = req.body;

    const data: Record<string, unknown> = { ...rest };
    if (password) data.password = await bcrypt.hash(password, 10);
    if (permisos !== undefined) data.permisos = permisos;

    if (esEmpleadoEstructura !== undefined) {
      data.esEmpleadoEstructura = esEmpleadoEstructura;
      data.empleadoId = esEmpleadoEstructura ? (empleadoId ?? null) : null;
      data.rfc = esEmpleadoEstructura ? (rfc ?? null) : null;
    }

    const usuario = await prisma.usuario.update({
      where: { id: parseId(req.params.id) },
      data,
      select: userSelect,
    });
    res.json(usuario);
  } catch (err) {
    next(err);
  }
};

export const desactivar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.usuario.update({
      where: { id: parseId(req.params.id) },
      data: { activo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
