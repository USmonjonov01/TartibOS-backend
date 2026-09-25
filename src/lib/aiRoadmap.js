import { generateJson } from "./aiClient.js";

// Yo'l xaritasi uzunligi. Avval 5–8 bosqich edi — foydalanuvchiga "yo'l aniq"
// degan ishonch bermasdi. Endi 15–20: boshidan oxirigacha to'liq yo'l.
export const TARGET_MIN = 15;
export const MIN_STEPS = TARGET_MIN; // shundan kam kelsa, bir marta qayta so'raymiz
export const MAX_STEPS = 20;

const SYSTEM_PROMPT = `Sen TartibOS ilovasidagi shaxsiy rivojlanish yordamchisisan. Foydalanuvchi
o'ziga bir maqsad qo'yadi (masalan "Fullstack developer bo'lish", "Gitara chalishni
o'rganish", "Yugurish orqali sog'lom bo'lish"), va ixtiyoriy ravishda o'zining hozirgi
holati haqida qisqa izoh yozishi mumkin (masalan "hozir junior frontend developerman").
Sening vazifang — shu MAQSADNING O'ZIGA mos, hozirgi nuqtadan maqsadga yetguncha bo'lgan
TO'LIQ, batafsil va aniq yo'l xaritasini tuzish. Foydalanuvchi shu xaritaga qarab "mening
yo'lim aniq ekan, hech qanday muhim narsa tashlab ketilmagan" degan ishonchga kelishi kerak.

Qat'iy qoidalar:
- Bosqichlar FAQAT foydalanuvchi yozgan maqsadga oid bo'lsin. Agar maqsad "gitara
  chalish" bo'lsa, bosqichlar dasturlash yoki sport haqida BO'LMASIN.
- ${TARGET_MIN} tadan ${MAX_STEPS} tagacha bosqich yarat. Yo'lni qisqartirma: har bir bosqich
  kichik, aniq qadam bo'lsin (odatda 1–4 haftalik ish), katta sakrashlar bo'lmasin.
- Boshlanish nuqtasini foydalanuvchining IZOHIDAN (berilgan bo'lsa) va maqsad matnidan
  aniqla: agar hozirgi daraja ko'rsatilgan bo'lsa (masalan izohda "hozir junior frontend
  developerman" yoki maqsadda "Frontend'dan Fullstack'ga"), o'sha darajadan boshla —
  foydalanuvchi allaqachon biladigan asosiy narsalarni (masalan HTML/CSS'ni frontend
  developer allaqachon biladi) qaytadan o'rgatishga vaqt sarflama, to'g'ridan-to'g'ri
  KEYINGI daraja bosqichlaridan boshla. Hozirgi daraja ko'rsatilmagan bo'lsa, noldan
  (mutlaqo boshlang'ich) boshla.
- Tartib: eng oddiy/poydevor narsadan boshlab, eng murakkab va yakuniy natijaga qarab.
  Yo'l ichida bo'lishi kerak: poydevor → amaliyot → birinchi haqiqiy natija/loyiha →
  chuqurlashish → murakkab vazifalar → isbot (portfolio, imtihon, musobaqa, o'lchanadigan
  natija) → maqsadga erishish. Oxirgi bosqich — maqsadning o'zi yoki uning isboti.
- MUHIM — FUNDAMENTAL/AMALIYOT BOSQICHLARINI TASHLAB KETMA: ko'p hollarda AI faqat "qaysi
  texnologiya/vosita o'rganiladi" degan bosqichlarni ketma-ket yozib, ular orasidagi ASOSIY
  ko'nikmalarni (mantiqiy fikrlash, muammo yechish, amaliy kichik mashqlar, tajriba
  orttirish) tashlab ketadi — bu YARAMAYDI. Har bir yo'l xaritasida, mavzuga mos holda,
  quyidagilar ALOHIDA bosqichlar sifatida albatta bo'lishi kerak:
  * Dasturlash/texnik maqsadlar uchun: mantiqiy fikrlashni mustahkamlash va muammo yechish
    amaliyoti (masalan Codewars/LeetCode/HackerRank kabi platformalarda masalalar yechish),
    bir nechta KICHIK mustaqil loyihalar (katta portfolio loyihasidan OLDIN, har bir yangi
    texnologiyadan keyin — shu texnologiyani mustahkamlash uchun), va "endi bilganlaringizni
    birlashtiring" turidagi amaliy oraliq bosqichlar. Faqat "React va freymvorklar bilan
    loyiha qurish" deb bitta katta sakrash qilib qo'yish YETARLI EMAS — undan oldin va orasida
    mantiqiy fikrlash/muammo yechish va kichik mashqlar bosqichlari bo'lishi SHART.
  * Jismoniy/sport maqsadlar uchun: texnika o'rganish bilan bir qatorda, kuch/chidamlilik
    asta-sekin oshirish, dam olish/tiklanish va o'z-o'zini nazorat qilish (masalan progress
    kuzatish) bosqichlari ham bo'lsin.
  * Til/ijodiy maqsadlar uchun: nazariya bilan bir qatorda, muntazam amaliy mashq va kichik
    "sinov" vazifalari (masalan qisqa suhbat, kichik ijro, mini-loyiha) bosqichlari bo'lsin.
  Xulosa: yo'l xaritasi faqat "nima o'rganish kerak" ro'yxati emas, balki "qanday
  mustahkamlash va sinab ko'rish kerak" jarayonini ham o'z ichiga olishi kerak.
- Har bir bosqich TEKSHIRIB BO'LADIGAN natijaga ega bo'lsin: shunchaki "X ni o'rganish"
  emas, balki "X ni o'rganib, Y ni qilib ko'rsatish". Bosqichlar bir-birini takrorlamasin.
- "title" — o'zbek tilida (lotin yozuvi), aniq harakat + natija, 14 so'zdan oshmasin.
- "stageLabel" — foydalanuvchining shu bosqichdagi "unvoni", 2–4 so'z (masalan
  "Boshlang'ich gitarachi", "Junior Backend"). Unvonlar yo'l bo'ylab o'sib borsin;
  qo'shni bosqichlar bir xil unvonga ega bo'lishi mumkin, lekin oxirgisi eng yuqori bo'lsin.
- Javobni FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn, izoh yoki
  markdown belgisisiz:
{"steps":[{"title":"...","stageLabel":"..."}]}`;

