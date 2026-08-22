import prisma from "../lib/prisma.js";
import { createMissionSchema, updateMissionSchema } from "../validators/mission.validators.js";

export const listMissions = async (req, res, next) => {
    try {
        const missions = await prisma.mission.findMany({
            where: { userId: req.user.id },
            orderBy: [{ date: "desc" }, { start: "asc" }],
        });
        res.json({ missions });
    } catch (err) {
        next(err);
    }
};

export const createMission = async (req, res, next) => {
    try {
        const data = createMissionSchema.parse(req.body);
        const mission = await prisma.mission.create({
            data: { ...data, userId: req.user.id },
        });
        res.status(201).json({ mission });
    } catch (err) {
        next(err);
    }
};

export const updateMission = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateMissionSchema.parse(req.body);

        const existing = await prisma.mission.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Missiya topilmadi" });
        }

        const mission = await prisma.mission.update({ where: { id }, data });
        res.json({ mission });
    } catch (err) {
        next(err);
    }
};

export const deleteMission = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.mission.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Missiya topilmadi" });
        }
        await prisma.mission.delete({ where: { id } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
};
