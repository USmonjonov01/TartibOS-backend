import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { generateRawToken, hashToken } from "../lib/tokens.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/mailer.js";
import { verifyGoogleIdToken } from "../lib/googleAuth.js";
import {
    registerSchema,
    loginSchema,
    updateMeSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    googleAuthSchema,
} from "../validators/auth.validators.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 daqiqa
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 soat

const publicUser = (user) => ({
    id: user.id,
    ism: user.ism,
    email: user.email,
    number: user.number,
    address: user.address,
    level: user.level,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
    googleLinked: Boolean(user.googleId),
    avatarUrl: user.avatarUrl,
    hasPassword: Boolean(user.passwordHash),
});

// Email tasdiqlash tokeni yaratib, xat jo'natadi. register() va
// resendVerification() ikkalasi ham shundan foydalanadi. Xat yuborish
// muvaffaqiyatsiz bo'lsa ham (masalan SMTP vaqtincha ishlamasa) asosiy
// oqim (ro'yxatdan o'tish) to'xtab qolmasligi uchun xato yutib yuboriladi —
// faqat logga yoziladi.
const issueVerificationEmail = async (user) => {
    try {
        const rawToken = generateRawToken();
        await prisma.emailVerificationToken.create({
            data: {
                tokenHash: hashToken(rawToken),
                userId: user.id,
                expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
            },
        });
        await sendVerificationEmail(user, rawToken);
    } catch (err) {
        console.error("[auth] Tasdiqlash xati yuborilmadi:", err?.message || err);
    }
};

export const register = async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);

        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            return res.status(409).json({ message: "Bu email allaqachon ro'yxatdan o'tgan" });
        }

        const passwordHash = await bcrypt.hash(data.parol, 12);

        const user = await prisma.user.create({
            data: {
                ism: data.ism,
                email: data.email,
                passwordHash,
                number: data.number || null,
                address: data.address || null,
                activities: {
                    create: [{ title: "Ro'yxatdan o'tildi", color: "#E7A94C" }],
                },
            },
        });

        issueVerificationEmail(user); // fire-and-forget, javobni kutmaydi

        const token = signToken({ sub: user.id });
        res.status(201).json({ token, user: publicUser(user) });
    } catch (err) {
        next(err);
    }
};

export const login = async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
        }

        if (!user.passwordHash) {
            // Google orqali yaratilgan hisob — parol umuman yo'q. Aniq xabar
            // beramiz (email allaqachon band ekanini oshkor qilib qo'ymaydi,
            // chunki bu yerga faqat to'g'ri email kiritilganda yetib kelinadi).
            return res.status(400).json({
                message: "Bu hisob Google orqali yaratilgan. \"Google bilan kirish\" tugmasidan foydalaning yoki parolni tiklash orqali parol o'rnating.",
                code: "GOOGLE_ONLY_ACCOUNT",
            });
        }

        const valid = await bcrypt.compare(data.parol, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
        }

        const token = signToken({ sub: user.id });
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        next(err);
    }
};

export const me = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
        }
        res.json({ user: publicUser(user) });
    } catch (err) {
        next(err);
    }
};

export const updateMe = async (req, res, next) => {
    try {
        const data = updateMeSchema.parse(req.body);
        const { currentParol, parol, ...rest } = data;

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
        }

        const updateData = { ...rest };

        if (data.email && data.email !== user.email) {
            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing) {
                return res.status(409).json({ message: "Bu email allaqachon ro'yxatdan o'tgan" });
            }
            // Email o'zgartirilsa, eski tasdiq endi ishonchli emas —
            // foydalanuvchi yangi manzilni qayta tasdiqlashi kerak bo'ladi.
            updateData.emailVerified = false;
            updateData.emailVerifiedAt = null;
        }

        if (parol) {
            if (user.passwordHash) {
                if (!currentParol) {
                    return res.status(400).json({ message: "Parolni o'zgartirish uchun joriy parolni kiriting" });
                }
                const valid = await bcrypt.compare(currentParol, user.passwordHash);
                if (!valid) {
                    return res.status(401).json({ message: "Joriy parol noto'g'ri" });
                }
                updateData.passwordHash = await bcrypt.hash(parol, 12);
            } else {
                // Google-only hisob birinchi marta parol o'rnatmoqda —
                // joriy parol yo'qligi sababli currentParol talab qilinmaydi.
                updateData.passwordHash = await bcrypt.hash(parol, 12);
            }
        }

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...updateData,
                activities: {
                    create: [{ title: parol ? "Parol yangilandi" : "Profil yangilandi", color: "#E7A94C" }],
                },
            },
        });

        if (updateData.emailVerified === false) {
            issueVerificationEmail(updated);
        }

        res.json({ user: publicUser(updated) });
    } catch (err) {
        next(err);
    }
};

// --- Parolni tiklash -------------------------------------------------------

// Har doim bir xil generik javob qaytaradi — email bazada bor-yo'qligidan
// qat'iy nazar. Aks holda javobning o'zi (200 vs 404) hujumchiga "bu email
// ro'yxatdan o'tganmi" degan ma'lumotni sizdirib qo'yardi (user enumeration).
const FORGOT_PASSWORD_GENERIC_MESSAGE =
    "Agar shu email bilan hisob mavjud bo'lsa, parolni tiklash havolasi yuborildi.";

