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
export const updateMeSchema = z.object({
    ism: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak").max(120).optional(),
    email: z.string().trim().toLowerCase().email("Email noto'g'ri formatda").optional(),
    number: z.string().trim().max(40).optional().nullable(),
    address: z.string().trim().max(200).optional().nullable(),
    // currentParol shu yerda MAJBURIY qilinmaydi — chunki Google orqali
    // yaratilgan, hali parolsiz hisob birinchi marta parol o'rnatayotganda
    // "joriy parol"ning o'zi yo'q. Bu holatni controller (updateMe) alohida
    // tekshiradi: parol mavjud bo'lgan hisoblar uchun currentParol'ni hali
    // ham talab qiladi, parolsiz hisoblar uchun talab qilmaydi.
    currentParol: z.string().min(1).optional(),
    parol: z.string().min(8, "Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak").max(200).optional(),
});

// Parolni tiklash oqimi — 2 bosqich: avval email (havola so'raladi), keyin
// email'dagi token + yangi parol.
export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Email noto'g'ri formatda"),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(10, "Token yaroqsiz"),
    parol: z.string().min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak").max(200),
});

export const verifyEmailSchema = z.object({
    token: z.string().min(10, "Token yaroqsiz"),
});

// "credential" — Google Identity Services tugmasi qaytaradigan imzolangan
// JWT (ID token). Frontend uni o'zgartirmasdan shu ko'rinishda yuboradi.
export const googleAuthSchema = z.object({
    credential: z.string().min(10, "Google tokeni yaroqsiz"),
});
