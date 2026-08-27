import { z } from "zod";

const dayKeySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

// Dashboard/History sahifasi bitta kunni tasdiqlaganda shu payload'ni yuboradi
export const upsertDaySchema = z.object({
    weekId: z.string().regex(/^\d{4}-W\d{2}$/, "weekId formati noto'g'ri (masalan 2026-W33)"),
    dayKey: dayKeySchema,
    habitIds: z.array(z.string()).default([]),
    // Frontend "reasons" kabi butun haftalik scores obyektini yuboradi:
    // { mon: { habitKey1: 8 }, tue: { habitKey2: 10 }, ... }
    scores: z.record(dayKeySchema, z.record(z.string(), z.number().int().min(1).max(10))).optional(),
    reasons: z.record(z.string(), z.any()).optional(),
    totalHabits: z.number().int().min(0).default(0),
});