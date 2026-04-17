import type { Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";

// ============================================================
// Schemas de validación
// ============================================================

const CatalogoCreateSchema = z.object({
  nombre: z.string().min(2).max(150),
  descripcion: z.string().optional(),
  tipo: z.enum(["TECNOLOGICO", "INMOBILIARIO"]),
  marca: z.string().optional(),
  capacidad: z.number().int().positive().optional(),
});

const CatalogoUpdateSchema = CatalogoCreateSchema.partial();

const UnidadCreateSchema = z.object({
  numSerie: z.string().optional(),
  // codigoInventario: z.string().optional(), // SICIPO — pendiente
  piso: z.enum(["PB", "NIVEL_1", "NIVEL_2", "NIVEL_3"]).optional(),
  areaId: z.string().optional(),
  disponible: z.boolean().optional().default(true),
});

const UnidadUpdateSchema = UnidadCreateSchema.partial();

const AsignacionCreateSchema = z.object({
  unidadId: z.number().int(),
  ticketId: z.number().int().optional(),
  empleadoRfc: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  saleDEdificio: z.boolean().optional().default(false),
  propositoSalida: z.string().optional(),
  comentario: z.string().optional(),
});

const AsignacionPatchSchema = z.object({
  estado: z.enum(["APROBADA", "RECHAZADA", "DEVUELTA"]),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  saleDEdificio: z.boolean().optional(),
  propositoSalida: z.string().optional(),
  comentario: z.string().optional(),
});

// ============================================================
// CATÁLOGO — GET /api/recursos
// Lista todos los CatalogoRecurso activos con conteo de unidades
// ============================================================
export const listarCatalogos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tipo = req.query["tipo"] as string | undefined;

    const where: Record<string, unknown> = { activo: true };
    if (tipo && ["TECNOLOGICO", "INMOBILIARIO"].includes(tipo)) {
      where["tipo"] = tipo;
    }

    const catalogos = await prisma.catalogoRecurso.findMany({
      where,
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
      include: {
        _count: { select: { unidades: { where: { activo: true } } } },
        unidades: {
          where: { activo: true, disponible: true },
          select: { id: true, numSerie: true, piso: true, areaId: true },
        },
      },
    });

    // Calcular disponiblesCount en cada catálogo
    const result = catalogos.map((c) => ({
      ...c,
      disponiblesCount: c.unidades.length,
    }));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// CATÁLOGO — GET /api/recursos/:id
// Detalle con todas sus unidades activas
// ============================================================
export const obtenerCatalogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const catalogo = await prisma.catalogoRecurso.findFirst({
      where: { id, activo: true },
      include: {
        unidades: {
          where: { activo: true },
          orderBy: { createdAt: "asc" },
          include: {
            _count: {
              select: {
                asignaciones: { where: { estado: { in: ["PENDIENTE", "APROBADA"] } } },
              },
            },
          },
        },
      },
    });

    if (!catalogo) {
      res.status(404).json({ error: "Catálogo no encontrado" });
      return;
    }

    res.json({ data: catalogo });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// CATÁLOGO — POST /api/recursos
// Crear nuevo tipo de recurso
// ============================================================
export const crearCatalogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parse = CatalogoCreateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const data = parse.data;
    const catalogo = await prisma.catalogoRecurso.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        tipo: data.tipo as never,
        marca: data.marca ?? null,
        capacidad: data.capacidad ?? null,
      },
    });

    res.status(201).json({ data: catalogo });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// CATÁLOGO — PATCH /api/recursos/:id
// Editar tipo de recurso
// ============================================================
export const actualizarCatalogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const existing = await prisma.catalogoRecurso.findFirst({ where: { id, activo: true } });
    if (!existing) {
      res.status(404).json({ error: "Catálogo no encontrado" });
      return;
    }

    const parse = CatalogoUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const data = parse.data;
    const catalogo = await prisma.catalogoRecurso.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.tipo !== undefined && { tipo: data.tipo as never }),
        ...(data.marca !== undefined && { marca: data.marca }),
        ...(data.capacidad !== undefined && { capacidad: data.capacidad }),
      },
    });

    res.json({ data: catalogo });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// CATÁLOGO — DELETE /api/recursos/:id
