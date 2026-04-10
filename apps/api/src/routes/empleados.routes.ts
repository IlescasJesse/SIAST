import { Router } from "express";
import * as ctrl from "../controllers/empleados.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Requiere JWT — el frontend pasa el token al iframe vía postMessage
router.get("/ubicacion", authMiddleware, ctrl.ubicacion);

export default router;
