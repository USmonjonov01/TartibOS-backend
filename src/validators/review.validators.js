import { z } from "zod";

export const createReviewSchema = z.object({
    date: z.string().trim().min(1, "Sana kiritilishi shart"),
    win: z.string().trim().max(2000).optional().nullable(),
    mistake: z.string().trim().max(2000).optional().nullable(),
    summary: z.string().trim().max(2000).optional().nullable(),
    tomorrow: z.string().trim().max(2000).optional().nullable(),
    missionId: z.string().trim().optional().nullable(),
});
