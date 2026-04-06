import { api } from "./client.js";

export const getTickets = (params) => api.get("/api/tickets", { params }).then((r) => r.data);
export const getTicket = (id) => api.get(`/api/tickets/${id}`).then((r) => r.data);
export const createTicket = (body) => api.post("/api/tickets", body).then((r) => r.data);
export const asignarTicket = (id, tecnicoId) =>
  api.patch(`/api/tickets/${id}/asignar`, { tecnicoId }).then((r) => r.data);
export const cambiarEstado = (id, estado, comentario) =>
  api.patch(`/api/tickets/${id}/estado`, { estado, comentario }).then((r) => r.data);
export const agregarComentario = (id, texto, esInterno = false) =>
  api.post(`/api/tickets/${id}/comentarios`, { texto, esInterno }).then((r) => r.data);
export const eliminarTicket = (id) => api.delete(`/api/tickets/${id}`).then((r) => r.data);
