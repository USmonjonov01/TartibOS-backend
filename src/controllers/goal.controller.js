import prisma from "../lib/prisma.js";
import { roadmapTemplates, findTemplate } from "../data/roadmapTemplates.js";
import { generateRoadmapSteps } from "../lib/aiRoadmap.js";
import { generateRoutinePlan } from "../lib/aiRoutine.js";
import {
    createGoalSchema,
    updateGoalSchema,
    createStepSchema,
    updateStepSchema,
    generateStepsSchema,
    generateRoutineSchema,
} from "../validators/goal.validators.js";

// Frontend'dagi Goal yaratish formasi shu ro'yxatdan andoza tanlash imkonini
// beradi. Andoza tanlanmasa, bo'sh Goal yaratiladi.
export const listTemplates = async (_req, res) => {
    res.json({
        templates: roadmapTemplates.map((t) => ({
            key: t.key,
            title: t.title,
            stepCount: t.steps.length,
        })),
    });
};

export const listGoals = async (req, res, next) => {
    try {
        const goals = await prisma.goal.findMany({
            where: { userId: req.user.id },
            orderBy: { order: "asc" },
            include: { steps: { orderBy: { order: "asc" } } },
        });
        res.json({ goals });
    } catch (err) {
        next(err);
    }
};

// Foydalanuvchi maqsad nomini yozgandan keyin, buni chaqirib, AI'dan shu
// maqsadga mos bosqichlar ro'yxatini so'raydi. Hech narsa saqlanmaydi —
// faqat ko'rib chiqish (preview) uchun qaytariladi, foydalanuvchi tahrirlab
// yoki o'chirib, keyin createGoal orqali haqiqiy Goal yaratadi.
export const generateSteps = async (req, res, next) => {
    try {
        const { title, description } = generateStepsSchema.parse(req.body);
        // VAQTINCHALIK DIAGNOSTIKA LOGI — description backendga to'g'ri
        // yetib kelayotganini tasdiqlash uchun. Muammo hal bo'lgach, bu
        // qatorni olib tashlashingiz mumkin.
        console.log(
            `[goals/generate] title="${title}" description=${description ? `"${description.slice(0, 80)}..."` : "(bo'sh — yuborilmagan)"}`
        );
        const steps = await generateRoadmapSteps(title, { description });
        if (steps.length === 0) {
            console.error("[goals/generate] AI bo'sh javob qaytardi, title:", title);
            return res.status(502).json({ message: "AI bosqich taklif qila olmadi. Qo'lda qo'shing." });
        }
        res.json({ steps });
    } catch (err) {
        if (err.code === "AI_NOT_CONFIGURED") {
            console.error("[goals/generate] AI sozlanmagan:", err.message);
            return res.status(503).json({ message: "AI xizmati hozircha sozlanmagan. Qo'lda qo'shing." });
        }
        if (err.code === "AI_REQUEST_FAILED" || err.code === "AI_PARSE_FAILED") {
            console.error(`[goals/generate] ${err.code}:`, err.message);
            return res.status(502).json({ message: "AI xizmatida xatolik yuz berdi. Qayta urinib ko'ring." });
        }
        next(err);
    }
};

