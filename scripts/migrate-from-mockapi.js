// Bir martalik migratsiya: mockapi.io'dagi barcha ma'lumotlarni yangi
// Postgres backendga ko'chiradi. Ishlatish: npm run migrate:mockapi
//
// MUHIM: bu skript DATABASE_URL va MOCKAPI_* manzillarini .env'dan o'qiydi.
// Ishga tushirishdan oldin `npx prisma migrate deploy` bilan sxema
// bazada yaratilgan bo'lishi shart.

import "dotenv/config";
import axios from "axios";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

const AUTH_URL = process.env.MOCKAPI_AUTH_URL;
const ROUTINE_URL = process.env.MOCKAPI_ROUTINE_URL;
const MISSIONS_URL = process.env.MOCKAPI_MISSIONS_URL;

// mockapi'da userId maydoni yo'q eski yozuvlar shu foydalanuvchiga (birinchi
// ro'yxatdan o'tgan) tegishli deb hisoblanadi — frontenddagi ownership.js
// bilan bir xil qoida.
const LEGACY_OWNER_MOCKAPI_ID = "1";

// Migratsiyadan keyin eski parol bilan kirib bo'lmaydi (parollar qayta
// hash'lanadi, plaintext saqlanmaydi). Foydalanuvchi birinchi kirishda shu
// vaqtinchalik parolni "parolni tiklash" orqali almashtirishi kerak bo'ladi —
// bu haqda unga alohida xabar berish tavsiya etiladi.
const TEMP_PASSWORD_NOTE =
    "Migratsiyadan so'ng eski parolingiz endi ishlamaydi (xavfsizlik uchun qayta hash'lanmaydi, chunki asl parol saqlanmagan edi). Iltimos parolni tiklash orqali yangi parol o'rnating.";

async function migrateUsers() {
    console.log("[migrate] Foydalanuvchilar ko'chirilmoqda...");
    const { data: mockUsers } = await axios.get(`${AUTH_URL}/register`);

    const idMap = new Map(); // eski mockapi id -> yangi Postgres uuid

    for (const mu of mockUsers) {
        const email = (mu.email || "").trim().toLowerCase();
        if (!email) {
            console.warn(`[migrate] email'siz foydalanuvchi o'tkazib yuborildi: id=${mu.id}`);
            continue;
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            idMap.set(mu.id, existing.id);
            console.log(`[migrate] allaqachon mavjud, o'tkazib yuborildi: ${email}`);
            continue;
        }

        // Agar mockapi'da foydalanuvchining paroli bo'lsa, uni hash'lab saqlaymiz,
        // shunda foydalanuvchi o'z paroli bilan tizimga kirishda davom eta oladi.
        const userPassword = mu.parol || mu.password || `${crypto.randomUUID()}-Aa1!`;
        const passwordHash = await bcrypt.hash(userPassword, 12);

        const user = await prisma.user.create({
            data: {
                ism: mu.ism || "Foydalanuvchi",
                email,
                passwordHash,
                number: mu.number || null,
                address: mu.address || null,
                activities: {
                    create: (mu.activity || []).map((a) => ({
                        title: a.title,
                        color: a.color,
                        createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
                    })),
                },
            },
        });

        idMap.set(mu.id, user.id);
        console.log(`[migrate] yaratildi: ${email}`);
    }

    return idMap;
}

const resolveOwnerId = (item, idMap) => {
    const mockUserId = item.userId != null ? String(item.userId) : LEGACY_OWNER_MOCKAPI_ID;
    return idMap.get(mockUserId);
};

async function migrateRoutines(idMap) {
    console.log("[migrate] Routine yozuvlari ko'chirilmoqda...");
    const { data: items } = await axios.get(`${ROUTINE_URL}/routine`);

    let count = 0;
    for (const item of items) {
        const userId = resolveOwnerId(item, idMap);
        if (!userId) continue;

        await prisma.routine.create({
            data: {
                title: item.title,
                start: item.start,
                end: item.end,
                category: item.category || null,
                priority: item.priority || null,
                color: item.color || null,
                icon: item.icon || null,
                days: item.days || [],
                defaultMissions: item.defaultMissions || null,
                groupId: item.groupId || null,
                active: item.active !== false,
                retired: item.retired === true,
                effectiveFromWeek: item.effectiveFromWeek || null,
                createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
                userId,
            },
        });
        count++;
    }
    console.log(`[migrate] ${count} ta routine yozuvi ko'chirildi`);
}

