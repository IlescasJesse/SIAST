import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseId = (param: string | string[]): number =>
  parseInt(Array.isArray(param) ? param[0] : param, 10);

// ─── Schemas de validación ────────────────────────────────────────────────────

const MuebleCreateBodySchema = z.object({
  label: z.string().min(1).max(100),
  tipo: z.string().min(1).max(50),
  gridX: z.number().min(0).max(1),
  gridY: z.number().min(0).max(1),
  ancho: z.number().positive().optional().default(1.0),
  alto: z.number().positive().optional().default(1.0),
});

const MuebleUpdateBodySchema = z.object({
  label: z.string().min(1).max(100).optional(),
  tipo: z.string().min(1).max(50).optional(),
  gridX: z.number().min(0).max(1).optional(),
  gridY: z.number().min(0).max(1).optional(),
  ancho: z.number().positive().optional(),
  alto: z.number().positive().optional(),
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

    const { label, tipo, gridX, gridY, ancho, alto } = parse.data;

    const mueble = await prisma.mueble.create({
      data: {
        areaId,
        label,
        tipo,
        gridX,
        gridY,
        ancho,
        alto,
        activo: true,
      },
    });

    res.status(201).json({ data: mueble });
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

    const { label, tipo, gridX, gridY, ancho, alto } = parse.data;

    const mueble = await prisma.mueble.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(tipo !== undefined && { tipo }),
        ...(gridX !== undefined && { gridX }),
        ...(gridY !== undefined && { gridY }),
        ...(ancho !== undefined && { ancho }),
        ...(alto !== undefined && { alto }),
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
