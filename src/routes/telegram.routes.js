import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createLinkToken, getStatus, unlink } from "../controllers/telegram.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/status", getStatus);
router.post("/link-token", createLinkToken);
router.delete("/unlink", unlink);

export default router;