// Soft delete del catálogo y todas sus unidades
// ============================================================
export const eliminarCatalogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const existing = await prisma.catalogoRecurso.findFirst({ where: { id, activo: true } });
    if (!existing) {
      res.status(404).json({ error: "Catálogo no encontrado" });
      return;
    }

    // Soft delete de unidades + catálogo en transacción
    await prisma.$transaction([
      prisma.recursoUnidad.updateMany({ where: { catalogoId: id }, data: { activo: false } }),
      prisma.catalogoRecurso.update({ where: { id }, data: { activo: false } }),
    ]);

    res.json({ ok: true, mensaje: "Tipo de recurso y sus unidades eliminados correctamente" });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UNIDADES — GET /api/recursos/:catalogoId/unidades
// Lista unidades activas de un catálogo
// ============================================================
export const listarUnidades = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const catalogoId = parseInt(req.params["catalogoId"] as string, 10);
    if (isNaN(catalogoId)) {
      res.status(400).json({ error: "ID de catálogo inválido" });
      return;
    }

    const unidades = await prisma.recursoUnidad.findMany({
      where: { catalogoId, activo: true },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            asignaciones: { where: { estado: { in: ["PENDIENTE", "APROBADA"] } } },
          },
        },
      },
    });

    res.json({ data: unidades });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UNIDADES — POST /api/recursos/:catalogoId/unidades
// Agregar unidad física a un catálogo
// ============================================================
export const crearUnidad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const catalogoId = parseInt(req.params["catalogoId"] as string, 10);
    if (isNaN(catalogoId)) {
      res.status(400).json({ error: "ID de catálogo inválido" });
      return;
    }

    const catalogo = await prisma.catalogoRecurso.findFirst({ where: { id: catalogoId, activo: true } });
    if (!catalogo) {
      res.status(404).json({ error: "Catálogo no encontrado" });
      return;
    }

    const parse = UnidadCreateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const data = parse.data;
    const unidad = await prisma.recursoUnidad.create({
      data: {
        catalogoId,
        numSerie: data.numSerie ?? null,
        piso: data.piso ? (data.piso as never) : null,
        areaId: data.areaId ?? null,
        disponible: data.disponible ?? true,
      },
      include: { catalogo: { select: { nombre: true, tipo: true, marca: true } } },
    });

    res.status(201).json({ data: unidad });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UNIDADES — PATCH /api/recursos/unidades/:id
// Editar unidad física
// ============================================================
export const actualizarUnidad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const existing = await prisma.recursoUnidad.findFirst({ where: { id, activo: true } });
    if (!existing) {
      res.status(404).json({ error: "Unidad no encontrada" });
      return;
    }

    const parse = UnidadUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const data = parse.data;
    const unidad = await prisma.recursoUnidad.update({
      where: { id },
      data: {
        ...(data.numSerie !== undefined && { numSerie: data.numSerie }),
        ...(data.piso !== undefined && { piso: data.piso as never }),
        ...(data.areaId !== undefined && { areaId: data.areaId }),
        ...(data.disponible !== undefined && { disponible: data.disponible }),
      },
      include: { catalogo: { select: { nombre: true, tipo: true, marca: true } } },
    });

    res.json({ data: unidad });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UNIDADES — DELETE /api/recursos/unidades/:id
// Soft delete de unidad
// ============================================================
export const eliminarUnidad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const existing = await prisma.recursoUnidad.findFirst({ where: { id, activo: true } });
    if (!existing) {
      res.status(404).json({ error: "Unidad no encontrada" });
      return;
    }

    await prisma.recursoUnidad.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true, mensaje: "Unidad eliminada correctamente" });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UNIDADES — GET /api/recursos/unidades/by-serie/:serie
// Buscar unidad por número de serie (para el scanner)
// ============================================================
export const buscarUnidadPorSerie = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const serie = req.params["serie"] as string;
    if (!serie) {
      res.status(400).json({ error: "Número de serie requerido" });
      return;
    }

    const unidad = await prisma.recursoUnidad.findFirst({
      where: { numSerie: serie, activo: true },
      include: {
        catalogo: true,
        _count: {
          select: {
            asignaciones: { where: { estado: { in: ["PENDIENTE", "APROBADA"] } } },
          },
        },
      },
    });

    if (!unidad) {
      res.status(404).json({ error: `No se encontró ninguna unidad con el número de serie: ${serie}` });
      return;
    }

    res.json({ data: unidad });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ASIGNACIONES — GET /api/recursos/asignaciones