export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            const rawToken = generateRawToken();
            await prisma.passwordResetToken.create({
                data: {
                    tokenHash: hashToken(rawToken),
                    userId: user.id,
                    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
                },
            });
            sendPasswordResetEmail(user, rawToken).catch((err) =>
                console.error("[auth] Parolni tiklash xati yuborilmadi:", err?.message || err)
            );
        }

        res.json({ message: FORGOT_PASSWORD_GENERIC_MESSAGE });
    } catch (err) {
        next(err);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { token, parol } = resetPasswordSchema.parse(req.body);
        const tokenHash = hashToken(token);

        const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
        if (!record || record.usedAt || record.expiresAt < new Date()) {
            return res.status(400).json({ message: "Havola yaroqsiz yoki muddati o'tgan. Qayta so'rang." });
        }

        const passwordHash = await bcrypt.hash(parol, 12);

        const [, , user] = await prisma.$transaction([
            prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            // Shu foydalanuvchining boshqa barcha ochiq reset-tokenlari ham
            // bekor qilinadi — bitta parol o'zgarganda eski, foydalanilmagan
            // havolalar ham endi yaroqsiz bo'lishi kerak.
            prisma.passwordResetToken.updateMany({
                where: { userId: record.userId, usedAt: null },
                data: { usedAt: new Date() },
            }),
            prisma.user.update({
                where: { id: record.userId },
                data: {
                    passwordHash,
                    activities: { create: [{ title: "Parol tiklandi", color: "#E7A94C" }] },
                },
            }),
        ]);

        const jwtToken = signToken({ sub: user.id });
        res.json({ message: "Parol muvaffaqiyatli tiklandi", token: jwtToken, user: publicUser(user) });
    } catch (err) {
        next(err);
    }
};

// --- Email tasdiqlash --------------------------------------------------------

export const resendVerification = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
        }
        if (user.emailVerified) {
            return res.json({ message: "Email allaqachon tasdiqlangan" });
        }
        await issueVerificationEmail(user);
        res.json({ message: "Tasdiqlash xati qayta yuborildi" });
    } catch (err) {
        next(err);
    }
};

export const verifyEmail = async (req, res, next) => {
    try {
        const { token } = verifyEmailSchema.parse(req.body);
        const tokenHash = hashToken(token);

        const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
        if (!record || record.usedAt || record.expiresAt < new Date()) {
            return res.status(400).json({ message: "Havola yaroqsiz yoki muddati o'tgan. Qayta yuboring." });
        }

        await prisma.$transaction([
            prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            prisma.user.update({
                where: { id: record.userId },
                data: { emailVerified: true, emailVerifiedAt: new Date() },
            }),
        ]);

        res.json({ message: "Email muvaffaqiyatli tasdiqlandi" });
    } catch (err) {
        next(err);
    }
};

// --- Google Sign-In ----------------------------------------------------------

// Bitta endpoint ham kirish, ham ro'yxatdan o'tishni bajaradi (Google
// OAuth'da bu odatiy naqsh — foydalanuvchi bosishdan oldin frontend
// hisobning mavjud yo'qligini bilmaydi):
//   1) googleId bo'yicha topilsa       -> oddiy login
//   2) email bo'yicha topilsa (parol bilan ro'yxatdan o'tgan) -> shu Google
//      hisobi ULANADI (endi ikkala usul bilan ham kirish mumkin)
//   3) hech narsa topilmasa            -> yangi hisob yaratiladi, parolsiz
export const googleAuth = async (req, res, next) => {
    try {
        const { credential } = googleAuthSchema.parse(req.body);
        const payload = await verifyGoogleIdToken(credential);

        if (!payload.emailVerified) {
            return res.status(400).json({ message: "Google hisobingizning emaili tasdiqlanmagan" });
        }

        let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
        let isNewUser = false;

        if (!user) {
            const existingByEmail = await prisma.user.findUnique({ where: { email: payload.email } });

            if (existingByEmail) {
                user = await prisma.user.update({
                    where: { id: existingByEmail.id },
                    data: {
                        googleId: payload.sub,
                        avatarUrl: existingByEmail.avatarUrl || payload.picture,
                        // Google email'ni allaqachon tasdiqlagan
                        emailVerified: true,
                        emailVerifiedAt: existingByEmail.emailVerifiedAt || new Date(),
                        activities: { create: [{ title: "Google hisobi ulandi", color: "#E7A94C" }] },
                    },
                });
            } else {
                isNewUser = true;
                user = await prisma.user.create({
                    data: {
                        ism: payload.name,
                        email: payload.email,
                        passwordHash: null,
                        googleId: payload.sub,
                        avatarUrl: payload.picture,
                        emailVerified: true,
                        emailVerifiedAt: new Date(),
                        activities: { create: [{ title: "Google orqali ro'yxatdan o'tildi", color: "#E7A94C" }] },
                    },
                });
            }
        }

        const token = signToken({ sub: user.id });
        res.status(isNewUser ? 201 : 200).json({ token, user: publicUser(user), isNewUser });
    } catch (err) {
        if (err.code === "GOOGLE_NOT_CONFIGURED") {
            return res.status(503).json({ message: err.message });
        }
        next(err);
    }
};
