import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:5101`;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("siast_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("siast_token");
      localStorage.removeItem("siast_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);
