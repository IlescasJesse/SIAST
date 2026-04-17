import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:5101`;

export const api = axios.create({ baseURL: API_BASE });

// ── Adjuntar token en cada petición ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("siast_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Manejo de 401: intenta renovar antes de cerrar sesión ─────────────────────
let isRefreshing = false;
let refreshQueue = []; // callbacks pendientes mientras se renueva

function processQueue(newToken) {
  refreshQueue.forEach((cb) => cb(newToken));
  refreshQueue = [];
}

function forceLogout() {
  localStorage.removeItem("siast_token");
  localStorage.removeItem("siast_user");
  localStorage.removeItem("siast_token_exp");
  window.location.href = "/login";
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;

    // Solo manejar 401 una vez por request
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const token = localStorage.getItem("siast_token");

      // Sin token → ir al login directamente
      if (!token) {
        forceLogout();
        return Promise.reject(err);
      }

      // Si ya se está renovando, encolar la petición
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;

      try {
        // Intentar renovar el token (endpoint acepta tokens expirados recientemente)
        const { data } = await axios.post(
          `${API_BASE}/api/auth/refresh`,
          null,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const newToken = data.token;
        localStorage.setItem("siast_token", newToken);

        // Actualizar expiración guardada
        try {
          const decoded = JSON.parse(atob(newToken.split(".")[1]));
          if (decoded.exp) {
            localStorage.setItem("siast_token_exp", String(decoded.exp));
          }
        } catch {
          /* ignorar si falla decode */
        }

        isRefreshing = false;
        processQueue(newToken);

        // Reintentar la petición original
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        isRefreshing = false;
        processQueue(null);
        forceLogout();
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  },
);

// ── Renovación proactiva ──────────────────────────────────────────────────────
// Renueva el token 10 minutos antes de que expire para evitar interrupciones.

export function iniciarRenovacionProactiva() {
  const MARGEN_SECS = 10 * 60; // 10 minutos antes de expirar
  const CHECK_INTERVAL_MS = 60 * 1000; // checar cada minuto

  setInterval(async () => {
    const token = localStorage.getItem("siast_token");
    if (!token) return;

    let exp;
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      exp = decoded.exp;
    } catch {
      return;
    }

    if (!exp) return;

    const now = Math.floor(Date.now() / 1000);
    const secsRemaining = exp - now;

    // Si quedan menos de MARGEN_SECS segundos → renovar
    if (secsRemaining > 0 && secsRemaining < MARGEN_SECS) {
      try {
        const { data } = await axios.post(
          `${API_BASE}/api/auth/refresh`,
          null,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        localStorage.setItem("siast_token", data.token);
        console.debug("[SIAST] Token renovado proactivamente");
      } catch {
        /* se manejará en el próximo 401 */
      }
    }
  }, CHECK_INTERVAL_MS);
}