// Lista asignaciones con filtros opcionales
// ============================================================
export const listarAsignaciones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { estado, gestorId, unidadId, ticketId } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (estado) where["estado"] = estado;
    if (gestorId) where["gestorId"] = parseInt(gestorId, 10);
    if (unidadId) where["unidadId"] = parseInt(unidadId, 10);
    if (ticketId) where["ticketId"] = parseInt(ticketId, 10);

    // Si es GESTOR_RECURSOS_MATERIALES, filtrar solo sus asignaciones
    if (req.user?.rol === "GESTOR_RECURSOS_MATERIALES") {
      where["gestorId"] = req.user.id;
    }

    const asignaciones = await prisma.asignacionRecurso.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        unidad: {
          select: { id: true, numSerie: true, piso: true, areaId: true },
          include: {
            catalogo: { select: { nombre: true, tipo: true, marca: true } },
          },
        },
        empleado: {
          select: { nombreCompleto: true, rfc: true, puesto: true, departamento: true },
        },
        gestor: { select: { id: true, nombre: true, apellidos: true, usuario: true } },
        ticket: { select: { id: true, folio: true, asunto: true, subcategoria: true } },
      },
    });

    res.json({ data: asignaciones });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ASIGNACIONES — POST /api/recursos/asignaciones
// Crear asignación
// ============================================================
export const crearAsignacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parse = AsignacionCreateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const data = parse.data;

    // Verificar que la unidad existe y está disponible
    const unidad = await prisma.recursoUnidad.findFirst({
      where: { id: data.unidadId, activo: true },
    });
    if (!unidad) {
      res.status(404).json({ error: "Unidad no encontrada" });
      return;
    }
    if (!unidad.disponible) {
      res.status(409).json({ error: "La unidad no está disponible actualmente" });
      return;
    }

    const asignacion = await prisma.asignacionRecurso.create({
      data: {
        unidadId: data.unidadId,
        ticketId: data.ticketId ?? null,
        empleadoRfc: data.empleadoRfc ?? null,
        gestorId: req.user!.id,
        fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : null,
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
        saleDEdificio: data.saleDEdificio ?? false,
        propositoSalida: data.propositoSalida ?? null,
        comentario: data.comentario ?? null,
        estado: "PENDIENTE",
      },
      include: {
        unidad: {
          select: { id: true, numSerie: true, piso: true, areaId: true },
          include: { catalogo: { select: { nombre: true, tipo: true, marca: true } } },
        },
        empleado: { select: { nombreCompleto: true, rfc: true, puesto: true } },
        gestor: { select: { nombre: true, apellidos: true, usuario: true } },
      },
    });

    // Si la asignación está vinculada a un ticket, mover el ticket a EN_PROGRESO
    if (data.ticketId) {
      await prisma.ticket.update({
        where: { id: data.ticketId },
        data: { estado: "EN_PROGRESO" as never, tecnicoId: req.user!.id },
      });
    }

    res.status(201).json({ data: asignacion });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ASIGNACIONES — PATCH /api/recursos/asignaciones/:id
