/**
 * sirhAuth.service.ts
 *
 * Obtiene y cachea un token de sesión real de SIRH llamando a su endpoint
 * de login. El token resultante existe en la colección SESIONES de MongoDB
 * de SIRH, por lo que pasa su middleware de autenticación completo:
 *   1. jwt.verify(token, SECRET_KEY)  ✓
 *   2. query("SESIONES", { jwt: token }) — sesión existe ✓
 *   3. query("USUARIOS", { username }) — usuario existe ✓
 *
 * Variables de entorno requeridas:
 *   SIRH_BASE_URL         URL base de SIRH (ej: http://localhost:3000)
 *   SIRH_LOGIN_ENDPOINT   Endpoint de login de SIRH (default: /api/auth/login)
 *   SIRH_SERVICE_USER     Usuario de cuenta de servicio en SIRH
 *   SIRH_SERVICE_PASS     Contraseña de cuenta de servicio en SIRH
 */

// ── Config ────────────────────────────────────────────────────────────────────

const SIRH_BASE          = process.env.SIRH_BASE_URL      ?? "http://localhost:3000";
const SIRH_LOGIN_PATH    = process.env.SIRH_LOGIN_ENDPOINT ?? "/api/auth/login";
const SERVICE_USER       = process.env.SIRH_SERVICE_USER  ?? "";
const SERVICE_PASS       = process.env.SIRH_SERVICE_PASS  ?? "";

/** Margen antes del vencimiento para renovar el token (30 min en ms) */
const REFRESH_BUFFER_MS  = 30 * 60 * 1000;

/** Tiempo de vida asumido si SIRH no informa expiración (6 h en ms) */
const DEFAULT_TTL_MS     = 6 * 60 * 60 * 1000;

if (!SERVICE_USER || !SERVICE_PASS) {
  console.warn(
    "[SIRH-Auth] SIRH_SERVICE_USER / SIRH_SERVICE_PASS no configurados en .env — " +
    "las llamadas a SIRH fallarán si SIRH_ENABLED=true",
  );
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface TokenCache {
  token:     string;
  expiresAt: number; // epoch ms
}

let cache: TokenCache | null = null;
let refreshPromise: Promise<string> | null = null;

// ── Login contra SIRH ─────────────────────────────────────────────────────────

async function loginSirh(): Promise<string> {
  const url = `${SIRH_BASE}${SIRH_LOGIN_PATH}`;

  console.log(`[SIRH-Auth] Iniciando sesión en SIRH: ${url}`);

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ username: SERVICE_USER, password: SERVICE_PASS }),
    signal:  AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SIRH login falló (${res.status}): ${body}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // SIRH puede responder con { token }, { accessToken }, { jwt }, etc.
  const token = (data["token"] ?? data["accessToken"] ?? data["jwt"]) as string | undefined;

  if (!token || typeof token !== "string") {
    throw new Error(`SIRH login: respuesta sin token. Cuerpo: ${JSON.stringify(data)}`);
  }

  // Calcular expiración: decodificar exp del JWT si está presente
  let expiresAt = Date.now() + DEFAULT_TTL_MS;
  try {
    const payloadB64 = token.split(".")[1];
    if (payloadB64) {
      const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString()) as { exp?: number };
      if (payload.exp) expiresAt = payload.exp * 1000;
    }
  } catch {
    // usa DEFAULT_TTL_MS
  }

  cache = { token, expiresAt };
  console.log(
    `[SIRH-Auth] Token renovado. Válido hasta: ${new Date(expiresAt).toLocaleTimeString()}`,
  );
  return token;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve un token válido para SIRH.
 * - Si el cache está vigente y no está próximo a vencer, lo reutiliza.
 * - Si está próximo a vencer o no existe, llama al login de SIRH.
 * - Colapsa múltiples llamadas concurrentes en una sola petición de login.
 */
export async function getSirhServiceToken(): Promise<string> {
  const now = Date.now();

  // Token en cache válido
  if (cache && cache.expiresAt - REFRESH_BUFFER_MS > now) {
    return cache.token;
  }

  // Colapsar llamadas concurrentes: si ya hay un refresh en curso, esperarlo
  if (refreshPromise) return refreshPromise;

  refreshPromise = loginSirh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

/**
 * Wrapper de fetch autenticado para SIRH.
 * Adjunta automáticamente el Bearer token en cada request.
 *
 * Ejemplo:
 *   const resp = await sirhFetch("/api/personal/getEmployees");
 *   const data = await resp.json();
 */
export async function sirhFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url   = `${SIRH_BASE}${path}`;
  const token = await getSirhServiceToken();

  const headers = new Headers(options.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type",  "application/json");

  return fetch(url, { ...options, headers, signal: AbortSignal.timeout(15_000) });
}
