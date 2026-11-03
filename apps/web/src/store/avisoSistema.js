import { create } from "zustand";
import { io } from "socket.io-client";
import { API_BASE } from "../api/client.js";

// Avisos globales del sistema (mantenimiento, versión nueva…) que se lanzan
// desde el monitor del servidor. Usa su propio socket porque también deben
// verse en el login, antes de iniciar sesión.

const CLAVE_CERRADOS = "siast_avisos_cerrados";

const leerCerrados = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CERRADOS) ?? "[]");
  } catch {
    return [];
  }
};

const notificarNativo = (aviso) => {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(`SIAST · ${aviso.titulo}`, {
      body: aviso.mensaje || undefined,
      icon: "/favicon.ico",
      tag: `siast-aviso-${aviso.id}`,
    });
  } catch {
    /* algunos navegadores no permiten Notification fuera de un service worker */
  }
};

// Mantenimiento en curso = tipo MANTENIMIENTO sin inicio o con inicio ya pasado.
export const mantenimientoEnCurso = (aviso) =>
  aviso?.tipo === "MANTENIMIENTO" && (!aviso.inicio || new Date(aviso.inicio) <= new Date());

let socket = null;

export const useAvisoSistemaStore = create((set, get) => ({
  aviso: null,
  cerrados: leerCerrados(),

  iniciar: () => {
    if (socket) return;
    socket = io(API_BASE, { transports: ["websocket"] });
    // El servidor manda el aviso vigente al conectar y cada vez que cambia.
    socket.on("sistema:aviso", (nuevo) => {
      const anterior = get().aviso;
      if (nuevo && nuevo.id !== anterior?.id) notificarNativo(nuevo);
      set({ aviso: nuevo ?? null });
      // Terminó un mantenimiento en curso → recargar para tomar la versión nueva.
      if (!nuevo && mantenimientoEnCurso(anterior)) window.location.reload();
    });
  },

  cerrar: (id) => {
    const cerrados = [...get().cerrados.filter((x) => x !== id), id].slice(-20);
    try {
      localStorage.setItem(CLAVE_CERRADOS, JSON.stringify(cerrados));
    } catch {
      /* sin storage: solo se oculta en esta pestaña */
    }
    set({ cerrados });
  },
}));
