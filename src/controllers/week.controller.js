import prisma from "../lib/prisma.js";
import { upsertDaySchema } from "../validators/week.validators.js";

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
        const nextScores = { ...(existing?.scores || {}), ...(scores ? { [dayKey]: scores } : {}) };
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
