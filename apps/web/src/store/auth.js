import { create } from "zustand";
import { api } from "../api/client.js";

// Header RateLimit (IETF draft-8): '"5-in-15min"; r=4; t=900' — r = intentos restantes.
// Emitido por authRateLimiter (rate-limit.middleware.ts) en /api/auth/*.
const parseIntentosRestantes = (headers) => {
  const raw = headers?.["ratelimit"];
  if (!raw) return null;
  const m = /(?:^|;)\s*r=(\d+)/.exec(raw);
  return m ? Number(m[1]) : null;
};

/** Ejecuta una llamada de auth y adjunta intentosRestantes (éxito o error) para avisar antes del bloqueo por IP. */
const conIntentosRestantes = async (fn) => {
  try {
    const res = await fn();
    return { ...res.data, intentosRestantes: parseIntentosRestantes(res.headers) };
  } catch (err) {
    const intentosRestantes = parseIntentosRestantes(err.response?.headers);
    if (intentosRestantes != null) err.intentosRestantes = intentosRestantes;
    throw err;
  }
};

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem("siast_user") ?? "null");
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  user: stored(),
  token: localStorage.getItem("siast_token"),

  // ── OTP (empleados) ───────────────────────────────────────
  /** Paso 1: solicitar código OTP. Devuelve { ok, hint, devCodigo? } o { necesitaTelefono: true } */
  solicitarOtp: async (rfc, telefono, canal, email) =>
    conIntentosRestantes(() =>
      api.post("/api/auth/solicitar-otp", { rfc, telefono, canal, email }),
    ),

  /** Paso 2: verificar código OTP y obtener sesión */
  verificarOtp: async (rfc, codigo) => {
    const data = await conIntentosRestantes(() =>
      api.post("/api/auth/verificar-otp", { rfc, codigo }),
    );
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },

  loginStaff: async (usuario, password) => {
    const data = await conIntentosRestantes(() =>
      api.post("/api/auth/login", { usuario, password }),
    );
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },

  logout: () => {
    localStorage.removeItem("siast_token");
    localStorage.removeItem("siast_user");
    set({ user: null, token: null });
  },
}));
