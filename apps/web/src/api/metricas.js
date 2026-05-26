import { api } from "./client.js";

/**
 * Llama GET /api/metricas con los parámetros dados.
 * @param {Object} params - { tipo, fechaInicio, fechaFin, areaId?, tecnicoId? }
 * @returns {Promise<import('@stf/shared').MetricasResponse>}
 */
export const getMetricas = (params) =>
  api.get("/api/metricas", { params }).then((r) => r.data);
