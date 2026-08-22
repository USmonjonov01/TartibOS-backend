import prisma from "../lib/prisma.js";
import { createRoutineSchema, updateRoutineSchema } from "../validators/routine.validators.js";

export const listRoutines = async (req, res, next) => {
    try {
        const routines = await prisma.routine.findMany({
            where: { userId: req.user.id },
            orderBy: { start: "asc" },
        });
        res.json({ routines });
    } catch (err) {
        next(err);
    }
};

export const createRoutine = async (req, res, next) => {
    try {
        const data = createRoutineSchema.parse(req.body);
        const routine = await prisma.routine.create({
            data: { ...data, userId: req.user.id },
        });
        res.status(201).json({ routine });
    } catch (err) {
        next(err);
    }
};

// Frontend'dagi "versiyalash" mantig'i: eski yozuv o'chirilmaydi, retired=true
// qilinadi va yangi versiya alohida yozuv sifatida yaratiladi — tarix saqlanadi.
export const updateRoutine = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateRoutineSchema.parse(req.body);

        const existing = await prisma.routine.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Odat topilmadi" });
        }

        if (data.retired === true && Object.keys(data).length === 1) {
            // Faqat retire qilish so'ralgan — yangi versiya yaratilmaydi
            const retired = await prisma.routine.update({
                where: { id },
                data: { retired: true, active: false },
            });
            return res.json({ routine: retired });
        }

        const [, newVersion] = await prisma.$transaction([
            prisma.routine.update({
                where: { id },
                data: { retired: true, active: false },
            }),
            prisma.routine.create({
                data: {
                    ...existing,
                    ...data,
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                    retired: false,
                    active: data.active ?? true,
                    versions: existing.versions + 1,
                    userId: req.user.id,
                },
            }),
        ]);

        res.json({ routine: newVersion });
    } catch (err) {
        next(err);
    }
};

export const deleteRoutine = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.routine.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Odat topilmadi" });
        }
        await prisma.routine.delete({ where: { id } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
};
