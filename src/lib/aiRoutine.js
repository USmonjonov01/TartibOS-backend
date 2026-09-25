import { generateJson } from "./aiClient.js";

// Frontend'dagi Routine sahifasi bilan bir xil kategoriyalar/ikonlar
// (src/components/Routine/index.jsx). Ikon foydalanuvchi qo'lda yaratgan
// odatlardagidek kategoriyadan olinadi.
export const CATEGORIES = ["Salomatlik", "Jismoniy", "Bilim", "Kasb", "Refleksiya", "Ijtimoiy", "Boshqa"];
const CATEGORY_ICONS = {
    Salomatlik: "💚",
    Jismoniy: "💪",
    Bilim: "📚",
    Kasb: "💼",
    Refleksiya: "🪞",
    Ijtimoiy: "👥",
    Boshqa: "✦",
};
const PRIORITIES = ["yuqori", "ortacha", "past"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MIN_ROUTINES = 3;
const MAX_ROUTINES = 8;
const MAX_DURATION_MIN = 240;

const SYSTEM_PROMPT = `Sen TartibOS ilovasidagi shaxsiy intizom yordamchisisan. Foydalanuvchining maqsadi va
uning yo'l xaritasi (bosqichlari) berilgan. Sening vazifang — shu maqsadga yetish uchun
foydalanuvchiga MAXSUS, REAL va bajarsa bo'ladigan haftalik kun tartibi (odatlar
ro'yxati) tuzish. Noto'g'ri yoki oshirib yuborilgan tartib foydalanuvchini charchatadi
va tashlab ketishiga olib keladi — shuning uchun real bo'l.

Qat'iy qoidalar:
- ${MIN_ROUTINES} tadan ${MAX_ROUTINES} tagacha odat yarat. Kamida yarmi maqsadga BEVOSITA xizmat qilsin
  (yo'l xaritasining hozirgi bosqichlarini bajarishga). Qolganlari qo'llab-quvvatlovchi
  bo'lishi mumkin (harakat, dam olish, kun yakuniy sharhi) — lekin ular ham maqsadga mos bo'lsin.
- Foydalanuvchi kuniga maqsadga ajrata oladigan vaqt beriladi. Maqsadga oid odatlarning
  KUNLIK JAMI davomiyligi shu vaqtdan oshmasin.
- Har bir odat 15 daqiqadan 120 daqiqagacha davom etsin.
- Vaqtlar 24 soatlik "HH:MM" formatida, 06:00 dan 22:30 gacha oralig'ida bo'lsin (uyqu vaqtiga
  tegma). Odatlar bir-birining ustiga tushmasin. "Mavjud odatlar" ro'yxatidagi vaqtlarni
  ham band qilma va ularning nomlarini takrorlama.
- "days" — haftaning kunlari: mon, tue, wed, thu, fri, sat, sun. Hamma odat 7 kun bo'lmasin:
  haftada kamida bitta kun yengil yoki to'liq dam kuni qolsin. Yangi odatni juda tez-tez qilish
  o'rniga izchil rejaga ustunlik ber.
- "title" — QISQA va TANISH bo'lsin (1–3 so'z), foydalanuvchi bir qarashda tushunadigan oddiy
  odat nomi. Bu — HAR KUNI (yoki rejalashtirilgan kunlarda) takrorlanadigan "odat toifasi"ning
  nomi, o'sha kunning ANIQ mazmuni EMAS — kunning aniq mazmuni "dayPlans"da beriladi (pastga
  qara). Uzun, "risoladagidek" yoki bir martalik tavsif beruvchi nomlar YOZMA.
  YAXSHI: "Sport", "Gitara mashqi", "Kitob o'qish", "Meditatsiya", "Ingliz tili".
  YOMON: "Butun tanani mustahkamlovchi mashqlar", "Gitarada akkord va arpeggio mashqlari",
  "Kunlik ingliz tili lug'at va grammatika mashqi" — bular juda uzun va "bir kunlik" tavsifga
  o'xshab qolgan, holbuki bu — doimiy takrorlanadigan odat nomi.
- "dayPlans" — "days" ichidagi HAR BIR kun uchun juda QISQA (2–5 so'z) FOKUS BELGISI, TO'LIQ GAP
  EMAS. Bu xuddi kalendarga qo'lda yozib qo'yiladigan eslatma kabi — "bugun nimaga e'tibor
  qaratish kerak"ligini bir necha so'zda aytadi, uni TUSHUNTIRMAYDI. Agar mavzu kunlar bo'yicha
  tabiiy ravishda bo'linadigan bo'lsa (masalan sport — mushak guruhlari, gitara — texnika turlari,
  dasturlash — mavzular), har bir kun uchun BOSHQA-BOSHQA fokus ber — bir xil so'zni barcha
  kunlarga qo'yib chiqma.
  YAXSHI (Sport uchun): {"mon":"Ko'krak/Press","wed":"Orqa/Bitseps","fri":"Oyoq kuni"}.
  YAXSHI (Gitara uchun): {"mon":"Akkordlar","thu":"Arpeggio mashqi"}.
  YOMON: {"mon":"Bugun siz butun tanangizni mashq qilasiz va kuch mashqlarini bajarasiz"} —
  bu to'liq gap, juda uzun, "dayPlans"ga emas balki tavsifga o'xshaydi.
- Til: "title" va "dayPlans" O'ZBEK TILIDA (lotin yozuvida) bo'lsin. Faqat maqsad texnik soha
  bo'lib, atama o'zbekchada tabiiy qabul qilinmasa (masalan "React", "JavaScript", "Git" kabi
  atoqli/texnik nomlar), o'sha so'zni original holida qoldirish mumkin — lekin gapning qolgan
  qismi baribir o'zbekcha bo'lsin. Oddiy so'zlarni ("chest", "workout", "practice" kabi)
  inglizchada yozma.
- "category" — faqat shulardan biri: ${CATEGORIES.join(", ")}.
- "priority" — faqat: yuqori, ortacha, past.
- Javobni FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn yoki markdown belgisisiz:
{"routines":[{"title":"...","category":"...","priority":"...","start":"HH:MM","end":"HH:MM","days":["mon"],"dayPlans":{"mon":"..."}}]}`;

const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
};

