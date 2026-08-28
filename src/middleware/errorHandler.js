import env from "../config/env.js";

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    console.error("[error]", err);

    if (err.name === "ZodError") {
        return res.status(400).json({
            message: "Kiritilgan ma'lumotlar noto'g'ri",
            issues: err.issues?.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
    }

    if (err.code === "P2002") {
        // Prisma unique constraint violation
        return res.status(409).json({ message: "Bu ma'lumot allaqachon mavjud" });
    }

    if (err.code === "P2025") {
        // Prisma record not found
        return res.status(404).json({ message: "Yozuv topilmadi" });
    }

    const status = err.status || 500;

    // Kutilmagan (500) xatolarda haqiqiy err.message'ni productionda mijozga
    // qaytarmaymiz — bu DB ulanish satri, fayl yo'li yoki boshqa ichki
    // tafsilotlarni oshkor qilib qo'yishi mumkin edi (masalan Prisma'ning
    // "Can't reach database server at ..." kabi xabarlari). Loglarga esa
    // to'liq xato baribir yoziladi (yuqoridagi console.error), shuning uchun
    // debugging imkoniyati yo'qolmaydi. 4xx xatolarda (bizning o'zimiz
    // res.status(4xx).json(...) bilan qaytargan hollarda) xabar baribir
    // aniq va foydalanuvchiga tushunarli bo'lgani uchun o'zgarishsiz qoladi.
    const message =
        status >= 500 && env.nodeEnv === "production"
            ? "Serverda kutilmagan xatolik yuz berdi"
            : err.message || "Serverda kutilmagan xatolik yuz berdi";

    res.status(status).json({ message });
};

export const notFoundHandler = (req, res) => {
    res.status(404).json({ message: `Route topilmadi: ${req.method} ${req.originalUrl}` });
};