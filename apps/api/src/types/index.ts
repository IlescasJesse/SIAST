import type { Request } from "express";
import type { Rol } from "@stf/shared";

export interface JwtPayload {
  id: number;
  rol: Rol;
  usuario?: string; // staff
  rfc?: string; // empleado
  nombre: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
