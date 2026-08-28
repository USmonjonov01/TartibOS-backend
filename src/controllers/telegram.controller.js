import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import env from "../config/env.js";

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
