import nodemailer from "nodemailer";
import env from "../config/env.js";

// SMTP sozlanmagan bo'lishi mumkin (masalan lokal dev muhitida) — bunday
// holda email jo'natilmaydi, lekin ilova ishlashda davom etadi: havola
// shunchaki server logiga chiqariladi, shu orqali dev rejimida SMTP sozlamay
// turib ham parolni tiklash/email tasdiqlash oqimini sinab ko'rish mumkin.
// Bu xuddi geminiApiKey / telegramBotToken uchun qo'llanilgan "ixtiyoriy
// xususiyat" andozasi bilan bir xil.
let transporter = null;
if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
        // Render (va boshqa ko'p hostinglar) tarmog'ida Gmail'ning SMTP
        // serveriga IPv6 orqali ulanish "Connection timeout" bilan tugaydi —
        // chunki hosting'ning IPv6 yo'nalishi Google'gacha to'g'ri
        // ishlamaydi. family:4 Node.js'ga har doim IPv4'dan foydalanishni
        // majburlaydi, bu muammoni butunlay hal qiladi.
        family: 4,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
}

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
    if (!transporter) {
        // SMTP sozlanmagan — havolani (test/dev uchun) loglaymiz va jim
        // qaytamiz. Controller bu holatda ham foydalanuvchiga xato
        // ko'rsatmasligi kerak (aks holda parolni tiklash butunlay
        // ishlamay qoladi, SMTP sozlanmagunicha).
        console.warn(`[mailer] SMTP sozlanmagan — "${subject}" xabari ${to}'ga yuborilmadi (faqat log).`);
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