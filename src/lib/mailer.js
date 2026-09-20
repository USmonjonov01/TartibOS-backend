import nodemailer from "nodemailer";
import env from "../config/env.js";

// Render (va bepul rejadagi ko'p boshqa hostinglar) chiquvchi SMTP
// portlarini (25/465/587) spam-profilaktika maqsadida bloklab qo'yadi —
// shu sabab raw SMTP ulanishi doim "Connection timeout" bilan tugaydi,
// SMTP ma'lumotlari to'g'ri bo'lsa ham. Buning YAGONA ishonchli yechimi —
// email'ni SMTP protokoli orqali emas, oddiy HTTPS so'rov orqali yuborish
// (443-port hech qachon bloklanmaydi). Shu sabab Brevo'ning transactional
// email API'si BIRINCHI TANLOV: BREVO_API_KEY sozlangan bo'lsa, shundan
// foydalaniladi. SMTP (nodemailer) faqat orqaga qaytish (fallback) sifatida
// qoladi — Render'dan boshqa, SMTP portlarini bloklamaydigan hostingda
// ishlatilsa mumkin.
let transporter = null;
if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
        family: 4,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
}

// "TartibOS <no-reply@tartibos.uz>" ko'rinishidagi qatordan ism va email'ni
// ajratib oladi — Brevo API JSON tanasida {email, name} shaklida talab
// qiladi, nodemailer esa xuddi shu qatorning o'zini qabul qiladi.
const parseFrom = (fromHeader) => {
    const match = fromHeader.match(/^(.*)<(.+)>$/);
    if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
    return { name: "TartibOS", email: fromHeader.trim() };
};

const sendViaBrevoApi = async ({ to, subject, html }) => {
    const { name, email } = parseFrom(env.smtp.from);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "api-key": env.brevoApiKey,
        },
        body: JSON.stringify({
            sender: { email, name },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Brevo API xatosi (${res.status}): ${body}`);
    }
    return { sent: true };
};

const wrapper = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="uz">
<body style="margin:0;padding:0;background:#0E141F;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#161F30;border-radius:16px;border:1px solid #2A3A54;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 0;">
              <div style="font-size:15px;font-weight:700;color:#E7A94C;letter-spacing:-0.01em;">TartibOS</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px;">
              <h1 style="margin:0 0 14px;font-size:20px;color:#EEF2F8;">${title}</h1>
              <div style="font-size:14px;line-height:1.7;color:#9FADC4;">${bodyHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 28px;">
              <div style="font-size:11px;color:#66748F;border-top:1px solid #212D42;padding-top:16px;">
                Bu xabarni siz so'ramagan bo'lsangiz, uni e'tiborsiz qoldiring — hech qanday amal bajarilmaydi.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const button = (href, label) => `
<div style="margin:22px 0;">
  <a href="${href}" style="display:inline-block;background:#E7A94C;color:#0E141F;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">${label}</a>
</div>
<div style="font-size:12px;color:#66748F;word-break:break-all;">${href}</div>`;

export const sendMail = async ({ to, subject, html }) => {
    if (env.brevoApiKey) {
        return sendViaBrevoApi({ to, subject, html });
    }

    if (!transporter) {
        // Hech biri sozlanmagan — havolani (test/dev uchun) loglaymiz va
        // jim qaytamiz. Controller bu holatda ham foydalanuvchiga xato
        // ko'rsatmasligi kerak (aks holda parolni tiklash butunlay
        // ishlamay qoladi, email yuborish sozlanmagunicha).
        console.warn(`[mailer] Email yuborish sozlanmagan — "${subject}" xabari ${to}'ga yuborilmadi (faqat log).`);
        return { sent: false };
    }

    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
    return { sent: true };
};

export const sendPasswordResetEmail = async (user, rawToken) => {
    const link = `${env.appUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
    const hasPassword = Boolean(user.passwordHash);
    const intro = hasPassword
        ? `Hisobingiz (<strong>${user.email}</strong>) uchun parolni tiklash so'ralgan. Quyidagi tugma orqali yangi parol o'rnating — havola 30 daqiqa amal qiladi.`
        : `Hisobingiz (<strong>${user.email}</strong>) hozircha faqat Google orqali kiriladi. Quyidagi tugma orqali parol o'rnatib, email+parol bilan ham kirish imkoniyatini qo'shishingiz mumkin — havola 30 daqiqa amal qiladi.`;

    console.log(`[mailer] Parolni tiklash havolasi (${user.email}): ${link}`);

    return sendMail({
        to: user.email,
        subject: "TartibOS — parolni tiklash",
        html: wrapper("Parolni tiklash", `<p>${intro}</p>${button(link, "Yangi parol o'rnatish")}`),
    });
};

export const sendVerificationEmail = async (user, rawToken) => {
    const link = `${env.appUrl.replace(/\/$/, "")}/verify-email?token=${rawToken}`;

    console.log(`[mailer] Email tasdiqlash havolasi (${user.email}): ${link}`);

    return sendMail({
        to: user.email,
        subject: "TartibOS — emailingizni tasdiqlang",
        html: wrapper(
            "Emailingizni tasdiqlang",
            `<p>Xush kelibsiz, <strong>${user.ism}</strong>! TartibOS'da hisobingizni faollashtirish uchun emailingizni tasdiqlang — havola 24 soat amal qiladi.</p>${button(link, "Emailni tasdiqlash")}`
        ),
    });
};