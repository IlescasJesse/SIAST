/**
 * sirhAuth.service.ts
 *
 * Genera y cachea un JWT de "cuenta de servicio" compatible con SIRH.
 * SIRH valida sus tokens con jwt.verify(token, SECRET_KEY) — mientras el
 * token esté firmado con el mismo secret y tenga el payload esperado,
 * el middleware de SIRH lo acepta sin necesidad de que exista en MongoDB.
 *
 * Uso:
 *   const token = await getSirhServiceToken();
 *   fetch(url, { headers: { Authorization: `Bearer ${token}` } });
 */

import jwt from "jsonwebtoken";

// ── Config ────────────────────────────────────────────────────────────────────

const SIRH_SECRET = process.env.SIRH_SECRET_KEY ?? "";
const TOKEN_TTL_SECONDS = 6 * 60 * 60;          // 6h — igual que SIRH
const REFRESH_BUFFER_SECONDS = 30 * 60;          // renovar 30 min antes de expirar

if (!SIRH_SECRET) {
  console.warn("[SIRH-Auth] SIRH_SECRET_KEY no está configurado en .env");
}

// ── Payload del token de servicio ─────────────────────────────────────────────
// Debe coincidir con la estructura que el middleware de SIRH espera.
// "siast_service" es una cuenta de máquina; ajusta rol/module/permissions
// según lo que los endpoints de SIRH requieran.

const SERVICE_PAYLOAD = {
  id:          "siast_service_account",
  name:        "SIAST Sistema",
  sex:         "M",
  username:    "siast_service",
  rol:         "admin",
  module:      ["personal", "reportes", "plantilla"],
  permissions: { read: true, write: false },    // solo lectura desde SIAST
};

// ── Cache in-process ──────────────────────────────────────────────────────────

interface TokenCache {
  token:     string;
  expiresAt: number; // epoch ms
}

let cache: TokenCache | null = null;

/** Minta un JWT firmado con el secret de SIRH */
function mintToken(): string {
  if (!SIRH_SECRET) throw new Error("SIRH_SECRET_KEY no configurado");
  return jwt.sign(SERVICE_PAYLOAD, SIRH_SECRET, { expiresIn: `${TOKEN_TTL_SECONDS}s` });
}

/**
 * Devuelve un token válido para SIRH.
 * Si el cache está vigente lo reutiliza; si expira en < REFRESH_BUFFER lo renueva.
 */
export function getSirhServiceToken(): string {
  const now = Date.now();
  const bufferMs = REFRESH_BUFFER_SECONDS * 1000;

  if (cache && cache.expiresAt - bufferMs > now) {
    return cache.token;
  }

  const token = mintToken();
  cache = {
    token,
    expiresAt: now + TOKEN_TTL_SECONDS * 1000,
  };

  console.log("[SIRH-Auth] Token de servicio renovado");
  return token;
}

/**
 * Wrapper de fetch autenticado para SIRH.
 * Adjunta automáticamente el Bearer token en cada request.
 *
 * Ejemplo:
 *   const data = await sirhFetch("/api/personal/getEmployees");
 */
export async function sirhFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = process.env.SIRH_BASE_URL ?? "http://localhost:3000";
  const url  = `${base}${path}`;
  const token = getSirhServiceToken();

  const headers = new Headers(options.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  return fetch(url, { ...options, headers, signal: AbortSignal.timeout(15_000) });
}
