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

function providerLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "microsoft") return "Microsoft";
  return provider ? String(provider) : "SSO";
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
    subject: `${APP_NAME} — SMTP test`,
    text: `Your ${APP_NAME} SMTP configuration is working.`,
    html: `<p><strong>${escapeHtml(APP_NAME)}</strong>: SMTP configuration is working.</p>`,
  });
}

/**
 * Shared HTML shell shared by all transactional emails.
 * Keeps the brand header, accent bar, card and footer consistent.
 *
 * Pills accept already-escaped strings; pass a falsy value to omit a pill.
 */
function renderPremiumShell({
  preheader,
  eyebrow,
  titleHtml,
  leadHtml,
  ctaLabel,
  ctaUrl,
  showFallbackUrl = true,
  pills = [],
  footerNote,
  accentColor = "#6366f1",
}) {
  const escapedAccent = escapeHtml(accentColor);
  const safePreheader = escapeHtml(preheader || "");
  const safeEyebrow = escapeHtml(eyebrow || "");
  const safeCtaLabel = escapeHtml(ctaLabel || "");
  const safeCtaUrl = escapeHtml(ctaUrl || "");
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : "";

  const pillsHtml =
    pills && pills.length
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            ${pills
              .filter(Boolean)
              .map(
                (pill, idx) => `<td style="padding-right:${
                  idx === pills.length - 1 ? 0 : 8
                }px;vertical-align:top;">
                  <span class="pill text-muted" style="display:inline-block;padding:6px 10px;font-size:11.5px;font-weight:500;border:1px solid #e2e8f0;border-radius:999px;background:#f8fafc;color:#475569;">
                    ${pill}
                  </span>
                </td>`,
              )
              .join("\n")}
          </tr>
        </table>`
      : "";

  const fallbackBlock =
    showFallbackUrl && ctaUrl
      ? `<tr>
          <td style="padding:8px 36px 4px;">
            <p class="text-faint" style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
              Si le bouton ne fonctionne pas, copiez-collez cette adresse&nbsp;:
            </p>
            <p style="margin:4px 0 0;font-size:12px;line-height:1.4;word-break:break-all;color:#475569;">
              <a href="${safeCtaUrl}" style="color:${escapedAccent};text-decoration:underline;">${safeCtaUrl}</a>
            </p>
          </td>
        </tr>`
      : "";

  const ctaBlock = ctaUrl
    ? `<tr>
        <td align="left" style="padding:24px 36px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-radius:10px;background:${escapedAccent};">
                <a class="cta" href="${safeCtaUrl}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background:${escapedAccent};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                  ${safeCtaLabel} →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const footerBlock = safeFooterNote
    ? `<tr>
        <td style="padding:24px 4px 0;">
          <p class="text-faint" style="margin:0;font-size:11.5px;line-height:1.6;color:#94a3b8;">
            ${safeFooterNote}
          </p>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
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
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">
${safePreheader}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f5f5f7;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
        <tr>
          <td style="padding:0 4px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:linear-gradient(135deg,#6366f1,#ec4899 55%,#10b981);width:32px;height:32px;border-radius:8px;text-align:center;color:#ffffff;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">A</td></tr></table>
                </td>
                <td style="padding-left:10px;font-size:14px;font-weight:600;color:#0f172a;letter-spacing:0.02em;" class="text-primary">${escapeHtml(APP_NAME)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td>
            <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#10b981);font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <tr>
                <td style="padding:36px 36px 8px;">
                  <p class="text-faint" style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">${safeEyebrow}</p>
                  <h1 class="h1 text-primary" style="margin:0;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
                    ${titleHtml}
                  </h1>
                  <p class="text-muted" style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#475569;">
                    ${leadHtml}
                  </p>
                </td>
              </tr>

              ${ctaBlock}
              ${fallbackBlock}

              ${
                pillsHtml
                  ? `<tr><td style="padding:24px 36px 36px;">${pillsHtml}</td></tr>`
                  : `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>`
              }
            </table>
          </td>
        </tr>

        ${footerBlock}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Premium HTML invitation to join a team.
 */
export function buildTeamInvitationEmail({
  teamName,
  inviterName,
  inviterEmail,
  token,
  expiresAt,
}) {
  const origin = getPrimaryOrigin();
  const url = `${origin}/invite/${encodeURIComponent(token)}`;
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

  const html = renderPremiumShell({
    preheader: `${safeInviter} vous invite à rejoindre ${safeTeam} — invitation valable jusqu'au ${expiresLabel}.`,
    eyebrow: "Invitation à une équipe",
    titleHtml: `${safeInviter} vous invite à rejoindre <span style="color:#6366f1;">${safeTeam}</span>`,
    leadHtml: `Sur ${escapeHtml(APP_NAME)}, vous animerez et suivrez vos rituels d'équipe : rétrospectives, planning poker, radar de maturité et cartographies de compétences. Acceptez l'invitation pour rejoindre <strong>${safeTeam}</strong>.`,
    ctaLabel: `Rejoindre ${safeTeam}`,
    ctaUrl: url,
    pills: [
      `⏱ Valable jusqu'au ${expiresLabel}`,
      safeInviterEmail ? `✉ ${safeInviterEmail}` : null,
    ],
    footerNote: `Vous recevez cet email car ${safeInviter} vous a invité·e dans une équipe sur ${escapeHtml(APP_NAME)}. Si vous ne connaissez pas cette personne, ignorez ce message — aucune action n'est requise.`,
  });

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

