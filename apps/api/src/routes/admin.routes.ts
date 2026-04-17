import { Router } from "express";
import * as ctrl from "../controllers/admin.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRol } from "../middleware/roles.middleware.js";

const router = Router();

// Solo ADMIN puede acceder
router.use(authMiddleware, requireRol("ADMIN"));

router.get("/sirh/status", ctrl.sirhSyncStatus);
router.post("/sirh/sync",  ctrl.sirhSyncNow);

export default router;
