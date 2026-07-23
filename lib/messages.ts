import "server-only";

import type { CurrentProfile } from "@/lib/auth/session";
import {
  getContactDeliveryMethod,
  getContactEmailDeliveryStatus,
  type ContactDeliveryMethod,
  type ContactEmailDeliveryStatus,
  type ContactRequestStatus,
} from "@/lib/contact-requests";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export const CONTACT_CONVERSATIONS_LIMIT = 100;

export type ConversationMode = "consumer" | "provider";

export type ConversationViewer = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

export type ConversationParticipant = {
  name: string;
  subtitle: string | null;
  avatarUrl: string | null;
  href: string | null;
};

export type ConversationMessage = {
  id: string;
  contactRequestId: string;
  senderUserId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
  isOwn: boolean;
};

export type ConversationSummary = {
  id: string;
  providerProfileId: string;
  requestCount: number;
  requestIds: string[];
  subject: string;
  status: ContactRequestStatus;
  deliveryMethod: ContactDeliveryMethod;
  emailDeliveryStatus: ContactEmailDeliveryStatus;
  emailDeliveryError: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  providerLastReadAt: string | null;
  senderLastReadAt: string | null;
  preview: string;
  unread: boolean;
  lastSenderUserId: string | null;
  participant: ConversationParticipant;
  senderContact: {
    email: string;
    phone: string | null;
  } | null;
};

export type ConversationPatch = Pick<
  ConversationSummary,
  | "id"
  | "status"
  | "updatedAt"
  | "lastMessageAt"
  | "providerLastReadAt"
  | "senderLastReadAt"
  | "preview"
  | "unread"
  | "lastSenderUserId"
>;

export type ConversationCenterData = {
  mode: ConversationMode;
  viewer: ConversationViewer;
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  selectedMessages: ConversationMessage[];
  total: number;
  unreadCount: number;
  limit: number;
  errorMessage: string | null;
};

export type MessagingProviderProfile = {
  id: string;
  business_name: string | null;
  display_name: string | null;
  city?: string | null;
  province_state?: string | null;
  country?: string | null;
  profile_image_url: string | null;
};

type AccountProfileRow = {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ContactRequestConversationRow = {
  id: string;
  provider_profile_id: string;
  sender_user_id: string | null;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string;
  message: string;
  delivery_method: string | null;
  email_delivery_status: string | null;
  email_delivery_error: string | null;
  status: ContactRequestStatus;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  provider_last_read_at: string | null;
  sender_last_read_at: string | null;
};

type ProviderConversationRow = {
  id: string;
  slug: string | null;
  business_name: string | null;
  display_name: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  profile_image_url: string | null;
};

type MessageRow = {
  id: string;
  contact_request_id: string;
  sender_user_id: string | null;
  sender_name_snapshot: string;
  sender_email_snapshot: string | null;
  sender_avatar_url_snapshot: string | null;
  body: string;
  created_at: string;
};

const contactRequestConversationColumns = [
  "id",
  "provider_profile_id",
  "sender_user_id",
  "sender_name",
  "sender_email",
  "sender_phone",
  "subject",
  "message",
  "delivery_method",
  "email_delivery_status",
  "email_delivery_error",
  "status",
  "created_at",
  "updated_at",
  "last_message_at",
  "provider_last_read_at",
  "sender_last_read_at",
].join(",");

const messageColumns = [
  "id",
  "contact_request_id",
  "sender_user_id",
  "sender_name_snapshot",
  "sender_email_snapshot",
  "sender_avatar_url_snapshot",
  "body",
  "created_at",
].join(",");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined) {
  return Boolean(value && uuidPattern.test(value));
}

function getPublicImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.hostname === "example.com" || url.hostname.endsWith(".example.com")) {
      return null;
    }

    return value;
  } catch {
    return value.startsWith("/") ? value : null;
  }
}

function getFallbackName(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "MyRealHub member";
}

function getProviderName(provider: ProviderConversationRow | null) {
  return getFallbackName(
    provider?.business_name,
    provider?.display_name,
    "Provider profile",
  );
}

