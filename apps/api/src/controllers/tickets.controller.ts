import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import * as ticketsService from "../services/tickets.service.js";
import * as adjuntosService from "../services/adjuntos.service.js";
import { archivosDe } from "../middleware/upload.middleware.js";

const parseId = (param: string | string[]): number =>
  parseInt(Array.isArray(param) ? param[0] : param, 10);

export const listar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") query[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") query[k] = v[0];
    }
    const result = await ticketsService.listarTickets(req.user!, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const crear = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.crearTicket(req.user!, req.body);
    res.status(201).json({ ticket, mensaje: "Solicitud creada exitosamente" });
  } catch (err) {
    next(err);
  }
};

export const obtener = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.obtenerTicket(parseId(req.params.id), req.user!);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

export const obtenerPorFolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const param = req.params.folio;
    const folio = Array.isArray(param) ? param[0] : param;
    const ticket = await ticketsService.obtenerTicketPorFolio(folio, req.user!);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

export const asignar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.asignarTicket(
      parseId(req.params.id),
      req.body.tecnicoId,
      req.user!,
    );
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const aceptar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.aceptarTicket(parseId(req.params.id), req.user!);
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const reasignarArea = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.reasignarArea(
      parseId(req.params.id),
      req.body.subcategoria,
      req.user!,
    );
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const actualizarPrioridad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.actualizarPrioridad(
      parseId(req.params.id),
      req.body.prioridad,
      req.user!,
    );
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const cambiarEstado = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.cambiarEstado(parseId(req.params.id), req.body, req.user!);
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const comentar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const archivos = archivosDe(req);
  try {
    const comentario = await ticketsService.agregarComentario(
      parseId(req.params.id),
      req.body ?? {},
      req.user!,
      archivos,
    );
    res.status(201).json({ comentario });
  } catch (err) {
    // Comentario rechazado: no dejar huérfanos en disco los archivos ya recibidos
    await adjuntosService.eliminarArchivos(archivos);
    next(err);
  }
};

export const adjuntar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const archivos = archivosDe(req);
  try {
    const adjuntos = await adjuntosService.adjuntarASolicitud(
      parseId(req.params.id),
      archivos,
      req.user!,
    );
    res.status(201).json({ adjuntos });
  } catch (err) {
    await adjuntosService.eliminarArchivos(archivos);
    next(err);
  }
};

export const descargarAdjunto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { adjunto, ruta } = await adjuntosService.obtenerAdjunto(
      parseId(req.params.adjuntoId),
      req.user!,
    );
    // Solo imágenes y PDF se muestran en el navegador; lo demás se descarga
    const enLinea = adjunto.mimeType.startsWith("image/") || adjunto.mimeType === "application/pdf";
    res.setHeader("Content-Type", adjunto.mimeType);
    res.setHeader(
      "Content-Disposition",
      `${enLinea ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(adjunto.nombreOriginal)}`,
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    // dotfiles "allow": la ruta la arma el servidor; sin esto sendFile responde 404
    // si UPLOADS_DIR vive bajo una carpeta que empieza con punto
    res.sendFile(ruta, { dotfiles: "allow" }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
};

export const eliminar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await ticketsService.eliminarTicket(parseId(req.params.id), req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const completarPaso = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.completarPaso(
      parseId(req.params.id),
      parseId(req.params.pasoId),
      req.body,
      req.user!,
    );
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const asignarPaso = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.asignarPaso(
      parseId(req.params.id),
      parseId(req.params.pasoId),
      req.body.tecnicoId,
      req.user!,
    );
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const misPasos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pasos = await ticketsService.obtenerMisPasos(req.user!);
    res.json(pasos);
  } catch (err) {
    next(err);
  }
};
