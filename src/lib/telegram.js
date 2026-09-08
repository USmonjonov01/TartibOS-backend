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

if (bot) {
    // Bu handler bo'lmasa, node-telegram-bot-api xatoni faqat konsolga
    // yopiradi va hech narsa tushuntirmaydi. 409 (ETELEGRAM) xatosi deyarli
    // har doim BITTA sababdan: shu TELEGRAM_BOT_TOKEN bilan boshqa bir joyda
    // (masalan production'dagi Render instance) allaqachon getUpdates
    // so'rovi ishlab turibdi — Telegram bitta tokenga faqat bitta faol
    // poller'ga ruxsat beradi. Yechim kod emas — local va production uchun
    // ALOHIDA bot token ishlatish (yangi bot @BotFather orqali yaratiladi).
    bot.on("polling_error", (err) => {
        if (err?.code === "ETELEGRAM" && /409/.test(err?.message || "")) {
            console.error(
                "[telegram] 409 Conflict: shu TELEGRAM_BOT_TOKEN bilan boshqa bir " +
                    "joyda (masalan production server) ham bot ishlab turibdi. " +
                    "Local dev uchun @BotFather orqali alohida token yarating va " +
                    ".env faylidagi TELEGRAM_BOT_TOKEN'ni shunga almashtiring."
            );
            return;
        }
        console.error("[telegram] polling xatosi:", err?.message || err);
    });
}
