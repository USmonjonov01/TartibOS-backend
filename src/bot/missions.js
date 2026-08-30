import prisma from "../lib/prisma.js";
import { getDateStr } from "../lib/date.js";

const PRIORITY_ICON = { yuqori: "🔴", ortacha: "🟠", past: "🟢" };

// Bugungi va kechikkan (muddati o'tgan, hali bajarilmagan) missiyalar.
// Frontenddagi Missions sahifasidagi "bugun"/"kechikkan" tushunchasi bilan
// bir xil mantiq — faqat backend'da soddalashtirilgan holda.
export const getMissionOverviewForUser = async (user) => {
    const timezone = user.timezone || "Asia/Tashkent";
    const todayStr = getDateStr(timezone);

    const missions = await prisma.mission.findMany({
        where: { userId: user.id, cancelled: false, completed: false, date: { lte: todayStr } },
        orderBy: { date: "asc" },
    });

    const today = missions.filter((m) => m.date === todayStr);
    const overdue = missions.filter((m) => m.date < todayStr);

    return { today, overdue, priorityIcon: PRIORITY_ICON };
};
