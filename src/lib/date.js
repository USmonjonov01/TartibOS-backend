// Frontenddagi src/utils/date.js bilan bir xil mantiq — faqat bu yerda
// "hozir" foydalanuvchining timezone'iga qarab hisoblanadi (Telegram
// scheduler har xil hududdagi foydalanuvchilar uchun to'g'ri soatda
// ishlashi kerak).

const DAY_KEY_BY_JS_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Berilgan timezone'da "hozir"ning yil/oy/kun/soat/daqiqa/hafta-kuni qismlarini
// qaytaradi. Intl.DateTimeFormat serverning o'z mahalliy vaqtidan mustaqil
// ishlaydi — shuning uchun server qayerda joylashgan bo'lishidan qat'iy nazar
// to'g'ri natija beradi.
export const getNowParts = (timezone = "Asia/Tashkent", date = new Date()) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        weekday: "short",
    });

    const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));

    const weekdayMap = { Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" };

    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour === "24" ? "00" : parts.hour,
        minute: parts.minute,
        dayKey: weekdayMap[parts.weekday] || DAY_KEY_BY_JS_INDEX[date.getUTCDay()],
    };
};

export const getDateStr = (timezone, date = new Date()) => {
    const p = getNowParts(timezone, date);
    return `${p.year}-${p.month}-${p.day}`;
};

export const getHHMM = (timezone, date = new Date()) => {
    const p = getNowParts(timezone, date);
    return `${p.hour}:${p.minute}`;
};

export const getDayKey = (timezone, date = new Date()) => getNowParts(timezone, date).dayKey;

// Frontenddagi getISOWeekId bilan bir xil algoritm (ISO-8601), faqat
// foydalanuvchi timezone'idagi sana asosida hisoblanadi.
export const getISOWeekId = (timezone, date = new Date()) => {
    const p = getNowParts(timezone, date);
    const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

// Frontenddagi src/utils/routine.js:habitKey bilan AYNAN bir xil bo'lishi
// SHART — aks holda bot orqali belgilangan odat frontendda alohida
// "boshqa odat" sifatida ko'rinib qoladi.
export const habitKey = (item) => item?.title?.trim().toLowerCase() || item?.id;

// Berilgan weekId ("2026-W34") uchun o'sha haftaning DUSHANBA sanasini
// qaytaradi — frontenddagi src/utils/date.js:getMondayOfISOWeek bilan AYNAN
// bir xil algoritm. Timezone'ga bog'liq emas (sof kalendar hisob-kitobi),
// shu sabab haftalik AI xulosasi uchun statistika oralig'ini (Dushanba —
// Yakshanba) aniqlashda ishlatiladi.
export const getMondayOfISOWeek = (weekId) => {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekId || "");
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);

    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - (jan4Day - 1));

    const monday = new Date(mondayOfWeek1);
    monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
};

// getISOWeekId bilan bir xil algoritm, lekin timezone'siz — bitta Date
// obyektidan to'g'ridan-to'g'ri (masalan Mission.date yoki
// RoadmapStep.completedAt'dan) hafta ID'sini chiqarish uchun. Foydalanuvchi
// timezone'i kerak bo'lmagan joylarda (masalan weekId allaqachon ma'lum
// bo'lgan on-demand AI xulosa so'rovida) shu qulayroq.
export const getISOWeekIdFromDate = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};
