import { generateJson } from "./aiClient.js";

// Yo'l xaritasi uzunligi. Avval 5–8 bosqich edi — foydalanuvchiga "yo'l aniq"
// degan ishonch bermasdi. Endi 15–20: boshidan oxirigacha to'liq yo'l.
export const TARGET_MIN = 15;
export const MIN_STEPS = TARGET_MIN; // shundan kam kelsa, bir marta qayta so'raymiz
export const MAX_STEPS = 20;

const SYSTEM_PROMPT = `Sen TartibOS ilovasidagi shaxsiy rivojlanish yordamchisisan. Foydalanuvchi
o'ziga bir maqsad qo'yadi (masalan "Fullstack developer bo'lish", "Gitara chalishni
o'rganish", "Yugurish orqali sog'lom bo'lish"). Sening vazifang — shu MAQSADNING O'ZIGA
mos, hozirgi nuqtadan maqsadga yetguncha bo'lgan TO'LIQ, batafsil va aniq yo'l xaritasini
tuzish. Foydalanuvchi shu xaritaga qarab "mening yo'lim aniq ekan" degan ishonchga kelishi kerak.

Qat'iy qoidalar:
- Bosqichlar FAQAT foydalanuvchi yozgan maqsadga oid bo'lsin. Agar maqsad "gitara
  chalish" bo'lsa, bosqichlar dasturlash yoki sport haqida BO'LMASIN.
- ${TARGET_MIN} tadan ${MAX_STEPS} tagacha bosqich yarat. Yo'lni qisqartirma: har bir bosqich
  kichik, aniq qadam bo'lsin (odatda 1–4 haftalik ish), katta sakrashlar bo'lmasin.
- Boshlanish nuqtasini maqsad matnidan aniqla: agar maqsadda hozirgi daraja ko'rsatilgan
  bo'lsa (masalan "Frontend'dan Fullstack'ga"), o'sha darajadan boshla; ko'rsatilmagan
  bo'lsa, noldan (mutlaqo boshlang'ich) boshla.
- Tartib: eng oddiy/poydevor narsadan boshlab, eng murakkab va yakuniy natijaga qarab.
  Yo'l ichida bo'lishi kerak: poydevor → amaliyot → birinchi haqiqiy natija/loyiha →
  chuqurlashish → murakkab vazifalar → isbot (portfolio, imtihon, musobaqa, o'lchanadigan
  natija) → maqsadga erishish. Oxirgi bosqich — maqsadning o'zi yoki uning isboti.
- Har bir bosqich TEKSHIRIB BO'LADIGAN natijaga ega bo'lsin: shunchaki "X ni o'rganish"
  emas, balki "X ni o'rganib, Y ni qilib ko'rsatish". Bosqichlar bir-birini takrorlamasin.
- "title" — o'zbek tilida (lotin yozuvi), aniq harakat + natija, 14 so'zdan oshmasin.
- "stageLabel" — foydalanuvchining shu bosqichdagi "unvoni", 2–4 so'z (masalan
  "Boshlang'ich gitarachi", "Junior Backend"). Unvonlar yo'l bo'ylab o'sib borsin;
  qo'shni bosqichlar bir xil unvonga ega bo'lishi mumkin, lekin oxirgisi eng yuqori bo'lsin.
- Javobni FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn, izoh yoki
  markdown belgisisiz:
{"steps":[{"title":"...","stageLabel":"..."}]}`;

// Xom AI javobini tozalaydi: bo'sh/takror bosqichlarni tashlaydi, uzunlikni
// cheklaydi va MAX_STEPS'dan ortig'ini kesadi.
export function normalizeSteps(parsed) {
    const raw = Array.isArray(parsed?.steps) ? parsed.steps : [];
    const seen = new Set();
    const steps = [];

    for (const s of raw) {
        const title = s?.title ? String(s.title).trim().slice(0, 200) : "";
        if (!title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        steps.push({
            title,
            stageLabel: s.stageLabel ? String(s.stageLabel).trim().slice(0, 80) : null,
        });
        if (steps.length === MAX_STEPS) break;
    }
    return steps;
}

// goalTitle — foydalanuvchi kiritgan maqsad matni.
// Muvaffaqiyatli bo'lsa, [{ title, stageLabel }] massivini qaytaradi.
// AI juda qisqa xarita (MIN_STEPS'dan kam) qaytarsa, bir marta qayta so'raydi.
// API kaliti yo'q yoki chaqiruv muvaffaqiyatsiz bo'lsa, xato tashlaydi — controller
// buni tutib, foydalanuvchiga tushunarli xabar qaytaradi.
export async function generateRoadmapSteps(goalTitle) {
    let best = [];

    for (let attempt = 0; attempt < 2; attempt++) {
        const hint =
            attempt === 0
                ? ""
                : `\n\nDIQQAT: oldingi javobda bosqichlar yetarli emas edi. Aynan ${TARGET_MIN}–${MAX_STEPS} ta batafsil bosqich yarat.`;

        const parsed = await generateJson({
            systemPrompt: SYSTEM_PROMPT,
            userText: `Maqsad: ${goalTitle}\nBosqichlar soni: ${TARGET_MIN}–${MAX_STEPS} ta (kamida ${TARGET_MIN} ta). Yo'lni qisqartirma, har bir qadamni alohida yoz.${hint}`,
        });

        const steps = normalizeSteps(parsed);
        if (steps.length > best.length) best = steps;
        if (best.length >= MIN_STEPS) break;
    }

    if (best.length < TARGET_MIN) {
        // Render loglarida ko'rinishi uchun: AI ikki urinishda ham qisqa xarita bergan
        console.warn(`[aiRoadmap] AI ${best.length} ta bosqich qaytardi (kutilgan ${TARGET_MIN}–${MAX_STEPS}): "${goalTitle}"`);
    }
    return best;
}
