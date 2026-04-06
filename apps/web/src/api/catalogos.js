import { api } from "./client.js";

export const getCategorias = () => api.get("/api/catalogos/categorias").then((r) => r.data);
export const getTecnicos = () => api.get("/api/catalogos/tecnicos").then((r) => r.data);
export const getAreas = () => api.get("/api/catalogos/areas").then((r) => r.data);
export const getPisos = () => api.get("/api/catalogos/pisos").then((r) => r.data);
export const getUsuarios = () => api.get("/api/usuarios").then((r) => r.data);
export const createUsuario = (body) => api.post("/api/usuarios", body).then((r) => r.data);
