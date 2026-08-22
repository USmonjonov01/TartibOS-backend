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

        const review = await prisma.dailyReview.create({
            data: { ...data, userId: req.user.id },
        });
        res.status(201).json({ review });
    } catch (err) {
        next(err);
    }
};
