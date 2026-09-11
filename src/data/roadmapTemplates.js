// Tayyor yo'l xaritasi andozalari. Foydalanuvchi Goal yaratayotganda
// shulardan birini tanlashi mumkin (steps avtomatik nusxalanadi), yoki
// "bo'sh Goal" yaratib, hammasini o'zi qo'lda kiritishi mumkin.
//
// Yangi andoza qo'shish uchun shu massivga yangi obyekt qo'shish kifoya —
// controller va frontend avtomatik moslashadi.

export const roadmapTemplates = [
    {
        key: "frontend-to-fullstack",
        title: "Frontend'dan Fullstack Developer'ga",
        steps: [
            { title: "HTML/CSS va Flexbox/Grid'ni mustahkamlash", stageLabel: "Boshlang'ich Frontend" },
            { title: "JavaScript asoslarini chuqur o'rganish", stageLabel: "Junior Frontend" },
            { title: "React bilan haqiqiy loyiha qurish", stageLabel: "Frontend Developer" },
            { title: "Node.js va terminalda ishlashni o'rganish", stageLabel: "Backend'ga kirish" },
            { title: "Express va REST API qurishni o'rganish", stageLabel: "Junior Backend" },
            { title: "PostgreSQL/Prisma bilan ma'lumotlar bazasi", stageLabel: "Backend Developer" },
            { title: "To'liq loyihani deploy qilish (frontend + backend)", stageLabel: "Fullstack Developer" },
        ],
    },
    {
        key: "junior-to-middle-dev",
        title: "Junior'dan Middle Developer'ga",
        steps: [
            { title: "Git va jamoaviy workflow (branch, PR, review)", stageLabel: "Junior Developer" },
            { title: "Test yozishni o'rganish (unit/integration)", stageLabel: "Junior+ Developer" },
            { title: "Arxitektura va dizayn pattern'larni o'rganish", stageLabel: "Pre-Middle Developer" },
            { title: "Mustaqil ravishda kichik loyihani boshidan oxirigacha olib borish", stageLabel: "Middle Developer" },
        ],
    },
    {
        key: "fitness-basic",
        title: "Jismoniy shaklga kirish",
        steps: [
            { title: "Haftada 3 marta 20 daqiqalik mashq odatini shakllantirish", stageLabel: "Boshlang'ich" },
            { title: "Mashq davomiyligini 40 daqiqagacha oshirish", stageLabel: "Barqaror" },
            { title: "Ovqatlanish tartibini nazorat qilishni qo'shish", stageLabel: "Intizomli" },
            { title: "Belgilangan maqsad (vazn/kuch)ga erishish", stageLabel: "Maqsadga yetgan" },
        ],
    },
];

export const findTemplate = (key) => roadmapTemplates.find((t) => t.key === key) || null;
