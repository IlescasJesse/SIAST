/**
 * Definición de todos los cuartos del Edificio Saúl Martínez.
 * Coordenadas extraídas de los planos arquitectónicos (cuadrícula 32×27).
 * X: columnas 1-32 (izquierda→derecha)
 * Y: filas 1-27 (abajo→arriba)
 *
 * Revisado contra planos PB.pdf, 1.pdf, 2.pdf, 3.pdf — 2026-04-06
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
  // Plano PB.pdf — revisado 2026-04-06
  // ════════════════════════════════════════════════
  pb: [
    // Acceso principal centrado en X14-18, Y12-15
    {
      id: "pb_acceso_principal",
      label: "Acceso Principal",
      x1: 14, y1: 12, x2: 18, y2: 15,
      color: AREA_COLORS.acceso,
      floor: 0,
    },
    // Área de Archivos — ala izquierda superior, X1-9, Y15-27
    {
      id: "pb_archivos",
      label: "Área de Archivos",
      x1: 1, y1: 15, x2: 9, y2: 27,
      color: AREA_COLORS.archivo,
      floor: 0,
    },
    // Ingresos — ala derecha, ocupa toda la franja Y14-27 según plano
    {
      id: "pb_ingresos",
      label: "Ingresos",
      x1: 20, y1: 14, x2: 32, y2: 27,
      color: AREA_COLORS.finanzas,
      floor: 0,
    },
    // Unidad Administrativa — ala izquierda inferior, X1-13, Y7-14
    // (recortada en Y para dejar espacio a los subespacios inferiores Y2-6)
    {
      id: "pb_unidad_administrativa",
      label: "Unidad Administrativa",
      x1: 1, y1: 7, x2: 13, y2: 14,
      color: AREA_COLORS.directivo,
      floor: 0,
    },
    // Control / Caja — zona central, X14-19, Y6-11
    {
      id: "pb_control",
      label: "Control / Caja",
      x1: 14, y1: 6, x2: 19, y2: 11,
      color: AREA_COLORS.finanzas,
      floor: 0,
    },
    // Cuarto Eléctrico PB — X8-9, Y14-16 (visible en plano)
    {
      id: "pb_cuarto_electrico",
      label: "Cuarto Eléctrico PB",
      x1: 8, y1: 14, x2: 9, y2: 16,
      color: AREA_COLORS.servicios,
      floor: 0,
    },
    // Atención Ciudadana — ala derecha inferior, X20-32, Y2-13
    {
      id: "pb_atencion_ciudadana",
      label: "Atención Ciudadana",
      x1: 20, y1: 2, x2: 32, y2: 13,
      color: AREA_COLORS.acceso,
      floor: 0,
    },
    // Sala de Juntas PB — X1-4, Y12-14 (subespacio dentro de UA)
    {
      id: "pb_sala_juntas",
      label: "Sala de Juntas",
      x1: 1, y1: 12, x2: 4, y2: 14,
      color: AREA_COLORS.reunion,
      floor: 0,
    },
    // Área de Soreo / Biblioteca — X1-7, Y4-6 (zona inferior izquierda)
    {
      id: "pb_soreo",
      label: "Área de Soreo / Biblioteca",
      x1: 1, y1: 4, x2: 7, y2: 6,
      color: AREA_COLORS.servicios,
      floor: 0,
    },
    // Área de Recepción y Preparación de Alimentos — X1-7, Y2-3
    {
      id: "pb_recepcion",
      label: "Recepción / Alimentación",
      x1: 1, y1: 2, x2: 7, y2: 3,
      color: AREA_COLORS.acceso,
      floor: 0,
    },
  ],

  // ════════════════════════════════════════════════
  // NIVEL 1 (floor: 1)
  // Plano 1.pdf — revisado 2026-04-06
  // ════════════════════════════════════════════════
  nivel1: [
    // Secretaría de Finanzas — ala derecha superior, X20-32, Y17-27
    // (Subsecretarías son subdivisiones internas; no se solapan en geometría)
    {
      id: "n1_secretaria",
      label: "Secretaría de Finanzas",
      x1: 20, y1: 17, x2: 32, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 1,
    },
    // Subsecretaría de Planeación — dentro de zona derecha superior X24-32, Y22-27
    // (corregido: antes era Y20-27, solapaba con Secretaría; ahora ocupa franja norte)
    {
      id: "n1_subsec_planeacion",
      label: "Subsecretaría de Planeación",
      x1: 24, y1: 22, x2: 32, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 1,
    },
    // Subsecretaría de Ingresos — ala derecha inferior, X20-32, Y8-16
    // (corregido: antes terminaba en Y18; plano muestra franja Y8-16 para sub ingresos)
    {
      id: "n1_subsec_ingresos",
      label: "Subsecretaría de Ingresos",
      x1: 20, y1: 8, x2: 32, y2: 16,
      color: AREA_COLORS.finanzas,
      floor: 1,
    },
    // Área Jurídica — ala izquierda superior, X1-9, Y18-27
    {
      id: "n1_juridico",
      label: "Área Jurídica",
      x1: 1, y1: 18, x2: 9, y2: 27,
      color: AREA_COLORS.juridico,
      floor: 1,
    },
    // Salón Morelos — X1-8, Y10-13 (ajustado: plano lo ubica en Y10-12 aprox)
    {
      id: "n1_salon_morelos",
      label: "Salón Morelos",
      x1: 1, y1: 10, x2: 8, y2: 13,
      color: AREA_COLORS.reunion,
      floor: 1,
    },
    // Centro de Reuniones Cd. Judicial — X1-13, Y2-8
    {
      id: "n1_centro_reuniones",
      label: "Centro de Reuniones",
      x1: 1, y1: 2, x2: 13, y2: 8,
      color: AREA_COLORS.reunion,
      floor: 1,
    },
    // Oficina Alterna — gran zona central, X9-19, Y14-27
    // (corregido: y1 era 12; plano muestra que Oficina Alterna arranca en Y14)
    {
      id: "n1_oficina_alterna",
      label: "Oficina Alterna",
      x1: 9, y1: 14, x2: 19, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 1,
    },
    // Sala de Juntas central — X10-13, Y8-12 (visible en plano nivel 1)
    {
      id: "n1_sala_juntas",
      label: "Sala de Juntas",
      x1: 10, y1: 8, x2: 13, y2: 12,
      color: AREA_COLORS.reunion,
      floor: 1,
    },
    // Zona de acceso / circulación Nivel 1 — franjas laterales sin solapar Sala de Juntas
    // Franja izquierda: X9-9, Y8-13 y franja derecha: X14-19, Y8-13
    {
      id: "n1_acceso",
      label: "Acceso / Circulación N1",
      x1: 14, y1: 8, x2: 19, y2: 13,
      color: AREA_COLORS.acceso,
      floor: 1,
    },
  ],

  // ════════════════════════════════════════════════
  // NIVEL 2 (floor: 2)
  // Plano 2.pdf — revisado 2026-04-06
  // ════════════════════════════════════════════════
  nivel2: [
    // Informática — ala izquierda media, X1-4, Y9-16
    // (corregido: antes era X1-9, Y9-16; plano muestra Informática solo en X1-4)
    {
      id: "n2_informatica",
      label: "Informática",
      x1: 1, y1: 9, x2: 4, y2: 16,
      color: AREA_COLORS.tecnologia,
      floor: 2,
    },
    // Recaudación — zona central izquierda, X5-13, Y9-26
    // (corregido: antes era X5-18, Y11-18; plano muestra Recaudación ocupando
    //  la franja central izquierda superior, compartiendo con Informática abajo)
    {
      id: "n2_recaudacion",
      label: "Recaudación",
      x1: 5, y1: 9, x2: 13, y2: 26,
      color: AREA_COLORS.finanzas,
      floor: 2,
    },
    // Contraloría — zona izquierda inferior, X1-13, Y2-8
    // (corregido: antes era X5-14, Y2-8; incluye X1-4 que Informática no cubre abajo)
    {
      id: "n2_contraloria",
      label: "Contraloría",
      x1: 1, y1: 2, x2: 13, y2: 8,
      color: AREA_COLORS.juridico,
      floor: 2,
    },
    // Egresos — ala derecha superior, X20-32, Y14-26
    // (corregido: antes llegaba a Y27; plano muestra que Y26 es el límite útil)
    {
      id: "n2_egresos",
      label: "Egresos",
      x1: 20, y1: 14, x2: 32, y2: 26,
      color: AREA_COLORS.finanzas,
      floor: 2,
    },
    // Dirección de Egresos — subnodo dentro de ala derecha, X20-23, Y15-20
    // (corregido: antes solapaba con n2_egresos en mismas coords; ahora se ajusta
    //  a la oficina directiva visible en el plano X20-22, Y15-20)
    {
      id: "n2_dir_egresos",
      label: "Dirección de Egresos",
      x1: 20, y1: 15, x2: 23, y2: 20,
      color: AREA_COLORS.directivo,
      floor: 2,
    },
    // Nóminas / RRHH — ala derecha inferior, X20-32, Y2-8
    // (corregido: antes era X25-32, Y16-22; plano muestra nóminas en zona inferior derecha)
    {
      id: "n2_nominas",
      label: "Departamento de Nóminas",
      x1: 20, y1: 2, x2: 32, y2: 8,
      color: AREA_COLORS.finanzas,
      floor: 2,
    },
    // Almacén Informática — X9-13, Y18-22
    // (mantenido; visible en plano con etiqueta "almacén informática" aprox X9-13, Y18-22)
    {
      id: "n2_almacen",
      label: "Almacén Informática",
      x1: 9, y1: 18, x2: 13, y2: 22,
      color: AREA_COLORS.tecnologia,
      floor: 2,
    },
    // Choferes / Auxiliares — zona central, X14-19, Y10-12
    // (nuevo: visible en plano 2.pdf con etiqueta "CHOFERES AUXILIARES" X14-19 Y10-12)
    {
      id: "n2_choferes",
      label: "Choferes Auxiliares",
      x1: 14, y1: 10, x2: 19, y2: 12,
      color: AREA_COLORS.servicios,
      floor: 2,
    },
    // Cuarto Eléctrico N2 izquierdo — X8-9, Y14-16
    {
      id: "n2_cuarto_electrico_izq",
      label: "Cuarto Eléctrico N2",
      x1: 8, y1: 14, x2: 9, y2: 16,
      color: AREA_COLORS.servicios,
      floor: 2,
    },
    // Cuarto Eléctrico N2 derecho — X23-24, Y14-16
    {
      id: "n2_cuarto_electrico_der",
      label: "Cuarto Eléctrico N2 Der",
      x1: 23, y1: 14, x2: 24, y2: 16,
      color: AREA_COLORS.servicios,
      floor: 2,
    },
  ],

  // ════════════════════════════════════════════════
  // NIVEL 3 (floor: 3)
  // Plano 3.pdf — extraído 2026-04-06
  // Cuadrícula 32×27: X=columnas (1→32 izq→der), Y=filas (1→27 abajo→arriba)
  // ════════════════════════════════════════════════
  nivel3: [
    // ── Ala izquierda — Dirección de Auditoría e Inspección Fiscal ──
    // X1-4, Y18-27 (columna izquierda superior según plano 3.pdf)
    {
      id: "n3_inspeccion_fiscal",
      label: "Dirección Aux. / Inspección Fiscal",
      x1: 1, y1: 18, x2: 4, y2: 27,
      color: AREA_COLORS.juridico,
      floor: 3,
    },
    // Auditoría — zona central izquierda, X1-13, Y9-17
    // (corregido: antes era X1-13, Y13-17; plano muestra Auditoría ocupando Y9-17)
    {
      id: "n3_auditoria",
      label: "Auditoría",
      x1: 1, y1: 9, x2: 13, y2: 17,
      color: AREA_COLORS.finanzas,
      floor: 3,
    },
    // Archivo de la Dirección — X5-13, Y8-9
    // (ajustado: plano lo muestra en franja delgada Y8-9 entre Auditoría y Archivo General)
    {
      id: "n3_archivo_direccion",
      label: "Archivo de la Dirección",
      x1: 5, y1: 8, x2: 13, y2: 9,
      color: AREA_COLORS.archivo,
      floor: 3,
    },
    // Archivo General / Oficialía de Partes — X5-13, Y6-7
    // (ajustado: plano muestra Archivo General y Oficialía en zona Y6-7)
    {
      id: "n3_archivo_general",
      label: "Archivo General / Oficialía de Partes",
      x1: 5, y1: 6, x2: 13, y2: 7,
      color: AREA_COLORS.archivo,
      floor: 3,
    },
    // Domiciliarias y Notificaciones — X1-4, Y2-5
    {
      id: "n3_domiciliarias",
      label: "Domiciliarias y Notificaciones",
      x1: 1, y1: 2, x2: 4, y2: 5,
      color: AREA_COLORS.servicios,
      floor: 3,
    },
    // Conserva el ID que usa la BD (670 empleados externos / CIACs / ICEO)
    // Reubicado a X5-13, Y2-5 (zona inferior izquierda libre en plano)
    {
      id: "n3_nivel3_general",
      label: "Departamentos Nivel 3",
      x1: 5, y1: 2, x2: 13, y2: 5,
      color: AREA_COLORS.directivo,
      floor: 3,
    },
    // Acceso / Circulación N3 — X1-4, Y8-9 (área entre Auditoría e Inspección)
    {
      id: "n3_acceso_escaleras",
      label: "Acceso / Circulación",
      x1: 1, y1: 6, x2: 4, y2: 8,
      color: AREA_COLORS.acceso,
      floor: 3,
    },
    // ── Centro — núcleo de circulación ─────────────────────────
    // Choferes y Almacenes — X14-19, Y10-12
    {
      id: "n3_choferes_almacenes",
      label: "Choferes y Almacenes",
      x1: 14, y1: 10, x2: 19, y2: 12,
      color: AREA_COLORS.servicios,
      floor: 3,
    },
    // Espera — X14-19, Y5-7
    {
      id: "n3_espera",
      label: "Espera",
      x1: 14, y1: 5, x2: 19, y2: 7,
      color: AREA_COLORS.acceso,
      floor: 3,
    },
    // Núcleo / Escaleras — X14-19, Y2-4
    {
      id: "n3_nucleo_central",
      label: "Núcleo / Escaleras",
      x1: 14, y1: 2, x2: 19, y2: 4,
      color: AREA_COLORS.bano,
      floor: 3,
    },
    // Sala de Juntas N3 — X14-19, Y8-9 (visible en plano 3.pdf)
    {
      id: "n3_sala_juntas",
      label: "Sala de Juntas N3",
      x1: 14, y1: 8, x2: 19, y2: 9,
      color: AREA_COLORS.reunion,
      floor: 3,
    },
    // ── Ala derecha — Inspección Fiscal + Contabilidad ──────────
    // Inspeccion Fiscal ala derecha — X20-32, Y18-27
    // (en plano 3.pdf el ala derecha superior alberga dirección de Revisión/Inspección)
    {
      id: "n3_dir_contabilidad",
      label: "Dirección de Contabilidad Gubernamental",
      x1: 20, y1: 18, x2: 32, y2: 27,
      color: AREA_COLORS.directivo,
      floor: 3,
    },
    // Departamentos de Contabilidad — X20-32, Y13-17
    {
      id: "n3_deptos_contabilidad",
      label: "Departamentos de Contabilidad",
      x1: 20, y1: 13, x2: 32, y2: 17,
      color: AREA_COLORS.finanzas,
      floor: 3,
    },
    // Contabilidad general — X20-32, Y7-12
    // (corregido: antes era X21-32, Y5-12; plano muestra CONTABILIDAD en Y7-12)
    {
      id: "n3_contabilidad",
      label: "Contabilidad",
      x1: 20, y1: 7, x2: 32, y2: 12,
      color: AREA_COLORS.finanzas,
      floor: 3,
    },
    // Jefe de Departamento / zona inferior derecha — X20-32, Y2-6
    // (corregido: antes era X21-32, Y2-4; plano muestra zona inferior derecha Y2-6)
    {
      id: "n3_jefe_depto",
      label: "Jefe de Departamento",
      x1: 20, y1: 2, x2: 32, y2: 6,
      color: AREA_COLORS.directivo,
      floor: 3,
    },
    // Inspeccion Fiscal central izquierda (zona superior) — X5-13, Y18-27
    // (plano muestra área de inspección fiscal que abarca X5-13 en zona superior)
    {
      id: "n3_inspeccion_central",
      label: "Inspección Fiscal",
      x1: 5, y1: 18, x2: 13, y2: 27,
      color: AREA_COLORS.juridico,
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
