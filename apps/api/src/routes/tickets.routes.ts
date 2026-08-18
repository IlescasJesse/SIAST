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
    "TECNICO_TI",
    "TECNICO_REDES",
    "TECNICO_SISTEMAS",
    "TECNICO_ELECTRICISTA",
    "TECNICO_PLOMERO",
    "TECNICO_MOVILIDAD",
  ),
  ctrl.misPasos,
);
router.get("/:id", ctrl.obtener);
router.delete("/:id", requireRol("ADMIN", "MESA_AYUDA"), ctrl.eliminar);

router.patch(
  "/:id/asignar",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.asignar,
);
router.patch(
  "/:id/aceptar",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.aceptar,
);
router.patch(
  "/:id/reasignar-area",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.reasignarArea,
);
router.patch(
  "/:id/prioridad",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.actualizarPrioridad,
);
router.patch(
  "/:id/estado",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "TECNICO_TI",
    "TECNICO_REDES",
    "TECNICO_SISTEMAS",
    "TECNICO_ELECTRICISTA",
    "TECNICO_PLOMERO",
    "TECNICO_MOVILIDAD",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
    "GESTOR_RECURSOS_MATERIALES",
    "GESTOR_SALAS_JUNTA",
    "GESTOR_RECURSOS",
    "GESTOR_INVENTARIO",
    "EMPLEADO",
  ),
  ctrl.cambiarEstado,
);
router.post(
  "/:id/comentarios",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "TECNICO_TI",
    "TECNICO_REDES",
    "TECNICO_SISTEMAS",
    "TECNICO_ELECTRICISTA",
    "TECNICO_PLOMERO",
    "TECNICO_MOVILIDAD",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
    "GESTOR_RECURSOS_MATERIALES",
    "GESTOR_SALAS_JUNTA",
    "GESTOR_RECURSOS",
    "GESTOR_INVENTARIO",
  ),
  ctrl.comentar,
);
router.patch(
  "/:id/pasos/:pasoId/completar",
  requireRol(
    "TECNICO_TI",
    "TECNICO_REDES",
    "TECNICO_SISTEMAS",
    "TECNICO_ELECTRICISTA",
    "TECNICO_PLOMERO",
    "TECNICO_MOVILIDAD",
  ),
  ctrl.completarPaso,
);
router.patch(
  "/:id/pasos/:pasoId/asignar",
  requireRol(
    "ADMIN",
    "MESA_AYUDA",
    "RESPONSABLE_TI",
    "RESPONSABLE_SISTEMAS",
    "RESPONSABLE_REDES",
    "RESPONSABLE_MANTENIMIENTO",
    "RESPONSABLE_RECURSOS_MATERIALES",
  ),
  ctrl.asignarPaso,
);

export default router;
