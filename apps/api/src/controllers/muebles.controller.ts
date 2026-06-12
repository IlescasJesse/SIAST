import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseId = (param: string | string[]): number =>
  parseInt(Array.isArray(param) ? param[0] : param, 10);

// ─── Schemas de validación ────────────────────────────────────────────────────

const RotacionSchema = z
  .number()
  .int()
  .refine((v) => [0, 90, 180, 270].includes(v), { message: "rotacion debe ser 0, 90, 180 o 270" });

const MuebleCreateBodySchema = z.object({
  label: z.string().min(1).max(100),
  tipo: z.string().min(1).max(50),
  gridX: z.number().min(0).max(1),
  gridY: z.number().min(0).max(1),
  ancho: z.number().positive().optional().default(1.0),
  alto: z.number().positive().optional().default(1.0),
  rotacion: RotacionSchema.optional().default(0),
});

const MuebleUpdateBodySchema = z.object({
  label: z.string().min(1).max(100).optional(),
  tipo: z.string().min(1).max(50).optional(),
  gridX: z.number().min(0).max(1).optional(),
  gridY: z.number().min(0).max(1).optional(),
  ancho: z.number().positive().optional(),
  alto: z.number().positive().optional(),
  rotacion: RotacionSchema.optional(),
});

const FilaMueblesBodySchema = z.object({
  labelPrefix: z.string().min(1).max(80),
  tipo: z.string().min(1).max(50),
  cantidad: z.number().int().min(1).max(30),
  gridX: z.number().min(0).max(1), // posición del primer módulo
  gridY: z.number().min(0).max(1),
  orientacion: z.enum(["H", "V"]).default("H"), // H = fila horizontal, V = columna vertical
  separacion: z.number().min(0).max(1).optional(), // paso entre módulos; default = ancho/alto del módulo
  ancho: z.number().positive().optional().default(0.15),
  alto: z.number().positive().optional().default(0.15),
  rotacion: RotacionSchema.optional().default(0),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/areas/:areaId/muebles
 * Lista los muebles activos de un área.
 */
export const listarMuebles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { areaId } = req.params as { areaId: string };

    const area = await prisma.areaEdificio.findUnique({ where: { id: areaId } });
    if (!area || !area.activo) {
      res.status(404).json({ error: `Área "${areaId}" no encontrada` });
      return;
    }

    const data = await prisma.mueble.findMany({
      where: { areaId, activo: true },
      orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/areas/:areaId/muebles
 * Crea un mueble dentro de un área.
 */
export const crearMueble = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { areaId } = req.params as { areaId: string };

    const area = await prisma.areaEdificio.findUnique({ where: { id: areaId } });
    if (!area || !area.activo) {
      res.status(404).json({ error: `Área "${areaId}" no encontrada` });
      return;
    }

    const parse = MuebleCreateBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const { label, tipo, gridX, gridY, ancho, alto, rotacion } = parse.data;

    const mueble = await prisma.mueble.create({
      data: {
        areaId,
        label,
        tipo,
        gridX,
        gridY,
        ancho,
        alto,
        rotacion,
        activo: true,
      },
    });

    res.status(201).json({ data: mueble });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/areas/:areaId/muebles/fila
 * Crea una fila (u columna) de N módulos idénticos distribuidos a partir de
 * (gridX, gridY) con un paso `separacion` en la orientación indicada.
 * Los módulos cuya posición se salga del rango 0-1 se omiten (clamp por conteo).
 */
export const crearFilaMuebles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { areaId } = req.params as { areaId: string };

    const area = await prisma.areaEdificio.findUnique({ where: { id: areaId } });
    if (!area || !area.activo) {
      res.status(404).json({ error: `Área "${areaId}" no encontrada` });
      return;
    }

    const parse = FilaMueblesBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const { labelPrefix, tipo, cantidad, gridX, gridY, orientacion, ancho, alto, rotacion } =
      parse.data;
    const paso = parse.data.separacion ?? (orientacion === "H" ? ancho : alto);

    const filas = [];
    for (let i = 0; i < cantidad; i++) {
      const x = orientacion === "H" ? gridX + i * paso : gridX;
      const y = orientacion === "V" ? gridY + i * paso : gridY;
      if (x > 1 || y > 1) break; // no salirse del área
      filas.push({
        areaId,
        label: `${labelPrefix} ${i + 1}`,
        tipo,
        gridX: x,
        gridY: y,
        ancho,
        alto,
        rotacion,
        activo: true,
      });
    }

    if (filas.length === 0) {
      res.status(400).json({ error: "Ningún módulo cabe en el área con esos parámetros" });
      return;
    }

    await prisma.mueble.createMany({ data: filas });
    const data = await prisma.mueble.findMany({
      where: { areaId, activo: true },
      orderBy: [{ gridY: "asc" }, { gridX: "asc" }],
    });

    res.status(201).json({ data, creados: filas.length });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/muebles/:id
 * Actualiza un mueble existente.
 */
export const actualizarMueble = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params["id"] as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID de mueble inválido" });
      return;
    }

    const existente = await prisma.mueble.findUnique({ where: { id } });
    if (!existente || !existente.activo) {
      res.status(404).json({ error: `Mueble ${id} no encontrado` });
      return;
    }

    const parse = MuebleUpdateBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const { label, tipo, gridX, gridY, ancho, alto, rotacion } = parse.data;

    const mueble = await prisma.mueble.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(tipo !== undefined && { tipo }),
        ...(gridX !== undefined && { gridX }),
        ...(gridY !== undefined && { gridY }),
        ...(ancho !== undefined && { ancho }),
        ...(alto !== undefined && { alto }),
        ...(rotacion !== undefined && { rotacion }),
      },
    });

    res.json({ data: mueble });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/muebles/:id
 * Soft-delete: activo = false. Nunca borrado físico.
 */
export const eliminarMueble = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params["id"] as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID de mueble inválido" });
      return;
    }

    const existente = await prisma.mueble.findUnique({ where: { id } });
    if (!existente) {
      res.status(404).json({ error: `Mueble ${id} no encontrado` });
      return;
    }
    if (!existente.activo) {
      res.status(409).json({ error: `El mueble ${id} ya está eliminado` });
      return;
    }

    const mueble = await prisma.mueble.update({
      where: { id },
      data: { activo: false },
    });

    res.json({ data: mueble, mensaje: "Mueble desactivado correctamente" });
  } catch (err) {
    next(err);
  }
};
