import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { SUBCATEGORIAS_POR_CATEGORIA } from "@stf/shared";
import { sirhFetch } from "../services/sirhAuth.service.js";

export const categorias = (_req: Request, res: Response) => {
  res.json({
    data: Object.entries(SUBCATEGORIAS_POR_CATEGORIA).map(([cat, subs]) => ({
      categoria: cat,
      subcategorias: subs,
    })),
  });
};

// Mapeo categoría → roles habilitados para esa categoría
const CATEGORIA_ROLES: Record<string, string[]> = {
  TECNOLOGIAS: ["TECNICO_INFORMATICO"],
  SERVICIOS: ["TECNICO_SERVICIOS"],
  RECURSOS_MATERIALES: ["GESTOR_RECURSOS_MATERIALES"],
};

export const tecnicos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoria = req.query["categoria"] as string | undefined;

    // Si se pasa ?categoria=, filtrar solo los roles correspondientes;
    // si no, devolver técnicos y gestores (excluye ADMIN, MESA_AYUDA, EMPLEADO)
    const rolesPermitidos =
      categoria && CATEGORIA_ROLES[categoria]
        ? (CATEGORIA_ROLES[categoria] as import("@prisma/client").Rol[])
        : (["TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "GESTOR_RECURSOS_MATERIALES"] as import("@prisma/client").Rol[]);

    const data = await prisma.usuario.findMany({
      where: {
        activo: true,
        rol: { in: rolesPermitidos },
      },
      select: { id: true, nombre: true, apellidos: true, rol: true, esEmpleadoEstructura: true, empleadoId: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// ── Paleta de colores institucional (misma que AreaGridEditor.jsx) ─────────────
const PH = 342, PS = 62, PL = 38;
const PALETTE_DELTAS = [
  [0, 0, 0], [-20, -15, 18], [20, 10, -10], [-40, -20, 28],
  [15, -5, 12], [-60, -8, 20], [30, 15, -8], [0, 18, 22],
  [-80, -15, 30], [40, -5, -5], [-10, -8, 38], [25, 20, 8],
];

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function areaColorHex(index: number): string {
  const [dH, dS, dL] = PALETTE_DELTAS[index % PALETTE_DELTAS.length];
  const h = ((PH + dH) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, PS + dS));
  const l = Math.max(0, Math.min(100, PL + dL));
  return hslToHex(h, s, l);
}

export const areas = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = await prisma.areaEdificio.findMany({
      where: { activo: true },
      orderBy: [{ floor: "asc" }, { label: "asc" }],
    });
    // Agregar colorHex determinístico por índice (mismo algoritmo que el editor 2D)
    const data = raw.map((area, i) => ({ ...area, colorHex: areaColorHex(i) }));
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const pisos = (_req: Request, res: Response) => {
  res.json({
    data: [
      { piso: "PB",      floor: 0, label: "Planta Baja" },
      { piso: "NIVEL_1", floor: 1, label: "Nivel 2" },
      { piso: "NIVEL_2", floor: 2, label: "Nivel 3" },
      { piso: "NIVEL_3", floor: 3, label: "Nivel 4" },
    ],
  });
};

// ─── Adscripciones SIRH ──────────────────────────────────────────────────────

interface SirhAdscripcion {
  nombre: string;
  nivel: number;
  clave: string;
  proyectos: unknown[];
}

interface SirhInternalInfoResponse {
  adscripciones?: Record<string, SirhAdscripcion[]>;
  [key: string]: unknown;
}

/**
 * GET /api/catalogos/sirh-adscripciones
 * Proxy al endpoint de SIRH. Requiere authMiddleware (JWT de SIAST).
 * Retorna las adscripciones agrupadas por nivel 1-5.
 */
export const sirhAdscripciones = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const resp = await sirhFetch("/api/personal/getInternalInformation");

    if (!resp.ok) {
      res.status(502).json({
        error: `SIRH respondió ${resp.status} ${resp.statusText}`,
      });
      return;
    }

    const body = (await resp.json()) as SirhInternalInfoResponse;
    const adscripciones = body.adscripciones ?? {};

    const data = {
      nivel1: adscripciones["1"] ?? [],
      nivel2: adscripciones["2"] ?? [],
      nivel3: adscripciones["3"] ?? [],
      nivel4: adscripciones["4"] ?? [],
      nivel5: adscripciones["5"] ?? [],
    };

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// ─── Área CRUD ───────────────────────────────────────────────────────────────

const CreateAreaSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "El id solo puede contener letras minúsculas, números y guiones bajos"),
  label: z.string().min(1).max(200),
  piso: z.enum(["PB", "NIVEL_1", "NIVEL_2", "NIVEL_3"]),
  floor: z.number().int().min(0).max(3),
  gridX1: z.number().int().min(0).optional(),
  gridY1: z.number().int().min(0).optional(),
  gridX2: z.number().int().min(0).optional(),
  gridY2: z.number().int().min(0).optional(),
});

const UpdateAreaSchema = z.object({
  // label puede venir del nombre SIRH seleccionado (subsecretaría/dirección/coordinación/departamento)
  label: z.string().min(1).max(200).optional(),
  gridX1: z.number().int().min(0).optional(),
  gridY1: z.number().int().min(0).optional(),
  gridX2: z.number().int().min(0).optional(),
  gridY2: z.number().int().min(0).optional(),
});

/**
 * POST /api/catalogos/areas
 * Crea un área nueva. Requiere ADMIN.
 */
export const crearArea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = CreateAreaSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const { id, label, piso, floor, gridX1, gridY1, gridX2, gridY2 } = parse.data;

    const existente = await prisma.areaEdificio.findUnique({ where: { id } });
    if (existente) {
      res.status(409).json({ error: `Ya existe un área con id "${id}"` });
      return;
    }

    const area = await prisma.areaEdificio.create({
      data: {
        id,
        label,
        piso: piso as import("@prisma/client").PisoEdificio,
        floor,
        gridX1: gridX1 ?? null,
        gridY1: gridY1 ?? null,
        gridX2: gridX2 ?? null,
        gridY2: gridY2 ?? null,
        activo: true,
      },
    });

    res.status(201).json({ data: area });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/catalogos/areas/:id
 * Actualiza un área existente. Requiere ADMIN.
 */
export const actualizarArea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;

    const existente = await prisma.areaEdificio.findUnique({ where: { id } });
    if (!existente) {
      res.status(404).json({ error: `Área "${id}" no encontrada` });
      return;
    }

    const parse = UpdateAreaSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: parse.error.flatten() });
      return;
    }

    const { label, gridX1, gridY1, gridX2, gridY2 } = parse.data;

    const area = await prisma.areaEdificio.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(gridX1 !== undefined && { gridX1 }),
        ...(gridY1 !== undefined && { gridY1 }),
        ...(gridX2 !== undefined && { gridX2 }),
        ...(gridY2 !== undefined && { gridY2 }),
      },
    });

    res.json({ data: area });
  } catch (err) {
    next(err);
  }
};

