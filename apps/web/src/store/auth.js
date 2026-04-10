import { create } from "zustand";
import { api } from "../api/client.js";

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
  solicitarOtp: async (rfc, telefono) => {
    const { data } = await api.post("/api/auth/solicitar-otp", { rfc, telefono });
    return data;
  },

  /** Paso 2: verificar código OTP y obtener sesión */
  verificarOtp: async (rfc, codigo) => {
    const { data } = await api.post("/api/auth/verificar-otp", { rfc, codigo });
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },

  // ── Legacy (sin OTP) ──────────────────────────────────────
  loginRFC: async (rfc) => {
    const { data } = await api.post("/api/auth/login-rfc", { rfc });
    localStorage.setItem("siast_token", data.token);
    localStorage.setItem("siast_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data;
  },

  loginStaff: async (usuario, password) => {
    const { data } = await api.post("/api/auth/login", { usuario, password });
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
