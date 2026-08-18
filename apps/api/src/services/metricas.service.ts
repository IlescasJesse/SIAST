import { prisma } from "../config/database.js";
import { Prisma, Rol, SubcategoriaTicket } from "@prisma/client";
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
type DateField = "createdAt" | "fechaResolucion";
function buildDateWhere(
  fechaInicio?: Date,
  fechaFin?: Date,
  field: DateField = "createdAt",
): Record<string, { gte?: Date; lte?: Date }> {
  if (!fechaInicio && !fechaFin) return {};
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (fechaInicio) dateFilter.gte = fechaInicio;
  if (fechaFin) {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);
    dateFilter.lte = fin;
  }
  return { [field]: dateFilter };
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
  const joinClause = areaId ? Prisma.sql`LEFT JOIN usuarios u ON t.tecnicoId = u.id` : Prisma.empty;
  const areaFilter = areaId
    ? Prisma.sql`AND (u.area_soporte_id = ${areaId} OR t.tecnicoId IS NULL)`
    : Prisma.empty;

  // Creados: agrupados por createdAt
  type CreadosRow = { dia: string; total: bigint };
  const creadosRows = await prisma.$queryRaw<CreadosRow[]>`
    SELECT DATE(t.createdAt) AS dia, COUNT(*) AS total
    FROM tickets t
    ${joinClause}
    WHERE t.activo = true
      AND t.createdAt >= ${fechaInicio}
      AND t.createdAt <= ${fechaFin}
      ${areaFilter}
    GROUP BY DATE(t.createdAt)
  `;

  // Resueltos: agrupados por createdAt (para consistencia con demás queries)
  type ResueltosRow = { dia: string; total: bigint };
  const resueltosRows = await prisma.$queryRaw<ResueltosRow[]>`
    SELECT DATE(t.createdAt) AS dia, COUNT(*) AS total
    FROM tickets t
    ${joinClause}
    WHERE t.activo = true
      AND t.estado = 'RESUELTO'
      AND t.createdAt >= ${fechaInicio}
      AND t.createdAt <= ${fechaFin}
      ${areaFilter}
    GROUP BY DATE(t.createdAt)
  `;

  // Merge en mapa por día
  const map = new Map<string, { creados: number; resueltos: number }>();
  for (const r of creadosRows) {
    const dia = String(r.dia);
    map.set(dia, { creados: Number(r.total), resueltos: 0 });
  }
  for (const r of resueltosRows) {
    const dia = String(r.dia);
    const existing = map.get(dia);
    if (existing) {
      existing.resueltos = Number(r.total);
    } else {
      map.set(dia, { creados: 0, resueltos: Number(r.total) });
    }
  }

  // Ordenar por día
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => ({ dia, creados: v.creados, resueltos: v.resueltos }));
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
  const resolucionWhere = buildDateWhere(fechaInicio, fechaFin, "fechaResolucion");
  const baseWhere = { activo: true, ...dateWhere };

  const fInicio = fechaInicio ?? new Date(Date.now() - 30 * 86_400_000);
  const fFin = (() => {
    const d = fechaFin ?? new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  })();

  const [
    totalTickets,
    ticketsActivos,
    ticketsResueltos,
    ticketsSinAsignar,
    slaGlobal,
    tiempoPromedioHoras,
  ] = await Promise.all([
    prisma.ticket.count({ where: baseWhere }),
    prisma.ticket.count({
      where: { activo: true, estado: { notIn: ["RESUELTO", "CANCELADO"] } },
    }),
    prisma.ticket.count({
      where: { ...baseWhere, estado: "RESUELTO" },
    }),
    prisma.ticket.count({
      where: { activo: true, tecnicoId: null },
    }),
    calcularSLA({ activo: true, ...resolucionWhere }),
    calcularTiempoPromedio({ activo: true, ...resolucionWhere }),
  ]);

  // Tendencia diaria
  const tendenciaDiaria = await calcularTendencia(fInicio, fFin);

  // Distribución por categoría (todos los activos, sin filtro temporal)
  const catRaw = await prisma.ticket.groupBy({
    by: ["categoria"],
    where: { activo: true },
    _count: { _all: true },
  });
  const distribucionCategoria: DistribucionCategoria[] = catRaw.map((r) => ({
    categoria: r.categoria as string,
    total: r._count._all,
  }));

  // Distribución por estado
  const estadoRaw = await prisma.ticket.groupBy({
    by: ["estado"],
    where: { activo: true },
    _count: { _all: true },
  });
  const distribucionEstado: DistribucionCategoria[] = estadoRaw.map((r) => ({
    categoria: r.estado as string,
    total: r._count._all,
  }));

  // Comparativo por área: join tickets → tecnico → areaSoporte
  const areas = await prisma.areaSoporte.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, subcategorias: true },
  });
  const comparativoPorArea = await Promise.all(
    areas.map(async (a) => {
      // Total: tickets creados en el período
      type TotalRow = { total: bigint };
      const totalRows = await prisma.$queryRaw<TotalRow[]>`
        SELECT COUNT(*) AS total
        FROM tickets t
        JOIN usuarios u ON t.tecnicoId = u.id
        WHERE t.activo = true
          AND u.area_soporte_id = ${a.id}
          ${dateWhere.createdAt?.gte ? Prisma.sql`AND t.createdAt >= ${dateWhere.createdAt.gte}` : Prisma.empty}
          ${dateWhere.createdAt?.lte ? Prisma.sql`AND t.createdAt <= ${dateWhere.createdAt.lte}` : Prisma.empty}
      `;
      // Resueltos: tickets creados en el período que están resueltos
      type ResueltoRow = { total: bigint };
      const resueltosRows = await prisma.$queryRaw<ResueltoRow[]>`
        SELECT COUNT(*) AS total
        FROM tickets t
        JOIN usuarios u ON t.tecnicoId = u.id
        WHERE t.activo = true
          AND t.estado = 'RESUELTO'
          AND u.area_soporte_id = ${a.id}
          ${dateWhere.createdAt?.gte ? Prisma.sql`AND t.createdAt >= ${dateWhere.createdAt.gte}` : Prisma.empty}
          ${dateWhere.createdAt?.lte ? Prisma.sql`AND t.createdAt <= ${dateWhere.createdAt.lte}` : Prisma.empty}
      `;
      // El JSON del área puede traer strings que no estén en el enum — filtrar protege la query
      const subcategoriasArea = ((a.subcategorias as string[]) ?? []).filter(
        (s): s is SubcategoriaTicket => s in SubcategoriaTicket,
      );
      const sinAsignar = await prisma.ticket.count({
        where: {
          activo: true,
          tecnicoId: null,
          subcategoria: { in: subcategoriasArea },
          ...dateWhere,
        },
      });
      return {
        areaNombre: a.nombre,
        areaSoporteId: a.id,
        total: Number(totalRows[0]?.total ?? 0),
        resueltos: Number(resueltosRows[0]?.total ?? 0),
        sinAsignar,
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
        ...resolucionWhere,
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
    ticketsSinAsignar,
    slaGlobal,
    tiempoPromedioHoras,
    tendenciaDiaria,
    distribucionCategoria,
    distribucionEstado,
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
  const resolucionWhere = buildDateWhere(fechaInicio, fechaFin, "fechaResolucion");

  const fInicio = fechaInicio ?? new Date(Date.now() - 30 * 86_400_000);
  const fFin = (() => {
    const d = fechaFin ?? new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  })();

  const area = await prisma.areaSoporte.findUnique({
    where: { id: areaId },
    select: { nombre: true, subcategorias: true },
  });

  const subcategoriasArea = (area?.subcategorias as SubcategoriaTicket[]) ?? [];
  const sinAsignarWhere = {
    activo: true,
    tecnicoId: null,
    subcategoria: { in: subcategoriasArea },
    ...dateWhere,
  };
  const areaResueltoWhere = {
    activo: true,
    ...resolucionWhere,
    tecnico: { areaSoporteId: areaId },
  };

  const [ticketsActivos, ticketsSinAsignar, slaGlobal, tiempoPromedioHoras] = await Promise.all([
    prisma.ticket.count({
      where: {
        activo: true,
        estado: { notIn: ["RESUELTO", "CANCELADO"] },
        tecnico: { areaSoporteId: areaId },
      },
    }),
    prisma.ticket.count({ where: sinAsignarWhere }),
    calcularSLA(areaResueltoWhere),
    calcularTiempoPromedio(areaResueltoWhere),
  ]);

  // Tickets reabiertos: transiciones a ABIERTO desde RESUELTO/CANCELADO
  type ReabiertosRow = { total: bigint };
  const reabiertosRows = await prisma.$queryRaw<ReabiertosRow[]>`
    SELECT COUNT(DISTINCT ht.ticketId) AS total
    FROM historial_tickets ht
    JOIN tickets t ON ht.ticketId = t.id
    JOIN usuarios u ON t.tecnicoId = u.id
    WHERE t.activo = true
      AND u.area_soporte_id = ${areaId}
      AND ht.estadoNuevo = 'ABIERTO'
      AND ht.estadoAnterior IN ('RESUELTO', 'CANCELADO')
  `;
  const ticketsReabiertos = Number(reabiertosRows[0]?.total ?? 0);

  // Tendencia, distribución subcategoría
  const [tendenciaDiaria, subCatRaw, estadoAreaRaw] = await Promise.all([
    calcularTendencia(fInicio, fFin, areaId),
    prisma.ticket.groupBy({
      by: ["subcategoria"],
      where: { activo: true, subcategoria: { in: subcategoriasArea } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["estado"],
      where: { activo: true, subcategoria: { in: subcategoriasArea } },
      _count: { _all: true },
    }),
  ]);

  const distribucionEstado: DistribucionCategoria[] = estadoAreaRaw.map((r) => ({
    categoria: r.estado as string,
    total: r._count._all,
  }));

  const distribucionSubcategoria: DistribucionCategoria[] = subCatRaw.map((r) => ({
    categoria: r.subcategoria as string,
    total: r._count._all,
  }));

  // Técnicos del área (excluir roles no técnicos)
  const rolesNoTecnico: Rol[] = [
    Rol.RESPONSABLE_TI,
    Rol.RESPONSABLE_SISTEMAS,
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
          where: {
            tecnicoId: t.id,
            activo: true,
            estado: "RESUELTO",
            fechaResolucion: { not: null },
            ...resolucionWhere,
          },
        }),
      })),
    ),
    Promise.all(
      tecnicos.map(async (t): Promise<RendimientoTecnico> => {
        const tecWhereCreated = { tecnicoId: t.id, activo: true, ...dateWhere };
        const tecWhereResuelto = { tecnicoId: t.id, activo: true, ...resolucionWhere };
        const [activos, completados, cancelados, tiempo, primeraResp] = await Promise.all([
          prisma.ticket.count({
            where: { tecnicoId: t.id, activo: true, estado: { notIn: ["RESUELTO", "CANCELADO"] } },
          }),
          prisma.ticket.count({ where: { ...tecWhereResuelto, estado: "RESUELTO" } }),
          prisma.ticket.count({ where: { ...tecWhereCreated, estado: "CANCELADO" } }),
          calcularTiempoPromedio(tecWhereResuelto),
          calcularTiemprimeraRespuesta(t.id, tecWhereCreated),
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
    ticketsSinAsignar,
    tiempoPromedioHoras,
    slaGlobal,
    ticketsReabiertos,
    tendenciaDiaria,
    distribucionSubcategoria,
    distribucionEstado,
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
  const resolucionWhere = buildDateWhere(fechaInicio, fechaFin, "fechaResolucion");
  const tecWhere = { tecnicoId, activo: true, ...dateWhere };
  const tecResueltoWhere = { tecnicoId, activo: true, ...resolucionWhere };

  const fInicio = fechaInicio ?? new Date(Date.now() - 30 * 86_400_000);
  const fFin = (() => {
    const d = fechaFin ?? new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  })();

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

  const [
    ticketsCompletados,
    cancelados,
    tiempoPromedioHoras,
    tiemprimeraRespuestaHoras,
    estadoTecRaw,
  ] = await Promise.all([
    prisma.ticket.count({ where: { ...tecResueltoWhere, estado: "RESUELTO" } }),
    prisma.ticket.count({ where: { ...tecWhere, estado: "CANCELADO" } }),
    calcularTiempoPromedio(tecResueltoWhere),
    calcularTiemprimeraRespuesta(tecnicoId, tecWhere),
    prisma.ticket.groupBy({
      by: ["estado"],
      where: { activo: true, tecnicoId },
      _count: { _all: true },
    }),
  ]);

  const distribucionEstado: DistribucionCategoria[] = estadoTecRaw.map((r) => ({
    categoria: r.estado as string,
    total: r._count._all,
  }));

  const ratioResueltosCancelados =
    ticketsCompletados + cancelados > 0
      ? Math.round((ticketsCompletados / (ticketsCompletados + cancelados)) * 100) / 100
      : null;

  // Tendencia productividad personal (por fechaResolucion)
  type ProdRow = { dia: string; completados: bigint };
  const prodRows = await prisma.$queryRaw<ProdRow[]>`
    SELECT DATE(fechaResolucion) AS dia, COUNT(*) AS completados
    FROM tickets
    WHERE activo = true AND tecnicoId = ${tecnicoId} AND estado = 'RESUELTO'
      AND fechaResolucion IS NOT NULL
      AND fechaResolucion >= ${fInicio} AND fechaResolucion <= ${fFin}
    GROUP BY DATE(fechaResolucion) ORDER BY dia ASC
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
        ...resolucionWhere,
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
    distribucionEstado,
  };
}
