import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;

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