// Actualizar estado (APROBADA / RECHAZADA / DEVUELTA)
// ============================================================
export const actualizarAsignacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const existing = await prisma.asignacionRecurso.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    const parse = AsignacionPatchSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const data = parse.data;

    // Generar folio de orden de salida si se aprueba con salida del edificio
    let ordenSalidaFolio: string | null = existing.ordenSalidaFolio;
    const saleDEdificio = data.saleDEdificio ?? existing.saleDEdificio;

    if (data.estado === "APROBADA" && saleDEdificio && !ordenSalidaFolio) {
      const now = new Date();
      const anio = now.getFullYear();
      const mes = String(now.getMonth() + 1).padStart(2, "0");
      const dia = String(now.getDate()).padStart(2, "0");
      ordenSalidaFolio = `OS-${anio}${mes}${dia}-${String(id).padStart(3, "0")}`;
    }

    const asignacion = await prisma.asignacionRecurso.update({
      where: { id },
      data: {
        estado: data.estado as never,
        ...(data.fechaInicio && { fechaInicio: new Date(data.fechaInicio) }),
        ...(data.fechaFin && { fechaFin: new Date(data.fechaFin) }),
        ...(data.saleDEdificio !== undefined && { saleDEdificio: data.saleDEdificio }),
        ...(data.propositoSalida !== undefined && { propositoSalida: data.propositoSalida }),
        ...(data.comentario !== undefined && { comentario: data.comentario }),
        ...(ordenSalidaFolio && { ordenSalidaFolio }),
        gestorId: req.user!.id,
      },
      include: {
        unidad: {
          select: { id: true, numSerie: true, piso: true, areaId: true },
          include: { catalogo: { select: { nombre: true, tipo: true, marca: true } } },
        },
        empleado: {
          select: { nombreCompleto: true, rfc: true, puesto: true, departamento: true },
        },
        gestor: { select: { nombre: true, apellidos: true, usuario: true } },
        ticket: { select: { folio: true, asunto: true } },
      },
    });

    // Si se aprueba y hay ticket vinculado, marcar el ticket como RESUELTO
    if (data.estado === "APROBADA" && existing.ticketId) {
      await prisma.ticket.update({
        where: { id: existing.ticketId },
        data: { estado: "RESUELTO" as never, fechaResolucion: new Date() },
      });
    }

    // Actualizar disponibilidad de la unidad según el nuevo estado
    if (data.estado === "APROBADA") {
      await prisma.recursoUnidad.update({
        where: { id: existing.unidadId },
        data: { disponible: false },
      });
    } else if (data.estado === "DEVUELTA") {
      await prisma.recursoUnidad.update({
        where: { id: existing.unidadId },
        data: { disponible: true },
      });
    } else if (data.estado === "RECHAZADA" && existing.estado === "APROBADA") {
      await prisma.recursoUnidad.update({
        where: { id: existing.unidadId },
        data: { disponible: true },
      });
    }

    res.json({ data: asignacion });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ASIGNACIONES — GET /api/recursos/asignaciones/:id/orden-salida
// Datos de la orden de salida (JSON)
// ============================================================
export const ordenSalida = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const asignacion = await prisma.asignacionRecurso.findUnique({
      where: { id },
      include: {
        unidad: {
          select: { numSerie: true, piso: true, areaId: true },
          include: {
            catalogo: { select: { nombre: true, marca: true, tipo: true } },
          },
        },
        empleado: {
          select: {
            nombreCompleto: true,
            rfc: true,
            puesto: true,
            departamento: true,
            adscripcion: true,
          },
        },
        gestor: { select: { nombre: true, apellidos: true, usuario: true } },
      },
    });

    if (!asignacion) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    if (!asignacion.ordenSalidaFolio) {
      res.status(400).json({ error: "Esta asignación no tiene orden de salida generada" });
      return;
    }

    res.json({
      data: {
        folio: asignacion.ordenSalidaFolio,
        recurso: {
          nombre: asignacion.unidad?.catalogo?.nombre ?? "",
          numSerie: asignacion.unidad?.numSerie ?? "",
          marca: asignacion.unidad?.catalogo?.marca ?? "",
          tipo: asignacion.unidad?.catalogo?.tipo ?? "",
        },
        empleado: {
          nombre: asignacion.empleado?.nombreCompleto ?? "",
          rfc: asignacion.empleadoRfc ?? "",
          puesto: asignacion.empleado?.puesto ?? "",
          area: asignacion.empleado?.departamento ?? asignacion.empleado?.adscripcion ?? "",
        },
        gestor: {
          nombre: asignacion.gestor
            ? `${asignacion.gestor.nombre} ${asignacion.gestor.apellidos}`
            : "",
          usuario: asignacion.gestor?.usuario ?? "",
        },
        fechaInicio: asignacion.fechaInicio?.toISOString() ?? null,
        fechaFin: asignacion.fechaFin?.toISOString() ?? null,
        propositoSalida: asignacion.propositoSalida ?? "",
        saleDEdificio: asignacion.saleDEdificio,
        estado: asignacion.estado,
        fechaEmision: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};
