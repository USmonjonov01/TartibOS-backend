import prisma from "../lib/prisma.js";
import bot from "../lib/telegram.js";
import env from "../config/env.js";
import { getTodayStatusForUser, getWeekOverviewForUser, markHabitDoneForUser } from "./habits.js";
import { getMissionOverviewForUser } from "./missions.js";

const findUserByChatId = (chatId) => prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });

const DAY_LABELS_UZ = { mon: "Du", tue: "Se", wed: "Ch", thu: "Pa", fri: "Ju", sat: "Sh", sun: "Ya" };

// Botning butun muloqotida bir xil ma'noni bir xil belgi bilan ko'rsatamiz —
// bu "chaqiriq" his qildiradigan, izchil "vizual til".
const ICON = {
    done: "✅",
    pending: "⬜️",
    missed: "❌",
    excused: "🟡",
    time: "⏰",
    missions: "🎯",
    habits: "📋",
    stats: "📊",
    weekly: "📅",
    streak: "🔥",
    star: "⭐",
    app: "📱",
    link: "🔗",
    help: "❓",
    warn: "⚠️",
};

// Har doim ekranning pastida turadigan menyu — botni "bitta eslatma yuboradigan
// dastur" emas, doim qo'l ostida turadigan boshqaruv paneli his qildiradi.
const MAIN_KEYBOARD = {
    keyboard: [
        [{ text: `${ICON.habits} Bugungi holat` }, { text: `${ICON.missions} Missiyalar` }],
        [{ text: `${ICON.weekly} Haftalik` }, { text: `${ICON.stats} Statistika` }],
        [{ text: `${ICON.app} Ilova` }, { text: `${ICON.help} Yordam` }],
    ],
    resize_keyboard: true,
    is_persistent: true,
};

const send = (chatId, text, extra = {}) =>
    bot.sendMessage(chatId, text, { parse_mode: "HTML", ...extra });

const notLinkedText =
    `Hisobingiz hali bog'lanmagan. tartibos.uz saytida <b>Sozlamalar</b> → ` +
    `"Telegram botni ulash" tugmasini bosing.`;

const habitsListText = ({ habits, doneCount }) => {
    if (habits.length === 0) {
        return `${ICON.habits} <b>Bugungi odatlar</b>\n\nBugun uchun rejalashtirilgan odat yo'q.`;
    }
    const lines = habits.map((h) => {
        const mark = h.done ? ICON.done : ICON.pending;
        const plan = h.todayPlan ? ` — <i>${h.todayPlan}</i>` : "";
        return `${mark} ${h.start ? `${h.start} ` : ""}<b>${h.title}</b>${plan}`;
    });
    return `${ICON.habits} <b>Bugungi odatlar</b> — ${doneCount}/${habits.length} bajarildi\n\n${lines.join("\n")}`;
};

const missionsText = ({ today, overdue, priorityIcon }) => {
    if (today.length === 0 && overdue.length === 0) {
        return `${ICON.missions} <b>Missiyalar</b>\n\nBugun uchun ochiq missiya yo'q. Zo'r! 🎉`;
    }

    const renderMission = (m) => `${priorityIcon[m.priority] || "⚪️"} <b>${m.title}</b>`;

    let text = `${ICON.missions} <b>Bugungi missiyalar</b>\n\n`;
    text += today.length > 0 ? today.map(renderMission).join("\n") : "<i>Bugun uchun missiya yo'q.</i>";

    if (overdue.length > 0) {
        text += `\n\n${ICON.warn} <b>Kechikkan (${overdue.length})</b>\n`;
        text += overdue.map((m) => `${renderMission(m)} — <i>${m.date}</i>`).join("\n");
    }

    return text;
};

const weeklyText = ({ days }) => {
    const lines = days.map((d) => {
        const label = DAY_LABELS_UZ[d.day];
        if (d.isFuture) return `${label}   ·`;
        if (d.scheduled === 0) return `${label}   —`;
        const marker = d.isToday ? "👉" : "  ";
        return `${marker} ${label}  ${d.done}/${d.scheduled}  (${d.pct}%)`;
    });
    return `${ICON.weekly} <b>Haftalik ko'rinish</b>\n\n${lines.join("\n")}`;
};

