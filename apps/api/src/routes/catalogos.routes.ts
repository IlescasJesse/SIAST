import { Router } from "express";
import * as ctrl from "../controllers/catalogos.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

// Rutas públicas — datos del edificio, no sensibles (el visor 3D las necesita sin token)
router.get("/areas",  ctrl.areas);
router.get("/pisos",  ctrl.pisos);

// El resto requiere sesión SIAST válida
router.use(authMiddleware);

router.get("/categorias", ctrl.categorias);
router.get("/tecnicos",   ctrl.tecnicos);

// Proxy SIRH — además verifica sesión con SIRH internamente
router.get("/sirh-adscripciones", ctrl.sirhAdscripciones);
router.get("/sirh-empleado", ctrl.sirhEmpleado);
router.get("/disponibilidad-tecnico/:empleadoId", ctrl.disponibilidadTecnico);

// CRUD de áreas — solo ADMIN (authMiddleware ya aplicado por router.use)
router.post("/areas",      requireRol("ADMIN"), ctrl.crearArea);
router.put("/areas/:id",   requireRol("ADMIN"), ctrl.actualizarArea);
router.delete("/areas/:id", requireRol("ADMIN"), ctrl.eliminarArea);

export default router;
