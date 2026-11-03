import { Router } from "express";
import { CrearAvisoSistemaSchema, CrearNovedadSchema } from "@stf/shared";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { monitorAuth } from "../middleware/monitor.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as ctrl from "../controllers/sistema.controller.js";

const router = Router();

// ── Aviso global ──────────────────────────────────────────────────────────────
// Público: el login también muestra el aviso (sin sesión).
router.get("/aviso", ctrl.obtenerAviso);
// Solo el monitor del servidor (header X-Monitor-Token).
router.post("/aviso", monitorAuth, validate(CrearAvisoSistemaSchema), ctrl.publicarAviso);
router.delete("/aviso", monitorAuth, ctrl.quitarAviso);

// ── Novedades de versión ─────────────────────────────────────────────────────
// Usuario con sesión: las novedades que le tocan según su rol.
router.get("/novedades", authMiddleware, ctrl.listarNovedades);
// Monitor: historial completo, publicar y retirar.
router.get("/novedades/monitor", monitorAuth, ctrl.listarNovedadesMonitor);
router.post("/novedades", monitorAuth, validate(CrearNovedadSchema), ctrl.publicarNovedad);
router.delete("/novedades/:id", monitorAuth, ctrl.retirarNovedad);

export default router;
