import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login-rfc", ctrl.loginRFC);       // legacy (sin OTP)
router.post("/solicitar-otp", ctrl.solicitarOtp);
router.post("/verificar-otp", ctrl.verificarOtp);
router.post("/login", ctrl.loginStaff);
router.post("/logout", authMiddleware, ctrl.logout);
router.post("/refresh", ctrl.refreshToken);     // renovación sin requerir token válido
router.get("/me", authMiddleware, ctrl.me);
router.patch("/password", authMiddleware, ctrl.changePassword);

export default router;
