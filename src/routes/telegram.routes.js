import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createLinkToken, getStatus, unlink, miniAppAuth, linkViaMiniApp } from "../controllers/telegram.controller.js";

const router = Router();

// Ochiq — o'zi initData imzosini tekshiradi, alohida login talab qilmaydi
router.post("/mini-app-auth", miniAppAuth);

router.use(requireAuth);
router.get("/status", getStatus);
router.post("/link-token", createLinkToken);
router.post("/link-via-miniapp", linkViaMiniApp);
router.delete("/unlink", unlink);

export default router;
