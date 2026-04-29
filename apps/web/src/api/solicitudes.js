import { api } from "./client.js";

export const getSolicitudes = (params) => api.get("/api/solicitudes", { params }).then((r) => r.data);
export const getSolicitud = (id) => api.get(`/api/solicitudes/${id}`).then((r) => r.data);
export const createSolicitud = (body) => api.post("/api/solicitudes", body).then((r) => r.data);
export const asignarSolicitud = (id, tecnicoId) =>
  api.patch(`/api/solicitudes/${id}/asignar`, { tecnicoId }).then((r) => r.data);
export const cambiarEstado = (id, estado, comentario) =>
  api.patch(`/api/solicitudes/${id}/estado`, { estado, comentario }).then((r) => r.data);
export const agregarComentario = (id, texto, esInterno = false) =>
  api.post(`/api/solicitudes/${id}/comentarios`, { texto, esInterno }).then((r) => r.data);
export const eliminarSolicitud = (id) => api.delete(`/api/solicitudes/${id}`).then((r) => r.data);
export const getMisPasos = () => api.get("/api/solicitudes/mis-pasos").then((r) => r.data);
export const completarPaso = (ticketId, pasoId, body) =>
  api.patch(`/api/solicitudes/${ticketId}/pasos/${pasoId}/completar`, body).then((r) => r.data);
export const asignarPaso = (ticketId, pasoId, tecnicoId) =>
  api.patch(`/api/solicitudes/${ticketId}/pasos/${pasoId}/asignar`, { tecnicoId }).then((r) => r.data);
