import { z } from "zod";

export const registerSchema = z.object({
    ism: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak").max(120),
    email: z.string().trim().toLowerCase().email("Email noto'g'ri formatda"),
    parol: z.string().min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak").max(200),
    number: z.string().trim().max(40).optional().nullable(),
    address: z.string().trim().max(200).optional().nullable(),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Email noto'g'ri formatda"),
    parol: z.string().min(1, "Parol kiritilishi shart"),
});

// Profil (ism/email) va parolni yangilash uchun. Parolni o'zgartirish faqat
// currentParol + parol ikkalasi ham berilganda amalga oshiriladi — shu orqali
// hisobga kirib olgan kishi boshqa birovning sessiyasidan foydalanib parolni
// almashtira olmaydi (joriy parolni bilishi shart).
export const updateMeSchema = z
    .object({
        ism: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak").max(120).optional(),
        email: z.string().trim().toLowerCase().email("Email noto'g'ri formatda").optional(),
        number: z.string().trim().max(40).optional().nullable(),
        address: z.string().trim().max(200).optional().nullable(),
        currentParol: z.string().min(1).optional(),
        parol: z.string().min(8, "Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak").max(200).optional(),
    })
    .refine((data) => !data.parol || !!data.currentParol, {
        message: "Parolni o'zgartirish uchun joriy parolni kiriting",
        path: ["currentParol"],
    });
