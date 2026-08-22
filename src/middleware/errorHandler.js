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
    res.status(status).json({ message: err.message || "Serverda kutilmagan xatolik yuz berdi" });
};

export const notFoundHandler = (req, res) => {
    res.status(404).json({ message: `Route topilmadi: ${req.method} ${req.originalUrl}` });
};
