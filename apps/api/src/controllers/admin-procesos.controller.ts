import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { SubcategoriaTicketSchema } from "@stf/shared";

// ── Listar todos los procesos con sus pasos ──────────────────────────────────
export const listar = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const procesos = await prisma.procesoDefinicion.findMany({
      include: { pasos: { orderBy: { orden: "asc" } } },
      orderBy: [{ subcategoria: "asc" }, { subTipo: "asc" }],
    });
    res.json({ data: procesos });
  } catch (err) {
    next(err);
  }
};

// ── Obtener uno ──────────────────────────────────────────────────────────────
export const obtener = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proceso = await prisma.procesoDefinicion.findUnique({
      where: { id: Number(req.params.id) },
      include: { pasos: { orderBy: { orden: "asc" } } },
    });
    if (!proceso) { res.status(404).json({ error: "Proceso no encontrado" }); return; }
    res.json(proceso);
  } catch (err) {
    next(err);
  }
};

const PasoInput = z.object({
  orden: z.number().int().min(1),
  rolRequerido: z.string().min(1),
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(300).optional().nullable(),
  registraUnidades: z.boolean().optional().default(false),
  labelUnidades: z.string().max(100).optional().nullable(),
});

const ProcesoInput = z.object({
  subcategoria: SubcategoriaTicketSchema,
  subTipo: z.string().max(50).optional().nullable(),
  tipoFlujo: z.enum(["DIRECTO", "SECUENCIAL", "PENDIENTE"]),
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(300).optional().nullable(),
  activo: z.boolean().optional().default(true),
  pasos: z.array(PasoInput).min(0),
});

// ── Crear proceso + pasos en una transacción ─────────────────────────────────
export const crear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ProcesoInput.parse(req.body);

    const proceso = await prisma.$transaction(async (tx) => {
      const p = await tx.procesoDefinicion.create({
        data: {
          subcategoria: body.subcategoria,
          subTipo: body.subTipo ?? null,
          tipoFlujo: body.tipoFlujo,
          nombre: body.nombre,
          descripcion: body.descripcion ?? null,
          activo: body.activo ?? true,
        },
      });

      if (body.pasos.length > 0) {
        await tx.pasoDefinicion.createMany({
          data: body.pasos.map((paso) => ({
            procesoId: p.id,
            orden: paso.orden,
            rolRequerido: paso.rolRequerido,
            nombre: paso.nombre,
            descripcion: paso.descripcion ?? null,
            registraUnidades: paso.registraUnidades ?? false,
            labelUnidades: paso.labelUnidades ?? null,
          })),
        });
      }

      return tx.procesoDefinicion.findUnique({
        where: { id: p.id },
        include: { pasos: { orderBy: { orden: "asc" } } },
      });
    });

    res.status(201).json(proceso);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues }); return; }
    next(err);
  }
};

// ── Actualizar proceso + reemplazar pasos ────────────────────────────────────
export const actualizar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const body = ProcesoInput.partial().parse(req.body);

    const proceso = await prisma.$transaction(async (tx) => {
      await tx.procesoDefinicion.update({
        where: { id },
        data: {
          ...(body.subcategoria !== undefined && { subcategoria: body.subcategoria }),
          ...(body.subTipo !== undefined && { subTipo: body.subTipo }),
          ...(body.tipoFlujo !== undefined && { tipoFlujo: body.tipoFlujo }),
          ...(body.nombre !== undefined && { nombre: body.nombre }),
          ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
          ...(body.activo !== undefined && { activo: body.activo }),
        },
      });

      // Si vienen pasos, reemplazarlos todos (más simple que diff individual)
      if (body.pasos !== undefined) {
        await tx.pasoDefinicion.deleteMany({ where: { procesoId: id } });
        if (body.pasos.length > 0) {
          await tx.pasoDefinicion.createMany({
            data: body.pasos.map((paso) => ({
              procesoId: id,
              orden: paso.orden,
              rolRequerido: paso.rolRequerido,
              nombre: paso.nombre,
              descripcion: paso.descripcion ?? null,
              registraUnidades: paso.registraUnidades ?? false,
              labelUnidades: paso.labelUnidades ?? null,
            })),
          });
        }
      }

      return tx.procesoDefinicion.findUnique({
        where: { id },
        include: { pasos: { orderBy: { orden: "asc" } } },
      });
    });

    res.json(proceso);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues }); return; }
    next(err);
  }
};

// ── Toggle activo (soft disable) ─────────────────────────────────────────────
export const toggleActivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const actual = await prisma.procesoDefinicion.findUnique({ where: { id }, select: { activo: true } });
    if (!actual) { res.status(404).json({ error: "Proceso no encontrado" }); return; }
    const updated = await prisma.procesoDefinicion.update({
      where: { id },
      data: { activo: !actual.activo },
      include: { pasos: { orderBy: { orden: "asc" } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};
