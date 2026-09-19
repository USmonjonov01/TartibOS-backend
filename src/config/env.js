import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET"];

for (const key of required) {
    if (!process.env[key]) {
        console.error(`[config] Muhim environment o'zgaruvchisi yo'q: ${key}. .env faylini tekshiring.`);
        process.exit(1);
    }
}

export const env = {
    port: Number(process.env.PORT) || 4000,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
    // Bir nechta manzilga ruxsat berish uchun vergul bilan ajratiladi, masalan:
    // "http://localhost:5173,https://tartib-os.vercel.app"
    corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    nodeEnv: process.env.NODE_ENV || "development",
    // Telegram bot — ixtiyoriy. Token bo'lmasa, bot shunchaki ishga tushmaydi,
    // web API'ga hech qanday ta'sir qilmaydi.
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    // Telegram Mini App ochiladigan sahifa manzili (frontend'dagi /telegram-app route'i)
    miniAppUrl: process.env.MINI_APP_URL || null,
    // Yo'l xaritasi bosqichlarini AI orqali generatsiya qilish uchun (Google AI Studio /
    // Gemini API, bepul reja). Bo'lmasa, foydalanuvchi faqat qo'lda bosqich qo'sha oladi
    // (xato bermaydi — goal.controller.js buni tutib, tushunarli xabar qaytaradi).
    // Model nomi Google tomonidan tez-tez yangilanadi — joriy bepul modelni
    // https://aistudio.google.com'dan tekshirib, GEMINI_MODEL orqali sozlang.
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",

    // Frontend'ning to'liq manzili — parolni tiklash va email tasdiqlash
    // havolalari shu manzil ustiga quriladi (masalan
    // `${appUrl}/reset-password?token=...`). CORS_ORIGIN'dagi birinchi
    // manzilga tushadi, lekin alohida sozlash ham mumkin.
    appUrl: process.env.APP_URL || (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim(),

    // Email yuborish (SMTP) — ixtiyoriy. Sozlanmagan bo'lsa, parolni tiklash
    // va email tasdiqlash havolalari xato bermaydi, faqat server logiga
    // yoziladi (dev rejimida qulay) — mailer.js'ga qarang.
    smtp: {
        host: process.env.SMTP_HOST || null,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER || null,
        pass: process.env.SMTP_PASS || null,
        from: process.env.SMTP_FROM || "TartibOS <no-reply@tartibos.uz>",
    },

    // Google Sign-In — Google Cloud Console'dagi OAuth 2.0 Client ID
    // (frontenddagi Google tugmasi ishlatadigan bilan BIR XIL bo'lishi kerak,
    // aks holda token audience tekshiruvi rad etadi).
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
};

export default env;
