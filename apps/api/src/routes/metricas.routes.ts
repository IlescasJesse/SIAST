import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import * as ctrl from "../controllers/metricas.controller.js";

const router = Router();

router.use(authMiddleware);

// Todos los roles con acceso a métricas (Phase 3+ incluidos — pitfall 6 del RESEARCH)
const rolesMetricas = requireRol(
  "ADMIN",
  "MESA_AYUDA",
  "RESPONSABLE_TI",
  "RESPONSABLE_REDES",
  "RESPONSABLE_MANTENIMIENTO",
  "RESPONSABLE_RECURSOS_MATERIALES",
  "TECNICO_TI",
  "TECNICO_REDES",
  "TECNICO_ELECTRICISTA",
  "TECNICO_PLOMERO",
  "TECNICO_MOVILIDAD",
);

// Endpoint único paramétrico (D-10)
router.get("/", rolesMetricas, ctrl.obtener);

export default router;
