import prisma from "../lib/prisma.js";
import { getDayKey, getISOWeekId, getDateStr, habitKey } from "../lib/date.js";

// Frontenddagi src/utils/routine.js:getHabitsForDay bilan bir xil mantiq —
// versiyalangan (retired) yozuvlarni chetlab o'tadi, sarlavha bo'yicha
// eng oxirgi versiyani oladi, so'ng shu kunga tegishlilarini filtrlaydi.
const dedupeAndFilterByDay = (routines, dayKey) => {
    const active = (routines || []).filter((r) => !r.retired);
    const byTitle = new Map();

    for (const item of active) {
        const key = habitKey(item);
        if (!key) continue;
        const existing = byTitle.get(key);
        if (!existing || new Date(item.createdAt) >= new Date(existing.createdAt)) {
            byTitle.set(key, item);
        }
    }

    return [...byTitle.values()]
        .filter((item) => !item.days || item.days.length === 0 || item.days.includes(dayKey))
        .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
};

// Foydalanuvchining bugungi (o'z timezone'ida) odatlari + har birining
// bajarilgan/bajarilmaganligi. Dashboard'dagi getTodayHabits + getHabitState
// bilan bir xil natija berishi kerak.
export const getTodayStatusForUser = async (user) => {
    const timezone = user.timezone || "Asia/Tashkent";
    const dayKey = getDayKey(timezone);
    const weekId = getISOWeekId(timezone);

    const [routines, week] = await Promise.all([
        prisma.routine.findMany({ where: { userId: user.id } }),
        prisma.week.findUnique({ where: { userId_weekId: { userId: user.id, weekId } } }),
    ]);

    const todayHabits = dedupeAndFilterByDay(routines, dayKey);
    const doneKeys = new Set(week?.completions?.[dayKey] || []);

    const habits = todayHabits.map((habit) => ({
        ...habit,
        key: habitKey(habit),
        done: doneKeys.has(habitKey(habit)),
        todayPlan: habit.dayPlans?.[dayKey] || null,
    }));

    return { dayKey, weekId, habits, doneCount: habits.filter((h) => h.done).length };
};

// Bitta odatni "bugun bajarildi" deb belgilaydi — week.controller.js:upsertDay
// bilan bir xil upsert mantig'i, faqat bot callback'idan chaqiriladi.
export const markHabitDoneForUser = async (user, routineId) => {
    const timezone = user.timezone || "Asia/Tashkent";
    const dayKey = getDayKey(timezone);
    const weekId = getISOWeekId(timezone);

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: user.id } });
    if (!routine) return { ok: false, reason: "not_found" };

    const key = habitKey(routine);
    const existing = await prisma.week.findUnique({
        where: { userId_weekId: { userId: user.id, weekId } },
    });

    const dayCompletions = new Set(existing?.completions?.[dayKey] || []);
    if (dayCompletions.has(key)) {
        return { ok: true, alreadyDone: true, routine };
    }
    dayCompletions.add(key);

    const nextCompletions = { ...(existing?.completions || {}), [dayKey]: [...dayCompletions] };
    const nextExecutions = { ...(existing?.executions || {}), [dayKey]: dayCompletions.size };

    await prisma.week.upsert({
        where: { userId_weekId: { userId: user.id, weekId } },
        update: { completions: nextCompletions, executions: nextExecutions },
        create: {
            userId: user.id,
            weekId,
            completions: nextCompletions,
            executions: nextExecutions,
        },
    });

    return { ok: true, alreadyDone: false, routine };
};

export const getTodayDateStr = (timezone) => getDateStr(timezone);

// Haftaning barcha kunlari uchun: shu kunga rejalashtirilgan odatlar soni va
// nechtasi bajarilgani. /haftalik buyrug'i uchun.
export const getWeekOverviewForUser = async (user) => {
    const timezone = user.timezone || "Asia/Tashkent";
    const weekId = getISOWeekId(timezone);
    const dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

    const [routines, week] = await Promise.all([
        prisma.routine.findMany({ where: { userId: user.id } }),
        prisma.week.findUnique({ where: { userId_weekId: { userId: user.id, weekId } } }),
    ]);

    const todayKey = getDayKey(timezone);
    const todayIndex = dayOrder.indexOf(todayKey);

    const days = dayOrder.map((day, index) => {
        const scheduled = dedupeAndFilterByDay(routines, day);
        const doneCount = (week?.completions?.[day] || []).length;
        return {
            day,
            scheduled: scheduled.length,
            done: doneCount,
            pct: scheduled.length > 0 ? Math.round((doneCount / scheduled.length) * 100) : null,
            isFuture: index > todayIndex,
            isToday: index === todayIndex,
        };
    });

    return { weekId, days };
};
