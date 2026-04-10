import type { Request, Response, NextFunction } from "express";

export const errorMiddleware = (
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ error: err.message ?? "Error interno del servidor" });
};
