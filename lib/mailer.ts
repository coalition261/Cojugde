import nodemailer, { type Transporter } from "nodemailer";

/**
 * Direct SMTP delivery (Gmail app password by default). n8n stays a fallback:
 * if SMTP isn't configured or fails, alerts.ts hands the email to n8n instead.
 */
let transporter: Transporter | null = null;

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export type MailResult = { ok: true; messageId: string } | { ok: false; error: string };

export async function sendMail(mail: { to: string; subject: string; text: string }): Promise<MailResult> {
  if (!smtpConfigured()) return { ok: false, error: "SMTP not configured" };
  try {
    const from = process.env.SMTP_FROM ?? `CoJudge <${process.env.SMTP_USER}>`;
    const info = await getTransporter().sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "send failed";
    console.warn("[mailer] send failed:", error);
    return { ok: false, error: error.slice(0, 200) };
  }
}
