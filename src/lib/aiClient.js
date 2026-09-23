import * as gemini from "./providers/geminiProvider.js";
import * as cloudflare from "./providers/cloudflareProvider.js";
import * as groq from "./providers/groqProvider.js";

// Provayderlar shu tartibda sinaladi: Gemini (asosiy, bepul) → Cloudflare AI
// Gateway / GPT-5.5 (pullik, lekin sifatli zaxira) → Groq (bepul, tez,
// oxirgi zaxira). aiRoadmap.js va aiRoutine.js bu fayldan generateJson'ni
// import qiladi — ular provayderlar haqida umuman bilmaydi, shuning uchun
// bu tartibni yoki ro'yxatni o'zgartirish ularga hech qanday ta'sir qilmaydi.
const PROVIDERS = [gemini, cloudflare, groq];

// Har bir provayderni navbat bilan sinab ko'radi:
//  - AI_NOT_CONFIGURED bo'lsa (kalit yo'q) — darhol keyingisiga o'tadi, xato yozmaydi
//  - AI_REQUEST_FAILED yoki AI_PARSE_FAILED bo'lsa — logga yozadi va keyingisiga o'tadi
//  - Hech biri ishlamasa — oxirgi provayderning xatosini tashlaydi (controller
//    buni tutib, foydalanuvchiga "AI xizmati hozircha band" kabi xabar beradi)
export async function generateJson({ systemPrompt, userText }) {
    let lastErr;

    for (const provider of PROVIDERS) {
        try {
            const result = await provider.generateJson({ systemPrompt, userText });
            return result;
        } catch (err) {
            lastErr = err;
            if (err.code !== "AI_NOT_CONFIGURED") {
                console.warn(`[aiClient] ${provider.providerName} muvaffaqiyatsiz (${err.code}): ${err.message}`);
            }
            // keyingi provayderga o'tiladi
        }
    }

    // Hech qaysi provayder ishlamadi
    if (!lastErr) {
        lastErr = new Error("Hech qanday AI provayder sozlanmagan");
        lastErr.code = "AI_NOT_CONFIGURED";
    }
    throw lastErr;
}
