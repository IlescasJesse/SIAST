import type { Server } from "socket.io";

export const configurarSockets = (io: Server) => {
  io.on("connection", (socket) => {
    socket.on("join:user", (userId: string) => {
      socket.join(`user:${userId}`);
    });

    socket.on("join:empleado", (rfc: string) => {
      socket.join(`emp:${rfc}`);
    });

    socket.on("join:admin", () => {
      socket.join("admins");
    });

    socket.on("disconnect", () => {
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });
};
