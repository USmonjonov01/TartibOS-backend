import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import env from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import routineRoutes from "./routes/routine.routes.js";
import weekRoutes from "./routes/week.routes.js";
import missionRoutes from "./routes/mission.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import telegramRoutes from "./routes/telegram.routes.js";
import prisma from "./lib/prisma.js";

const app = express();

// Render/Railway/Fly.io kabi platformalar reverse-proksi orqasida ishlaydi —
// shu sozlamasiz express-rate-limit har bir so'rovda xato beradi va, eng
// yomoni, BARCHA foydalanuvchilarni bitta IP sifatida hisoblab, birining
// faolligi qolgan hammani bloklab qo'yishi mumkin edi (proksi header'i orqali
// yuborilgan haqiqiy IP o'rniga proksining o'zi ko'rinadi). "1" — faqat bitta
// proksi qatlamiga (platforma balanslagichiga) ishoniladi, degani.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
    cors({
        origin: env.corsOrigins,
        credentials: true,
    })
);
app.use(express.json({ limit: "1mb" }));

// Umumiy so'rov chegarasi — barcha route'lar uchun asosiy himoya qatlami
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
    })
);

app.get("/health", async (req, res) => {
    try {
        // Engil so'rov — asosiy maqsad Neon'ning "serverless compute"si
        // uxlab qolmasligi (~5 daqiqa faoliyatsizlikdan keyin avtomatik
        // to'xtaydi). Tashqi uptime-monitoring xizmati shu endpoint'ni
        // har 5 daqiqada bir chaqirib tursa, bot ham, baza ham doim tayyor
        // holatda qoladi.
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok", db: "ok", time: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: "degraded", db: "error", message: err.message });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/weeks", weekRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/telegram", telegramRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
