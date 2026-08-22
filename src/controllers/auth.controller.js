import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { registerSchema, loginSchema, updateMeSchema } from "../validators/auth.validators.js";

const publicUser = (user) => ({
    id: user.id,
    ism: user.ism,
    email: user.email,
    number: user.number,
    address: user.address,
    createdAt: user.createdAt,
});

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
        }

        if (parol) {
            const valid = await bcrypt.compare(currentParol, user.passwordHash);
            if (!valid) {
                return res.status(401).json({ message: "Joriy parol noto'g'ri" });
            }
            updateData.passwordHash = await bcrypt.hash(parol, 12);
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

        res.json({ user: publicUser(updated) });
    } catch (err) {
        next(err);
    }
};
