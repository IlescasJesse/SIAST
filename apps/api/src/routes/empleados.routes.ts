import { Router } from "express";
import * as ctrl from "../controllers/empleados.controller.js";

const router = Router();

// Ruta pública — usada por módulo 3D
router.get("/ubicacion", ctrl.ubicacion);

export default router;
