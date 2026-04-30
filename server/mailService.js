import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;
const APP_NAME = process.env.APP_NAME || "AgileSuite";

function getPrimaryOrigin() {
  const raw = (process.env.ORIGIN || "").trim();
  if (!raw) return "http://localhost:8088";
  const first = raw
    .split(",")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  return (first || "http://localhost:8088").replace(/\/+$/, "");
}

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateFr(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

let transporter = null;

function assertMailConfig() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    const error = new Error("Mail service is not configured");
    error.code = "MAIL_NOT_CONFIGURED";
    throw error;
  }
}

function getTransporter() {
  assertMailConfig();
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (typeof to !== "string" || !to.trim()) {
    throw new Error("Recipient is required");
  }

  const tx = getTransporter();
  return tx.sendMail({
    from: MAIL_FROM,
    to: to.trim(),
    subject,
    text,
    html,
  });
}

export async function testMail({ to }) {
  return sendMail({
    to,
    subject: "Retro Party - SMTP test",
    text: "Your Gmail SMTP configuration is working.",
    html: "<p><strong>Retro Party</strong>: Gmail SMTP configuration is working.</p>",
  });
}

/**
 * Premium HTML invitation to join a team.
 * Compatible with major email clients (table-based layout, inline styles,
 * dark-mode media query supported on Apple Mail / iOS / Outlook.com).
 */
export function buildTeamInvitationEmail({
  teamName,
  inviterName,
  inviterEmail,
  token,
  expiresAt,
}) {
  const origin = getPrimaryOrigin();
  const url = `${origin}/?invitation=${encodeURIComponent(token)}`;
  const safeTeam = escapeHtml(teamName || "votre équipe");
  const safeInviter = escapeHtml(inviterName || inviterEmail || "Un collègue");
  const safeInviterEmail = escapeHtml(inviterEmail || "");
  const expiresLabel = escapeHtml(formatDateFr(expiresAt));

  const subject = `${safeInviter} vous invite à rejoindre ${safeTeam} sur ${APP_NAME}`;

  const text =
    `Bonjour,\n\n` +
    `${inviterName || inviterEmail || "Un collègue"} vous invite à rejoindre l'équipe ` +
    `"${teamName}" sur ${APP_NAME}.\n\n` +
    `Cliquez sur ce lien pour créer votre compte et rejoindre l'équipe :\n${url}\n\n` +
    `Cette invitation expire le ${formatDateFr(expiresAt)}.\n\n` +
    `Si vous ne connaissez pas cette personne, vous pouvez ignorer ce message.\n\n` +
    `— L'équipe ${APP_NAME}`;

  const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>${escapeHtml(subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background:#0a0a14 !important; }
    .card { background:#0e0e1a !important; border-color:rgba(255,255,255,0.07) !important; }
    .text-primary { color:#f1f5f9 !important; }
    .text-muted { color:#94a3b8 !important; }
    .text-faint { color:#64748b !important; }
    .pill { background:rgba(255,255,255,0.04) !important; border-color:rgba(255,255,255,0.07) !important; color:#cbd5e1 !important; }
    .divider { border-color:rgba(255,255,255,0.07) !important; }
  }
  @media only screen and (max-width:600px) {
    .container { width:100% !important; padding-left:16px !important; padding-right:16px !important; }
    .h1 { font-size:22px !important; line-height:1.3 !important; }
    .cta { display:block !important; width:100% !important; box-sizing:border-box !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
<!-- preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">
${safeInviter} vous invite à rejoindre ${safeTeam} — invitation valable jusqu'au ${expiresLabel}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f5f5f7;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
        <!-- Brand header -->
        <tr>
          <td style="padding:0 4px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:linear-gradient(135deg,#6366f1,#ec4899);width:32px;height:32px;border-radius:8px;text-align:center;color:#ffffff;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">A</td></tr></table>
                </td>
                <td style="padding-left:10px;font-size:14px;font-weight:600;color:#0f172a;letter-spacing:0.02em;" class="text-primary">${escapeHtml(APP_NAME)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td>
            <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
              <!-- Accent bar -->
              <tr>
                <td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 36px 8px;">
                  <p class="text-faint" style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">Invitation à une équipe</p>
                  <h1 class="h1 text-primary" style="margin:0;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
                    ${safeInviter} vous invite à rejoindre <span style="color:#6366f1;">${safeTeam}</span>
                  </h1>
                  <p class="text-muted" style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#475569;">
                    Sur ${escapeHtml(APP_NAME)}, vous animerez et suivrez vos rituels d'équipe :
                    rétrospectives, planning poker, radar de maturité et cartographies de
                    compétences. Acceptez l'invitation pour rejoindre <strong>${safeTeam}</strong>.
                  </p>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td align="left" style="padding:24px 36px 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="border-radius:10px;background:#6366f1;">
                        <a class="cta" href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background:#6366f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                          Rejoindre ${safeTeam} →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Fallback link -->
              <tr>
                <td style="padding:8px 36px 4px;">
                  <p class="text-faint" style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                    Si le bouton ne fonctionne pas, copiez-collez cette adresse&nbsp;:
                  </p>
                  <p style="margin:4px 0 0;font-size:12px;line-height:1.4;word-break:break-all;color:#475569;">
                    <a href="${escapeHtml(url)}" style="color:#6366f1;text-decoration:underline;">${escapeHtml(url)}</a>
                  </p>
                </td>
              </tr>

              <!-- Pills (expiry + sender) -->
              <tr>
                <td style="padding:24px 36px 36px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding-right:8px;vertical-align:top;">
                        <span class="pill text-muted" style="display:inline-block;padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #e2e8f0;border-radius:999px;background:#f8fafc;color:#475569;">
                          ⏱ Valable jusqu'au ${expiresLabel}
                        </span>
                      </td>
                      ${
                        safeInviterEmail
                          ? `<td style="vertical-align:top;">
                              <span class="pill text-muted" style="display:inline-block;padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #e2e8f0;border-radius:999px;background:#f8fafc;color:#475569;">
                                ✉ ${safeInviterEmail}
                              </span>
                            </td>`
                          : ""
                      }
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 4px 0;">
            <p class="text-faint" style="margin:0;font-size:11.5px;line-height:1.6;color:#94a3b8;">
              Vous recevez cet email car ${safeInviter} vous a invité·e dans une équipe sur
              ${escapeHtml(APP_NAME)}. Si vous ne connaissez pas cette personne, ignorez ce message —
              aucune action n'est requise.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html, url };
}

export async function sendTeamInvitationEmail({
  to,
  teamName,
  inviterName,
  inviterEmail,
  token,
  expiresAt,
}) {
  const { subject, text, html } = buildTeamInvitationEmail({
    teamName,
    inviterName,
    inviterEmail,
    token,
    expiresAt,
  });
  return sendMail({ to, subject, text, html });
}
