import env from "../config/env.js";

const SYSTEM_PROMPT = `Sen TartibOS ilovasidagi shaxsiy rivojlanish yordamchisisan. Foydalanuvchi
o'ziga bir maqsad qo'yadi (masalan "Fullstack developer bo'lish", "Gitara chalishni
o'rganish", "Yugurish orqali sog'lom bo'lish"). Sening vazifang — shu MAQSADNING O'ZIGA
mos, boshlang'ichdan maqsadga yetguncha bo'lgan real, mantiqiy ketma-ketlikdagi
bosqichlar (roadmap) tuzish.

Qat'iy qoidalar:
- Bosqichlar FAQAT foydalanuvchi yozgan maqsadga oid bo'lsin. Agar maqsad "gitara
  chalish" bo'lsa, bosqichlar dasturlash yoki sport haqida BO'LMASIN.
- 5 tadan 8 tagacha bosqich yarat, eng oddiy/boshlang'ich narsadan boshlab, eng
  yuqori/murakkab narsaga qarab tartiblangan holda.
- Har bir bosqich uchun: "title" (aniq, bajarsa bo'ladigan harakat, o'zbek tilida,
  10 so'zdan oshmasin) va "stageLabel" (foydalanuvchining shu bosqichdagi "unvoni",
  2-4 so'z, masalan "Boshlang'ich gitarachi", "Junior Backend").
- Javobni FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn, izoh yoki
  markdown belgisisiz:
{"steps":[{"title":"...","stageLabel":"..."}]}`;

// goalTitle — foydalanuvchi kiritgan maqsad matni (masalan "Fullstack developer bo'lish").
// Muvaffaqiyatli bo'lsa, [{ title, stageLabel }] massivini qaytaradi.
// API kaliti yo'q yoki chaqiruv muvaffaqiyatsiz bo'lsa, xato tashlaydi — controller buni tutib,
// foydalanuvchiga tushunarli xabar qaytaradi (frontend "bo'sh, o'zim qo'shaman"ga o'tkazadi).
export async function generateRoadmapSteps(goalTitle) {
    if (!env.geminiApiKey) {
        const err = new Error("AI xizmati sozlanmagan (GEMINI_API_KEY yo'q)");
        err.code = "AI_NOT_CONFIGURED";
        throw err;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;

    // Eslatma: thinkingLevel faqat Gemini 3.x modellarida ishlaydi (hozirgi standart
    // GEMINI_MODEL shunday). Agar kelajakda GEMINI_MODEL'ni 2.5 seriyasiga o'zgartirsangiz,
    // bu yerda thinkingBudget'ga almashtirish kerak bo'ladi — aks holda 400 xato qaytadi.

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.geminiApiKey,
        },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: `Maqsad: ${goalTitle}` }] }],
            // Gemini 3.x'da "thinking" standart holatda yoqiq bo'lib, oddiy so'rovga ham
            // yuzlab token sarflaydi. Bizga esa qisqa JSON ro'yxat kifoya — shuning uchun
            // "low" bilan tezlik/xarajatni optimallashtiramiz, sifat bu vazifa uchun yetarli.
            generationConfig: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel: "low" },
            },
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        const err = new Error(`AI xizmatidan xato: ${response.status} ${text}`);
        err.code = "AI_REQUEST_FAILED";
        throw err;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        const err = new Error("AI javobini o'qib bo'lmadi");
        err.code = "AI_PARSE_FAILED";
        throw err;
    }

    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    return steps
        .filter((s) => s?.title)
        .slice(0, 8)
        .map((s) => ({
            title: String(s.title).slice(0, 200),
            stageLabel: s.stageLabel ? String(s.stageLabel).slice(0, 80) : null,
        }));
}
