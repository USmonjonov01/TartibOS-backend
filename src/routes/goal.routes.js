import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import {
    listTemplates,
    listGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    createStep,
    updateStep,
    deleteStep,
    toggleStep,
    generateSteps,
    generateRoutine,
} from "../controllers/goal.controller.js";

const router = Router();

router.use(requireAuth);

// AI chaqiruvi haqiqiy pul sarflaydi — umumiy 300/15daqiqalik limitdan tashqari,
// shu endpoint uchun alohida qattiqroq chegara: soatiga 15 ta so'rov.
const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "AI so'rovlar chegarasiga yetdingiz. Bir soatdan keyin qayta urinib ko'ring." },
});

router.get("/templates", listTemplates);
router.post("/generate", aiLimiter, generateSteps);
router.post("/:goalId/routine", aiLimiter, generateRoutine);

router.get("/", listGoals);
router.post("/", createGoal);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);

router.post("/:goalId/steps", createStep);
router.put("/:goalId/steps/:stepId", updateStep);
router.delete("/:goalId/steps/:stepId", deleteStep);
router.patch("/:goalId/steps/:stepId/toggle", toggleStep);

export default router;