// Maqsadga mos kun tartibini (Routine yozuvlarini) AI orqali tuzadi va SAQLAYDI.
// Yo'l xaritasidan farqli, bu yerda "ko'rib chiqish" bosqichi yo'q: foydalanuvchi
// frontendda "ha, tuzib bering" deb tasdiqlagan, keyin odatlarni Routine
// sahifasida o'zi tahrirlaydi/o'chiradi. Yaratilgan odatlar groupId =
// "goal:<goalId>" bilan belgilanadi — shu orqali ikki marta yaratilishi oldi olinadi.
export const generateRoutine = async (req, res, next) => {
    try {
        const { goalId } = req.params;
        const { dailyHours } = generateRoutineSchema.parse(req.body ?? {});

        const goal = await prisma.goal.findFirst({
            where: { id: goalId, userId: req.user.id },
            include: { steps: { orderBy: { order: "asc" } } },
        });
        if (!goal) return res.status(404).json({ message: "Maqsad topilmadi" });

        const groupId = `goal:${goal.id}`;
        const alreadyCreated = await prisma.routine.count({
            where: { userId: req.user.id, groupId, retired: false },
        });
        if (alreadyCreated > 0) {
            return res.status(409).json({
                message: "Bu maqsad uchun kun tartibi allaqachon yaratilgan. Uni \"Kun tartibim\" sahifasida tahrirlashingiz mumkin.",
            });
        }

        const existingRoutines = await prisma.routine.findMany({
            where: { userId: req.user.id, retired: false, active: true },
            select: { title: true, start: true, end: true, days: true },
        });

        const plan = await generateRoutinePlan({ goal, existingRoutines, dailyHours });

        const routines = await prisma.$transaction(
            plan.map((r) => prisma.routine.create({ data: { ...r, groupId, userId: req.user.id } }))
        );

        res.status(201).json({ routines });
    } catch (err) {
        if (err.code === "AI_NOT_CONFIGURED") {
            console.error("[goals/routine] AI sozlanmagan:", err.message);
            return res.status(503).json({ message: "AI xizmati hozircha sozlanmagan. Kun tartibini qo'lda qo'shing." });
        }
        if (err.code === "AI_REQUEST_FAILED" || err.code === "AI_PARSE_FAILED") {
            console.error(`[goals/routine] ${err.code}:`, err.message);
            return res.status(502).json({ message: "AI kun tartibini tuza olmadi. Qayta urinib ko'ring." });
        }
        next(err);
    }
};

export const createGoal = async (req, res, next) => {
    try {
        const data = createGoalSchema.parse(req.body);
        const template = data.templateKey ? findTemplate(data.templateKey) : null;

        // Ustunlik tartibi: foydalanuvchi tahrirlagan/tasdiqlagan AI bosqichlari
        // (data.steps) > statik andoza (template) > bosqichsiz (bo'sh Goal).
        const stepsToCreate = data.steps?.length
            ? data.steps
            : template
              ? template.steps
              : null;

        const lastGoal = await prisma.goal.findFirst({
            where: { userId: req.user.id },
            orderBy: { order: "desc" },
        });
        const nextOrder = (lastGoal?.order ?? -1) + 1;

        const goal = await prisma.goal.create({
            data: {
                title: data.title,
                description: data.description || null,
                templateKey: data.steps?.length ? null : (template?.key ?? null),
                order: nextOrder,
                userId: req.user.id,
                steps: stepsToCreate
                    ? {
                          create: stepsToCreate.map((s, i) => ({
                              title: s.title,
                              stageLabel: s.stageLabel,
                              order: i,
                          })),
                      }
                    : undefined,
            },
            include: { steps: { orderBy: { order: "asc" } } },
        });

        res.status(201).json({ goal });
    } catch (err) {
        next(err);
    }
};

export const updateGoal = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateGoalSchema.parse(req.body);

        const existing = await prisma.goal.findFirst({ where: { id, userId: req.user.id } });
        if (!existing) return res.status(404).json({ message: "Maqsad topilmadi" });

        const goal = await prisma.goal.update({
            where: { id },
            data,
            include: { steps: { orderBy: { order: "asc" } } },
        });
        res.json({ goal });
    } catch (err) {
        next(err);
    }
};

export const deleteGoal = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.goal.findFirst({ where: { id, userId: req.user.id } });
        if (!existing) return res.status(404).json({ message: "Maqsad topilmadi" });

        await prisma.goal.delete({ where: { id } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
};

export const createStep = async (req, res, next) => {
    try {
        const { goalId } = req.params;
        const data = createStepSchema.parse(req.body);

        const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: req.user.id } });
        if (!goal) return res.status(404).json({ message: "Maqsad topilmadi" });

        const lastStep = await prisma.roadmapStep.findFirst({
            where: { goalId },
            orderBy: { order: "desc" },
        });
        const nextOrder = data.order ?? (lastStep?.order ?? -1) + 1;

        const step = await prisma.roadmapStep.create({
            data: {
                title: data.title,
                stageLabel: data.stageLabel,
                order: nextOrder,
                goalId,
            },
        });
        res.status(201).json({ step });
    } catch (err) {
        next(err);
    }
};

