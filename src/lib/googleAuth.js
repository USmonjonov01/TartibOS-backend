import { OAuth2Client } from "google-auth-library";
import env from "../config/env.js";

// google-auth-library'ning verifyIdToken metodi Google'ning ochiq (public)
// imzolash kalitlari bilan JWT imzosini, audience'ni (bizning Client ID'imiz
// ekanini) va muddatini tekshiradi — shu sababli frontend yuborgan
// "credential" haqiqatan ham Google tomonidan berilganiga real ishonch
// bilan tayanish mumkin (frontendning o'zi soxta token yasab bera olmaydi).
let client = null;
const getClient = () => {
    if (!client) client = new OAuth2Client(env.googleClientId);
    return client;
};

// idToken — Google Identity Services (GSI) tugmasidan kelgan "credential"
// maydoni. Muvaffaqiyatli bo'lsa { sub, email, emailVerified, name, picture }
// qaytaradi. Google sozlanmagan yoki token yaroqsiz bo'lsa xato tashlaydi.
export const verifyGoogleIdToken = async (idToken) => {
    if (!env.googleClientId) {
        const err = new Error("Google Sign-In hozircha sozlanmagan (GOOGLE_CLIENT_ID yo'q)");
        err.code = "GOOGLE_NOT_CONFIGURED";
        err.status = 503;
        throw err;
    }

    const ticket = await getClient().verifyIdToken({
        idToken,
        audience: env.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
        const err = new Error("Google tokeni yaroqsiz");
        err.status = 401;
        throw err;
    }

    return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: Boolean(payload.email_verified),
        name: payload.name || payload.given_name || payload.email.split("@")[0],
        picture: payload.picture || null,
    };
};
