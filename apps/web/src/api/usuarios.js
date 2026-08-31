import { api } from "./client.js";

export const getUsuarios = () => api.get("/api/usuarios").then((r) => r.data);
export const createUsuario = (body) => api.post("/api/usuarios", body).then((r) => r.data);
export const updateUsuario = (id, body) =>
  api.patch(`/api/usuarios/${id}`, body).then((r) => r.data);
export const deleteUsuario = (id) => api.delete(`/api/usuarios/${id}`).then((r) => r.data);
export const updatePassword = (body) => api.patch("/api/auth/password", body).then((r) => r.data);
export const getPerfil = () => api.get("/api/auth/me").then((r) => r.data);
export const updateNotificacionesWhatsapp = (body) =>
  api.patch("/api/auth/notificaciones-whatsapp", body).then((r) => r.data);
export const completarPerfil = (body) =>
  api.patch("/api/auth/completar-perfil", body).then((r) => r.data);
