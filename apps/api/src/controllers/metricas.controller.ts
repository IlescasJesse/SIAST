import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import { prisma } from "../config/database.js";
import type { MetricasSolicitudesResponse, MetricaTecnico, MetricaProceso } from "@stf/shared";
import { getProcesoKey, PROCESO_MAP } from "@stf/shared";
import type { Rol } from "@prisma/client";

// ============================================================
// GET /api/metricas/solicitudes
// Query: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// ============================================================
export const metricasSolicitudes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { desde, hasta } = req.query as { desde?: string; hasta?: string };

    const where: Record<string, unknown> = { activo: true };

    if (desde || hasta) {
      const fechaFiltro: Record<string, Date> = {};
      if (desde) fechaFiltro.gte = new Date(desde);
      if (hasta) {
        // Incluir todo el día "hasta"
        const d = new Date(hasta);
        d.setHours(23, 59, 59, 999);
        fechaFiltro.lte = d;
      }
      where.createdAt = fechaFiltro;
    }

    // Total de solicitudes
    const totalSolicitudes = await prisma.ticket.count({ where });

    // Por categoría
    const porCategoriaRaw = await prisma.ticket.groupBy({
      by: ["categoria"],
      where,
      _count: { _all: true },
      orderBy: { _count: { categoria: "desc" } },
    });
    const porCategoria = porCategoriaRaw.map((r) => ({
      categoria: r.categoria as string,
      total: r._count._all,
    }));

    // Por subcategoría + subTipo (raw SQL para manejar nullable subTipo)
    type SubcatRow = { subcategoria: string; sub_tipo: string | null; total: bigint };
    const fechaFiltro = where.createdAt as Record<string, Date> | undefined;
    const porSubcategoriaRaw = await prisma.$queryRaw<SubcatRow[]>`
      SELECT subcategoria, sub_tipo, COUNT(*) AS total
      FROM tickets
      WHERE activo = true
        AND (${fechaFiltro?.gte ?? null} IS NULL OR created_at >= ${fechaFiltro?.gte ?? null})
        AND (${fechaFiltro?.lte ?? null} IS NULL OR created_at <= ${fechaFiltro?.lte ?? null})
      GROUP BY subcategoria, sub_tipo
      ORDER BY total DESC
    `;
    const porSubcategoria = porSubcategoriaRaw.map((r) => ({
      subcategoria: r.subcategoria,
      subTipo: r.sub_tipo ?? null,
      total: Number(r.total),
    }));

    // Por estado
    const porEstadoRaw = await prisma.ticket.groupBy({
      by: ["estado"],
      where,
      _count: { _all: true },
      orderBy: { _count: { estado: "desc" } },
    });
    const porEstado = porEstadoRaw.map((r) => ({
      estado: r.estado as string,
      total: r._count._all,
    }));

    // Por piso
    const porPisoRaw = await prisma.ticket.groupBy({
      by: ["piso"],
      where,
      _count: { _all: true },
      orderBy: { _count: { piso: "desc" } },
    });
    const porPiso = porPisoRaw.map((r) => ({
      piso: r.piso as string,
      total: r._count._all,
    }));

    const response: MetricasSolicitudesResponse = {
      totalSolicitudes,
      porCategoria,
      porSubcategoria,
      porEstado,
      porPiso,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/metricas/tecnicos
// ============================================================
export const metricasTecnicos = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Obtener todos los técnicos activos
    const rolesMetricas = ["TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS"] as unknown as Rol[];
    const tecnicos = await prisma.usuario.findMany({
      where: { activo: true, rol: { in: rolesMetricas } },
      select: { id: true, nombre: true, apellidos: true, rol: true },
    });

    const resultado: MetricaTecnico[] = [];

    for (const tecnico of tecnicos) {
      // Pasos asignados a este técnico
      const pasosAsignados = await prisma.pasoTicket.count({
        where: { tecnicoId: tecnico.id },
      });

      // Pasos completados
      const pasosCompletados = await prisma.pasoTicket.count({
        where: { tecnicoId: tecnico.id, estado: "COMPLETADO" },
      });

      // Unidades atendidas (suma de cantidadUnidades en pasos completados)
      const unidadesAgg = await prisma.pasoTicket.aggregate({
        where: { tecnicoId: tecnico.id, estado: "COMPLETADO" },
        _sum: { cantidadUnidades: true },
      });

      // Tiempo promedio de completado (horas entre createdAt y completadoAt)
      const pasosConFecha = await prisma.pasoTicket.findMany({
        where: { tecnicoId: tecnico.id, estado: "COMPLETADO", completadoAt: { not: null } },
        select: { createdAt: true, completadoAt: true },
      });

      let tiempoPromedioCompletadoHoras: number | null = null;
      if (pasosConFecha.length > 0) {
        const totalMs = pasosConFecha.reduce((acc: number, p: { createdAt: Date; completadoAt: Date | null }) => {
          return acc + (p.completadoAt!.getTime() - p.createdAt.getTime());
        }, 0);
        tiempoPromedioCompletadoHoras =
          Math.round((totalMs / pasosConFecha.length / 1000 / 3600) * 100) / 100;
      }

      resultado.push({
        tecnico: { id: tecnico.id, nombre: tecnico.nombre, apellidos: tecnico.apellidos, rol: tecnico.rol },
        totalPasosAsignados: pasosAsignados,
        totalPasosCompletados: pasosCompletados,
        unidadesAtendidas: unidadesAgg._sum.cantidadUnidades ?? 0,
        tiempoPromedioCompletadoHoras,
      });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/metricas/procesos
// ============================================================
export const metricasProcesos = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // SLA configurable — por defecto 24 h
    const slaHoras = Number(req.query.slaHoras ?? 24);
    const slaMs = slaHoras * 3600 * 1000;

    // Agrupar por subcategoria + sub_tipo via raw SQL (nullable sub_tipo)
    type GrupoRow = { subcategoria: string; sub_tipo: string | null; total: bigint };
    const grupos = await prisma.$queryRaw<GrupoRow[]>`
      SELECT subcategoria, sub_tipo, COUNT(*) AS total
      FROM tickets WHERE activo = true
      GROUP BY subcategoria, sub_tipo
    `;

    const resultado: MetricaProceso[] = [];

    for (const grupo of grupos) {
      const key = getProcesoKey(grupo.subcategoria, grupo.sub_tipo);
      const procesoInfo = PROCESO_MAP[key];

      // Tickets de este grupo que están resueltos
      const ticketsResueltos = await prisma.ticket.findMany({
        where: {
          activo: true,
          subcategoria: grupo.subcategoria as never,
          subTipo: grupo.sub_tipo ?? null,
          estado: "RESUELTO",
          fechaResolucion: { not: null },
        },
        select: { createdAt: true, fechaResolucion: true },
      });

      let resueltasATiempo = 0;
      let totalMs = 0;
      for (const t of ticketsResueltos) {
        const diff = t.fechaResolucion!.getTime() - t.createdAt.getTime();
        totalMs += diff;
        if (diff <= slaMs) resueltasATiempo++;
      }

      const tiempoPromedioHoras =
        ticketsResueltos.length > 0
          ? Math.round((totalMs / ticketsResueltos.length / 1000 / 3600) * 100) / 100
          : null;

      // Suma de unidades atendidas en pasos de tickets de este grupo
      const unidadesAgg = await prisma.pasoTicket.aggregate({
        where: {
          ticket: {
            subcategoria: grupo.subcategoria as never,
            subTipo: grupo.sub_tipo ?? null,
            activo: true,
          },
          estado: "COMPLETADO",
        },
        _sum: { cantidadUnidades: true },
      });

      resultado.push({
        proceso: key,
        nombre: procesoInfo?.nombre ?? key,
        totalSolicitudes: Number(grupo.total),
        resueltasATiempo,
        tiempoPromedioHoras,
        unidadesAtendidas: unidadesAgg._sum.cantidadUnidades ?? 0,
      });
    }

    // Ordenar por totalSolicitudes desc
    resultado.sort((a, b) => b.totalSolicitudes - a.totalSolicitudes);

    res.json(resultado);
  } catch (err) {
    next(err);
  }
};
