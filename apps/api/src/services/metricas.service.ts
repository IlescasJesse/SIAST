import { prisma } from "../config/database.js";
import { Prisma, Rol } from "@prisma/client";
import type {
  MetricasGlobalResponse,
  MetricasPorAreaResponse,
  MetricasPorTecnicoResponse,
  TendenciaDia,
  EficienciaResponsable,
  RendimientoTecnico,
  DistribucionCategoria,
} from "@stf/shared";

// ── Constantes SLA (D-02) ─────────────────────────────────────────────────────
const SLA_HORAS: Record<string, number> = {
  TECNOLOGIAS: 24,
  SERVICIOS: 48,
  RECURSOS_MATERIALES: 72,
};

// ── Helper: construir where con rango de fechas ───────────────────────────────
function buildDateWhere(fechaInicio?: Date, fechaFin?: Date): { createdAt?: { gte?: Date; lte?: Date } } {
  if (!fechaInicio && !fechaFin) return {};
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (fechaInicio) createdAt.gte = fechaInicio;
  if (fechaFin) {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);
    createdAt.lte = fin;
  }
  return { createdAt };
}

// ── Helper: calcular SLA % ────────────────────────────────────────────────────
async function calcularSLA(where: Record<string, unknown>): Promise<number | null> {
  const resueltos = await prisma.ticket.findMany({
    where: { ...where, estado: "RESUELTO", fechaResolucion: { not: null }, activo: true },
    select: { categoria: true, createdAt: true, fechaResolucion: true },
  });
  if (resueltos.length === 0) return null; // null = sin datos, 0 = todos incumplidos
  let cumplieron = 0;
  for (const t of resueltos) {
    const metaMs = (SLA_HORAS[t.categoria as string] ?? 24) * 3_600_000;
    const diff = t.fechaResolucion!.getTime() - t.createdAt.getTime();
    if (diff <= metaMs) cumplieron++;
  }
  return Math.round((cumplieron / resueltos.length) * 100);
}

// ── Helper: tendencia diaria via $queryRaw ────────────────────────────────────
// CRÍTICO: bigint → Number antes de retornar (pitfall 1 del RESEARCH)
async function calcularTendencia(
  fechaInicio: Date,
  fechaFin: Date,
  areaId?: number,
): Promise<TendenciaDia[]> {
  type DayRow = { dia: string; creados: bigint; resueltos: bigint };
  const rows = await prisma.$queryRaw<DayRow[]>`
    SELECT
      DATE(t.created_at) AS dia,
      COUNT(*) AS creados,
      SUM(CASE WHEN t.estado = 'RESUELTO' THEN 1 ELSE 0 END) AS resueltos
    FROM tickets t
    ${
      areaId
        ? Prisma.sql`LEFT JOIN usuarios u ON t.tecnico_id = u.id`
        : Prisma.empty
    }
    WHERE t.activo = true
      AND t.created_at >= ${fechaInicio}
      AND t.created_at <= ${fechaFin}
      ${areaId ? Prisma.sql`AND (u.area_soporte_id = ${areaId} OR t.tecnico_id IS NULL)` : Prisma.empty}
    GROUP BY DATE(t.created_at)
    ORDER BY dia ASC
  `;
  return rows.map((r) => ({
    dia: String(r.dia),
    creados: Number(r.creados),
    resueltos: Number(r.resueltos),
  }));
}

// ── Helper: tiempo promedio resolución (horas) ────────────────────────────────
async function calcularTiempoPromedio(where: Record<string, unknown>): Promise<number | null> {
  const tickets = await prisma.ticket.findMany({
    where: { ...where, estado: "RESUELTO", fechaResolucion: { not: null }, activo: true },
    select: { createdAt: true, fechaResolucion: true },
  });
  if (tickets.length === 0) return null;
  const totalMs = tickets.reduce(
    (acc, t) => acc + (t.fechaResolucion!.getTime() - t.createdAt.getTime()),
    0,
  );
  return Math.round((totalMs / tickets.length / 3_600_000) * 100) / 100;
}

