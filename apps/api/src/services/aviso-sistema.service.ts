import { randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import type { AvisoSistema, CrearAvisoSistema } from "@stf/shared";
import { getIo } from "./notificaciones.service.js";

// El aviso activo se guarda en un archivo JSON (no en MySQL) para que siga
// disponible aunque la base de datos esté caída durante un mantenimiento y
// para que sobreviva a un reinicio de PM2.
const ARCHIVO = resolve(process.env.AVISO_FILE ?? "./data/aviso-sistema.json");

let avisoActual: AvisoSistema | null = cargar();

function cargar(): AvisoSistema | null {
  try {
    if (!existsSync(ARCHIVO)) return null;
    return JSON.parse(readFileSync(ARCHIVO, "utf8")) as AvisoSistema;
  } catch (err) {
    console.error("[Aviso] No se pudo leer el aviso guardado:", err);
    return null;
  }
}

function guardar() {
  try {
    if (avisoActual) {
      mkdirSync(dirname(ARCHIVO), { recursive: true });
      writeFileSync(ARCHIVO, JSON.stringify(avisoActual, null, 2), "utf8");
    } else if (existsSync(ARCHIVO)) {
      rmSync(ARCHIVO);
    }
  } catch (err) {
    console.error("[Aviso] No se pudo guardar el aviso:", err);
  }
}

const expirado = (a: AvisoSistema) => !!a.fin && new Date(a.fin).getTime() <= Date.now();

export const obtenerAviso = (): AvisoSistema | null => {
  if (avisoActual && expirado(avisoActual)) {
    avisoActual = null;
    guardar();
  }
  return avisoActual;
};

export const publicarAviso = (datos: CrearAvisoSistema): AvisoSistema => {
  avisoActual = {
    ...datos,
    id: randomUUID(),
    fijo: datos.fijo ?? (datos.tipo === "MANTENIMIENTO" || datos.tipo === "URGENTE"),
    creadoEn: new Date().toISOString(),
  };
  guardar();
  getIo()?.emit("sistema:aviso", avisoActual);
  console.log(`[Aviso] Publicado ${avisoActual.tipo}: ${avisoActual.titulo}`);
  return avisoActual;
};

export const quitarAviso = (): void => {
  avisoActual = null;
  guardar();
  getIo()?.emit("sistema:aviso", null);
  console.log("[Aviso] Aviso retirado");
};

// Revisa cada minuto si el aviso ya venció para avisar a los clientes conectados.
setInterval(() => {
  if (avisoActual && expirado(avisoActual)) quitarAviso();
}, 60_000).unref();

// Cuántos navegadores tienen SIAST abierto (para que el monitor lo reporte).
export const contarConectados = (): number => getIo()?.engine.clientsCount ?? 0;
