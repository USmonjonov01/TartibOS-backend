# TartibOS API

TartibOS uchun real backend — Express + Prisma + PostgreSQL. mockapi.io'ning
o'rnini bosadi: real parol xavfsizligi (bcrypt), JWT autentifikatsiya, va
eng muhimi — **ma'lumotlar egaligi endi serverda tekshiriladi** (frontendda
emas, shuning uchun boshqa foydalanuvchi ma'lumotingizni ko'ra olmaydi).

## 1. O'rnatish

```bash
cd tartibos-api
npm install
```

## 2. Ma'lumotlar bazasi (Neon)

1. https://neon.tech saytida bepul hisob oching
2. Yangi loyiha yarating (masalan "tartibos")
3. Dashboard'da "Connection string" ni nusxalang (`postgresql://...` bilan boshlanadi)

## 3. Environment sozlash

```bash
cp .env.example .env
```

`.env` faylini oching va to'ldiring:
- `DATABASE_URL` — Neon'dan olgan connection string
- `JWT_SECRET` — quyidagi buyruq bilan generatsiya qiling:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

## 4. Sxemani bazaga qo'llash

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Bu jarayon internetdan Prisma'ning "engine" fayllarini yuklab oladi — shu
sabab men buni sizning uchun bu yerda ishga tushira olmadim (bu muhitda
tarmoq cheklangan). Bu buyruqlar sizning kompyuteringizda muammosiz ishlaydi.

## 5. Ishga tushirish

```bash
npm run dev
```

Server `http://localhost:4000` da ishga tushadi. Tekshirish:
```bash
curl http://localhost:4000/health
```

## 6. mockapi.io'dan ma'lumotlarni ko'chirish

`.env` faylida `MOCKAPI_*` manzillari to'ldirilganidan keyin:

```bash
npm run migrate:mockapi
```

**MUHIM:** mockapi.io'dagi parollar oddiy matn (plaintext) holida saqlangan
edi. Xavfsizlik nuqtai nazaridan ularni qayta ishlatib bo'lmaydi — shuning
uchun skript har bir foydalanuvchiga **tasodifiy vaqtinchalik parol**
biriktiradi. Migratsiyadan keyin **hech kim eski paroli bilan kira olmaydi** —
"parolni tiklash" funksiyasi orqali yangi parol o'rnatish kerak bo'ladi
(bu funksiya hali frontendda yo'q — keyingi bosqichda qo'shamiz, xohlasangiz).

## 7. Frontendni yangi backendga ulash

`TartibOS` frontend loyihasida `src/axios/index.jsx` faylida barcha
`baseURL`larni yangi backend manziliga almashtiring:

```js
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL, // masalan https://tartibos-api.onrender.com/api
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;
```

Va endpoint yo'llari o'zgaradi:
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/me`
- `GET/POST/PUT/DELETE /api/routines`
- `GET /api/weeks`, `PUT /api/weeks/day`
- `GET/POST/PUT/DELETE /api/missions`
- `GET/POST /api/reviews`

Bu qadam — **keyingi bosqich**, hozircha faqat backend tayyor. Frontendni
ulashni xohlasangiz, alohida so'rang, men `UserContext`, `RoutineContext`,
`WeeksContext`larni yangi API'ga moslab qayta yozib beraman.

## 8. Deploy qilish (Render)

1. Bu loyihani GitHub'ga push qiling (alohida repo yoki frontend bilan bir repo, `tartibos-api/` papkasida)
2. https://render.com'da "New Web Service" yarating, repo'ni bog'lang
3. Sozlamalar:
   - **Root Directory**: `tartibos-api` (agar bitta repo bo'lsa)
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npx prisma migrate deploy && npm start`
4. Environment Variables bo'limida `.env`dagi barcha o'zgaruvchilarni qo'shing.
   `CORS_ORIGIN`ga vergul bilan ajratib bir nechta manzil yozish mumkin —
   masalan: `http://localhost:5173,https://tartib-os.vercel.app`
   (lokal frontend va Vercel'dagi frontend bir vaqtda ishlashi uchun).
5. Render/Railway kabi platformalar reverse-proksi orqasida ishlagani uchun
   `app.js`da `app.set("trust proxy", 1)` allaqachon o'rnatilgan — bu qadam
   qo'shimcha sozlash talab qilmaydi, faqat shuni bilib qo'ying: agar boshqa
   platformaga (masalan ikkita proksi qatlami bo'lgan joyga) deploy qilsangiz,
   bu qiymatni moslashtirish kerak bo'lishi mumkin.

## Xavfsizlik haqida qisqacha

- Parollar **bcrypt** bilan hash'lanadi (12 rounds) — hech qachon ochiq saqlanmaydi
- Har bir himoyalangan route **JWT token** talab qiladi (`requireAuth` middleware)
- Har bir so'rov **faqat token egasining ma'lumotlariga** kirish huquqiga ega —
  bu server darajasida majburiy, frontend buni chetlab o'tolmaydi
- `helmet` — umumiy HTTP xavfsizlik sarlavhalari
- `express-rate-limit` — brute-force hujumlarga qarshi (auth route'larida qattiqroq)
- Barcha kiritilgan ma'lumotlar `zod` orqali tekshiriladi, noto'g'ri format serverga yetib bormaydi

## Nima hali yo'q (keyingi bosqichlar uchun)

- Parolni tiklash (forgot password) oqimi
- Refresh token / logout-all-devices
- Email tasdiqlash
- Fayl yuklash (agar profil rasmi kerak bo'lsa)