function getProviderLocation(provider: ProviderConversationRow | null) {
  const parts = [
    provider?.city,
    provider?.province_state,
    provider?.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function getProviderProfileName(providerProfile: MessagingProviderProfile | null) {
  return getFallbackName(
    providerProfile?.business_name,
    providerProfile?.display_name,
    "Provider",
  );
}

function getTime(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = Date.parse(value);

  return Number.isFinite(time) ? time : 0;
}

function getProviderSenderGroupKey(row: ContactRequestConversationRow) {
  if (row.sender_user_id) {
    return `user:${row.sender_user_id}`;
  }

  return `email:${row.sender_email.trim().toLowerCase()}`;
}

function getConversationActivityAt(
  row: ContactRequestConversationRow,
  latestMessage: MessageRow | null,
) {
  return row.last_message_at ?? latestMessage?.created_at ?? row.created_at;
}

function sortRowsByActivityDesc(
  rows: ContactRequestConversationRow[],
  latestMessages: Map<string, MessageRow>,
) {
  return [...rows].sort((first, second) => {
    const firstTime = getTime(
      getConversationActivityAt(first, latestMessages.get(first.id) ?? null),
    );
    const secondTime = getTime(
      getConversationActivityAt(second, latestMessages.get(second.id) ?? null),
    );

    return secondTime - firstTime;
  });
}

function isUnreadConversation({
  lastMessageAt,
  lastSenderUserId,
  mode,
  providerLastReadAt,
  senderLastReadAt,
  viewerId,
}: {
  lastMessageAt: string;
  lastSenderUserId: string | null;
  mode: ConversationMode;
  providerLastReadAt: string | null;
  senderLastReadAt: string | null;
  viewerId: string;
}) {
  if (lastSenderUserId === viewerId) {
    return false;
  }

  const readAt = mode === "provider" ? providerLastReadAt : senderLastReadAt;

  return getTime(lastMessageAt) > getTime(readAt);
}

function toConversationMessage(
  row: MessageRow,
  viewerId: string,
): ConversationMessage {
  return {
    id: row.id,
    contactRequestId: row.contact_request_id,
    senderUserId: row.sender_user_id,
    senderName: row.sender_name_snapshot,
    senderEmail: row.sender_email_snapshot,
    senderAvatarUrl: getPublicImageUrl(row.sender_avatar_url_snapshot),
    body: row.body,
    createdAt: row.created_at,
    isOwn: row.sender_user_id === viewerId,
  };
}

function toConversationPatch({
  latestMessage,
  mode,
  row,
  viewerId,
}: {
  latestMessage: MessageRow | null;
  mode: ConversationMode;
  row: ContactRequestConversationRow;
  viewerId: string;
}): ConversationPatch {
  const lastMessageAt =
    row.last_message_at ?? latestMessage?.created_at ?? row.updated_at;
  const preview = latestMessage?.body ?? row.message;
  const lastSenderUserId = latestMessage?.sender_user_id ?? row.sender_user_id;

  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
    lastMessageAt,
    providerLastReadAt: row.provider_last_read_at,
    senderLastReadAt: row.sender_last_read_at,
    preview,
    unread: isUnreadConversation({
      lastMessageAt,
      lastSenderUserId,
      mode,
      providerLastReadAt: row.provider_last_read_at,
      senderLastReadAt: row.sender_last_read_at,
      viewerId,
    }),
    lastSenderUserId,
  };
}

function toPatchFromSummary(summary: ConversationSummary): ConversationPatch {
  return {
    id: summary.id,
    status: summary.status,
    updatedAt: summary.updatedAt,
    lastMessageAt: summary.lastMessageAt,
    providerLastReadAt: summary.providerLastReadAt,
    senderLastReadAt: summary.senderLastReadAt,
    preview: summary.preview,
    unread: summary.unread,
    lastSenderUserId: summary.lastSenderUserId,
  };
}

function toConversationSummary({
  latestMessage,
  mode,
  provider,
  row,
  viewerId,
}: {
  latestMessage: MessageRow | null;
  mode: ConversationMode;
  provider: ProviderConversationRow | null;
  row: ContactRequestConversationRow;
  viewerId: string;
}): ConversationSummary {
  const lastMessageAt =
    row.last_message_at ?? latestMessage?.created_at ?? row.created_at;
  const preview = latestMessage?.body ?? row.message;
  const lastSenderUserId = latestMessage?.sender_user_id ?? row.sender_user_id;
  const participant =
    mode === "provider"
      ? {
          name: row.sender_name,
          subtitle: row.sender_email,
          avatarUrl: null,
          href: null,
        }
      : {
          name: getProviderName(provider),
          subtitle: getProviderLocation(provider),
          avatarUrl: getPublicImageUrl(provider?.profile_image_url),
          href: provider?.slug ? `/providers/${provider.slug}` : null,
        };

  return {
    id: row.id,
    providerProfileId: row.provider_profile_id,
    requestCount: 1,
    requestIds: [row.id],
    subject: row.subject,
    status: row.status,
    deliveryMethod: getContactDeliveryMethod(row.delivery_method),
    emailDeliveryStatus: getContactEmailDeliveryStatus(
      row.email_delivery_status,
    ),
    emailDeliveryError: row.email_delivery_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt,
    providerLastReadAt: row.provider_last_read_at,
    senderLastReadAt: row.sender_last_read_at,
    preview,
    unread: isUnreadConversation({
      lastMessageAt,
      lastSenderUserId,
      mode,
      providerLastReadAt: row.provider_last_read_at,
      senderLastReadAt: row.sender_last_read_at,
      viewerId,
    }),
    lastSenderUserId,
    participant,
    senderContact:
      mode === "provider"
        ? {
            email: row.sender_email,
            phone: row.sender_phone,
          }
        : null,
  };
}

function toProviderConversationSummary({
  latestMessages,
  rows,
  viewerId,
}: {
  latestMessages: Map<string, MessageRow>;
  rows: ContactRequestConversationRow[];
  viewerId: string;
}): ConversationSummary {
  const sortedRows = sortRowsByActivityDesc(rows, latestMessages);
  const latestRow = sortedRows[0];
  const primaryRow =
    sortedRows.find((row) => row.status !== "archived") ?? latestRow;
  const latestMessage = latestMessages.get(latestRow.id) ?? null;
  const lastMessageAt = getConversationActivityAt(latestRow, latestMessage);
  const lastSenderUserId =
    latestMessage?.sender_user_id ?? latestRow.sender_user_id;
  const senderName = getFallbackName(latestRow.sender_name, "Sender");
  const unread = sortedRows.some((row) => {
    const rowLatestMessage = latestMessages.get(row.id) ?? null;
    const rowLastMessageAt = getConversationActivityAt(row, rowLatestMessage);

    return isUnreadConversation({
      lastMessageAt: rowLastMessageAt,
      lastSenderUserId:
        rowLatestMessage?.sender_user_id ?? row.sender_user_id,
      mode: "provider",
      providerLastReadAt: row.provider_last_read_at,
      senderLastReadAt: row.sender_last_read_at,
      viewerId,
    });
  });
  const allArchived = sortedRows.every((row) => row.status === "archived");
  const failedEmailRow =
    sortedRows.find((row) => row.email_delivery_status === "failed") ?? null;
  const newestPhone =
    sortedRows.find((row) => row.sender_phone)?.sender_phone ?? null;

  return {
    id: primaryRow.id,
    providerProfileId: primaryRow.provider_profile_id,
    requestCount: sortedRows.length,
    requestIds: sortedRows.map((row) => row.id),
    subject:
      sortedRows.length > 1
        ? `${sortedRows.length} inquiries with ${senderName}`
        : primaryRow.subject,
    status: allArchived ? "archived" : unread ? "new" : primaryRow.status,
    deliveryMethod: getContactDeliveryMethod(primaryRow.delivery_method),
    emailDeliveryStatus: failedEmailRow
      ? "failed"
      : getContactEmailDeliveryStatus(primaryRow.email_delivery_status),
    emailDeliveryError:
      failedEmailRow?.email_delivery_error ?? primaryRow.email_delivery_error,
    createdAt: sortedRows[sortedRows.length - 1]?.created_at ?? primaryRow.created_at,
    updatedAt: latestRow.updated_at,
    lastMessageAt,
    providerLastReadAt: primaryRow.provider_last_read_at,
    senderLastReadAt: primaryRow.sender_last_read_at,
    preview: latestMessage?.body ?? latestRow.message,
    unread,
    lastSenderUserId,
    participant: {
      name: senderName,
      subtitle: latestRow.sender_email,
      avatarUrl: null,
      href: null,
    },
    senderContact: {
      email: latestRow.sender_email,
      phone: newestPhone,
    },
  };
}

async function getViewer({
  mode,
  profile,
  providerProfile,
}: {
  mode: ConversationMode;
  profile: CurrentProfile;
  providerProfile: MessagingProviderProfile | null;
}): Promise<ConversationViewer> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name,email,avatar_url")
    .eq("id", profile.id)
    .maybeSingle();
  const accountProfile = (data ?? null) as AccountProfileRow | null;
  const providerAvatar = getPublicImageUrl(providerProfile?.profile_image_url);
  const accountAvatar = getPublicImageUrl(accountProfile?.avatar_url);

  return {
    id: profile.id,
    name:
      mode === "provider"
        ? getFallbackName(
            providerProfile?.business_name,
            providerProfile?.display_name,
            accountProfile?.full_name,
            profile.fullName,
            profile.email,
            "Provider",
          )
        : getFallbackName(
            accountProfile?.full_name,
            profile.fullName,
            accountProfile?.email,
            profile.email,
            "MyRealHub user",
          ),
    email: accountProfile?.email ?? profile.email,
    avatarUrl: mode === "provider" ? providerAvatar ?? accountAvatar : accountAvatar,
  };
}

