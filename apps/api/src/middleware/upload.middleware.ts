import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { ADJUNTOS_MAX_ARCHIVOS, ADJUNTOS_MAX_BYTES, ADJUNTOS_TIPOS } from "@stf/shared";

/**
 * Carpeta en disco de los adjuntos. En producción (PM2) definir UPLOADS_DIR con
 * ruta absoluta fuera del repo para que sobreviva a los deploys.
 */
export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? "uploads");

/** Extensión en minúsculas y sin punto ("Reporte.PDF" → "pdf"). */
export const extensionDe = (nombre: string): string => path.extname(nombre).slice(1).toLowerCase();

/** multer entrega el nombre en latin1; los navegadores lo mandan en UTF-8. */
const nombreUtf8 = (nombre: string): string => Buffer.from(nombre, "latin1").toString("utf8");

// El navegador no siempre conoce el tipo (p. ej. .docx en un equipo sin Office):
// con estos se acepta por extensión y la firma del archivo decide después.
const MIME_GENERICOS = new Set(["", "application/octet-stream"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(UPLOADS_DIR, { recursive: true }, (err) => cb(err, UPLOADS_DIR));
  },
  // Nombre aleatorio: el nombre original nunca toca el sistema de archivos
  filename: (_req, file, cb) => cb(null, `${randomUUID()}.${extensionDe(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: ADJUNTOS_MAX_BYTES, files: ADJUNTOS_MAX_ARCHIVOS },
  fileFilter: (_req, file, cb) => {
    file.originalname = nombreUtf8(file.originalname);
    const ext = extensionDe(file.originalname);
    const mimes = ADJUNTOS_TIPOS[ext];
    if (!mimes || !(mimes.includes(file.mimetype) || MIME_GENERICOS.has(file.mimetype))) {
      cb(
        Object.assign(new Error(`Tipo de archivo no permitido: "${file.originalname}"`), {
          status: 400,
        }),
      );
      return;
    }
    // Tipo canónico según la extensión (no se confía en el que declara el cliente)
    file.mimetype = mimes[0];
    cb(null, true);
  },
}).array("archivos", ADJUNTOS_MAX_ARCHIVOS);

const MENSAJES_MULTER: Record<string, string> = {
  LIMIT_FILE_SIZE: `Cada archivo puede pesar máximo ${ADJUNTOS_MAX_BYTES / (1024 * 1024)} MB`,
  LIMIT_FILE_COUNT: `Máximo ${ADJUNTOS_MAX_ARCHIVOS} archivos por envío`,
  LIMIT_UNEXPECTED_FILE: `Máximo ${ADJUNTOS_MAX_ARCHIVOS} archivos por envío`,
};

/**
 * Recibe hasta ADJUNTOS_MAX_ARCHIVOS archivos en el campo "archivos" (multipart).
 * Peticiones JSON pasan intactas. Los errores de multer salen como 400 legibles.
 */
export const subirAdjuntos = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      next(
        Object.assign(new Error(MENSAJES_MULTER[err.code] ?? "No se pudo recibir el archivo"), {
          status: 400,
        }),
      );
      return;
    }
    next(err);
  });
};

/** Archivos recibidos por `subirAdjuntos` en esta petición (vacío si no hubo). */
export const archivosDe = (req: Request): Express.Multer.File[] =>
  Array.isArray(req.files) ? req.files : [];
