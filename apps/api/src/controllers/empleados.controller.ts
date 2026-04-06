import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { LABEL_PISO } from "@stf/shared";
import type { PisoEdificio } from "@stf/shared";

export const ubicacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfc = (req.query.rfc as string)?.toUpperCase();
    if (!rfc) { res.status(400).json({ error: "RFC requerido" }); return; }

    const empleado = await prisma.empleado.findUnique({
      where: { rfc },
      include: { area: true },
    });

    if (!empleado) { res.status(404).json({ error: "Empleado no encontrado" }); return; }

    res.json({
      rfc: empleado.rfc,
      nombre: empleado.nombreCompleto,
      area: empleado.area.label,
      areaId: empleado.areaId,
      floor: empleado.area.floor,
      floorLabel: LABEL_PISO[empleado.piso as PisoEdificio],
    });
  } catch (err) {
    next(err);
  }
};
