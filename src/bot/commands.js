import prisma from "../lib/prisma.js";
import bot from "../lib/telegram.js";
import env from "../config/env.js";
import { getTodayStatusForUser, markHabitDoneForUser } from "./habits.js";

const findUserByChatId = (chatId) => prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });

const habitsListText = ({ habits, doneCount }) => {
    if (habits.length === 0) {
        return "Bugun uchun rejalashtirilgan odat yo'q.";
    }
    const lines = habits.map((h) => {
        const mark = h.done ? "✅" : "⬜️";
        const plan = h.todayPlan ? ` — ${h.todayPlan}` : "";
        return `${mark} ${h.start ? `${h.start} ` : ""}${h.title}${plan}`;
    });
    return `Bugun: ${doneCount}/${habits.length} bajarildi\n\n${lines.join("\n")}`;
};

// /start <token> — hisobni Telegram'ga bog'laydi. Token web-ilovada
// yaratiladi (POST /api/telegram/link-token) va deep-link orqali keladi:
// https://t.me/<bot_username>?start=<token>
const handleStart = async (msg, match) => {
    const chatId = msg.chat.id;
    const token = (match?.[1] || "").trim();

    if (!token) {
        await bot.sendMessage(
            chatId,
            "Assalomu alaykum! 👋 Men — TartibOS botiman.\n\n" +
                "Sizga har kuni odatlaringiz vaqti kelganda eslataman va shu yerdan turib \"✅ Bajarildi\" deb belgilashingizga yordam beraman.\n\n" +
                "Boshlash uchun: tartibos.uz saytiga kiring → Sozlamalar → \"Telegram botni ulash\" tugmasini bosing."
        );
        return;
    }

    const linkToken = await prisma.telegramLinkToken.findUnique({ where: { token } });
    if (!linkToken || linkToken.usedAt || linkToken.expiresAt < new Date()) {
        await bot.sendMessage(chatId, "❌ Havola muddati o'tgan yoki noto'g'ri. Saytdan qaytadan urinib ko'ring.");
        return;
    }

    const alreadyLinked = await prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });
    if (alreadyLinked && alreadyLinked.id !== linkToken.userId) {
        await bot.sendMessage(chatId, "❌ Bu Telegram hisobi boshqa TartibOS foydalanuvchisiga bog'langan.");
        return;
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: linkToken.userId },
            data: { telegramChatId: String(chatId), telegramLinkedAt: new Date() },
        }),
        prisma.telegramLinkToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);

    await bot.sendMessage(
        chatId,
        "✅ Hisobingiz bog'landi! Endi odatlaringiz vaqti kelganda shu yerga eslatma yuboraman.\n\n" +
            "Buyruqlar:\n/bugun — bugungi holat\n/stats — qisqa statistika"
    );
};

const handleBugun = async (msg) => {
    const chatId = msg.chat.id;
    const user = await findUserByChatId(chatId);
    if (!user) {
        await bot.sendMessage(chatId, "Hisobingiz hali bog'lanmagan. Saytda Sozlamalar bo'limiga o'ting.");
        return;
    }
    const status = await getTodayStatusForUser(user);
    await bot.sendMessage(chatId, habitsListText(status));
};

const handleStats = async (msg) => {
    const chatId = msg.chat.id;
    const user = await findUserByChatId(chatId);
    if (!user) {
        await bot.sendMessage(chatId, "Hisobingiz hali bog'lanmagan. Saytda Sozlamalar bo'limiga o'ting.");
        return;
    }
    const { habits, doneCount } = await getTodayStatusForUser(user);
    const pct = habits.length > 0 ? Math.round((doneCount / habits.length) * 100) : 0;

    const weekAgg = await prisma.week.findMany({ where: { userId: user.id }, orderBy: { weekId: "desc" }, take: 1 });
    const thisWeek = weekAgg[0];
    const daysTracked = thisWeek ? Object.keys(thisWeek.executions || {}).length : 0;

    await bot.sendMessage(
        chatId,
        `📊 Statistika\n\nBugun: ${doneCount}/${habits.length} (${pct}%)\n` +
            `Bu hafta kuzatilgan kunlar: ${daysTracked}\n\n` +
            `To'liq tahlil uchun: tartibos.uz/statistics`
    );
};

// "✅ Bajarildi" tugmasi — reminders.js yuborgan xabar ostidagi inline tugma
const handleCallbackQuery = async (query) => {
    const chatId = query.message.chat.id;
    const [action, routineId] = (query.data || "").split(":");

    if (action !== "done") {
        await bot.answerCallbackQuery(query.id);
        return;
    }

    const user = await findUserByChatId(chatId);
    if (!user) {
        await bot.answerCallbackQuery(query.id, { text: "Hisob bog'lanmagan", show_alert: true });
        return;
    }

    const result = await markHabitDoneForUser(user, routineId);
    if (!result.ok) {
        await bot.answerCallbackQuery(query.id, { text: "Odat topilmadi", show_alert: true });
        return;
    }

    await bot.answerCallbackQuery(query.id, {
        text: result.alreadyDone ? "Allaqachon belgilangan ✅" : "Bajarildi deb belgilandi ✅",
    });

    // Xabar matnini yangilab, tugmani olib tashlaymiz — qayta bosilmasin
    try {
        await bot.editMessageText(`✅ ${result.routine.title} — bajarildi deb belgilandi.`, {
            chat_id: chatId,
            message_id: query.message.message_id,
        });
    } catch {
        // Xabarni tahrirlab bo'lmasa (masalan juda eski), jim o'tkazamiz — muhim emas
    }
};

const handleApp = async (msg) => {
    const chatId = msg.chat.id;
    if (!env.miniAppUrl) {
        await bot.sendMessage(chatId, "Mini App hozircha sozlanmagan.");
        return;
    }
    await bot.sendMessage(chatId, "Bugungi odatlaringizni ochish uchun tugmani bosing 👇", {
        reply_markup: {
            inline_keyboard: [[{ text: "📱 TartibOS'ni ochish", web_app: { url: env.miniAppUrl } }]],
        },
    });
};

export const registerBotCommands = () => {
    if (!bot) return;

    bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => handleStart(msg, match).catch(console.error));
    bot.onText(/\/bugun/, (msg) => handleBugun(msg).catch(console.error));
    bot.onText(/\/stats/, (msg) => handleStats(msg).catch(console.error));
    bot.onText(/\/app/, (msg) => handleApp(msg).catch(console.error));
    bot.on("callback_query", (query) => handleCallbackQuery(query).catch(console.error));

    console.log("[telegram] Bot buyruqlari ro'yxatdan o'tkazildi");
};
