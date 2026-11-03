import { api } from "./client.js";

export const getSolicitudes = (params) =>
  api.get("/api/solicitudes", { params }).then((r) => r.data);
export const getSolicitud = (id) => api.get(`/api/solicitudes/${id}`).then((r) => r.data);
export const getSolicitudPorFolio = (folio) =>
  api.get(`/api/solicitudes/folio/${encodeURIComponent(folio)}`).then((r) => r.data);

/** Ruta del detalle en la app: usa el folio legible; cae al id solo si no hubiera folio. */
export const rutaSolicitud = (t) =>
  t?.folio ? `/solicitudes/${encodeURIComponent(t.folio)}` : `/solicitudes/${t?.id}`;
export const createSolicitud = (body) => api.post("/api/solicitudes", body).then((r) => r.data);
export const asignarSolicitud = (id, tecnicoId) =>
  api.patch(`/api/solicitudes/${id}/asignar`, { tecnicoId }).then((r) => r.data);
export const aceptarSolicitud = (id) =>
  api.patch(`/api/solicitudes/${id}/aceptar`).then((r) => r.data);
export const reasignarAreaSolicitud = (id, subcategoria) =>
  api.patch(`/api/solicitudes/${id}/reasignar-area`, { subcategoria }).then((r) => r.data);
export const actualizarPrioridadSolicitud = (id, prioridad) =>
  api.patch(`/api/solicitudes/${id}/prioridad`, { prioridad }).then((r) => r.data);
export const cambiarEstado = (id, estado, comentario) =>
  api.patch(`/api/solicitudes/${id}/estado`, { estado, comentario }).then((r) => r.data);
/** Con `archivos` (File[]) el comentario viaja como multipart; sin ellos, como JSON. */
export const agregarComentario = (id, texto, esInterno = false, archivos = []) => {
  if (archivos.length === 0) {
    return api.post(`/api/solicitudes/${id}/comentarios`, { texto, esInterno }).then((r) => r.data);
  }
  const body = new FormData();
  body.append("texto", texto);
  body.append("esInterno", String(esInterno));
  archivos.forEach((a) => body.append("archivos", a, a.name));
  return api.post(`/api/solicitudes/${id}/comentarios`, body).then((r) => r.data);
};
/** Adjunta archivos (File[]) directamente a la solicitud. */
export const subirAdjuntos = (id, archivos) => {
  const body = new FormData();
  archivos.forEach((a) => body.append("archivos", a, a.name));
  return api.post(`/api/solicitudes/${id}/adjuntos`, body).then((r) => r.data);
};
/** Contenido de un adjunto como Blob (la descarga requiere el token, no es URL pública). */
export const descargarAdjunto = (adjuntoId) =>
  api.get(`/api/solicitudes/adjuntos/${adjuntoId}`, { responseType: "blob" }).then((r) => r.data);
export const eliminarSolicitud = (id) => api.delete(`/api/solicitudes/${id}`).then((r) => r.data);
export const getMisPasos = () => api.get("/api/solicitudes/mis-pasos").then((r) => r.data);
export const completarPaso = (ticketId, pasoId, body) =>
  api.patch(`/api/solicitudes/${ticketId}/pasos/${pasoId}/completar`, body).then((r) => r.data);
export const asignarPaso = (ticketId, pasoId, tecnicoId) =>
  api
    .patch(`/api/solicitudes/${ticketId}/pasos/${pasoId}/asignar`, { tecnicoId })
    .then((r) => r.data);
