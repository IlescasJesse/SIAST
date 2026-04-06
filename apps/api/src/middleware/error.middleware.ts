import type { Request, Response, NextFunction } from "express";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error(err.stack);
  res.status(500).json({ error: "Error interno del servidor", message: err.message });
};
