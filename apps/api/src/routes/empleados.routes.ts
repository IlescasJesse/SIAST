import { Router } from "express";
import * as ctrl from "../controllers/empleados.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

// Requiere JWT — el frontend pasa el token al iframe vía postMessage
router.get("/ubicacion", authMiddleware, ctrl.ubicacion);

// Honorarios (invitados) — solo ADMIN y Mesa de Ayuda pueden registrar/listar.
router.get("/honorarios", authMiddleware, requireRol("ADMIN", "MESA_AYUDA"), ctrl.listarHonorarios);
router.post("/honorarios", authMiddleware, requireRol("ADMIN", "MESA_AYUDA"), ctrl.crearHonorarios);

export default router;
