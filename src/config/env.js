import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET"];

for (const key of required) {
    if (!process.env[key]) {
        console.error(`[config] Muhim environment o'zgaruvchisi yo'q: ${key}. .env faylini tekshiring.`);
        process.exit(1);
    }
}

export const env = {
    port: Number(process.env.PORT) || 4000,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
    // Bir nechta manzilga ruxsat berish uchun vergul bilan ajratiladi, masalan:
    // "http://localhost:5173,https://tartib-os.vercel.app"
    corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    nodeEnv: process.env.NODE_ENV || "development",
};

export default env;
