import { Router } from "express";
import * as ctrl from "../controllers/tickets.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import { subirAdjuntos } from "../middleware/upload.middleware.js";

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
// Detalle por folio legible (TEC-SIS-0023) — debe ir antes de "/:id".
router.get("/folio/:folio", ctrl.obtenerPorFolio);
// Descarga de un adjunto (valida alcance sobre su solicitud) — antes de "/:id".
router.get("/adjuntos/:adjuntoId", ctrl.descargarAdjunto);
router.get("/:id", ctrl.obtener);
router.delete("/:id", requireRol("ADMIN", "MESA_AYUDA"), ctrl.eliminar);
// Adjuntos de la solicitud (capturas / documentos al crearla). Cualquier rol con
// acceso de lectura a la solicitud; el alcance se valida en el servicio.
router.post("/:id/adjuntos", subirAdjuntos, ctrl.adjuntar);

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
  subirAdjuntos,
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
    // Admin también puede tener pasos asignados (los asigna Admin o Mesa de Ayuda).
    "ADMIN",
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
