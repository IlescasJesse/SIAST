import { defineConfig } from "vite";

export default defineConfig({
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