// ─── Búsqueda de empleado SIRH por RFC ───────────────────────────────────────

interface SirhEmpleado {
  _id: string;
  NOMBRES: string;
  APE_PAT: string;
  APE_MAT: string;
  RFC: string;
  EMAIL?: string;
  ADSCRIPCION?: string;
  ID_CTRL_ASIST?: string;
}

/**
 * GET /api/catalogos/sirh-empleado?rfc=XXXX
 *
 * Estrategia:
 *   1. Busca el empleado en la DB local (ya sincronizada con SIRH).
 *   2. Si existe, devuelve sus datos directamente (rápido, sin llamar a SIRH).
 *   3. Si no está en DB local, intenta el endpoint individual de SIRH.
 *   4. Si SIRH tampoco lo tiene, devuelve 404.
 *
 * Devuelve: { _id, nombre, apellidos, rfc, email, adscripcion }
 */
export const sirhEmpleado = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfc = (req.query["rfc"] as string | undefined)?.trim().toUpperCase();

    if (!rfc) {
      res.status(400).json({ error: "El parámetro rfc es requerido" });
      return;
    }

    // ── 1. Buscar en DB local primero ────────────────────────────────────────
    const local = await prisma.empleado.findFirst({
      where: { rfc, activo: true },
      select: {
        sirhId: true, rfc: true, nombre: true, apellidos: true,
        email: true, adscripcion: true,
      },
    });

    if (local) {
      res.json({
        data: {
          _id: local.sirhId ?? "",
          nombre: local.nombre,
          apellidos: local.apellidos,
          rfc: local.rfc,
          email: local.email ?? "",
          adscripcion: local.adscripcion ?? "",
        },
      });
      return;
    }

    // ── 2. Fallback: endpoint individual de SIRH ─────────────────────────────
    const resp = await sirhFetch(`/api/personal/getemployee/${encodeURIComponent(rfc)}`);

    if (!resp.ok) {
      res.status(resp.status === 404 ? 404 : 502).json({
        error: resp.status === 404 ? "RFC no encontrado en SIRH" : `SIRH respondió ${resp.status}`,
      });
      return;
    }

    const emp = (await resp.json()) as SirhEmpleado;

    if (!emp?._id) {
      res.status(404).json({ error: "RFC no encontrado en SIRH" });
      return;
    }

    res.json({
      data: {
        _id: String(emp._id),
        nombre: emp.NOMBRES ?? "",
        apellidos: `${emp.APE_PAT ?? ""} ${emp.APE_MAT ?? ""}`.trim(),
        rfc: emp.RFC ?? rfc,
        email: emp.EMAIL ?? "",
        adscripcion: emp.ADSCRIPCION ?? "",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Disponibilidad de técnico (vacaciones SIRH) ─────────────────────────────

interface SirhVacaciones {
  FECHAS?: {
    FECHA_INICIO?: string;
    FECHA_FIN?: string;
  };
}

interface SirhPerfilIncidencia {
  VACACIONES?: SirhVacaciones;
  [key: string]: unknown;
}

/**
 * GET /api/catalogos/disponibilidad-tecnico/:empleadoId
 * Verifica si un técnico está de vacaciones consultando SIRH.
 * Devuelve: { disponible: boolean, motivo?: string }
 */
export const disponibilidadTecnico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { empleadoId } = req.params as { empleadoId: string };

    if (!empleadoId) {
      res.status(400).json({ error: "empleadoId es requerido" });
      return;
    }

    const resp = await sirhFetch(`/api/control-asistencia/perfil-incidencia/${empleadoId}`);

    if (!resp.ok) {
      // Si SIRH no responde, asumir disponible para no bloquear el flujo
      res.json({ disponible: true });
      return;
    }

    const body = (await resp.json()) as SirhPerfilIncidencia;
    const vacaciones = body?.VACACIONES;

    if (!vacaciones?.FECHAS?.FECHA_INICIO || !vacaciones?.FECHAS?.FECHA_FIN) {
      res.json({ disponible: true });
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = new Date(vacaciones.FECHAS.FECHA_INICIO);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(vacaciones.FECHAS.FECHA_FIN);
    fin.setHours(23, 59, 59, 999);

    if (hoy >= inicio && hoy <= fin) {
      const fmt = (d: Date) =>
        d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });

      res.json({
        disponible: false,
        motivo: `De vacaciones del ${fmt(inicio)} al ${fmt(fin)}`,
      });
      return;
    }

    res.json({ disponible: true });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/catalogos/areas/:id
 * Soft-delete: pone activo = false. Requiere ADMIN.
 */
export const eliminarArea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;

    const existente = await prisma.areaEdificio.findUnique({ where: { id } });
    if (!existente) {
      res.status(404).json({ error: `Área "${id}" no encontrada` });
      return;
    }

    if (!existente.activo) {
      res.status(409).json({ error: `El área "${id}" ya está eliminada` });
      return;
    }

    const area = await prisma.areaEdificio.update({
      where: { id },
      data: { activo: false },
    });

    res.json({ data: area, mensaje: "Área desactivada correctamente" });
  } catch (err) {
    next(err);
  }
};
