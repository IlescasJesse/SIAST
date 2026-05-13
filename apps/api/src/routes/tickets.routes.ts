import { Router } from "express";
import * as ctrl from "../controllers/tickets.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", ctrl.listar);
router.post("/", requireRol("EMPLEADO", "MESA_AYUDA", "ADMIN"), ctrl.crear);
router.get(
  "/mis-pasos",
  requireRol(
    "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
    "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
  ),
  ctrl.misPasos,
);
router.get("/:id", ctrl.obtener);
router.delete("/:id", requireRol("ADMIN", "MESA_AYUDA"), ctrl.eliminar);

router.patch(
  "/:id/asignar",
  requireRol(
    "ADMIN",
    "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.asignar,
);
router.patch(
  "/:id/estado",
  requireRol(
    "ADMIN",
    "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
    "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
    "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
    "EMPLEADO",
  ),
  ctrl.cambiarEstado,
);
router.post(
  "/:id/comentarios",
  requireRol(
    "ADMIN", "MESA_AYUDA",
    "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
    "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
    "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.comentar,
);
router.patch(
  "/:id/pasos/:pasoId/completar",
  requireRol(
    "TECNICO_TI", "TECNICO_REDES", "TECNICO_SERVICIOS",
    "TECNICO_ELECTRICISTA", "TECNICO_PLOMERO", "TECNICO_MOVILIDAD",
  ),
  ctrl.completarPaso,
);
router.patch(
  "/:id/pasos/:pasoId/asignar",
  requireRol(
    "ADMIN", "MESA_AYUDA",
    "RESPONSABLE_TI", "RESPONSABLE_REDES", "RESPONSABLE_MANTENIMIENTO", "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.asignarPaso,
);

export default router;
