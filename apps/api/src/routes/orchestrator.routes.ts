import { Router } from "express";
import * as ctrl from "../controllers/orchestrator.controller.js";

/**
 * Rutas del orquestador para el dashboard local (`agent-dashboard.html`).
 * Sin authMiddleware a propósito: el dashboard se abre como archivo local sin
 * JWT y solo maneja progreso de agentes + preguntas de UI (datos no sensibles).
 * El CORS abierto se aplica al montar este router en index.ts.
 */
const router = Router();

// Todas las rutas exigen el token compartido (DASHBOARD_TOKEN): se exponen a
// internet vía túnel y no usan JWT.
router.use(ctrl.dashboardAuth);

router.get("/dashboard", ctrl.getDashboard);
router.get("/status", ctrl.getStatus);
router.post("/answer", ctrl.postAnswer);
router.post("/action", ctrl.postAction);
router.post("/chat", ctrl.postChat);

// Tablero dinámico que el orquestador (claude -p) actualiza en vivo
router.post("/tasks", ctrl.postTasks);
router.patch("/tasks/:id", ctrl.patchTask);
router.post("/phases", ctrl.postPhases);
router.post("/questions", ctrl.postQuestion);
router.get("/media/:file", ctrl.getMedia);

export default router;
