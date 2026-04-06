/**
 * Definición de todos los cuartos del Edificio Saúl Martínez.
 * Coordenadas extraídas de los planos arquitectónicos (cuadrícula 32×27).
 * X: columnas 1-32 (izquierda→derecha)
 * Y: filas 1-27 (abajo→arriba)
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

export const ROOMS = {
  // ════════════════════════════════════════════════
  // PLANTA BAJA (floor: 0)
  // ════════════════════════════════════════════════
  pb: [
    {
      id: "pb_acceso_principal",
      label: "Acceso Principal",
      x1: 14, y1: 12, x2: 18, y2: 15,
      color: AREA_COLORS.acceso,
      floor: 0,
    },
    {
      id: "pb_archivos",
      label: "Área de Archivos",
      x1: 1, y1: 15, x2: 9, y2: 27,
      color: AREA_COLORS.archivo,
      floor: 0,
    },
    {
      id: "pb_ingresos",
      label: "Ingresos",
      x1: 20, y1: 14, x2: 32, y2: 22,
      color: AREA_COLORS.finanzas,
      floor: 0,
    },
    {
      id: "pb_unidad_administrativa",
      label: "Unidad Administrativa",
      x1: 1, y1: 2, x2: 13, y2: 14,
      color: AREA_COLORS.directivo,
      floor: 0,
    },
    {
      id: "pb_control",
      label: "Control / Caja",
      x1: 14, y1: 6, x2: 19, y2: 11,
      color: AREA_COLORS.finanzas,
      floor: 0,
    },
    {
      id: "pb_cuarto_electrico",
      label: "Cuarto Eléctrico PB",
      x1: 8, y1: 14, x2: 9, y2: 16,
      color: AREA_COLORS.servicios,
      floor: 0,
    },
    {
      id: "pb_atencion_ciudadana",
      label: "Atención Ciudadana",
      x1: 20, y1: 3, x2: 32, y2: 13,
      color: AREA_COLORS.acceso,
      floor: 0,
    },
  ],

  // ════════════════════════════════════════════════
  // NIVEL 1 (floor: 1)
  // ════════════════════════════════════════════════
  nivel1: [
    {
      id: "n1_secretaria",
      label: "Secretaría de Finanzas",
      x1: 20, y1: 17, x2: 32, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 1,
    },
    {
      id: "n1_subsec_planeacion",
      label: "Subsecretaría de Planeación",
      x1: 24, y1: 20, x2: 32, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 1,
    },
    {
      id: "n1_subsec_ingresos",
      label: "Subsecretaría de Ingresos",
      x1: 24, y1: 8, x2: 32, y2: 18,
      color: AREA_COLORS.finanzas,
      floor: 1,
    },
    {
      id: "n1_juridico",
      label: "Área Jurídica",
      x1: 1, y1: 18, x2: 9, y2: 27,
      color: AREA_COLORS.juridico,
      floor: 1,
    },
    {
      id: "n1_salon_morelos",
      label: "Salón Morelos",
      x1: 1, y1: 9, x2: 8, y2: 13,
      color: AREA_COLORS.reunion,
      floor: 1,
    },
    {
      id: "n1_centro_reuniones",
      label: "Centro de Reuniones",
      x1: 1, y1: 2, x2: 13, y2: 8,
      color: AREA_COLORS.reunion,
      floor: 1,
    },
    {
      id: "n1_oficina_alterna",
      label: "Oficina Alterna",
      x1: 9, y1: 12, x2: 19, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 1,
    },
  ],

  // ════════════════════════════════════════════════
  // NIVEL 2 (floor: 2)
  // ════════════════════════════════════════════════
  nivel2: [
    {
      id: "n2_informatica",
      label: "Informática",
      x1: 1, y1: 9, x2: 9, y2: 16,
      color: AREA_COLORS.tecnologia,
      floor: 2,
    },
    {
      id: "n2_recaudacion",
      label: "Recaudación",
      x1: 5, y1: 11, x2: 18, y2: 18,
      color: AREA_COLORS.finanzas,
      floor: 2,
    },
    {
      id: "n2_contraloria",
      label: "Contraloría",
      x1: 5, y1: 2, x2: 14, y2: 8,
      color: AREA_COLORS.juridico,
      floor: 2,
    },
    {
      id: "n2_egresos",
      label: "Egresos",
      x1: 20, y1: 14, x2: 32, y2: 27,
      color: AREA_COLORS.finanzas,
      floor: 2,
    },
    {
      id: "n2_dir_egresos",
      label: "Dirección de Egresos",
      x1: 20, y1: 14, x2: 24, y2: 20,
      color: AREA_COLORS.directivo,
      floor: 2,
    },
    {
      id: "n2_nominas",
      label: "Departamento de Nóminas",
      x1: 25, y1: 16, x2: 32, y2: 22,
      color: AREA_COLORS.finanzas,
      floor: 2,
    },
    {
      id: "n2_almacen",
      label: "Almacén Informática",
      x1: 9, y1: 18, x2: 14, y2: 22,
      color: AREA_COLORS.tecnologia,
      floor: 2,
    },
  ],

  // ════════════════════════════════════════════════
  // NIVEL 3 (floor: 3)
  // ════════════════════════════════════════════════
  nivel3: [
    {
      id: "n3_nivel3_general",
      label: "Nivel 3",
      x1: 1, y1: 1, x2: 32, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 3,
    },
  ],
};

// Mapa plano id → room para búsqueda rápida
export const ROOM_MAP = {};
for (const rooms of Object.values(ROOMS)) {
  for (const room of rooms) {
    ROOM_MAP[room.id] = room;
  }
}

export const ALL_ROOMS = Object.values(ROOMS).flat();

export const FLOOR_LABELS = {
  0: "Planta Baja",
  1: "Nivel 1",
  2: "Nivel 2",
  3: "Nivel 3",
};
