import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";

const ROL_AREA_MAP: Record<string, string> = {
  RESPONSABLE_TI: "TI",
  TECNICO_TI: "TI",
  RESPONSABLE_SISTEMAS: "SISTEMAS",
  TECNICO_SISTEMAS: "SISTEMAS",
  RESPONSABLE_REDES: "REDES",
  TECNICO_REDES: "REDES",
  RESPONSABLE_MANTENIMIENTO: "MANTENIMIENTO",
  TECNICO_ELECTRICISTA: "MANTENIMIENTO",
  TECNICO_PLOMERO: "MANTENIMIENTO",
  TECNICO_MOVILIDAD: "MANTENIMIENTO",
  RESPONSABLE_RECURSOS_MATERIALES: "RECURSOS_MATERIALES",
  GESTOR_RECURSOS_MATERIALES: "RECURSOS_MATERIALES",
  GESTOR_SALAS_JUNTA: "RECURSOS_MATERIALES",
  GESTOR_RECURSOS: "RECURSOS_MATERIALES",
  GESTOR_INVENTARIO: "RECURSOS_MATERIALES",
};

async function resolveAreaId(rol: string): Promise<number | null> {
  const areaNombre = ROL_AREA_MAP[rol] ?? null;
  if (!areaNombre) return null;
  const area = await prisma.areaSoporte.findUnique({ where: { nombre: areaNombre } });
  return area?.id ?? null;
}

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
  areaSoporteId: true,
  areaSoporte: { select: { nombre: true } },
};

export const listar = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: userSelect,
      orderBy: { nombre: "asc" },
    });
    res.json({ data: usuarios, total: usuarios.length });
  } catch (err) {
    next(err);
  }
};

export const crear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, usuario, esEmpleadoEstructura, empleadoId, rfc, permisos, ...rest } =
      req.body as {
        nombre: string;
        apellidos: string;
        usuario: string;
        password: string;
        rol: string;
        email?: string;
        telefono?: string;
        esEmpleadoEstructura?: boolean;
        empleadoId?: string;
        rfc?: string;
        permisos?: string[];
      };

    // Validar campos requeridos antes de cualquier operación async
    const camposFaltantes: string[] = [];
    if (!rest.nombre?.trim()) camposFaltantes.push("nombre");
    if (!rest.apellidos?.trim()) camposFaltantes.push("apellidos");
    if (!usuario?.trim()) camposFaltantes.push("usuario");
    if (!rest.rol) camposFaltantes.push("rol");
    if (!password?.trim()) camposFaltantes.push("password");
    if (camposFaltantes.length > 0) {
      res.status(400).json({ error: "Campos requeridos faltantes", campos: camposFaltantes });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const areaSoporteId = await resolveAreaId(rest.rol);

    const usuarioCreado = await prisma.usuario.create({
      data: {
        ...rest,
        usuario,
        rol: rest.rol as never,
        password: hashedPassword,
        esEmpleadoEstructura: esEmpleadoEstructura ?? false,
        empleadoId: esEmpleadoEstructura ? (empleadoId ?? null) : null,
        rfc: esEmpleadoEstructura ? (rfc ?? null) : null,
        ...(permisos !== undefined && { permisos: permisos ?? [] }),
        areaSoporteId,
      },
      select: userSelect,
    });
    res.status(201).json(usuarioCreado);
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
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json(usuario);
  } catch (err) {
    next(err);
  }
};

export const actualizar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, usuario, esEmpleadoEstructura, empleadoId, rfc, permisos, ...rest } =
      req.body;

    // Validar campos que no pueden estar vacíos si vienen en el body
    if (usuario !== undefined && !usuario?.trim()) {
      res.status(400).json({ error: "El campo usuario no puede estar vacío", campos: ["usuario"] });
      return;
    }
    if (rest.nombre !== undefined && !rest.nombre?.trim()) {
      res.status(400).json({ error: "El campo nombre no puede estar vacío", campos: ["nombre"] });
      return;
    }
    if (rest.apellidos !== undefined && !rest.apellidos?.trim()) {
      res
        .status(400)
        .json({ error: "El campo apellidos no puede estar vacío", campos: ["apellidos"] });
      return;
    }

    const data: Record<string, unknown> = { ...rest };
    if (usuario !== undefined) data.usuario = usuario.trim();
    if (password) data.password = await bcrypt.hash(password, 10);
    if (permisos !== undefined) data.permisos = permisos;

    if (esEmpleadoEstructura !== undefined) {
      data.esEmpleadoEstructura = esEmpleadoEstructura;
      data.empleadoId = esEmpleadoEstructura ? (empleadoId ?? null) : null;
      data.rfc = esEmpleadoEstructura ? (rfc ?? null) : null;
    }

    if (rest.rol) {
      data.areaSoporteId = await resolveAreaId(rest.rol as string);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: parseId(req.params.id) },
      data,
      select: userSelect,
    });
    res.json(usuarioActualizado);
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
