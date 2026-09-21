import env from "../config/env.js";

const MAX_RETRIES = 2; // jami 3 marta urinadi (1 + 2 qayta urinish)
const RETRY_DELAY_MS = 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini'ga bitta system prompt + foydalanuvchi matni yuboradi va JSON
// javobni parse qilib qaytaradi. aiRoadmap.js va aiRoutine.js shu ikkalasi
// uchun umumiy — retry, xato kodlari va konfiguratsiya bitta joyda turadi.
//
// Xato kodlari (controller'lar shularni tutadi):
//   AI_NOT_CONFIGURED — GEMINI_API_KEY yo'q
//   AI_REQUEST_FAILED — Gemini HTTP xatosi (503/429'da avtomatik qayta uriniladi)
//   AI_PARSE_FAILED   — javob JSON emas
//
// Eslatma: thinkingLevel faqat Gemini 3.x modellarida ishlaydi. Agar
// GEMINI_MODEL 2.5 seriyasiga o'zgartirilsa, bu yerda thinkingBudget'ga
// almashtirish kerak — aks holda 400 xato qaytadi.
export async function generateJson({ systemPrompt, userText }) {
    if (!env.geminiApiKey) {
        const err = new Error("AI xizmati sozlanmagan (GEMINI_API_KEY yo'q)");
        err.code = "AI_NOT_CONFIGURED";
        throw err;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;

    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": env.geminiApiKey,
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: userText }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingLevel: "low" },
                },
            }),
        });

        if (response.ok) {
            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            try {
                return JSON.parse(rawText);
            } catch {
                const err = new Error("AI javobini o'qib bo'lmadi");
                err.code = "AI_PARSE_FAILED";
                throw err; // parse xatosi qayta urinishga yordam bermaydi
            }
        }

        const text = await response.text().catch(() => "");
        lastErr = new Error(`AI xizmatidan xato: ${response.status} ${text}`);
        lastErr.code = "AI_REQUEST_FAILED";

        const isRetryable = response.status === 503 || response.status === 429;
        if (!isRetryable || attempt === MAX_RETRIES) {
            throw lastErr;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
    }

    throw lastErr;
}
