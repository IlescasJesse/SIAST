import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import * as ticketsService from "../services/tickets.service.js";

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
    res.status(201).json({ ticket, mensaje: "Ticket creado exitosamente" });
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

export const cambiarEstado = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await ticketsService.cambiarEstado(
      parseId(req.params.id),
      req.body,
      req.user!,
    );
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

export const comentar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const comentario = await ticketsService.agregarComentario(
      parseId(req.params.id),
      req.body,
      req.user!,
    );
    res.status(201).json({ comentario });
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
