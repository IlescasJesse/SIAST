import { api } from "./client.js";

/**
 * Llama GET /api/metricas con los parámetros dados.
 * @param {Object} params - { tipo, fechaInicio, fechaFin, areaId?, tecnicoId? }
 * @param {AbortSignal} [signal] - Señal para cancelar la petición al desmontar el componente
 * @returns {Promise<import('@stf/shared').MetricasResponse>}
 */
export const getMetricas = (params, signal) =>
  api.get("/api/metricas", { params, signal }).then((r) => r.data);
