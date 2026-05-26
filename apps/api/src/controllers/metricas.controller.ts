import { z } from "zod";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import { ROLES_RESPONSABLE } from "../middleware/roles.middleware.js";
import * as metricasService from "../services/metricas.service.js";

// ── Validación de query params (Zod — seguridad D-threat Fechas malformadas) ──
const QuerySchema = z.object({
  tipo: z.enum(["area", "tecnico", "proceso"]).default("area"),
  fechaInicio: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const d = new Date(s);
      if (isNaN(d.getTime())) throw new Error("fechaInicio inválida");
      return d;
    }),
  fechaFin: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const d = new Date(s);
      if (isNaN(d.getTime())) throw new Error("fechaFin inválida");
      return d;
    }),
  areaId: z.string().optional().transform((s) => (s ? Number(s) : undefined)),
  tecnicoId: z.string().optional().transform((s) => (s ? Number(s) : undefined)),
});

// ============================================================
// GET /api/metricas?tipo=area|tecnico|proceso&fechaInicio=&fechaFin=&areaId=&tecnicoId=
// ============================================================
export const obtener = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Validar y parsear query params — 400 en fechas inválidas (T-04-02-05)
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Parámetros inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { tipo, fechaInicio, fechaFin, tecnicoId } = parsed.data;
    let { areaId } = parsed.data;
    const user = req.user!;

    // 2. Role scoping — SEGURIDAD CRÍTICA (D-12, T-04-02-01)
    // RESPONSABLE_*: ignorar areaId del query param, forzar desde JWT
    if ((ROLES_RESPONSABLE as readonly string[]).includes(user.rol)) {
      if (!user.areaSoporteId) {
        res.status(403).json({ error: "Responsable sin área asignada en token" });
        return;
      }
      areaId = user.areaSoporteId;
    }

    // 3. TECNICO_*: para tipo=proceso, forzar su propio tecnicoId (T-04-02-04)
    const ROLES_TECNICO = [
      "TECNICO_TI",
      "TECNICO_REDES",
      "TECNICO_ELECTRICISTA",
      "TECNICO_PLOMERO",
      "TECNICO_MOVILIDAD",
    ];
    const tecnicoIdEfectivo = ROLES_TECNICO.includes(user.rol) ? user.id : (tecnicoId ?? undefined);

    // 4. Delegar al servicio según tipo
    let data;
    if (tipo === "area") {
      data = await metricasService.obtenerMetricasGlobal(fechaInicio, fechaFin);
    } else if (tipo === "tecnico") {
      if (!areaId) {
        res.status(400).json({ error: "areaId requerido para tipo=tecnico" });
        return;
      }
      data = await metricasService.obtenerMetricasPorArea(areaId, fechaInicio, fechaFin);
    } else {
      // tipo === "proceso"
      if (!tecnicoIdEfectivo) {
        res.status(400).json({ error: "tecnicoId requerido para tipo=proceso" });
        return;
      }
      data = await metricasService.obtenerMetricasPorTecnico(tecnicoIdEfectivo, fechaInicio, fechaFin);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
};
