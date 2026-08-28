import app from "./app.js";
import env from "./config/env.js";
import { registerBotCommands } from "./bot/commands.js";
import { startReminderScheduler } from "./bot/reminders.js";

app.listen(env.port, () => {
    console.log(`[server] TartibOS API ${env.port}-portda ishlamoqda (${env.nodeEnv})`);
});

registerBotCommands();
startReminderScheduler();
