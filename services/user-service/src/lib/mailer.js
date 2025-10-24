// src/lib/mailer.js
import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || user;
const appName = process.env.APP_NAME || 'UIT-GO';
const supportEmail = process.env.SUPPORT_EMAIL || from;
const logoUrl = process.env.LOGO_URL || ''; 

if (!user || !pass) {
  console.warn('SMTP_USER or SMTP_PASS not set — emails will fail');
}

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass
  }
});

function escapeHtml(unsafe) {
  if (!unsafe && unsafe !== 0) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * sendOtpEmail
 * @param {string} to - recipient email
 * @param {string} otp - 6-digit OTP
 * @param {Object} options - { name, expiresMinutes = 10, verifyUrl }
 */
export async function sendOtpEmail(to, otp, options = {}) {
  const name = options.name ? escapeHtml(options.name) : '';
  const expiresMinutes = options.expiresMinutes ?? 10;
  const verifyUrl = options.verifyUrl || (frontendUrl ? `${frontendUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(to)}` : null);

  const subject = `${appName} — Mã xác thực email (OTP)`;

  // Plain text fallback
  const textLines = [
    `${appName} — Mã xác thực email (OTP)`,
    '',
    name ? `Xin chào ${name},` : 'Xin chào,',
    '',
    `Mã xác thực của bạn là: ${otp}`,
    `Mã có hiệu lực trong ${expiresMinutes} phút.`,
    '',
    verifyUrl ? `Bạn có thể xác thực ngay: ${verifyUrl}` : 'Vui lòng nhập mã vào ứng dụng để xác thực.',
    '',
    `Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.`,
    '',
    `Liên hệ hỗ trợ: ${supportEmail}`,
    '',
    `— ${appName}`
  ];
  const text = textLines.join('\n');

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #eef2f6;display:flex;align-items:center;gap:12px;">
                ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(appName)}" width="40" height="40" style="object-fit:contain;border-radius:6px;">` : ''}
                <div style="font-weight:600;font-size:18px;color:#111827;">${escapeHtml(appName)}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 24px 16px 24px;">
                <h1 style="margin:0 0 12px 0;font-size:20px;color:#111827;">Mã xác thực của bạn</h1>
                <p style="margin:0 0 20px 0;color:#475569;line-height:1.5;">
                  ${name ? `Xin chào ${name},` : 'Xin chào,'}
                  <br />
                  Vui lòng sử dụng mã bên dưới để xác thực địa chỉ email của bạn. Mã có hiệu lực trong <strong>${expiresMinutes} phút</strong>.
                </p>

                <div style="margin:20px 0 30px 0;display:flex;align-items:center;justify-content:center;">
                  <div style="background:#0f172a;color:#fff;padding:18px 28px;border-radius:12px;font-size:28px;letter-spacing:4px;font-weight:700;font-family:monospace;">
                    ${escapeHtml(otp)}
                  </div>
                </div>

                ${verifyUrl ? `
                  <div style="text-align:center;margin-bottom:20px;">
                    <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Xác thực email</a>
                  </div>
                ` : ''}

                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">
                  Nếu bạn không thể nhấn nút, sao chép đường dẫn sau và dán vào trình duyệt:
                  <br />
                  ${verifyUrl ? `<a href="${escapeHtml(verifyUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(verifyUrl)}</a>` : ''}
                </p>

                <hr style="border:none;border-top:1px solid #eef2f6;margin:24px 0;" />

                <p style="margin:0;color:#94a3b8;font-size:13px;">
                  Nếu bạn không yêu cầu mã này, hãy bỏ qua email này. <br />
                  Liên hệ hỗ trợ: <a href="mailto:${escapeHtml(supportEmail)}" style="color:#2563eb;">${escapeHtml(supportEmail)}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#fcfdff;border-top:1px solid #eef2f6;text-align:center;color:#94a3b8;font-size:12px;">
                © ${new Date().getFullYear()} ${escapeHtml(appName)}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // send mail
  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
}
