import { api } from "./client.js";

// ── Procesos ──────────────────────────────────────────────────────────────────
export const getProcesos = () => api.get("/api/admin/procesos").then((r) => r.data.data);
export const getProceso = (id) => api.get(`/api/admin/procesos/${id}`).then((r) => r.data);
export const createProceso = (body) => api.post("/api/admin/procesos", body).then((r) => r.data);
export const updateProceso = (id, body) => api.put(`/api/admin/procesos/${id}`, body).then((r) => r.data);
export const toggleProceso = (id) => api.patch(`/api/admin/procesos/${id}/toggle`).then((r) => r.data);

// ── Usuarios ──────────────────────────────────────────────────────────────────
export const getUsuarios = () => api.get("/api/admin/usuarios").then((r) => r.data.data);
export const getUsuario = (id) => api.get(`/api/admin/usuarios/${id}`).then((r) => r.data);
export const createUsuario = (body) => api.post("/api/admin/usuarios", body).then((r) => r.data);
export const updateUsuario = (id, body) => api.patch(`/api/admin/usuarios/${id}`, body).then((r) => r.data);
export const desactivarUsuario = (id) => api.delete(`/api/admin/usuarios/${id}`).then((r) => r.data);

// ── Seguridad ─────────────────────────────────────────────────────────────────
export const getLogsAcceso = (params) => api.get("/api/admin/logs-acceso", { params }).then((r) => r.data);
export const getSesiones = () => api.get("/api/admin/sesiones").then((r) => r.data.data);
export const cerrarSesionAdmin = (id) => api.delete(`/api/admin/sesiones/${id}`).then((r) => r.data);

// ── SIRH ──────────────────────────────────────────────────────────────────────
export const getSirhStatus = () => api.get("/api/admin/sirh/status").then((r) => r.data.data);
export const triggerSirhSync = () => api.post("/api/admin/sirh/sync").then((r) => r.data);
export const getSirhEmpleados = (params) => api.get("/api/admin/sirh/empleados", { params }).then((r) => r.data);