const helpText =
    `${ICON.link} <b>TartibOS bot</b> — shunchaki eslatma yuboradigan bot emas, ` +
    `intizomingizni telefon, kompyuter va Telegram'ning o'zida ham boshqarishga yordam beradi.\n\n` +
    `Quyidagi tugmalar yoki buyruqlar orqali:\n\n` +
    `${ICON.habits} <b>Bugungi holat</b> (/bugun) — barcha odatlaringiz va ularning holati\n` +
    `${ICON.missions} <b>Missiyalar</b> (/missiyalar) — bugungi va kechikkan maqsadlar\n` +
    `${ICON.weekly} <b>Haftalik</b> (/haftalik) — hafta bo'yicha kunma-kun ko'rinish\n` +
    `${ICON.stats} <b>Statistika</b> (/stats) — qisqacha umumiy tahlil\n` +
    `${ICON.app} <b>Ilova</b> (/app) — to'liq interfeys: belgilash, baholash, sabab yozish\n\n` +
    `${ICON.time} Odatingiz vaqti kelganda, o'zim eslataman — hech narsa yozishingiz shart emas.`;

// /start <token> — hisobni Telegram'ga bog'laydi.
const handleStart = async (msg, match) => {
    const chatId = msg.chat.id;
    const token = (match?.[1] || "").trim();

    if (!token) {
        await send(
            chatId,
            `Assalomu alaykum! 👋 Men — <b>TartibOS</b> botiman.\n\n` +
                `${ICON.time} Odatlaringiz vaqti kelganda eslataman, va shu yerdan turib boshqarishga yordam beraman.\n\n` +
                `Boshlash uchun: tartibos.uz → <b>Sozlamalar</b> → "Telegram botni ulash".`
        );
        return;
    }

    const linkToken = await prisma.telegramLinkToken.findUnique({ where: { token } });
    if (!linkToken || linkToken.usedAt || linkToken.expiresAt < new Date()) {
        await send(chatId, "❌ Havola muddati o'tgan yoki noto'g'ri. Saytdan qaytadan urinib ko'ring.");
        return;
    }

    const alreadyLinked = await prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });
    if (alreadyLinked && alreadyLinked.id !== linkToken.userId) {
        await send(chatId, "❌ Bu Telegram hisobi boshqa TartibOS foydalanuvchisiga bog'langan.");
        return;
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: linkToken.userId },
            data: { telegramChatId: String(chatId), telegramLinkedAt: new Date() },
        }),
        prisma.telegramLinkToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);

    await send(
        chatId,
        `${ICON.done} <b>Hisobingiz bog'landi!</b>\n\n` +
            `Endi pastdagi menyu orqali istalgan vaqtda holatingizni ko'rishingiz mumkin.`,
        { reply_markup: MAIN_KEYBOARD }
    );
};

const handleBugun = async (msg) => {
    const chatId = msg.chat.id;
    const user = await findUserByChatId(chatId);
    if (!user) return send(chatId, notLinkedText);
    const status = await getTodayStatusForUser(user);
    await send(chatId, habitsListText(status));
};

const handleMissiyalar = async (msg) => {
    const chatId = msg.chat.id;
    const user = await findUserByChatId(chatId);
    if (!user) return send(chatId, notLinkedText);
    const overview = await getMissionOverviewForUser(user);
    await send(chatId, missionsText(overview));
};

const handleHaftalik = async (msg) => {
    const chatId = msg.chat.id;
    const user = await findUserByChatId(chatId);
    if (!user) return send(chatId, notLinkedText);
    const overview = await getWeekOverviewForUser(user);
    await send(chatId, weeklyText(overview));
};

