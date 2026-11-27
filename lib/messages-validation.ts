import { isProviderProfileId } from "@/lib/providers/slug";

export function isConversationActionInput(value: unknown): value is {
  conversationId: string;
  mode: "consumer" | "provider";
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.conversationId === "string" &&
    isProviderProfileId(input.conversationId) &&
    (input.mode === "consumer" || input.mode === "provider")
  );
}

export function validateConversationMessageBody(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Write a message before sending.";
  }
  if (value.trim().length > 2000) {
    return "Messages must be 2,000 characters or fewer.";
  }
  return null;
}

export function isConversationStatusUpdate(value: unknown): value is {
  conversationId: string;
  mode: "provider";
  status: "rejected" | "archived";
  note?: string;
} {
  if (!isConversationActionInput(value) || value.mode !== "provider") return false;
  const input = value as Record<string, unknown>;
  return (
    (input.status === "rejected" || input.status === "archived") &&
    (input.note === undefined || typeof input.note === "string")
  );
}
