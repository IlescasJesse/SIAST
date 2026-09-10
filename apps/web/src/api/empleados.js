import { api } from "./client.js";

// Honorarios (invitados) — registro manual por ADMIN / Mesa de Ayuda (P4-12).
export const getHonorarios = () => api.get("/api/empleados/honorarios").then((r) => r.data);
export const createHonorarios = (body) =>
  api.post("/api/empleados/honorarios", body).then((r) => r.data);
