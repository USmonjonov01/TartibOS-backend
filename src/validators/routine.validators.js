import { z } from "zod";

export const createRoutineSchema = z.object({
    title: z.string().trim().min(1, "Sarlavha kiritilishi shart").max(200),
    start: z.string().trim().min(1),
    end: z.string().trim().min(1),
    category: z.string().trim().max(80).optional().nullable(),
    priority: z.enum(["yuqori", "ortacha", "past"]).optional().nullable(),
    color: z.string().trim().max(20).optional().nullable(),
    icon: z.string().trim().max(20).optional().nullable(),
    days: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).optional(),
    dayPlans: z.record(z.string(), z.string()).optional().nullable(),
    defaultMissions: z.record(z.string(), z.any()).optional().nullable(),
    groupId: z.string().trim().max(80).optional().nullable(),
    active: z.boolean().optional(),
    effectiveFromWeek: z.string().trim().max(20).optional().nullable(),
});

export const updateRoutineSchema = createRoutineSchema.partial().extend({
    retired: z.boolean().optional(),
});
