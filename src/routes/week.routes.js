import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listWeeks, upsertDay, generateWeekConclusion } from "../controllers/week.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", listWeeks);
router.put("/day", upsertDay);
// Haftalik AI xulosasini so'rab yaratish/qayta yaratish (on-demand). Avtomatik
// (har hafta oxirida, so'ramasdan) generatsiya src/bot/weeklyReview.js'da.
router.post("/:weekId/conclusion", generateWeekConclusion);

export default router;
