import { defineConfig } from "vite";

export default defineConfig({
  // Servido bajo la ruta /visor3d/ del dominio principal (siast.local/visor3d/)
  // para no depender de un subdominio propio que cada PC tendria que resolver.
  base: "/visor3d/",
  server: {
    port: 5174,
    host: true,
    cors: true,
    // Permitir que el visor sea embebido como iframe desde cualquier origen
    // (el frontend React en localhost:5173 lo carga en un <iframe>)
    headers: {
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  },
  build: {
    outDir: "dist",
  },
});
