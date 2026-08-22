import { z } from "zod";

export const createMissionSchema = z.object({
    title: z.string().trim().min(1, "Sarlavha kiritilishi shart").max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    date: z.string().trim().min(1, "Sana kiritilishi shart"),
    start: z.string().trim().max(10).optional().nullable(),
    end: z.string().trim().max(10).optional().nullable(),
    priority: z.enum(["yuqori", "ortacha", "past"]).optional().nullable(),
    difficulty: z.number().int().min(1).max(5).optional().nullable(),
    estimateMin: z.number().int().min(0).max(1440).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    scope: z.enum(["bugun", "kelgusi", "haftalik"]).optional().nullable(),
    habitGroupId: z.string().trim().max(80).optional().nullable(),
});

export const updateMissionSchema = createMissionSchema.partial().extend({
    completed: z.boolean().optional(),
    cancelled: z.boolean().optional(),
    reason: z.string().trim().max(1000).optional().nullable(),
    score: z.number().int().min(0).max(10).optional().nullable(),
});
