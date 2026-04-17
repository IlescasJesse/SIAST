import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";
import * as ctrl from "../controllers/recursos.controller.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ── Asignaciones (antes de /:id para evitar conflictos) ──────────────────────
router.get(
  "/asignaciones",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.listarAsignaciones,
);

router.post(
  "/asignaciones",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.crearAsignacion,
);

router.patch(
  "/asignaciones/:id(\\d+)",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.actualizarAsignacion,
);

router.get(
  "/asignaciones/:id(\\d+)/orden-salida",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.ordenSalida,
);

// ── Unidades — operaciones directas (antes de /:id numérico) ─────────────────
// IMPORTANTE: /unidades/by-serie/:serie debe ir ANTES de /unidades/:id(\\d+)
router.get(
  "/unidades/by-serie/:serie",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.buscarUnidadPorSerie,
);

router.patch(
  "/unidades/:id(\\d+)",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.actualizarUnidad,
);

router.delete(
  "/unidades/:id(\\d+)",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.eliminarUnidad,
);

// ── Catálogo (CRUD de tipos de recurso) ──────────────────────────────────────
router.get(
  "/",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.listarCatalogos,
);

router.post(
  "/",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.crearCatalogo,
);

router.get(
  "/:id(\\d+)",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.obtenerCatalogo,
);

router.patch(
  "/:id(\\d+)",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.actualizarCatalogo,
);

router.delete(
  "/:id(\\d+)",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.eliminarCatalogo,
);

// ── Unidades por catálogo ─────────────────────────────────────────────────────
router.get(
  "/:catalogoId(\\d+)/unidades",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.listarUnidades,
);

router.post(
  "/:catalogoId(\\d+)/unidades",
  requireRol("ADMIN", "GESTOR_RECURSOS_MATERIALES"),
  ctrl.crearUnidad,
);

export default router;
