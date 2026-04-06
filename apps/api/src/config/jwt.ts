import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/index.js";

const SECRET = process.env.JWT_SECRET ?? "siast_dev_secret";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

export const signToken = (payload: Omit<JwtPayload, "iat" | "exp">): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, SECRET) as JwtPayload;
};
