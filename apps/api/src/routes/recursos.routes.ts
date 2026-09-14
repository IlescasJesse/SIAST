import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import * as ctrl from "../controllers/recursos.controller.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Todos los roles "gestores" de recursos materiales comparten el mismo nivel
// de gestión operativa (CRUD); RESPONSABLE_RECURSOS_MATERIALES queda por
// encima con acceso de supervisión (solo lectura).
const ROLES_GESTOR_RECURSOS = [
  "GESTOR_RECURSOS_MATERIALES",
  "GESTOR_SALAS_JUNTA",
  "GESTOR_RECURSOS",
  "GESTOR_INVENTARIO",
] as const;

// ── Asignaciones (antes de /:id para evitar conflictos) ──────────────────────
router.get(
  "/asignaciones",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS, "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.listarAsignaciones,
);

router.post("/asignaciones", requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS), ctrl.crearAsignacion);

router.patch(
  "/asignaciones/:id",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS),
  ctrl.actualizarAsignacion,
);

router.get(
  "/asignaciones/:id/orden-salida",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS, "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.ordenSalida,
);

// ── Unidades — operaciones directas (antes de /:id numérico) ─────────────────
// IMPORTANTE: /unidades/by-serie/:serie debe ir ANTES de /unidades/:id
router.get(
  "/unidades/by-serie/:serie",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS, "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.buscarUnidadPorSerie,
);

router.patch("/unidades/:id", requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS), ctrl.actualizarUnidad);

router.delete("/unidades/:id", requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS), ctrl.eliminarUnidad);

// ── Catálogo (CRUD de tipos de recurso) ──────────────────────────────────────
router.get(
  "/",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS, "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.listarCatalogos,
);

router.get(
  "/:id",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS, "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.obtenerCatalogo,
);

router.get(
  "/:catalogoId/unidades",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS, "RESPONSABLE_RECURSOS_MATERIALES"),
  ctrl.listarUnidades,
);

// ── Catálogo (solo escritura para ADMIN y GESTOR) ─────────────────────────────
router.post("/", requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS), ctrl.crearCatalogo);

router.patch("/:id", requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS), ctrl.actualizarCatalogo);

router.delete("/:id", requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS), ctrl.eliminarCatalogo);

router.post(
  "/:catalogoId/unidades",
  requireRol("ADMIN", ...ROLES_GESTOR_RECURSOS),
  ctrl.crearUnidad,
);

export default router;
