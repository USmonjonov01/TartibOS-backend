import { PrismaClient } from "@prisma/client";
import env from "../config/env.js";

// Dev rejimida hot-reload paytida ko'p PrismaClient nusxasi yaratilib
// ketmasligi uchun global obyektga keshlanadi.
const globalForPrisma = globalThis;

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
    });

if (env.nodeEnv !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
