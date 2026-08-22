import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, updateMe } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Parol taxmin qilishga (brute-force) qarshi — 15 daqiqada 20 ta urinish
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);
router.put("/me", requireAuth, authLimiter, updateMe);

export default router;
