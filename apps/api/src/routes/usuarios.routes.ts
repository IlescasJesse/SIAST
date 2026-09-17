import { Router } from "express";
import * as ctrl from "../controllers/usuarios.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

// Organigrama: cualquier usuario autenticado puede consultarlo (no solo ADMIN) —
// va antes del requireRol("ADMIN") de abajo, que solo aplica a las rutas de
// administración de usuarios (CRUD).
router.get("/organigrama", authMiddleware, ctrl.organigrama);

router.use(authMiddleware, requireRol("ADMIN"));

router.get("/", ctrl.listar);
router.post("/", ctrl.crear);
router.get("/:id", ctrl.obtener);
router.patch("/:id", ctrl.actualizar);
router.delete("/:id", ctrl.desactivar);

export default router;
