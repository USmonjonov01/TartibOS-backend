import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    register,
    login,
    me,
    updateMe,
    forgotPassword,
    resetPassword,
    resendVerification,
    verifyEmail,
    googleAuth,
} from "../controllers/auth.controller.js";
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

// forgot-password ancha qattiqroq chegaralanadi — aks holda bu endpoint
// istalgan email manziliga cheksiz "spam" xat yuborish uchun ishlatilishi
// mumkin edi (foydalanuvchi hisobi bo'lmasa ham, so'rov o'zi bepul).
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);
router.put("/me", requireAuth, authLimiter, updateMe);

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);

router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-verification", requireAuth, forgotPasswordLimiter, resendVerification);

router.post("/google", authLimiter, googleAuth);

export default router;
