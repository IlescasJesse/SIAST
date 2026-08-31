import { api } from "./client.js";

export const getCategorias = () => api.get("/api/catalogos/categorias").then((r) => r.data);
export const getTecnicos = (categoria) =>
  api
    .get("/api/catalogos/tecnicos", { params: categoria ? { categoria } : {} })
    .then((r) => r.data);
export const getAreas = () => api.get("/api/catalogos/areas").then((r) => r.data);
export const getPisos = () => api.get("/api/catalogos/pisos").then((r) => r.data);
export const getUsuarios = () => api.get("/api/usuarios").then((r) => r.data);
export const createUsuario = (body) => api.post("/api/usuarios", body).then((r) => r.data);

// ─── Áreas CRUD (admin) ────────────────────────────────────────────────────
export const createArea = (body) => api.post("/api/catalogos/areas", body).then((r) => r.data);
export const updateArea = (id, body) =>
  api.put(`/api/catalogos/areas/${id}`, body).then((r) => r.data);
export const deleteArea = (id) => api.delete(`/api/catalogos/areas/${id}`).then((r) => r.data);

// ─── SIRH adscripciones ───────────────────────────────────────────────────
export const getSirhAdscripciones = () =>
  api.get("/api/catalogos/sirh-adscripciones").then((r) => r.data);

// ─── SIRH búsqueda de empleado por RFC ────────────────────────────────────
export const getSirhEmpleado = (rfc) =>
  api.get("/api/catalogos/sirh-empleado", { params: { rfc } }).then((r) => r.data);

// ─── Disponibilidad de técnico (vacaciones) ───────────────────────────────
export const getDisponibilidadTecnico = (empleadoId) =>
  api.get(`/api/catalogos/disponibilidad-tecnico/${empleadoId}`).then((r) => r.data);

// ─── Áreas sugeridas por adscripción (completar perfil) ───────────────────
export const getAreasSugeridas = () =>
  api.get("/api/catalogos/areas-sugeridas").then((r) => r.data);

// ─── Áreas de Soporte (Phase 3) ──────────────────────────────────────────
export const getAreasSoporte = () => api.get("/api/admin/areas-soporte").then((r) => r.data.data);

// ─── Admin: sincronización SIRH ───────────────────────────────────────────
export const getSirhSyncStatus = () => api.get("/api/admin/sirh/status").then((r) => r.data);

export const postSirhSyncNow = () => api.post("/api/admin/sirh/sync").then((r) => r.data);

// ─── Muebles / Cubículos por área ─────────────────────────────────────────
export const getMueblesByArea = (areaId) =>
  api.get(`/api/admin/areas/${areaId}/muebles`).then((r) => r.data);

export const createMueble = (areaId, data) =>
  api.post(`/api/admin/areas/${areaId}/muebles`, data).then((r) => r.data);

export const createFilaMuebles = (areaId, data) =>
  api.post(`/api/admin/areas/${areaId}/muebles/fila`, data).then((r) => r.data);

export const updateMueble = (muebleId, data) =>
  api.put(`/api/admin/muebles/${muebleId}`, data).then((r) => r.data);

export const deleteMueble = (muebleId) =>
  api.delete(`/api/admin/muebles/${muebleId}`).then((r) => r.data);