const handleStats = async (msg) => {
    const chatId = msg.chat.id;
    const user = await findUserByChatId(chatId);
    if (!user) return send(chatId, notLinkedText);

    const { habits, doneCount } = await getTodayStatusForUser(user);
    const pct = habits.length > 0 ? Math.round((doneCount / habits.length) * 100) : 0;
    const { today, overdue } = await getMissionOverviewForUser(user);

    const weekAgg = await prisma.week.findMany({ where: { userId: user.id }, orderBy: { weekId: "desc" }, take: 1 });
    const thisWeek = weekAgg[0];
    const daysTracked = thisWeek ? Object.keys(thisWeek.executions || {}).length : 0;

    await send(
        chatId,
        `${ICON.stats} <b>Statistika</b>\n\n` +
            `${ICON.habits} Bugun: <b>${doneCount}/${habits.length}</b> (${pct}%)\n` +
            `${ICON.missions} Ochiq missiyalar: <b>${today.length}</b>${overdue.length ? ` (${overdue.length} kechikkan)` : ""}\n` +
            `${ICON.weekly} Bu hafta kuzatilgan kunlar: <b>${daysTracked}</b>\n\n` +
            `To'liq tahlil: tartibos.uz/statistics`
    );
};

const handleApp = async (msg) => {
    const chatId = msg.chat.id;
    if (!env.miniAppUrl) {
        await send(chatId, "Mini App hozircha sozlanmagan.");
        return;
    }
    await send(chatId, `${ICON.app} Bugungi odatlaringizni ochish uchun tugmani bosing 👇`, {
        reply_markup: {
            inline_keyboard: [[{ text: `${ICON.app} TartibOS'ni ochish`, web_app: { url: env.miniAppUrl } }]],
        },
    });
};

const handleHelp = async (msg) => {
    await send(msg.chat.id, helpText, { reply_markup: MAIN_KEYBOARD });
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

    try {
        await bot.editMessageText(`${ICON.done} <b>${result.routine.title}</b> — bajarildi deb belgilandi.`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "HTML",
        });
    } catch {
        // Xabarni tahrirlab bo'lmasa (masalan juda eski), jim o'tkazamiz — muhim emas
    }
};

export const registerBotCommands = () => {
    if (!bot) return;

    // "/" bosilganda Telegram'ning o'zi ko'rsatadigan buyruqlar ro'yxati —
    // tavsif bilan, shunda foydalanuvchi botning nima qila olishini yozib
    // ko'rmasdan turib ham ko'radi.
    bot.setMyCommands([
        { command: "bugun", description: "📋 Bugungi odatlar holati" },
        { command: "missiyalar", description: "🎯 Bugungi va kechikkan missiyalar" },
        { command: "haftalik", description: "📅 Hafta bo'yicha ko'rinish" },
        { command: "stats", description: "📊 Qisqacha statistika" },
        { command: "app", description: "📱 To'liq ilovani ochish" },
        { command: "yordam", description: "❓ Bot nima qila oladi" },
    ]).catch((err) => console.error("[telegram] setMyCommands xatosi:", err.message));

    bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => handleStart(msg, match).catch(console.error));
    bot.onText(/\/bugun|^📋 Bugungi holat$/, (msg) => handleBugun(msg).catch(console.error));
    bot.onText(/\/missiyalar|^🎯 Missiyalar$/, (msg) => handleMissiyalar(msg).catch(console.error));
    bot.onText(/\/haftalik|^📅 Haftalik$/, (msg) => handleHaftalik(msg).catch(console.error));
    bot.onText(/\/stats|^📊 Statistika$/, (msg) => handleStats(msg).catch(console.error));
    bot.onText(/\/app|^📱 Ilova$/, (msg) => handleApp(msg).catch(console.error));
    bot.onText(/\/yordam|\/help|^❓ Yordam$/, (msg) => handleHelp(msg).catch(console.error));
    bot.on("callback_query", (query) => handleCallbackQuery(query).catch(console.error));

    console.log("[telegram] Bot buyruqlari ro'yxatdan o'tkazildi");
};
