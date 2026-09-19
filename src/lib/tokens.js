import crypto from "node:crypto";

// Parolni tiklash va email tasdiqlash — ikkalasi ham bir xil naqshdan
// foydalanadi: foydalanuvchiga RAW (xom) token yuboriladi (email havolasida),
// bazada esa faqat uning SHA-256 xeshi saqlanadi. Shu orqali baza sizib
// chiqqan taqdirda ham, hujumchi xeshdan asl tokenni tiklab, hisoblarga
// kira olmaydi — xuddi parolni bcrypt bilan xeshlashning xuddi shu sababi.
//
// bcrypt emas, oddiy SHA-256 ishlatilyapti — chunki bu yerda "brute-force
// sekinlashtirish" shart emas (token o'zi 32 bayt tasodifiy, taxmin qilib
// bo'lmaydi), bcrypt esa keraksiz CPU sarflardi.

export const generateRawToken = () => crypto.randomBytes(32).toString("hex");

export const hashToken = (rawToken) => crypto.createHash("sha256").update(rawToken).digest("hex");
