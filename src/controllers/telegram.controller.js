import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import env from "../config/env.js";
import { signToken } from "../lib/jwt.js";
import { verifyTelegramInitData } from "../lib/telegramAuth.js";

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 daqiqa — havola shuncha vaqt amal qiladi

export const createLinkToken = async (req, res, next) => {
    try {
        if (!env.telegramBotUsername) {
            return res.status(503).json({ message: "Telegram bot hozircha sozlanmagan" });
        }

        const token = crypto.randomBytes(24).toString("hex");
        await prisma.telegramLinkToken.create({
            data: {
                token,
                userId: req.user.id,
                expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
            },
        });

        res.json({
            deepLink: `https://t.me/${env.telegramBotUsername}?start=${token}`,
            expiresInSeconds: TOKEN_TTL_MS / 1000,
        });
    } catch (err) {
        next(err);
    }
};

export const getStatus = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        res.json({ linked: Boolean(user.telegramChatId), linkedAt: user.telegramLinkedAt });
    } catch (err) {
        next(err);
    }
};

export const unlink = async (req, res, next) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { telegramChatId: null, telegramLinkedAt: null },
        });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
};

// Telegram Mini App ochilganda chaqiriladi — hech qanday login/parol so'ralmaydi,
// chunki initData Telegram tomonidan allaqachon imzolangan. Agar shu Telegram
// hisobi avval saytda bog'langan bo'lsa — to'g'ridan-to'g'ri oddiy JWT beriladi
// (keyingi barcha so'rovlar — routines, weeks, missions — ODATDAGI endpoint'lar
// orqali ishlaydi, alohida "bot API"ga hojat yo'q).
export const miniAppAuth = async (req, res, next) => {
    try {
        const { initData } = req.body;
        const { valid, telegramUser } = verifyTelegramInitData(initData, env.telegramBotToken);
        if (!valid) {
            return res.status(401).json({ message: "initData tekshirilmadi" });
        }

        const user = await prisma.user.findUnique({
            where: { telegramChatId: String(telegramUser.id) },
        });

        if (!user) {
            return res.json({ linked: false });
        }

        const token = signToken({ sub: user.id });
        res.json({
            linked: true,
            token,
            user: { id: user.id, ism: user.ism, email: user.email },
        });
    } catch (err) {
        next(err);
    }
};

// Mini App ichida foydalanuvchi birinchi marta email+parol bilan kirganda
// (oddiy /api/auth/login orqali JWT olingach) chaqiriladi — shu Telegram
// hisobini doimiy ravishda ushbu foydalanuvchiga bog'laydi. requireAuth
// middleware'i orqali himoyalangan, shuning uchun initData'ni qayta
// tekshirish + parolni bilishi ikkalasi ham talab qilinadi — soxta bog'lash
// imkonsiz.
export const linkViaMiniApp = async (req, res, next) => {
    try {
        const { initData } = req.body;
        const { valid, telegramUser } = verifyTelegramInitData(initData, env.telegramBotToken);
        if (!valid) {
            return res.status(401).json({ message: "initData tekshirilmadi" });
        }

        const chatId = String(telegramUser.id);
        const takenBy = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
        if (takenBy && takenBy.id !== req.user.id) {
            return res.status(409).json({ message: "Bu Telegram hisobi boshqa foydalanuvchiga bog'langan" });
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: { telegramChatId: chatId, telegramLinkedAt: new Date() },
        });

        res.json({ linked: true });
    } catch (err) {
        next(err);
    }
};
