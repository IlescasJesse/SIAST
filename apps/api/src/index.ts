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
import * as metricasService from "./services/metricas.service.js";
import { prisma } from "./config/database.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { configurarSockets } from "./sockets/tickets.socket.js";
import { setIo } from "./services/notificaciones.service.js";
import { syncEmpleados } from "./services/sirh.service.js";
import { initWhatsApp } from "./services/whatsapp.service.js";

// ── STARTUP: validación de variables de entorno obligatorias ──────────────────
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}
if (!process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS env var is required");
}
const corsOrigins = process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 5101);

// ============================================================
// Socket.IO
// ============================================================
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
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
    origin: corsOrigins,
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

  // ── Job diario: snapshot de métricas en MetricasHistorial (Phase 4, D-20) ─────
  async function ejecutarSnapshotMetricas(): Promise<void> {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // inicio del día

      // Snapshot global (sin área)
      const global = await metricasService.obtenerMetricasGlobal();
      await prisma.metricasHistorial.upsert({
        where: { fecha_areaSoporteId: { fecha: hoy, areaSoporteId: null as any } },
        create: {
          fecha: hoy,
          areaSoporteId: null,
          totalTickets: global.totalTickets,
          ticketsResueltos: global.ticketsResueltos,
          ticketsActivos: global.ticketsActivos,
          slaGlobal: global.slaGlobal,
          tiempoPromedioHoras: global.tiempoPromedioHoras,
        },
        update: {
          totalTickets: global.totalTickets,
          ticketsResueltos: global.ticketsResueltos,
          ticketsActivos: global.ticketsActivos,
          slaGlobal: global.slaGlobal,
          tiempoPromedioHoras: global.tiempoPromedioHoras,
        },
      });

      // Snapshot por área
      const areas = await prisma.areaSoporte.findMany({
        where: { activo: true },
        select: { id: true },
      });
      for (const area of areas) {
        const areaData = await metricasService.obtenerMetricasPorArea(area.id);
        await prisma.metricasHistorial.upsert({
          where: { fecha_areaSoporteId: { fecha: hoy, areaSoporteId: area.id } },
          create: {
            fecha: hoy,
            areaSoporteId: area.id,
            totalTickets: areaData.ticketsActivos + areaData.ticketsReabiertos,
            ticketsResueltos: 0,
            ticketsActivos: areaData.ticketsActivos,
            slaGlobal: areaData.slaGlobal,
            tiempoPromedioHoras: areaData.tiempoPromedioHoras,
          },
          update: {
            ticketsActivos: areaData.ticketsActivos,
            slaGlobal: areaData.slaGlobal,
            tiempoPromedioHoras: areaData.tiempoPromedioHoras,
          },
        });
      }

      console.log(`[MetricasHistorial] Snapshot guardado — ${hoy.toISOString().slice(0, 10)}`);
    } catch (err) {
      console.error("[MetricasHistorial] Error al guardar snapshot:", err);
    }
  }

  // Ejecutar inmediatamente al arrancar y luego cada 24h (D-20, sin node-cron)
  ejecutarSnapshotMetricas();
  const VEINTICUATRO_HORAS = 24 * 60 * 60 * 1000;
  setInterval(ejecutarSnapshotMetricas, VEINTICUATRO_HORAS).unref();
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
