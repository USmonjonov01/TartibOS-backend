import cron from "node-cron";
import prisma from "../lib/prisma.js";
import bot from "../lib/telegram.js";
import env from "../config/env.js";
import { getTodayStatusForUser } from "./habits.js";
import { getHHMM } from "../lib/date.js";

const sendReminder = async (user, habit) => {
    const planLine = habit.todayPlan ? `\n📝 <i>${habit.todayPlan}</i>` : "";
    const text = `⏰ <b>Vaqti keldi:</b> ${habit.title} (${habit.start})${planLine}`;

    const buttons = [[{ text: "✅ Tez belgilash", callback_data: `done:${habit.id}` }]];
    // Mini App orqali: bajarilmadi/sababli va yulduzcha baholash — buni oddiy
    // callback tugma bilan qilib bo'lmaydi, shuning uchun to'liq interfeys kerak
    if (env.miniAppUrl) {
        buttons.push([{ text: "📱 Batafsil (baholash bilan)", web_app: { url: env.miniAppUrl } }]);
    }

    await bot.sendMessage(user.telegramChatId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
    });
};

const tick = async () => {
    const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } } });

    for (const user of users) {
        try {
            const timezone = user.timezone || "Asia/Tashkent";
            const nowHHMM = getHHMM(timezone);
            const { habits } = await getTodayStatusForUser(user);

            const due = habits.filter((h) => !h.done && h.start === nowHHMM);
            for (const habit of due) {
                await sendReminder(user, habit);
            }
        } catch (err) {
            // Bitta foydalanuvchida xato bo'lsa ham, qolganlar uchun eslatma
            // yuborilishida davom etadi
            console.error(`[telegram] Eslatma yuborishda xato (user ${user.id}):`, err.message);
        }
    }
};

export const startReminderScheduler = () => {
    if (!bot) return;

    // Har daqiqada bir marta tekshiradi — odat "start" vaqti aynan shu
    // daqiqaga to'g'ri kelsa, eslatma yuboriladi
    cron.schedule("* * * * *", () => {
        tick().catch((err) => console.error("[telegram] Scheduler xatosi:", err));
    });

    console.log("[telegram] Eslatma scheduler ishga tushdi (har daqiqada tekshiradi)");
};
