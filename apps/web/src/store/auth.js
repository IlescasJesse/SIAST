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
