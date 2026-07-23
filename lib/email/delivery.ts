import "server-only";

import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";

type SendEmailInput = {
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
};

export type EmailDeliveryResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

type SmtpConfig = {
  auth?: {
    pass: string;
    user: string;
  };
  from: string;
  host: string;
  port: number;
  secure: boolean;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function isPlaceholderValue(value: string) {
  return /your-|example|placeholder/i.test(value);
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const portValue = process.env.SMTP_PORT?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASSWORD?.trim() ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase() ?? "";
  const port = Number.parseInt(portValue || "587", 10);

  if (!host || !from || isPlaceholderValue(host) || isPlaceholderValue(from)) {
    return null;
  }

  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return {
    ...(user && pass ? { auth: { user, pass } } : {}),
    from,
    host,
    port,
    secure:
      secureValue === "true" ||
      secureValue === "1" ||
      port === 465,
  };
}

export function getEmailDeliveryConfigurationError() {
  return getSmtpConfig()
    ? null
    : "Email delivery is not configured for this environment.";
}

export async function sendEmail({
  html,
  replyTo,
  subject,
  text,
  to,
}: SendEmailInput): Promise<EmailDeliveryResult> {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    return {
      ok: false,
      error: "Email delivery is not configured for this environment.",
    };
  }

  transporter ??= nodemailer.createTransport({
    auth: smtpConfig.auth,
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
  });

  const mailOptions: SendMailOptions = {
    from: smtpConfig.from,
    html,
    replyTo,
    subject,
    text,
    to,
  };

  try {
    await transporter.sendMail(mailOptions);

    return { ok: true };
  } catch (error) {
    console.error("MyRealHub email delivery failed", error);

    return {
      ok: false,
      error: "Email delivery failed.",
    };
  }
}
