import { Router } from "express";
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
} from "../controllers/goal.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/templates", listTemplates);

router.get("/", listGoals);
router.post("/", createGoal);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);

router.post("/:goalId/steps", createStep);
router.put("/:goalId/steps/:stepId", updateStep);
router.delete("/:goalId/steps/:stepId", deleteStep);
router.patch("/:goalId/steps/:stepId/toggle", toggleStep);

export default router;