async function migrateWeeks(idMap) {
    console.log("[migrate] Haftalik yozuvlar ko'chirilmoqda...");
    const { data: items } = await axios.get(`${ROUTINE_URL}/routine/1/weeks`);

    let count = 0;
    for (const item of items) {
        const userId = resolveOwnerId(item, idMap);
        if (!userId) continue;

        await prisma.week.upsert({
            where: { userId_weekId: { userId, weekId: item.weekId } },
            update: {},
            create: {
                userId,
                weekId: item.weekId,
                routineId: item.routineId || "1",
                statuses: item.statuses || {},
                executions: item.executions || {},
                completions: item.completions || {},
                reasons: item.reasons || {},
                conclusion: item.conclusion || "",
            },
        });
        count++;
    }
    console.log(`[migrate] ${count} ta haftalik yozuv ko'chirildi`);
}

async function migrateMissions(idMap) {
    console.log("[migrate] Missiyalar ko'chirilmoqda...");
    const { data: items } = await axios.get(`${MISSIONS_URL}/Mission`);

    let count = 0;
    for (const item of items) {
        if (item.__container) continue; // texnik placeholder yozuv, o'tkazib yuboriladi

        const userId = resolveOwnerId(item, idMap);
        if (!userId) continue;

        await prisma.mission.create({
            data: {
                title: item.title,
                description: item.description || null,
                date: item.date,
                start: item.start || null,
                end: item.end || null,
                priority: item.priority || null,
                difficulty: item.difficulty ?? null,
                estimateMin: item.estimateMin ?? null,
                notes: item.notes || null,
                scope: item.scope || null,
                habitGroupId: item.habitGroupId || null,
                completed: item.completed === true,
                cancelled: item.cancelled === true,
                reason: item.reason || null,
                score: item.score ?? null,
                userId,
            },
        });
        count++;
    }
    console.log(`[migrate] ${count} ta missiya ko'chirildi`);
}

async function migrateReviews(idMap) {
    console.log("[migrate] Kunlik sharhlar ko'chirilmoqda...");
    try {
        const { data: items } = await axios.get(`${MISSIONS_URL}/Dailyreview`);
        let count = 0;
        for (const item of items) {
            const userId = resolveOwnerId(item, idMap);
            if (!userId) continue;

            await prisma.dailyReview.create({
                data: {
                    date: item.date || new Date().toISOString().split("T")[0],
                    win: item.win || item.achievement || null,
                    mistake: item.mistake || null,
                    summary: item.summary || null,
                    tomorrow: item.tomorrow || item.nextFocus || null,
                    userId,
                },
            });
            count++;
        }
        console.log(`[migrate] ${count} ta sharh ko'chirildi`);
    } catch (err) {
        console.warn("[migrate] Kunlik sharhlarni ko'chirishda ogohlantirish:", err.message);
    }
}

async function main() {
    if (!AUTH_URL || !ROUTINE_URL || !MISSIONS_URL) {
        console.error("[migrate] MOCKAPI_* environment o'zgaruvchilari .env'da to'liq emas");
        process.exit(1);
    }

    const idMap = await migrateUsers();
    await migrateRoutines(idMap);
    await migrateWeeks(idMap);
    await migrateMissions(idMap);
    await migrateReviews(idMap);

    console.log("\n[migrate] Barcha ma'lumotlar muvaffaqiyatli ko'chirildi.");
    console.log(`\n[migrate] MUHIM: ${TEMP_PASSWORD_NOTE}`);
    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error("[migrate] Xatolik:", err);
    await prisma.$disconnect();
    process.exit(1);
});
