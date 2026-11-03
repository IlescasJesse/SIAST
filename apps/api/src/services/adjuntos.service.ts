import fs from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import type { JwtPayload } from "../types/index.js";
import { verificarLecturaTicket } from "./alcance.service.js";
import { UPLOADS_DIR, extensionDe } from "../middleware/upload.middleware.js";

type Archivo = Express.Multer.File;

// Tope de adjuntos directos (sin comentario) por solicitud — evita llenar el disco
const MAX_ADJUNTOS_POR_SOLICITUD = 20;

export const adjuntoSelect = {
  id: true,
  ticketId: true,
  comentarioId: true,
  nombreOriginal: true,
  mimeType: true,
  tamano: true,
  createdAt: true,
} as const;

/** Borra del disco archivos recién subidos (petición rechazada después de recibirlos). */
export const eliminarArchivos = async (archivos: Archivo[]): Promise<void> => {
  await Promise.all(archivos.map((a) => fs.unlink(a.path).catch(() => undefined)));
};

const empiezaCon = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  bytes.every((b, i) => buf[offset + i] === b);

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx / xlsx / pptx
const OLE = [0xd0, 0xcf, 0x11, 0xe0]; // doc / xls / ppt

/** La firma (primeros bytes) debe corresponder a la extensión declarada. */
const firmaValida = (ext: string, buf: Buffer): boolean => {
  switch (ext) {
    case "png":
      return empiezaCon(buf, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return empiezaCon(buf, [0xff, 0xd8, 0xff]);
    case "gif":
      return empiezaCon(buf, [0x47, 0x49, 0x46, 0x38]);
    case "webp":
      return (
        empiezaCon(buf, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(buf, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "pdf":
      return empiezaCon(buf, [0x25, 0x50, 0x44, 0x46]);
    case "docx":
    case "xlsx":
    case "pptx":
      return empiezaCon(buf, ZIP);
    case "doc":
    case "xls":
    case "ppt":
      return empiezaCon(buf, OLE);
    default:
      // txt / csv: texto plano, sin bytes nulos
      return !buf.includes(0);
  }
};

/**
 * Verifica que el contenido de cada archivo sea del tipo que dice su extensión
 * (un .exe renombrado a .png se rechaza). Lanza 400 con el primer inválido.
 */
export const validarFirmas = async (archivos: Archivo[]): Promise<void> => {
  for (const archivo of archivos) {
    const fh = await fs.open(archivo.path, "r");
    try {
      const buf = Buffer.alloc(512);
      const { bytesRead } = await fh.read(buf, 0, 512, 0);
      if (
        bytesRead === 0 ||
        !firmaValida(extensionDe(archivo.originalname), buf.subarray(0, bytesRead))
      ) {
        throw Object.assign(
          new Error(`El archivo "${archivo.originalname}" está vacío o no corresponde a su tipo`),
          { status: 400 },
        );
      }
    } finally {
      await fh.close();
    }
  }
};

/** Filas `Adjunto` para los archivos ya guardados en disco. */
export const datosAdjuntos = (
  ticketId: number,
  comentarioId: number | null,
  archivos: Archivo[],
  user: JwtPayload,
): Prisma.AdjuntoCreateManyInput[] =>
  archivos.map((a) => ({
    ticketId,
    comentarioId,
    nombreOriginal: a.originalname.slice(0, 255),
    nombreArchivo: a.filename,
    mimeType: a.mimetype,
    tamano: a.size,
    // El empleado no tiene fila en Usuario: se identifica por RFC
    ...(user.rol === "EMPLEADO" ? { empleadoRfc: user.rfc ?? null } : { usuarioId: user.id }),
  }));

/** Adjunta archivos directamente a la solicitud (los que se suben al crearla). */
export const adjuntarASolicitud = async (
  ticketId: number,
  archivos: Archivo[],
  user: JwtPayload,
) => {
  if (archivos.length === 0) {
    throw Object.assign(new Error("No se recibió ningún archivo"), { status: 400 });
  }
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, activo: true } });
  if (!ticket) throw Object.assign(new Error("Solicitud no encontrada"), { status: 404 });

  // Mismo alcance que la lectura: el empleado solo adjunta en sus propias solicitudes
  await verificarLecturaTicket(ticketId, user);

  const existentes = await prisma.adjunto.count({ where: { ticketId, comentarioId: null } });
  if (existentes + archivos.length > MAX_ADJUNTOS_POR_SOLICITUD) {
    throw Object.assign(
      new Error(`La solicitud admite máximo ${MAX_ADJUNTOS_POR_SOLICITUD} archivos adjuntos`),
      { status: 400 },
    );
  }

  await validarFirmas(archivos);
  await prisma.adjunto.createMany({ data: datosAdjuntos(ticketId, null, archivos, user) });

  return prisma.adjunto.findMany({
    where: { nombreArchivo: { in: archivos.map((a) => a.filename) } },
    select: adjuntoSelect,
    orderBy: { id: "asc" },
  });
};

/** Metadatos + ruta en disco de un adjunto, validando que el usuario pueda verlo. */
export const obtenerAdjunto = async (id: number, user: JwtPayload) => {
  if (!Number.isInteger(id)) throw Object.assign(new Error("Adjunto inválido"), { status: 400 });

  const adjunto = await prisma.adjunto.findUnique({
    where: { id },
    include: { comentario: { select: { esInterno: true } } },
  });
  if (!adjunto) throw Object.assign(new Error("Adjunto no encontrado"), { status: 404 });

  await verificarLecturaTicket(adjunto.ticketId, user);
  // Los adjuntos de comentarios internos son solo para staff
  if (user.rol === "EMPLEADO" && adjunto.comentario?.esInterno) {
    throw Object.assign(new Error("Sin acceso a este archivo"), { status: 403 });
  }

  const ruta = path.join(UPLOADS_DIR, path.basename(adjunto.nombreArchivo));
  try {
    await fs.access(ruta);
  } catch {
    throw Object.assign(new Error("El archivo ya no está disponible"), { status: 404 });
  }
  return { adjunto, ruta };
};
