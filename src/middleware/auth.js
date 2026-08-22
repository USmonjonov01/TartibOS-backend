import { verifyToken } from "../lib/jwt.js";
import prisma from "../lib/prisma.js";

// Har bir himoyalangan route'da ishlatiladi. Token'dan foydalanuvchi ID'sini
// oladi va req.user'ga biriktiradi — shu orqali BARCHA keyingi so'rovlar
// FAQAT shu foydalanuvchiga tegishli ma'lumot bilan ishlaydi. Bu — mockapi.io
// arxitekturasidagi eng katta xavfsizlik kamchiligining yechimi: u yerda
// egalik filtri faqat frontendda edi, shuning uchun har qanday odam boshqa
// foydalanuvchining ma'lumotini network so'rovini o'zgartirib ko'rishi mumkin edi.
export const requireAuth = async (req, res, next) => {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;

        if (!token) {
            return res.status(401).json({ message: "Avtorizatsiya talab qilinadi" });
        }

        const payload = verifyToken(token);

        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
            return res.status(401).json({ message: "Foydalanuvchi topilmadi" });
        }

        req.user = { id: user.id, email: user.email, ism: user.ism };
        next();
    } catch {
        return res.status(401).json({ message: "Token yaroqsiz yoki muddati o'tgan" });
    }
};
