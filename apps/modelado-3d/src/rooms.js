/**
 * rooms.js — Definición estática de cuartos (fallback sin API).
 *
 * SISTEMA DE COORDENADAS: 0-based
 *   col : 0 → 31  (X, izquierda → derecha)
 *   fila: 0 → 26  (Y, abajo → arriba)
 *
 * Los cuartos se mapean desde el editor 2D en /admin/areas.
 * El visor 3D carga las áreas desde la API (/api/catalogos/areas)
 * en cuanto arranca; este archivo solo sirve de fallback visual
 * mientras llega la respuesta.
 *
 * Para re-mapear: ejecutar
 *   cd packages/database && npm run db:reset-areas
 * luego asignar coordenadas en /admin/areas → Guardar todo → Generar Render.
 */

export const AREA_COLORS = {
  tecnologia: 0x1565c0,
  finanzas:   0x2e7d32,
  directivo:  0x4a148c,
  servicios:  0xe65100,
  juridico:   0xb71c1c,
  archivo:    0x546e7a,
  reunion:    0x00695c,
  acceso:     0xf9a825,
  bano:       0x78909c,
  ticket_activo:   0xff1744,
  ticket_asignado: 0xffab00,
};

// Sin cuartos estáticos — se cargan dinámicamente desde la API.
export const ROOMS = {
  pb:     [],
  nivel1: [],
  nivel2: [],
  nivel3: [],
};

// Mapa plano id → room (vacío en fallback)
export const ROOM_MAP = {};

export const ALL_ROOMS = [];

export const FLOOR_LABELS = {
  0: "Planta Baja",
  1: "Nivel 2",
  2: "Nivel 3",
  3: "Nivel 4",
};
