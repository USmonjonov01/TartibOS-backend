import prisma from "../lib/prisma.js";
import { upsertDaySchema } from "../validators/week.validators.js";
import { getMondayOfISOWeek, getISOWeekIdFromDate } from "../lib/date.js";
import { buildWeeklyStats } from "../lib/weeklyStats.js";
import { generateWeeklyConclusion } from "../lib/aiWeeklyReview.js";

export const listWeeks = async (req, res, next) => {
    try {
        const weeks = await prisma.week.findMany({
            where: { userId: req.user.id },
            orderBy: { weekId: "asc" },
        });
        res.json({ weeks });
    } catch (err) {
        next(err);
    }
};

const AI_ERROR_CODES = new Set(["AI_NOT_CONFIGURED", "AI_REQUEST_FAILED", "AI_PARSE_FAILED"]);

// Bitta foydalanuvchi + bitta hafta uchun: kerakli ma'lumotlarni yig'ib,
// statistikani hisoblab, AI'dan xulosa so'rab, Week.conclusion'ga saqlaydi.
// Bu funksiya Express'dan MUSTAQIL — shuning uchun uni ham on-demand
// endpoint (generateWeekConclusion), ham har hafta avtomatik ishga
// tushadigan cron scheduler (src/bot/weeklyReview.js) baravar chaqiradi.
export const buildAndSaveWeeklyConclusion = async ({ userId, weekId }) => {
    const week = await prisma.week.findUnique({
        where: { userId_weekId: { userId, weekId } },
    });
    if (!week) {
        const err = new Error("Bu hafta uchun hali ma'lumot yo'q");
        err.code = "WEEK_NOT_FOUND";
        throw err;
    }

    const monday = getMondayOfISOWeek(weekId);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevWeekId = getISOWeekIdFromDate(prevMonday);

    const [routines, missions, goals, previousWeek] = await Promise.all([
        prisma.routine.findMany({ where: { userId, retired: false } }),
        prisma.mission.findMany({ where: { userId, cancelled: false } }),
        prisma.goal.findMany({ where: { userId, status: { not: "archived" } }, include: { steps: true } }),
        prisma.week.findUnique({ where: { userId_weekId: { userId, weekId: prevWeekId } } }),
    ]);

    const stats = buildWeeklyStats({
        weekId,
        week,
        previousWeek,
        routines,
        missions,
        goals,
        monday,
        sunday,
        isoWeekId: getISOWeekIdFromDate,
    });

    const ai = await generateWeeklyConclusion(stats);

    const updated = await prisma.week.update({
        where: { id: week.id },
        data: { conclusion: ai.text },
    });

    return { week: updated, ai, stats };
};

// Foydalanuvchi "Sharh" sahifasida "AI bilan tahlil qilish" tugmasini
// bosganda ishga tushadi — istalgan vaqt, o'zi so'rab chaqiradi (on-demand).
// Avtomatik (har hafta oxirida, foydalanuvchi so'ramasdan) generatsiya
// uchun src/bot/weeklyReview.js'ga qarang — u AYNAN shu
// buildAndSaveWeeklyConclusion'ni chaqiradi, shu sabab ikkala yo'l bir xil
// natija beradi.
export const generateWeekConclusion = async (req, res, next) => {
    try {
        const { weekId } = req.params;
        if (!/^\d{4}-W\d{2}$/.test(weekId || "")) {
            return res.status(400).json({ message: "weekId formati noto'g'ri (masalan 2026-W34)" });
        }

        const { week, ai } = await buildAndSaveWeeklyConclusion({ userId: req.user.id, weekId });
        res.json({ week, ai });
    } catch (err) {
        if (err.code === "WEEK_NOT_FOUND") {
            return res.status(404).json({ message: err.message });
        }
        if (AI_ERROR_CODES.has(err.code)) {
            return res.status(503).json({ message: "AI xizmati hozircha band, birozdan so'ng qayta urinib ko'ring" });
        }
        next(err);
    }
};

const computeDayStatus = (doneCount, total) => {
    if (total <= 0) return null;
    if (doneCount <= 0) return "missed";
    if (doneCount >= total) return "completed";
    return "partial";
};

// Bitta kunning odat bajarilishini yozadi/yangilaydi — Dashboard'dagi
// "bugun" va History sahifasidagi o'tgan kunlar UCHUN BIR XIL endpoint.
export const upsertDay = async (req, res, next) => {
    try {
        const { weekId, dayKey, habitIds, scores, reasons, totalHabits } = upsertDaySchema.parse(req.body);

        const existing = await prisma.week.findUnique({
            where: { userId_weekId: { userId: req.user.id, weekId } },
        });

        const status = computeDayStatus(habitIds.length, totalHabits);

        const nextStatuses = { ...(existing?.statuses || {}) };
        if (status) nextStatuses[dayKey] = status;
        else delete nextStatuses[dayKey];

        const nextExecutions = { ...(existing?.executions || {}), [dayKey]: habitIds.length };
        const nextCompletions = { ...(existing?.completions || {}), [dayKey]: habitIds };
        // scores => full object replacement (frontend "reasons" bilan bir xil pattern:
        // butun haftalik { dayKey: { habitKey: ball } } obyektini yuboradi)
        const nextScores = scores !== undefined ? scores : (existing?.scores || {});
        // reasons => full object replacement (frontend sends merged reasons)
        const nextReasons = reasons !== undefined ? reasons : (existing?.reasons || {});

        const week = await prisma.week.upsert({
            where: { userId_weekId: { userId: req.user.id, weekId } },
            update: {
                statuses: nextStatuses,
                executions: nextExecutions,
                completions: nextCompletions,
                scores: nextScores,
                reasons: nextReasons,
            },
            create: {
                userId: req.user.id,
                weekId,
                statuses: nextStatuses,
                executions: nextExecutions,
                completions: nextCompletions,
                scores: nextScores,
                reasons: nextReasons,
            },
        });

        res.json({ week });
    } catch (err) {
        next(err);
    }
};