// Xom AI javobini tozalaydi: bo'sh/takror bosqichlarni tashlaydi, uzunlikni
// cheklaydi va MAX_STEPS'dan ortig'ini kesadi.
export function normalizeSteps(parsed) {
    const raw = Array.isArray(parsed?.steps) ? parsed.steps : [];
    const seen = new Set();
    const steps = [];

    for (const s of raw) {
        const title = s?.title ? String(s.title).trim().slice(0, 200) : "";
        if (!title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        steps.push({
            title,
            stageLabel: s.stageLabel ? String(s.stageLabel).trim().slice(0, 80) : null,
        });
        if (steps.length === MAX_STEPS) break;
    }
    return steps;
}

// goalTitle — foydalanuvchi kiritgan maqsad matni.
// description — ixtiyoriy: foydalanuvchining hozirgi holati haqida qo'shimcha
// izoh (masalan "hozir junior frontend developerman"). Berilsa, AI boshlanish
// nuqtasini va bosqichlar chuqurligini shunga moslaydi.
// Muvaffaqiyatli bo'lsa, [{ title, stageLabel }] massivini qaytaradi.
// AI juda qisqa xarita (MIN_STEPS'dan kam) qaytarsa, bir marta qayta so'raydi.
// API kaliti yo'q yoki chaqiruv muvaffaqiyatsiz bo'lsa, xato tashlaydi — controller
// buni tutib, foydalanuvchiga tushunarli xabar qaytaradi.
export async function generateRoadmapSteps(goalTitle, { description } = {}) {
    let best = [];
    const trimmedDescription = String(description || "").trim().slice(0, 600);
    const contextLine = trimmedDescription
        ? `Foydalanuvchining hozirgi holati (o'zi yozgan izoh): ${trimmedDescription}`
        : "Foydalanuvchi hozirgi holati haqida izoh yozmagan — noldan boshlang'ich deb hisobla.";

    for (let attempt = 0; attempt < 2; attempt++) {
        const hint =
            attempt === 0
                ? ""
                : `\n\nDIQQAT: oldingi javobda bosqichlar yetarli emas edi. Aynan ${TARGET_MIN}–${MAX_STEPS} ta batafsil bosqich yarat.`;

        const parsed = await generateJson({
            systemPrompt: SYSTEM_PROMPT,
            userText: `Maqsad: ${goalTitle}\n${contextLine}\nBosqichlar soni: ${TARGET_MIN}–${MAX_STEPS} ta (kamida ${TARGET_MIN} ta). Yo'lni qisqartirma, har bir qadamni alohida yoz — texnologiya/vosita bosqichlari bilan bir qatorda mantiqiy fikrlash, amaliyot va kichik loyiha/sinov bosqichlarini ham unutma.${hint}`,
        });

        const steps = normalizeSteps(parsed);
        if (steps.length > best.length) best = steps;
        if (best.length >= MIN_STEPS) break;
    }

    if (best.length < TARGET_MIN) {
        // Render loglarida ko'rinishi uchun: AI ikki urinishda ham qisqa xarita bergan
        console.warn(`[aiRoadmap] AI ${best.length} ta bosqich qaytardi (kutilgan ${TARGET_MIN}–${MAX_STEPS}): "${goalTitle}"`);
    }
    return best;
}