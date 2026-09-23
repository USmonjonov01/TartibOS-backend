import env from "../../config/env.js";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stripCodeFence(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1] : trimmed;
}

// Groq'ning bepul (kredit karta talab qilmaydigan) OpenAI-compatible API'si.
// Zanjirning oxirgi zaxirasi — Gemini va Cloudflare ikkalasi ham muvaffaqiyatsiz
// bo'lganda shu ishga tushadi. Juda tez (LPU chip), lekin JSON formatga
// Gemini/GPT kabi barqaror rioya qilmasligi mumkin — shuning uchun
// stripCodeFence bilan ehtiyot chorasi ko'rilgan.
export async function generateJson({ systemPrompt, userText }) {
    if (!env.groqApiKey) {
        const err = new Error("Groq sozlanmagan (GROQ_API_KEY yo'q)");
        err.code = "AI_NOT_CONFIGURED";
        throw err;
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.groqApiKey}`,
            },
            body: JSON.stringify({
                model: env.groqModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userText },
                ],
                response_format: { type: "json_object" },
            }),
        });

        if (response.ok) {
            const data = await response.json();
            const rawText = data?.choices?.[0]?.message?.content || "";
            try {
                return JSON.parse(stripCodeFence(rawText));
            } catch {
                const err = new Error("Groq javobini o'qib bo'lmadi");
                err.code = "AI_PARSE_FAILED";
                throw err;
            }
        }

        const text = await response.text().catch(() => "");
        lastErr = new Error(`Groq xizmatidan xato: ${response.status} ${text}`);
        lastErr.code = "AI_REQUEST_FAILED";

        const isRetryable = response.status === 503 || response.status === 429;
        if (!isRetryable || attempt === MAX_RETRIES) {
            throw lastErr;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
    }

    throw lastErr;
}

export const providerName = "groq";
