import { habitKey } from "./date.js";

// Frontenddagi src/utils/routine.js:dedupeRoutines bilan bir xil mantiq —
// bir xil sarlavhali odatlar orasidan eng oxirgi yaratilganini qoldiradi.
const dedupeRoutines = (routines) => {
    const active = (routines || []).filter((item) => !item.retired);
    const byTitle = new Map();

    active.forEach((item) => {
        const key = habitKey(item);
        if (!key) return;
        const existing = byTitle.get(key);
        if (!existing) {
            byTitle.set(key, item);
            return;
        }
        const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
        const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        if (itemTime >= existingTime) byTitle.set(key, item);
    });

    return Array.from(byTitle.values());
};

// Frontenddagi src/utils/stats.js:getWeekAvgPct bilan AYNAN bir xil algoritm —
// faqat haqiqatda kuzatilgan (statuses mavjud) kunlar hisobga olinadi.
const getWeekAvgPct = (week, routines) => {
    if (!week) return null;
    const trackedDays = Object.keys(week.statuses || {});
    if (trackedDays.length === 0) return null;

    const habits = dedupeRoutines(routines);
    let sum = 0;
    let countedDays = 0;

    trackedDays.forEach((dayKey) => {
        const scheduledCount = habits.filter(
            (h) => !h.days || h.days.length === 0 || h.days.includes(dayKey)
        ).length;
        if (scheduledCount === 0) return;
        const executions = week.executions?.[dayKey] || 0;
        sum += Math.min(100, Math.round((executions / scheduledCount) * 100));
        countedDays += 1;
    });

    return countedDays > 0 ? Math.round(sum / countedDays) : null;
};

// Frontenddagi getHabitRates'ning shu bitta hafta uchun soddalashtirilgan
// versiyasi — AI promptiga "eng zaif" va "eng kuchli" odatlarni aniq
// ko'rsatish uchun yetarli.
const getHabitRates = (routines, week) => {
    const habits = dedupeRoutines(routines);
    const statuses = week?.statuses || {};
    const completions = week?.completions || {};

    return habits
        .map((habit) => {
            const key = habitKey(habit);
            const days = habit.days || [];
            let scheduled = 0;
            let completed = 0;

            Object.keys(statuses).forEach((dayKey) => {
                if (days.length > 0 && !days.includes(dayKey)) return;
                scheduled += 1;
                if ((completions[dayKey] || []).includes(key)) completed += 1;
            });

            return {
                title: habit.title,
                scheduled,
                completed,
                rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : null,
            };
        })
        .filter((h) => h.scheduled > 0)
        .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
};

// Frontenddagi getMissionStatsForWeek bilan bir xil: mission.date qaysi ISO
// haftaga tushishiga qarab guruhlanadi (scope maydoniga e'tibor berilmaydi).
const getMissionStatsForWeek = (missions, weekId, isoWeekId) => {
    const inWeek = (missions || []).filter((m) => m.date && isoWeekId(new Date(m.date)) === weekId);
    const completed = inWeek.filter((m) => m.completed).length;
    return {
        total: inWeek.length,
        completed,
        rate: inWeek.length > 0 ? Math.round((completed / inWeek.length) * 100) : null,
    };
};

// Bitta Goal ichida, shu hafta (monday..sunday) DAVOMIDA bajarilgan
// bosqichlarni ajratib oladi — "shu hafta nima yutuqqa erishdingiz" degan
// eng aniq signal, sof umumiy Level'dan ko'ra ko'proq narsa aytadi.
const buildGoalsProgress = (goals, monday, sunday) =>
    (goals || []).map((goal) => {
        const steps = goal.steps || [];
        const doneTotal = steps.filter((s) => s.completed).length;
        const stepsThisWeek = steps.filter((s) => {
            if (!s.completed || !s.completedAt) return false;
            const t = new Date(s.completedAt).getTime();
            return t >= monday.getTime() && t <= sunday.getTime();
        });

        return {
            title: goal.title,
            level: 1 + doneTotal,
            progress: `${doneTotal}/${steps.length}`,
            stepsDoneThisWeek: stepsThisWeek.map((s) => s.title),
        };
    });

// AI'ga yuboriladigan va controller javobida ham qaytariladigan, shu
// haftaning to'liq "portreti". Barcha manba: Week (odatlar), Mission
// (missiyalar), Goal+RoadmapStep (maqsad taraqqiyoti) — hech qanday
// o'ylab topilgan/taxminiy son yo'q.
export function buildWeeklyStats({ weekId, week, previousWeek, routines, missions, goals, monday, sunday, isoWeekId }) {
    return {
        weekId,
        currentPct: getWeekAvgPct(week, routines),
        previousPct: getWeekAvgPct(previousWeek, routines),
        habitRates: getHabitRates(routines, week),
        missionStats: getMissionStatsForWeek(missions, weekId, isoWeekId),
        goalsProgress: buildGoalsProgress(goals, monday, sunday),
    };
}