const normTitle = (t) => String(t || "").trim().toLowerCase();

// Ikki odat bir vaqtda, bir kunga tushib qolganmi? days bo'sh/yo'q = har kuni.
const daysOf = (r) => (Array.isArray(r.days) && r.days.length ? r.days : DAY_KEYS);
const overlaps = (a, b) => {
    const sharedDay = daysOf(a).some((d) => daysOf(b).includes(d));
    if (!sharedDay) return false;
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
};

// AI javobini tekshiradi va Routine modeliga mos holatga keltiradi.
// AI'ga ishonib bo'lmaydi: noto'g'ri vaqt, ustma-ust tushgan yoki mavjud odat
// bilan bir xil nomli yozuvlar shu yerda olib tashlanadi. (Frontend odatlarni
// sarlavha bo'yicha "dedupe" qiladi — bir xil nom mavjud odatni yashirib
// qo'yishi mumkin, shuning uchun takror nomlar qat'iy rad etiladi.)
export function sanitizeRoutinePlan(parsed, existingRoutines = []) {
    const raw = Array.isArray(parsed?.routines) ? parsed.routines : [];
    const takenTitles = new Set(existingRoutines.map((r) => normTitle(r.title)));
    const accepted = [];

    for (const r of raw) {
        const title = String(r?.title || "").trim().slice(0, 40);
        if (!title || takenTitles.has(normTitle(title))) continue;

        const start = String(r?.start || "").trim();
        const end = String(r?.end || "").trim();
        if (!TIME_RE.test(start) || !TIME_RE.test(end)) continue;
        const duration = toMinutes(end) - toMinutes(start);
        if (duration <= 0 || duration > MAX_DURATION_MIN) continue;

        const days = [...new Set((Array.isArray(r.days) ? r.days : []).filter((d) => DAY_KEYS.includes(d)))];
        const finalDays = days.length ? days : [...DAY_KEYS];

        const dayPlans = {};
        for (const d of DAY_KEYS) {
            const plan = r?.dayPlans?.[d];
            // 40 belgi ~ 5-6 so'z — dayPlan TO'LIQ GAP emas, qisqa fokus-belgisi
            // bo'lishi kerak (masalan "Ko'krak/Press"), shu sabab qat'iy qisqa.
            dayPlans[d] = finalDays.includes(d) && typeof plan === "string" ? plan.trim().slice(0, 40) : "";
        }

        const candidate = {
            title,
            category: CATEGORIES.includes(r.category) ? r.category : "Boshqa",
            icon: CATEGORY_ICONS[CATEGORIES.includes(r.category) ? r.category : "Boshqa"],
            priority: PRIORITIES.includes(r.priority) ? r.priority : "ortacha",
            start,
            end,
            days: finalDays,
            dayPlans,
        };

        const clashes = [...existingRoutines.filter((e) => e.start && e.end), ...accepted].some((other) =>
            overlaps(candidate, other)
        );
        if (clashes) continue;

        accepted.push(candidate);
        takenTitles.add(normTitle(title));
        if (accepted.length === MAX_ROUTINES) break;
    }

    return accepted.sort((a, b) => a.start.localeCompare(b.start));
}

const formatExisting = (routines) =>
    routines.length === 0
        ? "yo'q"
        : routines
              .map((r) => `- ${r.title} (${r.start}–${r.end}, ${daysOf(r).join("/")})`)
              .join("\n");

// goal: { title, steps: [{ title, completed }] }
// existingRoutines: foydalanuvchining hozirgi faol odatlari
// dailyHours: kuniga maqsadga ajrata oladigan soat (ixtiyoriy)
export async function generateRoutinePlan({ goal, existingRoutines = [], dailyHours }) {
    const steps = goal.steps || [];
    const focus = steps.filter((s) => !s.completed).slice(0, 5);

    const userText = [
        `Maqsad: ${goal.title}`,
        goal.description ? `Foydalanuvchining hozirgi holati (o'zi yozgan izoh): ${goal.description}` : null,
        `Yo'l xaritasi (${steps.length} ta bosqich):`,
        steps.map((s, i) => `${i + 1}. ${s.title}${s.completed ? " (bajarilgan)" : ""}`).join("\n") || "yo'q",
        `Hozirgi e'tibor markazi (birinchi bajarilmagan bosqichlar):`,
        focus.map((s) => `- ${s.title}`).join("\n") || "- yo'q",
        `Kuniga maqsadga ajrata oladigan vaqt: ${dailyHours ?? 2} soat`,
        `Mavjud odatlar (ularning vaqtlarini band qilma, nomlarini takrorlama):`,
        formatExisting(existingRoutines),
    ]
        .filter(Boolean)
        .join("\n");

    const parsed = await generateJson({ systemPrompt: SYSTEM_PROMPT, userText });
    const routines = sanitizeRoutinePlan(parsed, existingRoutines);

    if (routines.length < MIN_ROUTINES) {
        const err = new Error(`AI yaroqli kun tartibi tuza olmadi (${routines.length} ta odat qoldi)`);
        err.code = "AI_PARSE_FAILED";
        throw err;
    }
    return routines;
}