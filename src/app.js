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

app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/weeks", weekRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/reviews", reviewRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
