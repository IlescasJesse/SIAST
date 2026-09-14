import { Router } from "express";
import * as ctrl from "../controllers/empleados.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

// Requiere JWT — el frontend pasa el token al iframe vía postMessage
router.get("/ubicacion", authMiddleware, ctrl.ubicacion);

// Alias en inglés para el módulo 3D — mismo comportamiento (ver PROMPT_AGENTE_BACKEND.md).
// El visor 3D llama a /api/employee/location, que faltaba y devolvía 404 en silencio.
router.get("/location", authMiddleware, ctrl.ubicacion);

// Honorarios (invitados) — solo ADMIN y Mesa de Ayuda pueden registrar/listar.
router.get("/honorarios", authMiddleware, requireRol("ADMIN", "MESA_AYUDA"), ctrl.listarHonorarios);
router.post("/honorarios", authMiddleware, requireRol("ADMIN", "MESA_AYUDA"), ctrl.crearHonorarios);

export default router;
