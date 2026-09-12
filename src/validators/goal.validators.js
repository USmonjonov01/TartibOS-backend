import { z } from "zod";

export const createGoalSchema = z.object({
    title: z.string().trim().min(2, "Maqsad nomi kamida 2 ta belgidan iborat bo'lishi kerak").max(150),
    // Andozadan boshlash uchun (masalan "frontend-to-fullstack"). Bo'sh
    // qoldirilsa, bosqichsiz Goal yaratiladi — foydalanuvchi o'zi qo'shadi.
    templateKey: z.string().trim().max(80).optional().nullable(),
    // AI generatsiya qilib bergan (yoki foydalanuvchi tahrirlagan) bosqichlar.
    // Berilsa, templateKey'dan ustun turadi.
    steps: z
        .array(
            z.object({
                title: z.string().trim().min(2).max(200),
                stageLabel: z.string().trim().max(80).optional().nullable(),
            })
        )
        .max(12)
        .optional(),
});

export const generateStepsSchema = z.object({
    title: z.string().trim().min(2, "Maqsad nomi kamida 2 ta belgidan iborat bo'lishi kerak").max(150),
});

export const updateGoalSchema = z.object({
    title: z.string().trim().min(2).max(150).optional(),
    status: z.enum(["active", "completed", "archived"]).optional(),
    order: z.number().int().min(0).optional(),
});

export const createStepSchema = z.object({
    title: z.string().trim().min(2, "Bosqich nomi kamida 2 ta belgidan iborat bo'lishi kerak").max(200),
    stageLabel: z.string().trim().max(80).optional().nullable(),
    order: z.number().int().min(0).optional(),
});

export const updateStepSchema = z.object({
    title: z.string().trim().min(2).max(200).optional(),
    stageLabel: z.string().trim().max(80).optional().nullable(),
    order: z.number().int().min(0).optional(),
});
