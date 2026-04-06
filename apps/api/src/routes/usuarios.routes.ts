import { Router } from "express";
import * as ctrl from "../controllers/usuarios.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

router.use(authMiddleware, requireRol("ADMIN"));

router.get("/", ctrl.listar);
router.post("/", ctrl.crear);
router.get("/:id", ctrl.obtener);
router.patch("/:id", ctrl.actualizar);
router.delete("/:id", ctrl.desactivar);

export default router;
