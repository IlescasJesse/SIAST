import type { Request } from "express";
import type { Rol } from "@stf/shared";

export interface JwtPayload {
  id: number;
  rol: Rol;
  usuario?: string; // staff
  rfc?: string; // empleado
  nombre: string;
  areaSoporteId?: number; // solo RESPONSABLE_* — incluido en JWT para scoping seguro sin DB lookup
  jti?: string; // ID único de sesión (UUID)
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
