import { create } from "zustand";
import { io } from "socket.io-client";
import { API_BASE, api } from "../api/client.js";

// ── Novedades de versión ("¿Qué hay de nuevo?") ─────────────────────────────
// Se recuerda por usuario cuáles ya vio, para mostrar la ventana una sola vez.
const claveVistas = (user) => `siast_novedades_vistas:${user.rfc ?? user.id}`;
const leerVistas = (user) => {
  try {
    return JSON.parse(localStorage.getItem(claveVistas(user)) ?? "[]");
  } catch {
    return [];
  }
};
const guardarVistas = (user, ids) => {
  try {
    localStorage.setItem(claveVistas(user), JSON.stringify(ids.slice(-50)));
  } catch {
    /* sin storage: la ventana puede volver a salir, no pasa nada */
  }
};
const meToca = (novedad, user) =>
  novedad.audiencia === "TODOS" ||
  (novedad.audiencia === "EMPLEADOS" && user.rol === "EMPLEADO") ||
  (novedad.audiencia === "STAFF" && user.rol !== "EMPLEADO");
const notifDeNovedad = (n, vista) => ({
  id: new Date(n.createdAt).getTime(),
  tipo: "NOVEDAD",
  titulo: n.version ? `${n.titulo} (v${n.version})` : n.titulo,
  mensaje: n.puntos?.[0] ?? n.mensaje,
  leida: vista,
  data: { novedad: n },
});

let socket = null;

const ICONOS = {
  TICKET_CREADO: "🎫",
  TICKET_ASIGNADO: "👤",
  TICKET_ACTUALIZADO: "🔄",
  TICKET_RESUELTO: "✅",
  TICKET_CANCELADO: "❌",
  TICKET_URGENTE: "🚨",
  NOVEDAD: "✨",
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
  ticketsVersion: 0, // se incrementa con cada evento de ticket para forzar refetch
  socket: null,
  usuario: null,
  novedadAbierta: null, // novedad que se muestra en la ventana "¿Qué hay de nuevo?"
  permisoNotif: typeof window !== "undefined" ? Notification.permission : "default",

  pedirPermiso: async () => {
    await pedirPermisoNotificaciones();
    set({ permisoNotif: Notification.permission });
  },

  conectar: (user) => {
    if (socket) return;

    // Solicitar permiso de notificaciones al conectar
    pedirPermisoNotificaciones().then(() => set({ permisoNotif: Notification.permission }));

    // El token viaja en el handshake; el servidor decide a qué salas entra el usuario.
    // Se lee en cada (re)conexión para usar el token vigente tras una renovación.
    socket = io(API_BASE, {
      transports: ["websocket"],
      auth: (cb) => cb({ token: localStorage.getItem("siast_token") }),
    });
    set({ usuario: user });

    // Novedades publicadas mientras el usuario no estaba: van a la lista y la más
    // reciente que no ha visto se abre en ventana.
    api
      .get("/api/sistema/novedades")
      .then(({ data }) => {
        const vistas = leerVistas(user);
        const lista = data.novedades ?? [];
        const items = lista.map((n) => notifDeNovedad(n, vistas.includes(n.id)));
        const sinVer = lista.find((n) => !vistas.includes(n.id));
        set((s) => ({
          notificaciones: [...s.notificaciones, ...items].sort((a, b) => b.id - a.id),
          noLeidas: s.noLeidas + items.filter((i) => !i.leida).length,
          novedadAbierta: s.novedadAbierta ?? sinVer ?? null,
        }));
      })
      .catch(() => {});

    socket.on("connect", () => {
      if (
        user.rol === "ADMIN" ||
        user.rol === "MESA_AYUDA" ||
        user.rol === "RESPONSABLE_TI" ||
        user.rol === "RESPONSABLE_SISTEMAS" ||
        user.rol === "RESPONSABLE_REDES" ||
        user.rol === "RESPONSABLE_MANTENIMIENTO" ||
        user.rol === "RESPONSABLE_RECURSOS_MATERIALES"
      )
        socket.emit("join:admin");
      if (user.rol !== "EMPLEADO") socket.emit("join:user", String(user.id));
      if (user.rfc) socket.emit("join:empleado", user.rfc);
    });

    const add = (notif) => {
      mostrarNotifNativa(notif.tipo, notif.titulo, notif.mensaje);
      set((s) => ({
        notificaciones: [{ ...notif, id: Date.now(), leida: false }, ...s.notificaciones],
        noLeidas: s.noLeidas + 1,
        ticketsVersion: s.ticketsVersion + 1,
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
    socket.on("ticket:paso_asignado", (d) =>
      add({
        tipo: "TICKET_ASIGNADO",
        titulo: `Paso ${d.pasoOrden} asignado — Solicitud #${d.ticketId}`,
        mensaje: d.pasoNombre,
        data: { ticketId: d.ticketId },
      }),
    );
    socket.on("ticket:paso_listo", (d) =>
      add({
        tipo: "TICKET_ACTUALIZADO",
        titulo: `Solicitud #${d.ticketId} — Paso ${d.pasoOrden} listo para asignar`,
        mensaje: `${d.pasoNombre} · Requiere: ${d.rolLabel}`,
        data: { ticketId: d.ticketId },
      }),
    );

    // Novedad lanzada en vivo desde el monitor.
    socket.on("sistema:novedad", (n) => {
      if (!meToca(n, user)) return;
      mostrarNotifNativa("NOVEDAD", n.titulo, n.puntos?.[0] ?? n.mensaje);
      set((s) => ({
        notificaciones: [notifDeNovedad(n, false), ...s.notificaciones],
        noLeidas: s.noLeidas + 1,
        novedadAbierta: n,
      }));
    });

    set({ socket });
  },

  abrirNovedad: (novedad) => set({ novedadAbierta: novedad }),

  // Cierra la ventana y marca la novedad como vista (no vuelve a abrirse sola).
  cerrarNovedad: () => {
    const { novedadAbierta, usuario, notificaciones } = get();
    if (!novedadAbierta) return;
    if (usuario) {
      const vistas = leerVistas(usuario);
      if (!vistas.includes(novedadAbierta.id)) guardarVistas(usuario, [...vistas, novedadAbierta.id]);
    }
    const item = notificaciones.find(
      (x) => x.tipo === "NOVEDAD" && x.data?.novedad?.id === novedadAbierta.id,
    );
    set((s) => ({
      novedadAbierta: null,
      notificaciones: s.notificaciones.map((x) => (x === item ? { ...x, leida: true } : x)),
      noLeidas: item && !item.leida ? Math.max(0, s.noLeidas - 1) : s.noLeidas,
    }));
  },

  desconectar: () => {
    socket?.disconnect();
    socket = null;
    set({ socket: null, notificaciones: [], noLeidas: 0, usuario: null, novedadAbierta: null });
  },

  marcarLeida: (id) =>
    set((s) => {
      const yaLeida = s.notificaciones.find((n) => n.id === id)?.leida;
      return {
        notificaciones: s.notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n)),
        noLeidas: yaLeida ? s.noLeidas : Math.max(0, s.noLeidas - 1),
      };
    }),

  marcarTodasLeidas: () =>
    set((s) => ({
      notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })),
      noLeidas: 0,
    })),
}));
