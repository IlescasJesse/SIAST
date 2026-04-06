import { Router } from "express";
import * as ctrl from "../controllers/tickets.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", ctrl.listar);
router.post("/", requireRol("EMPLEADO", "MESA_AYUDA", "ADMIN"), ctrl.crear);
router.get("/:id", ctrl.obtener);
router.delete("/:id", requireRol("ADMIN", "MESA_AYUDA"), ctrl.eliminar);

router.patch("/:id/asignar", requireRol("ADMIN"), ctrl.asignar);
router.patch(
  "/:id/estado",
  requireRol("ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "EMPLEADO"),
  ctrl.cambiarEstado,
);
router.post(
  "/:id/comentarios",
  requireRol("ADMIN", "TECNICO_INFORMATICO", "TECNICO_SERVICIOS", "MESA_AYUDA"),
  ctrl.comentar,
);

export default router;
