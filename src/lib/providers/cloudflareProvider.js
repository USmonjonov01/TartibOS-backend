import env from "../../config/env.js";

const MAX_RETRIES = 1; // Cloudflare uchun kamroq qayta urinish — bu allaqachon fallback qatlami
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Xom AI javobidan (ba'zan ```json ... ``` bilan o'ralgan bo'lishi mumkin)
// toza JSON matnini ajratib oladi.
function stripCodeFence(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1] : trimmed;
}

// Cloudflare AI Gateway'ning unified REST API'si orqali (OpenAI-compatible
// /ai/v1/chat/completions endpoint) GPT-5.5 (yoki env orqali sozlangan boshqa
// openai/... modeli) ga so'rov yuboradi. Bu haqiqiy OpenAI API'ga Cloudflare
// hisobi orqali proksi qilingan, billing Cloudflare akkauntingizga tushadi —
// akkauntda yetarli kredit borligiga ishonch hosil qiling.
export async function generateJson({ systemPrompt, userText }) {
    if (!env.cloudflareApiToken || !env.cloudflareAccountId) {
        const err = new Error("Cloudflare AI Gateway sozlanmagan (CLOUDFLARE_API_TOKEN yoki CLOUDFLARE_ACCOUNT_ID yo'q)");
        err.code = "AI_NOT_CONFIGURED";
        throw err;
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/v1/chat/completions`;

    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.cloudflareApiToken}`,
            },
            body: JSON.stringify({
                model: env.cloudflareModel,
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
                const err = new Error("Cloudflare AI javobini o'qib bo'lmadi");
                err.code = "AI_PARSE_FAILED";
                throw err;
            }
        }

        const text = await response.text().catch(() => "");
        lastErr = new Error(`Cloudflare AI xizmatidan xato: ${response.status} ${text}`);
        lastErr.code = "AI_REQUEST_FAILED";

        const isRetryable = response.status === 503 || response.status === 429;
        if (!isRetryable || attempt === MAX_RETRIES) {
            throw lastErr;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
    }

    throw lastErr;
}

export const providerName = "cloudflare";
