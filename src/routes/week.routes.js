import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listWeeks, upsertDay } from "../controllers/week.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", listWeeks);
router.put("/day", upsertDay);

export default router;