async function getConversationRows({
  mode,
  participantId,
  selectedConversationId,
}: {
  mode: ConversationMode;
  participantId: string;
  selectedConversationId: string | null;
}) {
  const supabase = await getServerSupabaseClient();
  const baseColumn =
    mode === "provider" ? "provider_profile_id" : "sender_user_id";

  const [countResult, rowsResult] = await Promise.all([
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq(baseColumn, participantId),
    supabase
      .from("contact_requests")
      .select(contactRequestConversationColumns)
      .eq(baseColumn, participantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(CONTACT_CONVERSATIONS_LIMIT),
  ]);

  if (rowsResult.error) {
    return {
      rows: [] as ContactRequestConversationRow[],
      total: countResult.count ?? 0,
      errorMessage: "We could not load your conversations. Please try again.",
    };
  }

  const rows = (rowsResult.data ?? []) as unknown as ContactRequestConversationRow[];

  if (
    selectedConversationId &&
    isUuid(selectedConversationId) &&
    !rows.some((row) => row.id === selectedConversationId)
  ) {
    const { data: selectedRow } = await supabase
      .from("contact_requests")
      .select(contactRequestConversationColumns)
      .eq(baseColumn, participantId)
      .eq("id", selectedConversationId)
      .maybeSingle();

    if (selectedRow) {
      const selectedContactRequest =
        selectedRow as unknown as ContactRequestConversationRow;
      rows.unshift(selectedContactRequest);

      if (mode === "provider") {
        let groupQuery = supabase
          .from("contact_requests")
          .select(contactRequestConversationColumns)
          .eq("provider_profile_id", participantId);

        groupQuery = selectedContactRequest.sender_user_id
          ? groupQuery.eq("sender_user_id", selectedContactRequest.sender_user_id)
          : groupQuery.eq("sender_email", selectedContactRequest.sender_email);

        const { data: groupRows } = await groupQuery;

        for (const groupRow of (groupRows ??
          []) as unknown as ContactRequestConversationRow[]) {
          if (!rows.some((row) => row.id === groupRow.id)) {
            rows.push(groupRow);
          }
        }
      }
    }
  }

  return {
    rows,
    total: countResult.count ?? rows.length,
    errorMessage: null,
  };
}

function getProviderGroupedRows(rows: ContactRequestConversationRow[]) {
  const groups = new Map<string, ContactRequestConversationRow[]>();

  for (const row of rows) {
    const key = getProviderSenderGroupKey(row);
    const groupRows = groups.get(key) ?? [];
    groupRows.push(row);
    groups.set(key, groupRows);
  }

  return Array.from(groups.values());
}

async function getProviderRows(rows: ContactRequestConversationRow[]) {
  const providerIds = Array.from(
    new Set(rows.map((row) => row.provider_profile_id)),
  );

  if (providerIds.length === 0) {
    return new Map<string, ProviderConversationRow>();
  }

  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select(
      "id,slug,business_name,display_name,city,province_state,country,profile_image_url",
    )
    .in("id", providerIds);

  return new Map(
    ((data ?? []) as unknown as ProviderConversationRow[]).map((provider) => [
      provider.id,
      provider,
    ]),
  );
}

async function getLatestMessages(rows: ContactRequestConversationRow[]) {
  const conversationIds = rows.map((row) => row.id);

  if (conversationIds.length === 0) {
    return new Map<string, MessageRow>();
  }

  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("contact_request_latest_messages")
    .select(messageColumns)
    .in("contact_request_id", conversationIds);

  return new Map(
    ((data ?? []) as unknown as MessageRow[]).map((message) => [
      message.contact_request_id,
      message,
    ]),
  );
}

export async function getConversationMessages(
  conversationId: string,
  viewerId: string,
  mode: ConversationMode = "consumer",
) {
  if (!isUuid(conversationId)) {
    return [];
  }

  const supabase = await getServerSupabaseClient();
  const requestIds = await getConversationRequestIds({
    conversationId,
    mode,
  });

  if (requestIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("contact_request_messages")
    .select(messageColumns)
    .in("contact_request_id", requestIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  return ((data ?? []) as unknown as MessageRow[]).map((row) =>
    toConversationMessage(row, viewerId),
  );
}

async function getConversationRequestRows({
  conversationId,
  mode,
}: {
  conversationId: string;
  mode: ConversationMode;
}) {
  if (!isUuid(conversationId)) {
    return [];
  }

  const supabase = await getServerSupabaseClient();
  const { data: selectedRow } = await supabase
    .from("contact_requests")
    .select(contactRequestConversationColumns)
    .eq("id", conversationId)
    .maybeSingle();

  if (!selectedRow || mode !== "provider") {
    return selectedRow
      ? [selectedRow as unknown as ContactRequestConversationRow]
      : [];
  }

  const selectedContactRequest =
    selectedRow as unknown as ContactRequestConversationRow;
  let groupQuery = supabase
    .from("contact_requests")
    .select(contactRequestConversationColumns)
    .eq("provider_profile_id", selectedContactRequest.provider_profile_id);

  groupQuery = selectedContactRequest.sender_user_id
    ? groupQuery.eq("sender_user_id", selectedContactRequest.sender_user_id)
    : groupQuery.eq("sender_email", selectedContactRequest.sender_email);

  const { data: groupRows } = await groupQuery;

  return (groupRows ?? []) as unknown as ContactRequestConversationRow[];
}

export async function getConversationRequestIds({
  conversationId,
  mode,
}: {
  conversationId: string;
  mode: ConversationMode;
}) {
  const rows = await getConversationRequestRows({ conversationId, mode });

  return rows.map((row) => row.id);
}

export async function getConversationPatch({
  conversationId,
  mode,
  viewerId,
}: {
  conversationId: string;
  mode: ConversationMode;
  viewerId: string;
}) {
  if (!isUuid(conversationId)) {
    return null;
  }

  const supabase = await getServerSupabaseClient();
  const requestRows = await getConversationRequestRows({
    conversationId,
    mode,
  });

  if (requestRows.length === 0) {
    return null;
  }

  if (mode === "provider") {
    const latestMessages = await getLatestMessages(requestRows);

    return toPatchFromSummary(
      toProviderConversationSummary({
        latestMessages,
        rows: requestRows,
        viewerId,
      }),
    );
  }

  const requestRow = requestRows[0];
  const { data: latestMessage } = await supabase
    .from("contact_request_latest_messages")
    .select(messageColumns)
    .eq("contact_request_id", requestRow.id)
    .maybeSingle();

  return toConversationPatch({
    latestMessage: (latestMessage ?? null) as unknown as MessageRow | null,
    mode,
    row: requestRow as unknown as ContactRequestConversationRow,
    viewerId,
  });
}

async function getConversationCenterData({
  mode,
  participantId,
  profile,
  providerProfile,
  selectedConversationId,
}: {
  mode: ConversationMode;
  participantId: string | null;
  profile: CurrentProfile;
  providerProfile: MessagingProviderProfile | null;
  selectedConversationId: string | null;
}): Promise<ConversationCenterData> {
  const viewer = await getViewer({ mode, profile, providerProfile });

  if (!participantId) {
    return {
      mode,
      viewer,
      conversations: [],
      selectedConversationId: null,
      selectedMessages: [],
      total: 0,
      unreadCount: 0,
      limit: CONTACT_CONVERSATIONS_LIMIT,
      errorMessage: null,
    };
  }

  const { rows, total, errorMessage } = await getConversationRows({
    mode,
    participantId,
    selectedConversationId,
  });
  const [latestMessages, providerRows] = await Promise.all([
    getLatestMessages(rows),
    mode === "consumer"
      ? getProviderRows(rows)
      : Promise.resolve(new Map<string, ProviderConversationRow>()),
  ]);
  const conversations =
    mode === "provider"
      ? getProviderGroupedRows(rows)
          .map((groupRows) =>
            toProviderConversationSummary({
              latestMessages,
              rows: groupRows,
              viewerId: viewer.id,
            }),
          )
          .sort(
            (first, second) =>
              getTime(second.lastMessageAt) - getTime(first.lastMessageAt),
          )
      : rows.map((row) =>
          toConversationSummary({
            latestMessage: latestMessages.get(row.id) ?? null,
            mode,
            provider: providerRows.get(row.provider_profile_id) ?? null,
            row,
            viewerId: viewer.id,
          }),
        );
  const selectedId =
    conversations.find(
      (conversation) =>
        conversation.id === selectedConversationId ||
        Boolean(
          selectedConversationId &&
            conversation.requestIds.includes(selectedConversationId),
        ),
    )?.id ??
    conversations[0]?.id ??
    null;
  const selectedMessages = selectedId
    ? await getConversationMessages(selectedId, viewer.id, mode)
    : [];

  return {
    mode,
    viewer,
    conversations,
    selectedConversationId: selectedId,
    selectedMessages,
    total: mode === "provider" ? conversations.length : total,
    unreadCount: conversations.filter((conversation) => conversation.unread)
      .length,
    limit: CONTACT_CONVERSATIONS_LIMIT,
    errorMessage,
  };
}

export async function getConsumerConversationCenterData({
  profile,
  selectedConversationId,
}: {
  profile: CurrentProfile;
  selectedConversationId: string | null;
}) {
  return getConversationCenterData({
    mode: "consumer",
    participantId: profile.id,
    profile,
    providerProfile: null,
    selectedConversationId,
  });
}

export async function getProviderConversationCenterData({
  profile,
  providerProfile,
  selectedConversationId,
}: {
  profile: CurrentProfile;
  providerProfile: MessagingProviderProfile | null;
  selectedConversationId: string | null;
}) {
  return getConversationCenterData({
    mode: "provider",
    participantId: providerProfile?.id ?? null,
    profile,
    providerProfile,
    selectedConversationId,
  });
}

export function getProviderConversationViewerName(
  providerProfile: MessagingProviderProfile | null,
) {
  return getProviderProfileName(providerProfile);
}
