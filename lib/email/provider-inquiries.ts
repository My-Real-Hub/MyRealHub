import "server-only";

import { sendEmail, type EmailDeliveryResult } from "@/lib/email/delivery";

type ProviderInquiryEmailInput = {
  conversationUrl: string;
  message: string;
  providerName: string;
  recipientEmail: string;
  senderEmail: string;
  senderName: string;
  senderPhone: string | null;
  subject: string;
};

function getAppBaseUrl() {
  const baseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  return baseUrl.replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSenderSummary({
  senderEmail,
  senderName,
  senderPhone,
}: Pick<
  ProviderInquiryEmailInput,
  "senderEmail" | "senderName" | "senderPhone"
>) {
  return [
    `Name: ${senderName}`,
    `Email: ${senderEmail}`,
    senderPhone ? `Phone: ${senderPhone}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function getHtmlMessage(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

export function getProviderConversationUrl(requestId: string) {
  const params = new URLSearchParams({
    inquiry: requestId,
  });

  return `${getAppBaseUrl()}/provider/dashboard?${params.toString()}#inquiries`;
}

export async function sendProviderInquiryRelayEmail({
  conversationUrl,
  message,
  providerName,
  recipientEmail,
  senderEmail,
  senderName,
  senderPhone,
  subject,
}: ProviderInquiryEmailInput): Promise<EmailDeliveryResult> {
  const safeSubject = `[MyRealHub] ${subject}`;
  const senderSummary = getSenderSummary({
    senderEmail,
    senderName,
    senderPhone,
  });

  return sendEmail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.6;">
        <p>Hello ${escapeHtml(providerName)},</p>
        <p>You received a new direct email relay through MyRealHub.</p>
        <h2 style="font-size: 16px;">${escapeHtml(subject)}</h2>
        <p>${getHtmlMessage(message)}</p>
        <hr style="border: 0; border-top: 1px solid #e7e5e4;" />
        <p><strong>Sender</strong><br />${getHtmlMessage(senderSummary)}</p>
        <p>
          <a href="${escapeHtml(conversationUrl)}" style="color: #047857;">
            Open this inquiry securely in MyRealHub
          </a>
        </p>
        <p style="font-size: 12px; color: #78716c;">
          The sender cannot see your notification email address. Replying may share your reply-to address with the sender.
        </p>
      </div>
    `,
    replyTo: senderEmail,
    subject: safeSubject,
    text: [
      `Hello ${providerName},`,
      "",
      "You received a new direct email relay through MyRealHub.",
      "",
      subject,
      message,
      "",
      "Sender",
      senderSummary,
      "",
      `Open this inquiry securely in MyRealHub: ${conversationUrl}`,
      "",
      "The sender cannot see your notification email address. Replying may share your reply-to address with the sender.",
    ].join("\n"),
    to: recipientEmail,
  });
}

export async function sendProviderInquiryNotificationEmail({
  conversationUrl,
  message,
  providerName,
  recipientEmail,
  senderEmail,
  senderName,
  senderPhone,
  subject,
}: ProviderInquiryEmailInput): Promise<EmailDeliveryResult> {
  const senderSummary = getSenderSummary({
    senderEmail,
    senderName,
    senderPhone,
  });

  return sendEmail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.6;">
        <p>Hello ${escapeHtml(providerName)},</p>
        <p>You have a new in-app MyRealHub inquiry.</p>
        <h2 style="font-size: 16px;">${escapeHtml(subject)}</h2>
        <p>${getHtmlMessage(message)}</p>
        <hr style="border: 0; border-top: 1px solid #e7e5e4;" />
        <p><strong>Sender</strong><br />${getHtmlMessage(senderSummary)}</p>
        <p>
          <a href="${escapeHtml(conversationUrl)}" style="color: #047857;">
            Open the conversation securely in MyRealHub
          </a>
        </p>
      </div>
    `,
    subject: `[MyRealHub] New inquiry from ${senderName}`,
    text: [
      `Hello ${providerName},`,
      "",
      "You have a new in-app MyRealHub inquiry.",
      "",
      subject,
      message,
      "",
      "Sender",
      senderSummary,
      "",
      `Open the conversation securely in MyRealHub: ${conversationUrl}`,
    ].join("\n"),
    to: recipientEmail,
  });
}
