import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import * as adminCtrl from "../controllers/admin.controller.js";
import * as procesosCtrl from "../controllers/admin-procesos.controller.js";
import * as usuariosCtrl from "../controllers/usuarios.controller.js";
import * as seguridadCtrl from "../controllers/admin-seguridad.controller.js";
import * as mueblesCtrl from "../controllers/muebles.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import { prisma } from "../config/database.js";

const router = Router();

router.use(authMiddleware, requireRol("ADMIN"));

const listarAreasSoporte = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.areaSoporte.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// ── SIRH ─────────────────────────────────────────────────────────────────────
router.get("/sirh/status", adminCtrl.sirhSyncStatus);
router.post("/sirh/sync", adminCtrl.sirhSyncNow);
router.get("/sirh/empleados", adminCtrl.sirhEmpleados);

// ── Procesos de flujo ─────────────────────────────────────────────────────────
router.get("/procesos", procesosCtrl.listar);
router.get("/procesos/:id", procesosCtrl.obtener);
router.post("/procesos", procesosCtrl.crear);
router.put("/procesos/:id", procesosCtrl.actualizar);
router.patch("/procesos/:id/toggle", procesosCtrl.toggleActivo);

// ── Usuarios (movido aquí desde /api/usuarios) ────────────────────────────────
router.get("/usuarios", usuariosCtrl.listar);
router.post("/usuarios", usuariosCtrl.crear);
router.get("/usuarios/:id", usuariosCtrl.obtener);
router.patch("/usuarios/:id", usuariosCtrl.actualizar);
router.delete("/usuarios/:id", usuariosCtrl.desactivar);

// ── Áreas de Soporte ──────────────────────────────────────────────────────────
router.get("/areas-soporte", listarAreasSoporte);

// ── Muebles (cubículos, escritorios, salas dentro de un área) ─────────────────
router.get("/areas/:areaId/muebles", mueblesCtrl.listarMuebles);
router.post("/areas/:areaId/muebles", mueblesCtrl.crearMueble);
router.put("/muebles/:id", mueblesCtrl.actualizarMueble);
router.delete("/muebles/:id", mueblesCtrl.eliminarMueble);

// ── Seguridad: logs de acceso y sesiones activas ──────────────────────────────
router.get("/logs-acceso", seguridadCtrl.listarLogs);
router.get("/sesiones", seguridadCtrl.listarSesiones);
router.delete("/sesiones/:id", seguridadCtrl.cerrarSesionAdmin);

export default router;
