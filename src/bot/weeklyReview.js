import cron from "node-cron";
import prisma from "../lib/prisma.js";
import { bot } from "../lib/telegram.js";
import { getNowParts, getISOWeekIdFromDate } from "../lib/date.js";
import { buildAndSaveWeeklyConclusion } from "../controllers/week.controller.js";

// Bot ulangan foydalanuvchiga tayyor AI xulosadan qisqa ko'rinish yuboradi —
// bot/reminders.js:sendReminder bilan bir xil uslub (HTML parse_mode).
const notifyTelegram = async (user, weekId, ai) => {
    if (!bot || !user.telegramChatId) return;

    const preview = ai.conclusion.length > 220 ? `${ai.conclusion.slice(0, 217)}...` : ai.conclusion;
    const text = `📊 <b>Haftalik xulosangiz tayyor</b> (${weekId})\n\n${preview}\n\nTo'liq matnni "Sharh" bo'limida ko'rishingiz mumkin.`;

    try {
        await bot.sendMessage(user.telegramChatId, text, { parse_mode: "HTML" });
    } catch (err) {
        console.error(`[weeklyReview] Telegram xabarini yuborishda xato (user ${user.id}):`, err.message);
    }
};

// Har bir foydalanuvchi uchun ALOHIDA tekshiriladi — chunki timezone har xil
// bo'lishi mumkin, "hafta tugadi" signali ham har biriga o'z mahalliy
// vaqtida kelishi kerak (bot/reminders.js:tick bilan bir xil printsip).
const tick = async () => {
    const users = await prisma.user.findMany();

    for (const user of users) {
        try {
            const timezone = user.timezone || "Asia/Tashkent";
            const parts = getNowParts(timezone, new Date());

            // Faqat Dushanba, kun boshlangandan keyingi ilk 15 daqiqada ishga
            // tushadi — bu "o'tgan hafta yakunlandi" signalini bir marta,
            // ishonchli ushlab qolish uchun yetarli oyna (tick har 10 daqiqada
            // ishlaydi, shuning uchun bu oyna hech qachon butunlay o'tkazib
            // yuborilmaydi).
            if (parts.dayKey !== "mon" || parts.hour !== "00" || Number(parts.minute) >= 15) continue;

            const localMidnight = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
            const yesterday = new Date(localMidnight);
            yesterday.setDate(yesterday.getDate() - 1);
            const justEndedWeekId = getISOWeekIdFromDate(yesterday);

            const week = await prisma.week.findUnique({
                where: { userId_weekId: { userId: user.id, weekId: justEndedWeekId } },
            });
            // Bu hafta hech qanday faollik kuzatilmagan (Week yozuvi yo'q) yoki
            // AI xulosasi allaqachon yaratilgan bo'lsa — o'tkazib yuboramiz.
            if (!week || week.conclusion) continue;

            const { ai } = await buildAndSaveWeeklyConclusion({ userId: user.id, weekId: justEndedWeekId });
            await notifyTelegram(user, justEndedWeekId, ai);
        } catch (err) {
            // Bitta foydalanuvchida xato (masalan AI vaqtincha ishlamasa) bo'lsa
            // ham, qolganlar uchun scheduler davom etadi — keyingi 10 daqiqalik
            // tick'da shu hafta yana urinib ko'riladi (conclusion hali bo'sh
            // qolgani uchun).
            console.error(`[weeklyReview] Xato (user ${user.id}):`, err.message);
        }
    }
};

export const startWeeklyReviewScheduler = () => {
    // Har 10 daqiqada tekshiradi — har bir foydalanuvchi o'z timezone'ida
    // Dushanba 00:00 ga yetganda, o'tgan haftaning AI xulosasi AVTOMATIK
    // yaratiladi (foydalanuvchi so'ramasdan) va Week.conclusion'ga saqlanadi;
    // Telegram bot ulangan bo'lsa, qisqa xabar ham yuboriladi.
    cron.schedule("*/10 * * * *", () => {
        tick().catch((err) => console.error("[weeklyReview] Scheduler xatosi:", err));
    });

    console.log("[weeklyReview] Haftalik AI xulosa scheduleri ishga tushdi (har 10 daqiqada tekshiradi)");
};
