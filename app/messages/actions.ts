"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasProfileCapability } from "@/lib/auth/roles";
import {
  getConversationMessages,
  getConversationPatch,
  getConversationRequestIds,
  type ConversationMode,
  type ConversationPatch,
  type ConversationMessage,
} from "@/lib/messages";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ConversationActionResult = {
  status: "success" | "error";
  message: string;
  messages?: ConversationMessage[];
  patch?: ConversationPatch;
};

type ConversationActionInput = {
  conversationId: string;
  mode: ConversationMode;
};

type SendConversationMessageInput = ConversationActionInput & {
  body: string;
};

type UpdateConversationStatusInput = ConversationActionInput & {
  note?: string;
  status: "rejected" | "archived";
};

function isConversationMode(value: unknown): value is ConversationMode {
  return value === "consumer" || value === "provider";
}

async function getMessagingProfile() {
  const profile = await getCurrentProfile();

  if (
    !profile ||
    (!hasProfileCapability(profile.role, "consume_services") &&
      !hasProfileCapability(profile.role, "manage_provider_profile"))
  ) {
    return null;
  }

  return profile;
}

function revalidateMessageSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/provider/dashboard");
}

function getGenericMessageError(action: "load" | "read" | "send" | "status") {
  switch (action) {
    case "load":
      return "We could not load that conversation. Please try again.";
    case "read":
      return "We could not update the read status. Please try again.";
    case "send":
      return "We could not send your message. Please try again.";
    case "status":
      return "We could not update that conversation. Please try again.";
  }
}

export async function openConversation(
  input: ConversationActionInput,
): Promise<ConversationActionResult> {
  if (!isConversationMode(input.mode)) {
    return {
      status: "error",
      message: getGenericMessageError("load"),
    };
  }

  const profile = await getMessagingProfile();

  if (!profile) {
    return {
      status: "error",
      message: "Sign in to view your conversations.",
    };
  }

  const supabase = await getServerSupabaseClient();
  const requestIds = await getConversationRequestIds({
    conversationId: input.conversationId,
    mode: input.mode,
  });

  if (requestIds.length === 0) {
    return {
      status: "error",
      message: getGenericMessageError("load"),
    };
  }

  const markReadResults = await Promise.all(
    requestIds.map((requestId) =>
      supabase.rpc("mark_contact_request_conversation_read", {
        target_contact_request_id: requestId,
      }),
    ),
  );

  if (markReadResults.some((result) => result.error)) {
    return {
      status: "error",
      message: getGenericMessageError("read"),
    };
  }

  const [messages, patch] = await Promise.all([
    getConversationMessages(input.conversationId, profile.id, input.mode),
    getConversationPatch({
      conversationId: input.conversationId,
      mode: input.mode,
      viewerId: profile.id,
    }),
  ]);

  if (!patch) {
    return {
      status: "error",
      message: getGenericMessageError("load"),
    };
  }

  revalidateMessageSurfaces();

  return {
    status: "success",
    message: "Conversation loaded.",
    messages,
    patch,
  };
}

export async function sendConversationMessage(
  input: SendConversationMessageInput,
): Promise<ConversationActionResult> {
  if (!isConversationMode(input.mode)) {
    return {
      status: "error",
      message: getGenericMessageError("send"),
    };
  }

  const body = input.body.trim();

  if (!body) {
    return {
      status: "error",
      message: "Write a message before sending.",
    };
  }

  if (body.length > 2000) {
    return {
      status: "error",
      message: "Messages must be 2,000 characters or fewer.",
    };
  }

  const profile = await getMessagingProfile();

  if (!profile) {
    return {
      status: "error",
      message: "Sign in to send messages.",
    };
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc("send_contact_request_message", {
    message_body: body,
    target_contact_request_id: input.conversationId,
  });

  if (error) {
    return {
      status: "error",
      message:
        error.message === "contact_request_archived"
          ? "This conversation is deleted and cannot receive new messages."
          : getGenericMessageError("send"),
    };
  }

  const [messages, patch] = await Promise.all([
    getConversationMessages(input.conversationId, profile.id, input.mode),
    getConversationPatch({
      conversationId: input.conversationId,
      mode: input.mode,
      viewerId: profile.id,
    }),
  ]);

  if (!patch) {
    return {
      status: "error",
      message: getGenericMessageError("send"),
    };
  }

  revalidateMessageSurfaces();

  return {
    status: "success",
    message: "Message sent.",
    messages,
    patch,
  };
}

export async function updateConversationStatus(
  input: UpdateConversationStatusInput,
): Promise<ConversationActionResult> {
  if (!isConversationMode(input.mode)) {
    return {
      status: "error",
      message: getGenericMessageError("status"),
    };
  }

  const profile = await getMessagingProfile();

  if (!profile || !hasProfileCapability(profile.role, "manage_provider_profile")) {
    return {
      status: "error",
      message: "Only provider accounts can update inquiry status.",
    };
  }

  const note = input.note?.trim() ?? "";

  if (note.length > 2000) {
    return {
      status: "error",
      message: "Notes must be 2,000 characters or fewer.",
    };
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc(
    "update_contact_request_conversation_status",
    {
      target_contact_request_id: input.conversationId,
      target_provider_note: note || null,
      target_status: input.status,
    },
  );

  if (error) {
    return {
      status: "error",
      message: getGenericMessageError("status"),
    };
  }

  const [messages, patch] = await Promise.all([
    getConversationMessages(input.conversationId, profile.id, input.mode),
    getConversationPatch({
      conversationId: input.conversationId,
      mode: input.mode,
      viewerId: profile.id,
    }),
  ]);

  if (!patch) {
    return {
      status: "error",
      message: getGenericMessageError("status"),
    };
  }

  revalidateMessageSurfaces();

  return {
    status: "success",
    message:
      input.status === "archived"
        ? "Conversation moved to Deleted."
        : "Inquiry rejected.",
    messages,
    patch,
  };
}
