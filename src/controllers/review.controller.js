import prisma from "../lib/prisma.js";
import { createReviewSchema } from "../validators/review.validators.js";

export const listReviews = async (req, res, next) => {
    try {
        const reviews = await prisma.dailyReview.findMany({
            where: { userId: req.user.id },
            orderBy: { date: "desc" },
        });
        res.json({ reviews });
    } catch (err) {
        next(err);
    }
};

export const createReview = async (req, res, next) => {
    try {
        const data = createReviewSchema.parse(req.body);

        if (data.missionId) {
            const mission = await prisma.mission.findFirst({
                where: { id: data.missionId, userId: req.user.id },
            });
            if (!mission) {
                return res.status(404).json({ message: "Bog'langan missiya topilmadi" });
            }
        }

        // Bir kun (daily) yoki bir hafta (weekly) uchun faqat bitta yozuv
        // bo'lishi kerak — qayta saqlaganda yangisi qo'shilmaydi, borini
        // yangilaydi (frontenddagi "Reviewni saqlash" tugmasi shu xatti-
        // harakatni kutadi: qayta bosilsa dublikat yaratilmasin).
        const matchWhere =
            data.mode === "weekly"
                ? { userId: req.user.id, mode: "weekly", weekId: data.weekId }
                : { userId: req.user.id, mode: "daily", date: data.date };

        const existing = await prisma.dailyReview.findFirst({ where: matchWhere });

        const review = existing
            ? await prisma.dailyReview.update({ where: { id: existing.id }, data })
            : await prisma.dailyReview.create({ data: { ...data, userId: req.user.id } });

        res.status(existing ? 200 : 201).json({ review });
    } catch (err) {
        next(err);
    }
};
