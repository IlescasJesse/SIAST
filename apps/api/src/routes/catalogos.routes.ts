import { Router } from "express";
import * as ctrl from "../controllers/catalogos.controller.js";

const router = Router();

router.get("/categorias", ctrl.categorias);
router.get("/tecnicos", ctrl.tecnicos);
router.get("/areas", ctrl.areas);
router.get("/pisos", ctrl.pisos);

export default router;