/**
 * Welcome email after a manual sign-up (email + password).
 */
export function buildWelcomeEmail({ displayName, email }) {
  const origin = getPrimaryOrigin();
  const url = `${origin}/app`;
  const safeName = escapeHtml((displayName || "").trim() || "à toi");
  const safeEmail = escapeHtml(email || "");

  const subject = `Bienvenue sur ${APP_NAME}, ${safeName} 👋`;

  const text =
    `Bonjour ${displayName || ""},\n\n` +
    `Bienvenue sur ${APP_NAME}. Votre compte est prêt.\n\n` +
    `Découvrez Planning Poker, Rétro Party, Radar Agile et Skills Matrix pour animer vos rituels d'équipe en quelques clics.\n\n` +
    `Ouvrir votre dashboard : ${url}\n\n` +
    `À très vite,\n— L'équipe ${APP_NAME}`;

  const html = renderPremiumShell({
    preheader: `Votre compte ${APP_NAME} est prêt — animez vos rituels d'équipe en quelques clics.`,
    eyebrow: `Bienvenue sur ${escapeHtml(APP_NAME)}`,
    titleHtml: `Salut ${safeName}, votre espace est prêt`,
    leadHtml: `Vous pouvez dès maintenant créer une session <strong>Planning Poker</strong>, lancer une <strong>Rétro Party</strong>, mesurer votre maturité avec <strong>Radar Agile</strong> ou cartographier les compétences de votre équipe via <strong>Skills Matrix</strong>. Tout se passe depuis un seul espace, partagé en temps réel.`,
    ctaLabel: "Ouvrir mon dashboard",
    ctaUrl: url,
    pills: [`✉ ${safeEmail}`, "🔐 Compte créé manuellement"],
    footerNote: `Vous recevez cet email car un compte ${escapeHtml(APP_NAME)} vient d'être créé avec cette adresse. Si ce n'est pas vous, ignorez ce message ou contactez-nous.`,
  });

  return { subject, text, html, url };
}

export async function sendWelcomeEmail({ to, displayName, email }) {
  const { subject, text, html } = buildWelcomeEmail({ displayName, email });
  return sendMail({ to, subject, text, html });
}

/**
 * Welcome email after a Single Sign-On account creation (Google / Microsoft).
 */
