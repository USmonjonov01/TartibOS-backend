import app from "./app.js";
import env from "./config/env.js";
import { registerBotCommands } from "./bot/commands.js";
import { startReminderScheduler } from "./bot/reminders.js";
import { bot } from "./lib/telegram.js";

const server = app.listen(env.port, () => {
    console.log(`[server] TartibOS API ${env.port}-portda ishlamoqda (${env.nodeEnv})`);
});

registerBotCommands();
startReminderScheduler();

// Graceful shutdown — server to'xtaganda (Ctrl+C, `node --watch` qayta
// ishga tushirishi, yoki Render'ning deploy vaqtidagi restart'i) botning
// getUpdates ulanishini toza yopamiz. Aks holda eski ulanish Telegram
// tomonida bir muddat "faol" hisoblanib qolishi mumkin va yangi process
// ishga tushganda qisqa muddatli 409 xatolariga sabab bo'ladi.
const shutdown = async (signal) => {
    console.log(`[server] ${signal} qabul qilindi, to'xtatilmoqda...`);
    try {
        if (bot) await bot.stopPolling();
    } catch (err) {
        console.error("[telegram] stopPolling xatosi:", err?.message || err);
    }
    server.close(() => {
        console.log("[server] to'xtatildi.");
        process.exit(0);
    });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));