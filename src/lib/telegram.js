import TelegramBot from "node-telegram-bot-api";
import env from "../config/env.js";

// Token yo'q bo'lsa (masalan lokal dev'da hali sozlanmagan bo'lsa), bot
// shunchaki ishga tushmaydi — web API'ning qolgan qismi bunga bog'liq emas.
export const bot = env.telegramBotToken
    ? new TelegramBot(env.telegramBotToken, { polling: true })
    : null;

if (!env.telegramBotToken) {
    console.warn(
        "[telegram] TELEGRAM_BOT_TOKEN topilmadi — bot ishga tushmadi. " +
            ".env fayliga qo'shib, serverni qayta ishga tushiring."
    );
}

export default bot;
