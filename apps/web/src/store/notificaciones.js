import { create } from "zustand";
import { io } from "socket.io-client";
import { API_BASE } from "../api/client.js";

let socket = null;

const ICONOS = {
  TICKET_CREADO: "🎫",
  TICKET_ASIGNADO: "👤",
  TICKET_ACTUALIZADO: "🔄",
  TICKET_RESUELTO: "✅",
  TICKET_CANCELADO: "❌",
  TICKET_URGENTE: "🚨",
};

function mostrarNotifNativa(tipo, titulo, mensaje) {
  if (Notification.permission !== "granted") return;
  const icono = ICONOS[tipo] ?? "📌";
  const notif = new Notification(`${icono} ${titulo}`, {
    body: mensaje || undefined,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `siast-${tipo}-${Date.now()}`,
    renotify: true,
  });
  notif.onclick = () => {
    window.focus();
    notif.close();
  };
}

async function pedirPermisoNotificaciones() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export const useNotifStore = create((set, get) => ({
  notificaciones: [],
  noLeidas: 0,
  socket: null,
  permisoNotif: typeof window !== "undefined" ? Notification.permission : "default",

  pedirPermiso: async () => {
    await pedirPermisoNotificaciones();
    set({ permisoNotif: Notification.permission });
  },

  conectar: (user) => {
    if (socket) return;

    // Solicitar permiso de notificaciones al conectar
    pedirPermisoNotificaciones().then(() =>
      set({ permisoNotif: Notification.permission }),
    );

    socket = io(API_BASE, { transports: ["websocket"] });

    socket.on("connect", () => {
      if (user.rol === "ADMIN" || user.rol === "MESA_AYUDA") socket.emit("join:admin");
      if (user.rol !== "EMPLEADO") socket.emit("join:user", String(user.id));
      if (user.rfc) socket.emit("join:empleado", user.rfc);
    });

    const add = (notif) => {
      mostrarNotifNativa(notif.tipo, notif.titulo, notif.mensaje);
      set((s) => ({
        notificaciones: [{ ...notif, id: Date.now(), leida: false }, ...s.notificaciones],
        noLeidas: s.noLeidas + 1,
      }));
    };

    socket.on("ticket:nuevo", (d) =>
      add({ tipo: "TICKET_CREADO", titulo: `Nuevo ticket #${d.id}`, mensaje: d.asunto, data: d }),
    );
    socket.on("ticket:asignado", (d) =>
      add({
        tipo: "TICKET_ASIGNADO",
        titulo: `Ticket #${d.ticketId} asignado`,
        mensaje: d.asunto,
        data: d,
      }),
    );
    socket.on("ticket:asignado_empleado", (d) =>
      add({
        tipo: "TICKET_ASIGNADO",
        titulo: d.mensaje,
        mensaje: `Técnico: ${d.tecnico}`,
        data: d,
      }),
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
