import { generateJson } from "./aiClient.js";

// aiRoutine.js bilan bir xil naqsh: qat'iy tuzilgan system prompt + JSON
// javob + sanitize. AI'ga faqat HAQIQIY hisoblangan raqamlar beriladi
// (formatStatsForPrompt) — u hech qanday sonni o'zi o'ylab topmasligi kerak.
const SYSTEM_PROMPT = `Sen TartibOS ilovasidagi shaxsiy intizom tahlilchisisan. Foydalanuvchining
bir haftalik statistikasi (odatlar bajarilishi, missiyalar, maqsad bo'yicha yo'l xaritasi
taraqqiyoti, o'tgan haftaga solishtirma) berilgan. Sening vazifang — shu haqiqiy raqamlarga
asoslangan, samimiy va motivatsion, lekin HALOL (ko'r-ko'rona maqtov emas, oshirib
yubormaydigan) haftalik xulosa yozish.

Qat'iy qoidalar:
- FAQAT berilgan raqamlar va nomlardan foydalan. Hech qanday son, foiz yoki voqeani
  o'ylab topma yoki taxmin qilma.
- "conclusion" — 2 dan 4 gapgacha umumiy xulosa, o'zbek tilida (lotin), "Siz" murojaati
  bilan iliq ohangda, lekin haqiqiy natijaga tayangan holda.
- "strengths" — 0 dan 3 tagacha, shu hafta chindan ham yaxshi ketgan narsalar (har biri
  12 so'zgacha). Agar hech narsa alohida ajralib turmasa, bo'sh massiv qoldir.
- "watchOut" — eng ko'p e'tibor talab qiladigan BITTA joy (16 so'zgacha) yoki bo'sh satr
  (agar hammasi yaxshi bo'lsa).
- "nextFocus" — kelgusi hafta uchun BITTA aniq, kichik va bajarsa bo'ladigan tavsiya
  (16 so'zgacha).
- Javobni FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn yoki markdown
  belgisisiz:
{"conclusion":"...","strengths":["..."],"watchOut":"...","nextFocus":"..."}`;

const clip = (s, n) => String(s ?? "").trim().slice(0, n);

function formatStatsForPrompt(stats) {
    const lines = [];
    lines.push(`Hafta: ${stats.weekId}`);
    lines.push(
        stats.currentPct !== null
            ? `Bu haftagi o'rtacha ijro: ${stats.currentPct}%`
            : "Bu hafta hali yetarli kuzatilgan kun yo'q."
    );
    if (stats.previousPct !== null) {
        lines.push(`O'tgan haftagi o'rtacha ijro: ${stats.previousPct}%`);
    }

    if (stats.habitRates.length) {
        lines.push("Odatlar (shu hafta bajarilgan/rejalashtirilgan kun soni, foiz):");
        stats.habitRates.forEach((h) => lines.push(`- ${h.title}: ${h.completed}/${h.scheduled} (${h.rate}%)`));
    } else {
        lines.push("Bu hafta kuzatilgan odat yo'q.");
    }

    if (stats.missionStats.total > 0) {
        lines.push(
            `Missiyalar: ${stats.missionStats.completed}/${stats.missionStats.total} (${stats.missionStats.rate}%)`
        );
    } else {
        lines.push("Bu hafta rejalashtirilgan missiya yo'q.");
    }

    if (stats.goalsProgress.length) {
        lines.push("Maqsadlar bo'yicha taraqqiyot:");
        stats.goalsProgress.forEach((g) => {
            const stepsLine = g.stepsDoneThisWeek.length
                ? `, shu hafta bajarilgan bosqichlar: ${g.stepsDoneThisWeek.join("; ")}`
                : ", shu hafta yangi bosqich bajarilmagan";
            lines.push(`- ${g.title} (Level ${g.level}, jami ${g.progress} bosqich)${stepsLine}`);
        });
    } else {
        lines.push("Foydalanuvchining faol maqsadi yo'q.");
    }

    return lines.join("\n");
}

export function sanitizeWeeklyConclusion(parsed) {
    const conclusion = clip(parsed?.conclusion, 500);
    if (!conclusion) {
        const err = new Error("AI haftalik xulosa yarata olmadi");
        err.code = "AI_PARSE_FAILED";
        throw err;
    }

    const strengths = Array.isArray(parsed?.strengths)
        ? parsed.strengths.map((s) => clip(s, 100)).filter(Boolean).slice(0, 3)
        : [];
    const watchOut = clip(parsed?.watchOut, 140);
    const nextFocus = clip(parsed?.nextFocus, 140);

    return { conclusion, strengths, watchOut, nextFocus };
}

// Week.conclusion ustuniga saqlanadigan, o'qishga tayyor yakuniy matn.
// Bir nechta AI maydonini (conclusion/strengths/watchOut/nextFocus) bitta
// matnga birlashtiradi — schema'ga yangi ustun qo'shmaslik uchun ataylab
// shunday (Week.conclusion allaqachon mavjud, faqat hech qachon
// to'ldirilmagan edi).
export function formatConclusionText({ conclusion, strengths, watchOut, nextFocus }) {
    const parts = [conclusion];
    if (strengths.length) {
        parts.push("Yaxshi tomonlar:\n" + strengths.map((s) => `• ${s}`).join("\n"));
    }
    if (watchOut) parts.push(`Diqqat talab qiladi: ${watchOut}`);
    if (nextFocus) parts.push(`Kelgusi hafta uchun tavsiya: ${nextFocus}`);
    return parts.join("\n\n");
}

// stats — src/lib/weeklyStats.js:buildWeeklyStats natijasi.
export async function generateWeeklyConclusion(stats) {
    const userText = formatStatsForPrompt(stats);
    const parsed = await generateJson({ systemPrompt: SYSTEM_PROMPT, userText });
    const clean = sanitizeWeeklyConclusion(parsed);
    return { ...clean, text: formatConclusionText(clean) };
}