// ── Helper: tiempo primera respuesta del técnico (D-04) ───────────────────────
// Proxy: primera transición a EN_PROGRESO en HistorialTicket del técnico
async function calcularTiemprimeraRespuesta(
  tecnicoId: number,
  where: Record<string, unknown>,
): Promise<number | null> {
  const tickets = await prisma.ticket.findMany({
    where: { ...where, tecnicoId, fechaAsignacion: { not: null }, activo: true },
    select: {
      id: true,
      fechaAsignacion: true,
      historial: {
        where: { estadoNuevo: "EN_PROGRESO", usuarioId: tecnicoId },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  const tiempos = tickets
    .filter((t) => t.historial.length > 0)
    .map((t) => t.historial[0].createdAt.getTime() - t.fechaAsignacion!.getTime());
  if (tiempos.length === 0) return null;
  const avgMs = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  return Math.round((avgMs / 3_600_000) * 100) / 100;
}

// ── Función pública: Tab Global (ADMIN) ───────────────────────────────────────
export async function obtenerMetricasGlobal(
  fechaInicio?: Date,
  fechaFin?: Date,
): Promise<MetricasGlobalResponse> {
  const dateWhere = buildDateWhere(fechaInicio, fechaFin);
  const baseWhere = { activo: true, ...dateWhere };

  const fInicio = fechaInicio ?? new Date(Date.now() - 30 * 86_400_000);
  const fFin = fechaFin ?? new Date();

  const [totalTickets, ticketsActivos, ticketsResueltos, slaGlobal, tiempoPromedioHoras] =
    await Promise.all([
      prisma.ticket.count({ where: baseWhere }),
      prisma.ticket.count({
        where: { activo: true, estado: { notIn: ["RESUELTO", "CANCELADO"] } },
      }),
      prisma.ticket.count({ where: { ...baseWhere, estado: "RESUELTO" } }),
      calcularSLA(baseWhere),
      calcularTiempoPromedio(baseWhere),
    ]);

  // Tendencia diaria
  const tendenciaDiaria = await calcularTendencia(fInicio, fFin);

  // Distribución por categoría
  const catRaw = await prisma.ticket.groupBy({
    by: ["categoria"],
    where: baseWhere,
    _count: { _all: true },
  });
  const distribucionCategoria: DistribucionCategoria[] = catRaw.map((r) => ({
    categoria: r.categoria as string,
    total: r._count._all,
  }));

  // Comparativo por área: join tickets → tecnico → areaSoporte
  const areas = await prisma.areaSoporte.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
  });
  const comparativoPorArea = await Promise.all(
    areas.map(async (a) => {
      type AreaRow = { total: bigint; resueltos: bigint };
      const rows = await prisma.$queryRaw<AreaRow[]>`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN t.estado = 'RESUELTO' THEN 1 ELSE 0 END) AS resueltos
        FROM tickets t
        JOIN usuarios u ON t.tecnico_id = u.id
        WHERE t.activo = true
          AND u.area_soporte_id = ${a.id}
          ${dateWhere.createdAt?.gte ? Prisma.sql`AND t.created_at >= ${dateWhere.createdAt.gte}` : Prisma.empty}
          ${dateWhere.createdAt?.lte ? Prisma.sql`AND t.created_at <= ${dateWhere.createdAt.lte}` : Prisma.empty}
      `;
      const row = rows[0];
      return {
        areaNombre: a.nombre,
        areaSoporteId: a.id,
        total: Number(row?.total ?? 0),
        resueltos: Number(row?.resueltos ?? 0),
      };
    }),
  );

  // Tabla eficiencia responsables
  const responsables = await prisma.usuario.findMany({
    where: {
      activo: true,
      rol: {
        in: [
          Rol.RESPONSABLE_TI,
          Rol.RESPONSABLE_REDES,
          Rol.RESPONSABLE_MANTENIMIENTO,
          Rol.RESPONSABLE_RECURSOS_MATERIALES,
        ],
      },
      areaSoporteId: { not: null },
    },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      areaSoporteId: true,
      areaSoporte: { select: { nombre: true } },
    },
  });
  const eficienciaResponsables: EficienciaResponsable[] = await Promise.all(
    responsables.map(async (r) => {
      const areaWhere = {
        activo: true,
        ...dateWhere,
        tecnico: { areaSoporteId: r.areaSoporteId! },
      };
      const [resueltos, sla, tiempo] = await Promise.all([
        prisma.ticket.count({ where: { ...areaWhere, estado: "RESUELTO" } }),
        calcularSLA(areaWhere),
        calcularTiempoPromedio(areaWhere),
      ]);
      return {
        id: r.id,
        nombre: r.nombre,
        apellidos: r.apellidos,
        areaNombre: r.areaSoporte?.nombre ?? "",
        areaSoporteId: r.areaSoporteId!,
        ticketsResueltos: resueltos,
        tiempoPromedioHoras: tiempo,
        slaGlobal: sla,
      };
    }),
  );

  return {
    tipo: "area",
    totalTickets,
    ticketsActivos,
    ticketsResueltos,
    slaGlobal,
    tiempoPromedioHoras,
    tendenciaDiaria,
    distribucionCategoria,
    comparativoPorArea,
    eficienciaResponsables,
  };
}

// ── Función pública: Tab Por Responsable ──────────────────────────────────────
export async function obtenerMetricasPorArea(
  areaId: number,
  fechaInicio?: Date,
  fechaFin?: Date,
): Promise<MetricasPorAreaResponse> {
  const dateWhere = buildDateWhere(fechaInicio, fechaFin);
  const areaWhere = { activo: true, ...dateWhere, tecnico: { areaSoporteId: areaId } };

  const fInicio = fechaInicio ?? new Date(Date.now() - 30 * 86_400_000);
  const fFin = fechaFin ?? new Date();

  const area = await prisma.areaSoporte.findUnique({
    where: { id: areaId },
    select: { nombre: true },
  });

  const [ticketsActivos, slaGlobal, tiempoPromedioHoras] = await Promise.all([
    prisma.ticket.count({
      where: {
        activo: true,
        estado: { notIn: ["RESUELTO", "CANCELADO"] },
        tecnico: { areaSoporteId: areaId },
      },
    }),
    calcularSLA(areaWhere),
    calcularTiempoPromedio(areaWhere),
  ]);

  // Tickets reabiertos: transiciones a ABIERTO desde RESUELTO/CANCELADO
  type ReabiertosRow = { total: bigint };
  const reabiertosRows = await prisma.$queryRaw<ReabiertosRow[]>`
    SELECT COUNT(DISTINCT ht.ticket_id) AS total
    FROM historial_tickets ht
    JOIN tickets t ON ht.ticket_id = t.id
    JOIN usuarios u ON t.tecnico_id = u.id
    WHERE t.activo = true
      AND u.area_soporte_id = ${areaId}
      AND ht.estado_nuevo = 'ABIERTO'
      AND ht.estado_anterior IN ('RESUELTO', 'CANCELADO')
  `;
  const ticketsReabiertos = Number(reabiertosRows[0]?.total ?? 0);

  // Tendencia, distribución subcategoría
  const [tendenciaDiaria, subCatRaw] = await Promise.all([
    calcularTendencia(fInicio, fFin, areaId),
    prisma.ticket.groupBy({
      by: ["subcategoria"],
      where: areaWhere,
      _count: { _all: true },
    }),
  ]);

  const distribucionSubcategoria: DistribucionCategoria[] = subCatRaw.map((r) => ({
    categoria: r.subcategoria as string,
    total: r._count._all,
  }));

  // Técnicos del área (excluir roles no técnicos)
  const rolesNoTecnico: Rol[] = [
    Rol.RESPONSABLE_TI,
    Rol.RESPONSABLE_REDES,
    Rol.RESPONSABLE_MANTENIMIENTO,
    Rol.RESPONSABLE_RECURSOS_MATERIALES,
    Rol.ADMIN,
    Rol.MESA_AYUDA,
    Rol.EMPLEADO,
    Rol.GESTOR_RECURSOS_MATERIALES,
    Rol.GESTOR_SALAS_JUNTA,
    Rol.GESTOR_RECURSOS,
    Rol.GESTOR_INVENTARIO,
  ];
  const tecnicos = await prisma.usuario.findMany({
    where: { activo: true, areaSoporteId: areaId, rol: { notIn: rolesNoTecnico } },
    select: { id: true, nombre: true, apellidos: true, rol: true },
  });

  const [cargaTecnicos, rendimientoTecnicos] = await Promise.all([
    Promise.all(
      tecnicos.map(async (t) => ({
        tecnicoNombre: `${t.nombre} ${t.apellidos}`,
        tecnicoId: t.id,
        activos: await prisma.ticket.count({
          where: { tecnicoId: t.id, activo: true, estado: { notIn: ["RESUELTO", "CANCELADO"] } },
        }),
        completados: await prisma.ticket.count({
          where: { tecnicoId: t.id, activo: true, estado: "RESUELTO", ...dateWhere },
        }),
      })),
    ),
    Promise.all(
      tecnicos.map(async (t): Promise<RendimientoTecnico> => {
        const tecWhere = { tecnicoId: t.id, activo: true, ...dateWhere };
        const [activos, completados, cancelados, tiempo, primeraResp] = await Promise.all([
          prisma.ticket.count({
            where: { tecnicoId: t.id, activo: true, estado: { notIn: ["RESUELTO", "CANCELADO"] } },
          }),
          prisma.ticket.count({ where: { ...tecWhere, estado: "RESUELTO" } }),
          prisma.ticket.count({ where: { ...tecWhere, estado: "CANCELADO" } }),
          calcularTiempoPromedio(tecWhere),
          calcularTiemprimeraRespuesta(t.id, tecWhere),
        ]);
        return {
          id: t.id,
          nombre: t.nombre,
          apellidos: t.apellidos,
          rol: t.rol as string,
          ticketsActivos: activos,
          ticketsCompletados: completados,
          tiempoPromedioHoras: tiempo,
          tiemprimeraRespuestaHoras: primeraResp,
          ratioResueltosCancelados:
            completados + cancelados > 0
              ? Math.round((completados / (completados + cancelados)) * 100) / 100
              : null,
        };
      }),
    ),
  ]);

  return {
    tipo: "tecnico",
    areaId,
    areaNombre: area?.nombre ?? "",
    ticketsActivos,
    tiempoPromedioHoras,
    slaGlobal,
    ticketsReabiertos,
    tendenciaDiaria,
    distribucionSubcategoria,
    cargaTecnicos,
    rendimientoTecnicos,
  };
}

// ── Función pública: Tab Por Técnico ─────────────────────────────────────────
export async function obtenerMetricasPorTecnico(
  tecnicoId: number,
  fechaInicio?: Date,
  fechaFin?: Date,
): Promise<MetricasPorTecnicoResponse> {
  const dateWhere = buildDateWhere(fechaInicio, fechaFin);
  const tecWhere = { tecnicoId, activo: true, ...dateWhere };

  const fInicio = fechaInicio ?? new Date(Date.now() - 30 * 86_400_000);
  const fFin = fechaFin ?? new Date();

  const ROLES_TECNICOS_VALIDOS = [
    "TECNICO_TI",
    "TECNICO_REDES",
    "TECNICO_ELECTRICISTA",
    "TECNICO_PLOMERO",
    "TECNICO_MOVILIDAD",
  ];

  const tecnico = await prisma.usuario.findUnique({
    where: { id: tecnicoId },
    select: { nombre: true, apellidos: true, areaSoporteId: true, activo: true, rol: true },
  });

  if (!tecnico || !tecnico.activo) {
    throw Object.assign(new Error("Técnico no encontrado"), { status: 404 });
  }
  if (!ROLES_TECNICOS_VALIDOS.includes(tecnico.rol)) {
    throw Object.assign(new Error("El usuario no es un técnico"), { status: 400 });
  }

  const [ticketsCompletados, cancelados, tiempoPromedioHoras, tiemprimeraRespuestaHoras] =
    await Promise.all([
      prisma.ticket.count({ where: { ...tecWhere, estado: "RESUELTO" } }),
      prisma.ticket.count({ where: { ...tecWhere, estado: "CANCELADO" } }),
      calcularTiempoPromedio(tecWhere),
      calcularTiemprimeraRespuesta(tecnicoId, tecWhere),
    ]);

  const ratioResueltosCancelados =
    ticketsCompletados + cancelados > 0
      ? Math.round((ticketsCompletados / (ticketsCompletados + cancelados)) * 100) / 100
      : null;

  // Tendencia productividad personal
  type ProdRow = { dia: string; completados: bigint };
  const prodRows = await prisma.$queryRaw<ProdRow[]>`
    SELECT DATE(created_at) AS dia, COUNT(*) AS completados
    FROM tickets
    WHERE activo = true AND tecnico_id = ${tecnicoId} AND estado = 'RESUELTO'
      AND created_at >= ${fInicio} AND created_at <= ${fFin}
    GROUP BY DATE(created_at) ORDER BY dia ASC
  `;
  const tendenciaProductividad: TendenciaDia[] = prodRows.map((r) => ({
    dia: String(r.dia),
    creados: 0,
    resueltos: Number(r.completados),
  }));

  // Comparativa vs promedio del área
  const promedioAreaHoras = tecnico?.areaSoporteId
    ? await calcularTiempoPromedio({
        activo: true,
        ...dateWhere,
        tecnico: { areaSoporteId: tecnico.areaSoporteId },
      })
    : null;
  const comparativaVsArea = [
    {
      label: "Tiempo promedio resolución (h)",
      tecnico: tiempoPromedioHoras ?? 0,
      promedioArea: promedioAreaHoras ?? 0,
    },
  ];

  // Distribución resueltos / cancelados para pastel
  const distribucionResultado = [
    { name: "Resueltos", value: ticketsCompletados, color: "#9e9e9e" },
    { name: "Cancelados", value: cancelados, color: "#bdbdbd" },
  ];

  return {
    tipo: "proceso",
    tecnicoId,
    tecnicoNombre: tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : String(tecnicoId),
    ticketsCompletados,
    tiempoPromedioHoras,
    tiemprimeraRespuestaHoras,
    ratioResueltosCancelados,
    tendenciaProductividad,
    comparativaVsArea,
    distribucionResultado,
  };
}