export const updateStep = async (req, res, next) => {
    try {
        const { goalId, stepId } = req.params;
        const data = updateStepSchema.parse(req.body);

        const step = await prisma.roadmapStep.findFirst({
            where: { id: stepId, goalId, goal: { userId: req.user.id } },
        });
        if (!step) return res.status(404).json({ message: "Bosqich topilmadi" });

        const updated = await prisma.roadmapStep.update({ where: { id: stepId }, data });
        res.json({ step: updated });
    } catch (err) {
        next(err);
    }
};

export const deleteStep = async (req, res, next) => {
    try {
        const { goalId, stepId } = req.params;
        const step = await prisma.roadmapStep.findFirst({
            where: { id: stepId, goalId, goal: { userId: req.user.id } },
        });
        if (!step) return res.status(404).json({ message: "Bosqich topilmadi" });

        await prisma.roadmapStep.delete({ where: { id: stepId } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
};

// Bosqichni bajarilgan/bajarilmagan deb belgilaydi.
//
// MUHIM: bu yerda endi global user.level'ga TEGILMAYDI. Avvalgi versiyada
// har qanday Goal'dagi bosqich global Level'ni oshirar edi — bu bir nechta
// Goal bo'lsa, ularning darajalari bir-birini "bosib" ketishiga sabab
// bo'lgan jiddiy xato edi. Endi Level — Goal'ning o'zi ichida hisoblanadigan
// narsa (1 + shu Goal'dagi bajarilgan bosqichlar soni), frontend buni
// goal.steps'dan to'g'ridan-to'g'ri hisoblaydi, backend hech narsa
// saqlamaydi. Shu sabab bu yerda faqat step yangilanadi, level haqida
// hech narsa qaytarilmaydi.
export const toggleStep = async (req, res, next) => {
    try {
        const { goalId, stepId } = req.params;
        const step = await prisma.roadmapStep.findFirst({
            where: { id: stepId, goalId, goal: { userId: req.user.id } },
        });
        if (!step) return res.status(404).json({ message: "Bosqich topilmadi" });

        const willComplete = !step.completed;

        if (willComplete) {
            // Ketma-ketlikni buzmaslik uchun: bu bosqichdan oldingi (order kichikroq)
            // barcha bosqichlar avval bajarilgan bo'lishi kerak. Aks holda
            // foydalanuvchi to'g'ridan-to'g'ri eng oxirgi bosqichga "sakrab" o'tib,
            // o'zini haqiqatda bajarmagan ishni bajardim deb noto'g'ri baholashi
            // mumkin — bu ham UX, ham motivatsiya nuqtai nazaridan zararli.
            const earliestIncomplete = await prisma.roadmapStep.findFirst({
                where: { goalId, order: { lt: step.order }, completed: false },
                orderBy: { order: "asc" },
            });
            if (earliestIncomplete) {
                return res.status(409).json({
                    message: `Avval "${earliestIncomplete.title}" bosqichini bajarish kerak — bosqichlar ketma-ket bajariladi.`,
                    code: "STEP_OUT_OF_ORDER",
                    requiredStepId: earliestIncomplete.id,
                });
            }

            const updatedStep = await prisma.roadmapStep.update({
                where: { id: stepId },
                data: { completed: true, completedAt: new Date() },
            });
            return res.json({ step: updatedStep, leveledUp: true });
        }

        // Bosqichni "bajarilmagan"ga qaytarayapmiz. Ketma-ketlikni saqlash
        // uchun bundan KEYINGI (order kattaroq) barcha bajarilgan bosqichlar
        // ham avtomatik bajarilmagan holatga qaytariladi — aks holda masalan
        // 8-bosqich bajarilgan holda qolib, 5-bosqich bajarilmagan bo'lib
        // qolishi mumkin edi, bu ham xuddi shu "tartibsizlik" bug'i.
        const [updatedStep] = await prisma.$transaction([
            prisma.roadmapStep.update({
                where: { id: stepId },
                data: { completed: false, completedAt: null },
            }),
            prisma.roadmapStep.updateMany({
                where: { goalId, order: { gt: step.order }, completed: true },
                data: { completed: false, completedAt: null },
            }),
        ]);

        res.json({ step: updatedStep, leveledUp: false });
    } catch (err) {
        next(err);
    }
};