export function buildSsoWelcomeEmail({ displayName, email, provider }) {
  const origin = getPrimaryOrigin();
  const url = `${origin}/app`;
  const safeName = escapeHtml((displayName || "").trim() || "à toi");
  const safeEmail = escapeHtml(email || "");
  const label = providerLabel(provider);
  const safeLabel = escapeHtml(label);

  const subject = `Bienvenue sur ${APP_NAME} — connecté via ${label}`;

  const text =
    `Bonjour ${displayName || ""},\n\n` +
    `Votre compte ${APP_NAME} a été créé via votre identifiant ${label}. ` +
    `Aucun mot de passe à retenir : connectez-vous d'un clic depuis l'écran d'accueil.\n\n` +
    `Découvrez Planning Poker, Rétro Party, Radar Agile et Skills Matrix.\n\n` +
    `Ouvrir votre dashboard : ${url}\n\n` +
    `À très vite,\n— L'équipe ${APP_NAME}`;

  const html = renderPremiumShell({
    preheader: `Votre compte ${APP_NAME} est prêt — connecté via ${safeLabel}, sans mot de passe à retenir.`,
    eyebrow: `Bienvenue sur ${escapeHtml(APP_NAME)}`,
    titleHtml: `Salut ${safeName}, connecté·e via <span style="color:#6366f1;">${safeLabel}</span>`,
    leadHtml: `Votre compte est associé à votre identifiant <strong>${safeLabel}</strong>. Aucun mot de passe à retenir : reconnectez-vous d'un clic depuis l'écran d'accueil. Vous pouvez tout de suite lancer vos rituels — Planning Poker, Rétro Party, Radar Agile, Skills Matrix.`,
    ctaLabel: "Ouvrir mon dashboard",
    ctaUrl: url,
    pills: [`✉ ${safeEmail}`, `🔗 SSO ${safeLabel}`],
    footerNote: `Vous recevez cet email car un compte ${escapeHtml(APP_NAME)} vient d'être créé via votre identifiant ${safeLabel}. Si ce n'est pas vous, ignorez ce message ou révoquez l'accès depuis votre compte ${safeLabel}.`,
  });

  return { subject, text, html, url };
}

export async function sendSsoWelcomeEmail({ to, displayName, email, provider }) {
  const { subject, text, html } = buildSsoWelcomeEmail({ displayName, email, provider });
  return sendMail({ to, subject, text, html });
}

/**
 * Premium password reset email.
 */
export function buildPasswordResetEmail({ displayName, email, resetUrl, expiresInMinutes }) {
  const safeName = escapeHtml((displayName || "").trim() || "à toi");
  const safeEmail = escapeHtml(email || "");
  const minutes = Number(expiresInMinutes) || 60;
  const ttlLabel = minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;

  const subject = `${APP_NAME} — Réinitialisation de votre mot de passe`;

  const text =
    `Bonjour ${displayName || ""},\n\n` +
    `Vous avez demandé à réinitialiser le mot de passe de votre compte ${APP_NAME}.\n\n` +
    `Cliquez sur ce lien pour en définir un nouveau (valable ${ttlLabel}) :\n${resetUrl}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de passe restera inchangé.\n\n` +
    `— L'équipe ${APP_NAME}`;

  const html = renderPremiumShell({
    preheader: `Réinitialisez votre mot de passe ${APP_NAME} — lien valable ${ttlLabel}.`,
    eyebrow: "Sécurité du compte",
    titleHtml: `Réinitialiser votre mot de passe`,
    leadHtml: `Bonjour ${safeName}, nous avons reçu une demande de réinitialisation pour votre compte ${escapeHtml(APP_NAME)}. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est <strong>valable ${ttlLabel}</strong> et ne peut être utilisé qu'une seule fois.`,
    ctaLabel: "Choisir un nouveau mot de passe",
    ctaUrl: resetUrl,
    accentColor: "#6366f1",
    pills: [`⏱ Lien valable ${ttlLabel}`, safeEmail ? `✉ ${safeEmail}` : null],
    footerNote: `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de passe restera inchangé. Pour votre sécurité, ne transférez jamais ce lien.`,
  });

  return { subject, text, html, url: resetUrl };
}

export async function sendPasswordResetEmail({
  to,
  displayName,
  email,
  resetUrl,
  expiresInMinutes,
}) {
  const { subject, text, html } = buildPasswordResetEmail({
    displayName,
    email,
    resetUrl,
    expiresInMinutes,
  });
  return sendMail({ to, subject, text, html });
}
