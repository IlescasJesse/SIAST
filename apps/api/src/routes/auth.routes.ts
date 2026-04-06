import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login-rfc", ctrl.loginRFC);
router.post("/login", ctrl.loginStaff);
router.get("/me", authMiddleware, ctrl.me);
router.patch("/password", authMiddleware, ctrl.changePassword);

export default router;
