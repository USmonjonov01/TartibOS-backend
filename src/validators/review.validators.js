import { z } from "zod";

// Ball maydonlari 1 dan 5 gacha (frontenddagi ScoreField komponenti bilan mos).
// Frontend "hali belgilanmagan" holatini 0 sifatida yuboradi — buni backend
// null'ga aylantiradi, shunda bazada chalg'ituvchi "0 ball" saqlanmaydi.
const scoreField = z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .nullable()
    .transform((v) => (v === 0 ? null : v));

export const createReviewSchema = z
    .object({
        mode: z.enum(["daily", "weekly"]).default("daily"),
        date: z.string().trim().min(1, "Sana kiritilishi shart"),
        weekId: z
            .string()
            .trim()
            .regex(/^\d{4}-W\d{2}$/, "weekId formati noto'g'ri (masalan 2026-W33)")
            .optional()
            .nullable(),
        achievement: z.string().trim().max(2000).optional().nullable(),
        mistake: z.string().trim().max(2000).optional().nullable(),
        summary: z.string().trim().max(2000).optional().nullable(),
        nextFocus: z.string().trim().max(2000).optional().nullable(),
        reflection: z.string().trim().max(2000).optional().nullable(),
        discipline: scoreField,
        execution: scoreField,
        missionRate: scoreField,
        habitConsistency: scoreField,
        missionId: z.string().trim().optional().nullable(),
    })
    .refine((val) => val.mode !== "weekly" || !!val.weekId, {
        message: "Haftalik review uchun weekId kiritilishi shart",
        path: ["weekId"],
    });
