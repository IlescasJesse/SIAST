import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import empleadosRoutes from "./routes/empleados.routes.js";
import catalogosRoutes from "./routes/catalogos.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { configurarSockets } from "./sockets/tickets.socket.js";
import { setIo } from "./services/notificaciones.service.js";

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 3001);

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const VIEWER_URL = process.env.VIEWER_URL ?? "http://localhost:5174";

// ============================================================
// Socket.IO
// ============================================================
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, VIEWER_URL, "http://localhost:3008"],
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
    origin: [FRONTEND_URL, VIEWER_URL, "http://localhost:3008"],
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
app.use("/api/tickets", ticketsRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/empleados", empleadosRoutes);
app.use("/api/employee", empleadosRoutes); // alias para módulo 3D
app.use("/api/catalogos", catalogosRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

// ============================================================
// Error handler global
// ============================================================
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message ?? "Error interno del servidor" });
  },
);
app.use(errorMiddleware);

// ============================================================
// Arranque
// ============================================================
httpServer.listen(port, () => {
  console.log(`🚀 SIAST API lista en http://localhost:${port}`);
  console.log(`🔌 Socket.IO activo`);
});
