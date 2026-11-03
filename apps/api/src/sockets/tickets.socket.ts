import type { Server, Socket } from "socket.io";
import { obtenerAviso } from "../services/aviso-sistema.service.js";
import { verifyToken } from "../config/jwt.js";
import { verificarSesion } from "../services/sesiones.service.js";
import type { JwtPayload } from "../types/index.js";

// Roles que reciben los eventos de la sala "admins" (nuevos tickets, cambios de todas las áreas)
const puedeEntrarAdmins = (rol: string) =>
  rol === "ADMIN" || rol === "MESA_AYUDA" || rol.startsWith("RESPONSABLE_");

// Valida el token del handshake. Sin token válido el socket solo recibe el aviso del sistema.
const autenticar = async (socket: Socket): Promise<JwtPayload | null> => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = verifyToken(token);
    if (payload.jti && !(await verificarSesion(payload.jti))) return null;
    return payload;
  } catch {
    return null;
  }
};

export const configurarSockets = (io: Server) => {
  io.on("connection", (socket) => {
    // Cada navegador que se conecta (incluido el login) recibe el aviso vigente.
    socket.emit("sistema:aviso", obtenerAviso());

    // Los handlers se registran de inmediato y esperan la validación, para no perder
    // los join que el cliente manda justo al conectarse.
    const usuario = autenticar(socket);

    // Las salas se derivan del token, no de lo que mande el cliente.
    socket.on("join:user", async () => {
      const user = await usuario;
      if (user && user.rol !== "EMPLEADO") socket.join(`user:${user.id}`);
    });

    socket.on("join:empleado", async () => {
      const user = await usuario;
      if (user?.rfc) socket.join(`emp:${user.rfc}`);
    });

    socket.on("join:admin", async () => {
      const user = await usuario;
      if (user && puedeEntrarAdmins(user.rol)) socket.join("admins");
    });

    socket.on("disconnect", () => {
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });
};
