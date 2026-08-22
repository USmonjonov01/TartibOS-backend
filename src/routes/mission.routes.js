import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listMissions, createMission, updateMission, deleteMission } from "../controllers/mission.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", listMissions);
router.post("/", createMission);
router.put("/:id", updateMission);
router.delete("/:id", deleteMission);

export default router;
