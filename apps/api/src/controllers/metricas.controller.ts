import { z } from "zod";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import { ROLES_RESPONSABLE } from "../middleware/roles.middleware.js";
import { ROLES_TECNICO } from "../services/alcance.service.js";
import { prisma } from "../config/database.js";
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
  areaId: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const n = Number(s);
      if (isNaN(n) || !Number.isInteger(n) || n <= 0)
        throw new Error("areaId debe ser un entero positivo");
      return n;
    }),
  tecnicoId: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const n = Number(s);
      if (isNaN(n) || !Number.isInteger(n) || n <= 0)
        throw new Error("tecnicoId debe ser un entero positivo");
      return n;
    }),
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
    // Lista compartida con alcance.service (antes faltaba TECNICO_SISTEMAS aquí y
    // ese rol podía consultar las métricas globales).
    const esRolTecnico = (ROLES_TECNICO as readonly string[]).includes(user.rol);
    // Las métricas de los administradores solo las ve otro Admin.
    const verAdmins = user.rol === "ADMIN";

    // CR-01: TECNICO_* solo puede acceder a tipo=proceso (sus propias métricas)
    if (esRolTecnico && tipo !== "proceso") {
      res.status(403).json({ error: "Técnicos solo pueden acceder a métricas tipo=proceso" });
      return;
    }

    // CR-02: RESPONSABLE_* no puede acceder a tipo=area (métricas globales)
    if ((ROLES_RESPONSABLE as readonly string[]).includes(user.rol) && tipo === "area") {
      res.status(403).json({ error: "Responsables no pueden acceder a métricas globales" });
      return;
    }

    // RESPONSABLE_*: ignorar areaId del query param, forzar desde JWT
    if ((ROLES_RESPONSABLE as readonly string[]).includes(user.rol)) {
      if (!user.areaSoporteId) {
        res.status(403).json({ error: "Responsable sin área asignada en token" });
        return;
      }
      areaId = user.areaSoporteId;
    }

    // 3. RESPONSABLE_*: para tipo=proceso, validar que el técnico solicitado
    //    pertenezca a su propia área de soporte (evita fuga cross-área).
    //    MESA_AYUDA y ADMIN conservan scope global (consistente con el resto
    //    del controller, donde no están en ROLES_TECNICO ni ROLES_RESPONSABLE).
    if (
      (ROLES_RESPONSABLE as readonly string[]).includes(user.rol) &&
      tipo === "proceso" &&
      tecnicoId !== undefined
    ) {
      const tecnico = await prisma.usuario.findUnique({
        where: { id: tecnicoId },
        select: { areaSoporteId: true },
      });
      if (!tecnico || tecnico.areaSoporteId !== user.areaSoporteId) {
        res.status(403).json({ error: "Técnico fuera del área de soporte asignada" });
        return;
      }
    }

    // 4. TECNICO_*: para tipo=proceso, forzar su propio tecnicoId (T-04-02-04)
    const tecnicoIdEfectivo = esRolTecnico ? user.id : (tecnicoId ?? undefined);

    // Detalle de un Admin: solo para otro Admin.
    if (tipo === "proceso" && tecnicoIdEfectivo && !verAdmins) {
      const objetivo = await prisma.usuario.findUnique({
        where: { id: tecnicoIdEfectivo },
        select: { rol: true },
      });
      if (objetivo?.rol === "ADMIN") {
        res.status(403).json({ error: "Sin acceso a las métricas de este usuario" });
        return;
      }
    }

    // 5. Delegar al servicio según tipo
    let data;
    if (tipo === "area") {
      data = await metricasService.obtenerMetricasGlobal(fechaInicio, fechaFin, verAdmins);
    } else if (tipo === "tecnico") {
      if (!areaId) {
        res.status(400).json({ error: "areaId requerido para tipo=tecnico" });
        return;
      }
      data = await metricasService.obtenerMetricasPorArea(areaId, fechaInicio, fechaFin, verAdmins);
    } else {
      // tipo === "proceso"
      if (!tecnicoIdEfectivo) {
        res.status(400).json({ error: "tecnicoId requerido para tipo=proceso" });
        return;
      }
      data = await metricasService.obtenerMetricasPorTecnico(
        tecnicoIdEfectivo,
        fechaInicio,
        fechaFin,
        verAdmins,
      );
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
};
