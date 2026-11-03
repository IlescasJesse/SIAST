import type { NextFunction, Request, Response } from "express";
import type { AuthRequest } from "../types/index.js";
import * as avisoService from "../services/aviso-sistema.service.js";
import * as novedadesService from "../services/novedades.service.js";

// ── Aviso global (mantenimiento, versión, incidente) ─────────────────────────

export const obtenerAviso = (_req: Request, res: Response): void => {
  res.json({ aviso: avisoService.obtenerAviso() });
};

export const publicarAviso = (req: Request, res: Response): void => {
  const aviso = avisoService.publicarAviso(req.body);
  const conectados = avisoService.contarConectados();
  res.status(201).json({
    ok: true,
    confirmacion: `Aviso "${aviso.titulo}" lanzado a ${conectados} navegador(es) conectado(s).`,
    aviso,
    conectados,
  });
};

export const quitarAviso = (_req: Request, res: Response): void => {
  avisoService.quitarAviso();
  res.json({ ok: true, confirmacion: "Aviso retirado de todas las pantallas." });
};

// ── Novedades de versión ─────────────────────────────────────────────────────

export const listarNovedades = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ novedades: await novedadesService.listarParaUsuario(req.user!.rol) });
  } catch (err) {
    next(err);
  }
};

export const listarNovedadesMonitor = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ novedades: await novedadesService.listarTodas() });
  } catch (err) {
    next(err);
  }
};

export const publicarNovedad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const novedad = await novedadesService.publicar(req.body);
    const conectados = avisoService.contarConectados();
    res.status(201).json({
      ok: true,
      confirmacion:
        `Novedad #${novedad.id} "${novedad.titulo}" lanzada (${novedad.audiencia}). ` +
        `Llegó en vivo a ${conectados} navegador(es); los demás la verán al entrar.`,
      novedad,
      conectados,
    });
  } catch (err) {
    next(err);
  }
};

export const retirarNovedad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "id inválido" });
      return;
    }
    const ok = await novedadesService.retirar(id);
    if (!ok) {
      res.status(404).json({ error: "Novedad no encontrada" });
      return;
    }
    res.json({ ok: true, confirmacion: `Novedad #${id} retirada.` });
  } catch (err) {
    next(err);
  }
};
