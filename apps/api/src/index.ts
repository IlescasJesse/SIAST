import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js"; // expuesto como /api/solicitudes
import usuariosRoutes from "./routes/usuarios.routes.js";
import empleadosRoutes from "./routes/empleados.routes.js";
import catalogosRoutes from "./routes/catalogos.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import recursosRoutes from "./routes/recursos.routes.js";
import metricasRoutes from "./routes/metricas.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { configurarSockets } from "./sockets/tickets.socket.js";
import { setIo } from "./services/notificaciones.service.js";
import { syncEmpleados } from "./services/sirh.service.js";
import { initWhatsApp } from "./services/whatsapp.service.js";

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 5101);

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const VIEWER_URL = process.env.VIEWER_URL ?? "http://localhost:5174";
const IS_PROD = process.env.NODE_ENV === "production";

// En desarrollo permite cualquier origen (acceso desde la red local)
const corsOrigin = IS_PROD ? [FRONTEND_URL, VIEWER_URL, "http://localhost:3008"] : true;

// ============================================================
// Socket.IO
// ============================================================
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});
configurarSockets(io);
setIo(io);

// ============================================================
// Middlewares globales
// ============================================================
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// ============================================================
// Rutas
// ============================================================
app.use("/api/auth", authRoutes);
app.use("/api/solicitudes", ticketsRoutes);
app.use("/api/tickets", ticketsRoutes); // alias de retrocompatibilidad
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/empleados", empleadosRoutes);
app.use("/api/employee", empleadosRoutes); // alias para módulo 3D
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/recursos", recursosRoutes);
app.use("/api/metricas", metricasRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

// ============================================================
// Error handler global
// ============================================================
app.use(errorMiddleware);

// ============================================================
// Arranque
// ============================================================
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`🚀 SIAST API lista en http://localhost:${port}`);
  console.log(`🔌 Socket.IO activo`);

  // Inicializar cliente WhatsApp para OTP
  initWhatsApp();

  // Sincronizar empleados desde SIRH si está habilitado
  syncEmpleados().catch((err) => {
    console.error("[SIRH] Error inesperado en syncEmpleados:", err);
  });

  // Sincronización periódica automática cada 12 horas
  const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
  setInterval(() => {
    console.log("[SIRH] Ejecutando sync periódico automático...");
    syncEmpleados().catch((err) => {
      console.error("[SIRH] Error en sync periódico:", err);
    });
  }, SYNC_INTERVAL_MS).unref(); // .unref() para no bloquear el cierre del proceso
});

// ============================================================
// Cierre limpio — libera el puerto al terminar el proceso
// En Windows tsx no cierra sockets de Socket.IO automáticamente,
// por eso forzamos process.exit después de 1 s si httpServer.close
// no termina solo (conexiones WebSocket activas).
// ============================================================
const shutdown = () => {
  io.close();                              // cerrar todas las conexiones Socket.IO
  httpServer.close(() => process.exit(0)); // esperar que el servidor deje de escuchar
  setTimeout(() => process.exit(0), 1000).unref(); // forzar salida en 1 s si sigue abierto
};
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP",  shutdown);
