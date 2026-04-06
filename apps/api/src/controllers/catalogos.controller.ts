import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { SUBCATEGORIAS_POR_CATEGORIA } from "@stf/shared";

export const categorias = (_req: Request, res: Response) => {
  res.json({
    data: Object.entries(SUBCATEGORIAS_POR_CATEGORIA).map(([cat, subs]) => ({
      categoria: cat,
      subcategorias: subs,
    })),
  });
};

export const tecnicos = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.usuario.findMany({
      where: {
        activo: true,
        rol: { in: ["TECNICO_INFORMATICO", "TECNICO_SERVICIOS"] },
      },
      select: { id: true, nombre: true, apellidos: true, rol: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const areas = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.areaEdificio.findMany({
      where: { activo: true },
      orderBy: [{ floor: "asc" }, { label: "asc" }],
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const pisos = (_req: Request, res: Response) => {
  res.json({
    data: [
      { piso: "PB", floor: 0, label: "Planta Baja" },
      { piso: "NIVEL_1", floor: 1, label: "Nivel 1" },
      { piso: "NIVEL_2", floor: 2, label: "Nivel 2" },
      { piso: "NIVEL_3", floor: 3, label: "Nivel 3" },
    ],
  });
};
