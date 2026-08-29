import crypto from "node:crypto";

// Telegram Mini App'ning rasmiy initData tekshirish algoritmi:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// Bu MUHIM xavfsizlik qatlami — initData Telegram tomonidan bot tokeningiz
// bilan imzolangan, shuning uchun uni faqat backend (token bilan) tekshira
// oladi. Buni o'tkazib yuborish — istalgan kishi o'zini boshqa foydalanuvchi
// sifatida ko'rsatishiga imkon berish degani.
export const verifyTelegramInitData = (initData, botToken) => {
    if (!initData || !botToken) return { valid: false };

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };
    params.delete("hash");

    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (computedHash !== hash) return { valid: false };

    // Replay-hujumlardan himoya — 24 soatdan eski initData rad etiladi
    const authDate = Number(params.get("auth_date")) * 1000;
    if (!authDate || Date.now() - authDate > 24 * 60 * 60 * 1000) {
        return { valid: false, reason: "expired" };
    }

    let telegramUser;
    try {
        telegramUser = JSON.parse(params.get("user") || "null");
    } catch {
        return { valid: false };
    }

    if (!telegramUser?.id) return { valid: false };

    return { valid: true, telegramUser };
};
