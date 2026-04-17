import { api } from "./client.js";

// ── Catálogo ───────────────────────────────────────────────────────────────────
export const getCatalogos = (params) =>
  api.get("/api/recursos", { params }).then((r) => r.data);

export const getCatalogo = (id) =>
  api.get(`/api/recursos/${id}`).then((r) => r.data);

export const createCatalogo = (body) =>
  api.post("/api/recursos", body).then((r) => r.data);

export const updateCatalogo = (id, body) =>
  api.patch(`/api/recursos/${id}`, body).then((r) => r.data);

export const deleteCatalogo = (id) =>
  api.delete(`/api/recursos/${id}`).then((r) => r.data);

// ── Unidades ───────────────────────────────────────────────────────────────────
export const getUnidades = (catalogoId) =>
  api.get(`/api/recursos/${catalogoId}/unidades`).then((r) => r.data);

export const createUnidad = (catalogoId, body) =>
  api.post(`/api/recursos/${catalogoId}/unidades`, body).then((r) => r.data);

export const updateUnidad = (id, body) =>
  api.patch(`/api/recursos/unidades/${id}`, body).then((r) => r.data);

export const deleteUnidad = (id) =>
  api.delete(`/api/recursos/unidades/${id}`).then((r) => r.data);

export const buscarPorSerie = (serie) =>
  api.get(`/api/recursos/unidades/by-serie/${encodeURIComponent(serie)}`).then((r) => r.data);

// ── Asignaciones ───────────────────────────────────────────────────────────────
export const getAsignaciones = (params) =>
  api.get("/api/recursos/asignaciones", { params }).then((r) => r.data);

export const createAsignacion = (body) =>
  api.post("/api/recursos/asignaciones", body).then((r) => r.data);

export const updateAsignacion = (id, body) =>
  api.patch(`/api/recursos/asignaciones/${id}`, body).then((r) => r.data);

export const getOrdenSalida = (id) =>
  api.get(`/api/recursos/asignaciones/${id}/orden-salida`).then((r) => r.data);
