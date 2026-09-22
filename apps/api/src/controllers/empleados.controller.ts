import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { LABEL_PISO } from "@stf/shared";
import type { PisoEdificio } from "@stf/shared";

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ubicacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfc = (req.query.rfc as string)?.toUpperCase();
    if (!rfc) {
      res.status(400).json({ error: "RFC requerido" });
      return;
    }

    const empleado = await prisma.empleado.findFirst({
      where: { rfc, activo: true },
      include: { area: true },
    });

    if (!empleado) {
      res.status(404).json({ error: "Empleado no encontrado" });
      return;
    }

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

// ── Honorarios (invitados) — feedback staff P4-12 ──────────────────────────────
// Personal por honorarios que NO está en el SIRH. Un ADMIN o Mesa de Ayuda lo
// registra manualmente; luego se autentica por RFC e interactúa igual que un
// EMPLEADO (máx. MAX_TICKETS_ACTIVOS_EMPLEADO de @stf/shared, ve su historial propio). Necesita teléfono o
// correo para poder recibir el OTP de acceso.

export const listarHonorarios = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const empleados = await prisma.empleado.findMany({
      where: { esHonorarios: true },
      include: { area: true },
      orderBy: { nombreCompleto: "asc" },
    });
    res.json(
      empleados.map((e) => ({
        id: e.id,
        rfc: e.rfc,
        nombreCompleto: e.nombreCompleto,
        telefono: e.telefono,
        correoInstitucional: e.correoInstitucional,
        emailPersonal: e.emailPersonal,
        area: e.area.label,
        areaId: e.areaId,
        activo: e.activo,
        perfilCompleto: e.perfilCompleto,
      })),
    );
  } catch (err) {
    next(err);
  }
};

export const crearHonorarios = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfc, nombre, apellidos, telefono, emailPersonal, areaId, puesto } = req.body as {
      rfc?: string;
      nombre?: string;
      apellidos?: string;
      telefono?: string;
      emailPersonal?: string;
      areaId?: string;
      puesto?: string;
    };

    const rfcUp = rfc?.trim().toUpperCase() ?? "";
    if (!RFC_REGEX.test(rfcUp)) {
      res.status(400).json({ error: "Formato de RFC inválido" });
      return;
    }
    if (!nombre?.trim() || !apellidos?.trim()) {
      res.status(400).json({ error: "Nombre y apellidos son obligatorios" });
      return;
    }
    const tel = telefono?.trim() || null;
    const email = emailPersonal?.trim().toLowerCase() || null;
    // Sin teléfono ni correo no hay canal para el OTP de acceso.
    if (!tel && !email) {
      res.status(400).json({ error: "Captura un teléfono o un correo para el acceso por OTP" });
      return;
    }
    if (tel && !/^\d{10}$/.test(tel)) {
      res.status(400).json({ error: "El teléfono debe tener 10 dígitos" });
      return;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: "Correo inválido" });
      return;
    }
    if (!areaId?.trim()) {
      res.status(400).json({ error: "Selecciona una ubicación (área)" });
      return;
    }

    const yaExiste = await prisma.empleado.findUnique({ where: { rfc: rfcUp } });
    if (yaExiste) {
      res.status(409).json({ error: "Ya existe un empleado con ese RFC" });
      return;
    }

    const area = await prisma.areaEdificio.findUnique({ where: { id: areaId } });
    if (!area) {
      res.status(400).json({ error: "Ubicación inválida" });
      return;
    }

    const nom = nombre.trim();
    const ape = apellidos.trim();
    const empleado = await prisma.empleado.create({
      data: {
        rfc: rfcUp,
        nombre: nom,
        apellidos: ape,
        nombreCompleto: `${nom} ${ape}`,
        telefono: tel,
        emailPersonal: email,
        puesto: puesto?.trim() || "Honorarios",
        areaId: area.id,
        piso: area.piso,
        esHonorarios: true,
        // Entra al flujo normal de primer acceso (confirma datos y ubicación).
        primerAcceso: true,
        perfilCompleto: false,
      },
      include: { area: true },
    });

    res.status(201).json({
      id: empleado.id,
      rfc: empleado.rfc,
      nombreCompleto: empleado.nombreCompleto,
      telefono: empleado.telefono,
      emailPersonal: empleado.emailPersonal,
      area: empleado.area.label,
      areaId: empleado.areaId,
      activo: empleado.activo,
      perfilCompleto: empleado.perfilCompleto,
    });
  } catch (err) {
    next(err);
  }
};
