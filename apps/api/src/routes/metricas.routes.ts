import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import * as ctrl from "../controllers/metricas.controller.js";

const router = Router();

// Todas las rutas de métricas requieren autenticación
router.use(authMiddleware);

// Roles permitidos: ADMIN y cualquier técnico (para ver sus propias métricas)
const rolesMetricas = requireRol("ADMIN", "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS");

// GET /api/metricas/solicitudes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get("/solicitudes", rolesMetricas, ctrl.metricasSolicitudes);

// GET /api/metricas/tecnicos
router.get("/tecnicos", rolesMetricas, ctrl.metricasTecnicos);

// GET /api/metricas/procesos?slaHoras=24
router.get("/procesos", rolesMetricas, ctrl.metricasProcesos);

export default router;
