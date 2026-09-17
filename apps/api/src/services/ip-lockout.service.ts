/**
 * Bloqueo progresivo por IP — SEC-04.
 *
 * Reemplaza express-rate-limit (ventana fija de 15 min) por una lógica propia:
 *   - 5 intentos fallidos consecutivos por IP disparan un bloqueo.
 *   - Duración del bloqueo: 3 minutos la primera vez, +2 min cada bloqueo
 *     posterior de esa misma IP (progresión lineal: 3, 5, 7, 9, 11... min).
 *   - El contador de reincidencia (numBloqueos) expira si la IP pasa
 *     REINCIDENCIA_TTL_MS sin volver a caer en bloqueo — se considera
 *     "rehabilitada" y su próximo bloqueo vuelve a ser de 3 min. Se eligió
 *     24h: suficiente para no castigar en automático a alguien que tuvo un
 *     mal día, corto para no dar un respiro indefinido a quien insiste en
 *     forzar credenciales día tras día.
 *
 * Persistencia: en memoria del proceso (Map). No hay Redis en el stack y la
 * API no reinicia con frecuencia suficiente en producción para justificar
 * persistir esto en MySQL vía Prisma — perder el estado de bloqueo en un
 * restart es un trade-off aceptable (peor caso: alguien bloqueado recupera
 * sus 5 intentos). Si en el futuro se corren varias instancias de la API
 * detrás de un balanceador, esto necesitará moverse a un store compartido
 * (Redis) porque cada instancia tendría su propio Map.
 */

const MAX_INTENTOS_FALLIDOS = 5;
const DURACION_BASE_MIN = 3;
const INCREMENTO_POR_BLOQUEO_MIN = 2;

// Tiempo sin nuevos bloqueos tras el cual se reinicia la progresión de esa IP.
const REINCIDENCIA_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Limpieza periódica para no crecer sin límite en memoria.
const LIMPIEZA_INTERVALO_MS = 60 * 60 * 1000; // cada hora
const LIMPIEZA_INACTIVIDAD_MS = 48 * 60 * 60 * 1000; // purga tras 48h sin actividad

interface EstadoIp {
  intentosFallidos: number;
  bloqueadoHasta: number | null; // epoch ms
  numBloqueos: number;
  ultimoBloqueoEn: number | null; // epoch ms
  ultimaActividad: number; // epoch ms
}

const estados = new Map<string, EstadoIp>();

function obtenerEstado(ip: string): EstadoIp {
  let estado = estados.get(ip);
  if (!estado) {
    estado = {
      intentosFallidos: 0,
      bloqueadoHasta: null,
      numBloqueos: 0,
      ultimoBloqueoEn: null,
      ultimaActividad: Date.now(),
    };
    estados.set(ip, estado);
  }
  return estado;
}

export interface ResultadoVerificacion {
  bloqueado: boolean;
  minutosRestantes?: number;
}

/** Llamar al inicio de la request, antes de procesar el intento de auth. */
export function verificarBloqueo(ip: string): ResultadoVerificacion {
  const estado = obtenerEstado(ip);
  estado.ultimaActividad = Date.now();

  if (estado.bloqueadoHasta && Date.now() < estado.bloqueadoHasta) {
    const minutosRestantes = Math.ceil((estado.bloqueadoHasta - Date.now()) / 60000);
    return { bloqueado: true, minutosRestantes };
  }

  if (estado.bloqueadoHasta && Date.now() >= estado.bloqueadoHasta) {
    estado.bloqueadoHasta = null; // el bloqueo ya expiró
  }

  return { bloqueado: false };
}

/** Cuántos intentos fallidos le quedan a la IP antes del próximo bloqueo (para avisar en el frontend). */
export function intentosRestantes(ip: string): number {
  const estado = obtenerEstado(ip);
  return Math.max(0, MAX_INTENTOS_FALLIDOS - estado.intentosFallidos);
}

/** Llamar tras resolver la request, con si el intento de auth fue exitoso o no. */
export function registrarIntento(ip: string, fallido: boolean): void {
  const estado = obtenerEstado(ip);
  estado.ultimaActividad = Date.now();

  if (!fallido) {
    estado.intentosFallidos = 0;
    return;
  }

  // Reinicia la progresión si pasó suficiente tiempo desde el último bloqueo.
  if (estado.ultimoBloqueoEn && Date.now() - estado.ultimoBloqueoEn > REINCIDENCIA_TTL_MS) {
    estado.numBloqueos = 0;
  }

  estado.intentosFallidos += 1;
  if (estado.intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
    estado.numBloqueos += 1;
    const duracionMin = DURACION_BASE_MIN + INCREMENTO_POR_BLOQUEO_MIN * (estado.numBloqueos - 1);
    estado.bloqueadoHasta = Date.now() + duracionMin * 60 * 1000;
    estado.ultimoBloqueoEn = Date.now();
    estado.intentosFallidos = 0;
  }
}

// Barrido periódico: purga IPs inactivas y sin bloqueo vigente.
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, estado] of estados) {
    const bloqueoVigente = estado.bloqueadoHasta !== null && ahora < estado.bloqueadoHasta;
    const inactivo = ahora - estado.ultimaActividad > LIMPIEZA_INACTIVIDAD_MS;
    if (!bloqueoVigente && inactivo) {
      estados.delete(ip);
    }
  }
}, LIMPIEZA_INTERVALO_MS).unref();
