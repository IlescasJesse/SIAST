import { create } from "zustand";
import { io } from "socket.io-client";
import { API_BASE } from "../api/client.js";

let socket = null;

export const useNotifStore = create((set, get) => ({
  notificaciones: [],
  noLeidas: 0,
  socket: null,

  conectar: (user) => {
    if (socket) return;
    socket = io(API_BASE, { transports: ["websocket"] });

    socket.on("connect", () => {
      if (user.rol === "ADMIN" || user.rol === "MESA_AYUDA") socket.emit("join:admin");
      if (user.rol !== "EMPLEADO") socket.emit("join:user", String(user.id));
      if (user.rfc) socket.emit("join:empleado", user.rfc);
    });

    const add = (notif) =>
      set((s) => ({
        notificaciones: [{ ...notif, id: Date.now(), leida: false }, ...s.notificaciones],
        noLeidas: s.noLeidas + 1,
      }));

    socket.on("ticket:nuevo", (d) =>
      add({ tipo: "TICKET_CREADO", titulo: `Nuevo ticket #${d.id}`, mensaje: d.asunto, data: d }),
    );
    socket.on("ticket:asignado", (d) =>
      add({ tipo: "TICKET_ASIGNADO", titulo: `Ticket #${d.ticketId} asignado`, mensaje: d.asunto, data: d }),
    );
    socket.on("ticket:asignado_empleado", (d) =>
      add({ tipo: "TICKET_ASIGNADO", titulo: d.mensaje, mensaje: `Técnico: ${d.tecnico}`, data: d }),
    );
    socket.on("ticket:estado_cambiado", (d) =>
      add({ tipo: "TICKET_ACTUALIZADO", titulo: d.mensaje, mensaje: "", data: d }),
    );

    set({ socket });
  },

  desconectar: () => {
    socket?.disconnect();
    socket = null;
    set({ socket: null, notificaciones: [], noLeidas: 0 });
  },

  marcarLeida: (id) =>
    set((s) => ({
      notificaciones: s.notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n)),
      noLeidas: Math.max(0, s.noLeidas - 1),
    })),

  marcarTodasLeidas: () =>
    set((s) => ({
      notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })),
      noLeidas: 0,
    })),
}));
