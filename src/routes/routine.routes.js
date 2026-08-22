import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listRoutines, createRoutine, updateRoutine, deleteRoutine } from "../controllers/routine.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", listRoutines);
router.post("/", createRoutine);
router.put("/:id", updateRoutine);
router.delete("/:id", deleteRoutine);

export default router;
