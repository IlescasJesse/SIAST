import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.post("/solicitar-otp", authRateLimiter, ctrl.solicitarOtp);
router.post("/verificar-otp", authRateLimiter, ctrl.verificarOtp);
router.post("/login", authRateLimiter, ctrl.loginStaff);
router.post("/logout", authMiddleware, ctrl.logout);
router.post("/refresh", authRateLimiter, ctrl.refreshToken); // renovación sin requerir token válido
router.get("/me", authMiddleware, ctrl.me);
router.patch("/password", authMiddleware, ctrl.changePassword);

export default router;
