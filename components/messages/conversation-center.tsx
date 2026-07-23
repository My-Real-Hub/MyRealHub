"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  openConversation as openConversationAction,
  sendConversationMessage,
  updateConversationStatus,
} from "@/app/messages/actions";
import {
  contactDeliveryMethodLabels,
  contactEmailDeliveryStatusClassNames,
  contactEmailDeliveryStatusLabels,
  contactRequestStatusClassNames,
  contactRequestStatusLabels,
  type ContactRequestStatus,
} from "@/lib/contact-requests";
import type {
  ConversationCenterData,
  ConversationMessage,
  ConversationMode,
  ConversationPatch,
  ConversationSummary,
} from "@/lib/messages";

type ConversationCenterCopy = {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  title: string;
};

type ConversationCenterProps = {
  copy?: Partial<ConversationCenterCopy>;
  data: ConversationCenterData;
};

const defaultCopy = {
  consumer: {
    description:
      "A clean message history for every provider you have contacted.",
    emptyDescription:
      "Messages you send from provider profiles will appear here.",
    emptyTitle: "No provider conversations yet",
    eyebrow: "Sent messages",
    title: "Provider conversations",
  },
  provider: {
    description:
      "Review inquiries, reply from one thread, and keep read status tidy.",
    emptyDescription:
      "New inquiries from users and providers will appear here.",
    emptyTitle: "No inquiries yet",
    eyebrow: "Inquiries",
    title: "Provider inbox",
  },
} satisfies Record<ConversationMode, ConversationCenterCopy>;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : dateTimeFormatter.format(date);
}

function formatFullDateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : fullDateTimeFormatter.format(date);
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "MR";
}

function getConversationTime(value: string) {
  const time = Date.parse(value);

  return Number.isFinite(time) ? time : 0;
}

function getSearchableText(conversation: ConversationSummary) {
  return [
    conversation.participant.name,
    conversation.participant.subtitle,
    conversation.subject,
    conversation.preview,
    contactRequestStatusLabels[conversation.status],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getMessagePreview(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function Avatar({
  avatarUrl,
  name,
  own = false,
}: {
  avatarUrl: string | null;
  name: string;
  own?: boolean;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="size-11 shrink-0 rounded-full object-cover ring-1 ring-stone-200"
      />
    );
  }

  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        own
          ? "bg-emerald-700 text-white"
          : "bg-stone-100 text-stone-700 ring-1 ring-stone-200"
      }`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

function StatusBadge({ status }: { status: ContactRequestStatus }) {
  return (
    <span
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${contactRequestStatusClassNames[status]}`}
    >
      {contactRequestStatusLabels[status]}
    </span>
  );
}

function EmailDeliveryBadge({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  if (conversation.emailDeliveryStatus !== "failed") {
    return null;
  }

  return (
    <span
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${contactEmailDeliveryStatusClassNames.failed}`}
    >
      Email {contactEmailDeliveryStatusLabels.failed}
    </span>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-stone-300 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-stone-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
        {description}
      </p>
    </div>
  );
}

function applyConversationPatch(
  conversations: ConversationSummary[],
  patch: ConversationPatch,
) {
  return conversations
    .map((conversation) =>
      conversation.id === patch.id
        ? {
            ...conversation,
            lastMessageAt: patch.lastMessageAt,
            lastSenderUserId: patch.lastSenderUserId,
            preview: patch.preview,
            providerLastReadAt: patch.providerLastReadAt,
            senderLastReadAt: patch.senderLastReadAt,
            status: patch.status,
            unread: patch.unread,
            updatedAt: patch.updatedAt,
          }
        : conversation,
    )
    .sort(
      (first, second) =>
        getConversationTime(second.lastMessageAt) -
        getConversationTime(first.lastMessageAt),
    );
}

function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: ConversationSummary;
  isSelected: boolean;
  onSelect: (conversationId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={isSelected ? "true" : undefined}
      className={`w-full rounded-md border px-4 py-3 text-left transition ${
        isSelected
          ? "border-stone-950 bg-stone-50"
          : conversation.unread
          ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-600"
          : "border-stone-200 bg-white hover:border-stone-400"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          avatarUrl={conversation.participant.avatarUrl}
          name={conversation.participant.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`truncate text-sm ${
                  conversation.unread
                    ? "font-bold text-stone-950"
                    : "font-semibold text-stone-900"
                }`}
              >
                {conversation.participant.name}
              </p>
              {conversation.participant.subtitle ? (
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {conversation.participant.subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {conversation.unread ? (
                <span
                  className="size-2.5 rounded-full bg-emerald-600"
                  aria-label="Unread"
                />
              ) : null}
              <span className="text-xs font-medium text-stone-500">
                {formatDateTime(conversation.lastMessageAt)}
              </span>
            </div>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-stone-950">
            {conversation.subject}
          </p>
          {conversation.requestCount > 1 ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {conversation.requestCount} inquiries merged
            </p>
          ) : null}
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600">
            {getMessagePreview(conversation.preview)}
          </p>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  return (
    <div
      className={`flex gap-3 ${
        message.isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {!message.isOwn ? (
        <Avatar
          avatarUrl={message.senderAvatarUrl}
          name={message.senderName}
        />
      ) : null}
      <div
        className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 ${
          message.isOwn
            ? "rounded-br-md bg-emerald-700 text-white"
            : "rounded-bl-md border border-stone-200 bg-white text-stone-800"
        }`}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p
            className={`text-xs font-semibold ${
              message.isOwn ? "text-emerald-50" : "text-stone-600"
            }`}
          >
            {message.senderName}
          </p>
          <p
            className={`text-xs ${
              message.isOwn ? "text-emerald-50/80" : "text-stone-500"
            }`}
          >
            {formatFullDateTime(message.createdAt)}
          </p>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
          {message.body}
        </p>
      </div>
    </div>
  );
}

export function ConversationCenter({ copy, data }: ConversationCenterProps) {
  const text = { ...defaultCopy[data.mode], ...copy };
  const sectionId = data.mode === "provider" ? "inquiries" : "sent-messages";
  const queryParam = data.mode === "provider" ? "inquiry" : "message";
  const openedConversationIds = useRef(new Set<string>());
  const optimisticMessageCounter = useRef(0);
  const [conversations, setConversations] = useState(data.conversations);
  const [selectedConversationId, setSelectedConversationId] = useState(
    data.selectedConversationId,
  );
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ConversationMessage[]>
  >(() =>
    data.selectedConversationId
      ? { [data.selectedConversationId]: data.selectedMessages }
      : {},
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [loadingConversationId, setLoadingConversationId] = useState<
    string | null
  >(null);
  const [pendingSend, setPendingSend] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<
    "rejected" | "archived" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    data.errorMessage,
  );

  const updateConversationUrl = useCallback(
    (conversationId: string) => {
      if (typeof window === "undefined") {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      params.set(queryParam, conversationId);
      const query = params.toString();

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}#${sectionId}`,
      );
    },
    [queryParam, sectionId],
  );

  const handleConversationPatch = useCallback((patch: ConversationPatch) => {
    setConversations((current) => applyConversationPatch(current, patch));
  }, []);

  const handleOpenConversation = useCallback(
    async (conversationId: string, replaceUrl = true) => {
      setSelectedConversationId(conversationId);
      setErrorMessage(null);

      if (replaceUrl) {
        updateConversationUrl(conversationId);
      }

      const cachedMessages = messagesByConversation[conversationId];

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unread: false }
            : conversation,
        ),
      );

      if (!cachedMessages) {
        setLoadingConversationId(conversationId);
      }

      const result = await openConversationAction({
        conversationId,
        mode: data.mode,
      });

      setLoadingConversationId((current) =>
        current === conversationId ? null : current,
      );

      if (result.status === "error" || !result.messages || !result.patch) {
        setErrorMessage(result.message);
        return;
      }

      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: result.messages ?? [],
      }));
      handleConversationPatch(result.patch);
    },
    [
      data.mode,
      handleConversationPatch,
      messagesByConversation,
      updateConversationUrl,
    ],
  );

  useEffect(() => {
    if (
      !selectedConversationId ||
      openedConversationIds.current.has(selectedConversationId)
    ) {
      return;
    }

    openedConversationIds.current.add(selectedConversationId);
    void handleOpenConversation(selectedConversationId, false);
  }, [handleOpenConversation, selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (showUnreadOnly && !conversation.unread) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return getSearchableText(conversation).includes(normalizedSearch);
    });
  }, [conversations, searchTerm, showUnreadOnly]);

  const selectedConversation =
    conversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? null;
  const selectedMessages = selectedConversationId
    ? messagesByConversation[selectedConversationId] ?? []
    : [];
  const unreadCount = conversations.filter(
    (conversation) => conversation.unread,
  ).length;
  const hasLoadedAll = data.total <= data.limit;

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversation) {
      return;
    }

    const body = messageBody.trim();

    if (!body) {
      setErrorMessage("Write a message before sending.");
      return;
    }

    if (body.length > 2000) {
      setErrorMessage("Messages must be 2,000 characters or fewer.");
      return;
    }

    optimisticMessageCounter.current += 1;

    const optimisticMessage: ConversationMessage = {
      id: `pending-${optimisticMessageCounter.current}`,
      body,
      contactRequestId: selectedConversation.id,
      createdAt: new Date().toISOString(),
      isOwn: true,
      senderAvatarUrl: data.viewer.avatarUrl,
      senderEmail: data.viewer.email,
      senderName: data.viewer.name,
      senderUserId: data.viewer.id,
    };

    setPendingSend(true);
    setErrorMessage(null);
    setMessageBody("");
    setMessagesByConversation((current) => ({
      ...current,
      [selectedConversation.id]: [
        ...(current[selectedConversation.id] ?? []),
        optimisticMessage,
      ],
    }));
    setConversations((current) =>
      applyConversationPatch(current, {
        id: selectedConversation.id,
        lastMessageAt: optimisticMessage.createdAt,
        lastSenderUserId: data.viewer.id,
        preview: body,
        providerLastReadAt: selectedConversation.providerLastReadAt,
        senderLastReadAt: selectedConversation.senderLastReadAt,
        status:
          data.mode === "provider" ? "responded" : selectedConversation.status,
        unread: false,
        updatedAt: optimisticMessage.createdAt,
      }),
    );

    const result = await sendConversationMessage({
      body,
      conversationId: selectedConversation.id,
      mode: data.mode,
    });

    setPendingSend(false);

    if (result.status === "error" || !result.messages || !result.patch) {
      setErrorMessage(result.message);
      setMessagesByConversation((current) => ({
        ...current,
        [selectedConversation.id]: (current[selectedConversation.id] ?? []).filter(
          (message) => message.id !== optimisticMessage.id,
        ),
      }));
      setMessageBody(body);
      return;
    }

    setMessagesByConversation((current) => ({
      ...current,
      [selectedConversation.id]: result.messages ?? [],
    }));
    handleConversationPatch(result.patch);
  }

  async function handleStatusUpdate(status: "rejected" | "archived") {
    if (!selectedConversation) {
      return;
    }

    if (
      status === "archived" &&
      !window.confirm("Move this conversation to Deleted?")
    ) {
      return;
    }

    setPendingStatus(status);
    setErrorMessage(null);

    const result = await updateConversationStatus({
      conversationId: selectedConversation.id,
      mode: data.mode,
      note: status === "rejected" ? rejectionNote : undefined,
      status,
    });

    setPendingStatus(null);

    if (result.status === "error" || !result.messages || !result.patch) {
      setErrorMessage(result.message);
      return;
    }

    setRejectionNote("");
    setMessagesByConversation((current) => ({
      ...current,
      [selectedConversation.id]: result.messages ?? [],
    }));
    handleConversationPatch(result.patch);
  }

  return (
    <article
      id={sectionId}
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            {text.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {text.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            {text.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="w-fit rounded-md bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-200">
            {conversations.length} shown
          </span>
          <span className="w-fit rounded-md bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100">
            {unreadCount} unread
          </span>
        </div>
      </div>

      {!hasLoadedAll ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Showing the latest {data.limit} of {data.total} conversations. Use
          search or unread filtering to narrow the list.
        </p>
      ) : null}

      {errorMessage ? (
        <p
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50/60">
        <div className="grid gap-3 border-b border-stone-200 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="sr-only" htmlFor={`${sectionId}-search`}>
            Search conversations
          </label>
          <input
            id={`${sectionId}-search`}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, subject, or message"
            className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
          />
          <button
            type="button"
            onClick={() => setShowUnreadOnly((current) => !current)}
            aria-pressed={showUnreadOnly}
            className={`inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold transition ${
              showUnreadOnly
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-stone-300 bg-white text-stone-800 hover:border-stone-950"
            }`}
          >
            {showUnreadOnly ? "Showing unread" : "Unread only"}
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              description={text.emptyDescription}
              title={text.emptyTitle}
            />
          </div>
        ) : (
          <div className="grid gap-0 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
            <aside className="border-b border-stone-200 bg-white p-4 xl:border-b-0 xl:border-r">
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 xl:max-h-[44rem]">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={conversation.id === selectedConversationId}
                      onSelect={handleOpenConversation}
                    />
                  ))
                ) : (
                  <EmptyState
                    description="Try a different search term or turn off the unread filter."
                    title="No conversations match"
                  />
                )}
              </div>
            </aside>

            <section className="min-w-0 bg-white p-4">
              {selectedConversation ? (
                <div className="flex min-h-[32rem] flex-col">
                  <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar
                        avatarUrl={selectedConversation.participant.avatarUrl}
                        name={selectedConversation.participant.name}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-stone-950">
                            {selectedConversation.participant.name}
                          </h3>
                          {selectedConversation.unread ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              Unread
                            </span>
                          ) : null}
                        </div>
                        {selectedConversation.participant.subtitle ? (
                          <p className="mt-1 break-words text-sm text-stone-600">
                            {selectedConversation.participant.subtitle}
                          </p>
                        ) : null}
                        <p className="mt-2 break-words text-base font-semibold text-stone-950">
                          {selectedConversation.subject}
                        </p>
                        {selectedConversation.requestCount > 1 ? (
                          <p className="mt-1 w-fit rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100">
                            {selectedConversation.requestCount} inquiries merged
                            into this board
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Last activity{" "}
                          {formatFullDateTime(
                            selectedConversation.lastMessageAt,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <StatusBadge status={selectedConversation.status} />
                      <EmailDeliveryBadge
                        conversation={selectedConversation}
                      />
                      <span className="w-fit rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700">
                        {
                          contactDeliveryMethodLabels[
                            selectedConversation.deliveryMethod
                          ]
                        }
                      </span>
                    </div>
                  </div>

                  {selectedConversation.emailDeliveryStatus === "failed" ? (
                    <p
                      className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                      role="status"
                    >
                      {selectedConversation.emailDeliveryError ??
                        "Email delivery failed. The conversation is still saved in MyRealHub."}
                    </p>
                  ) : null}

                  {data.mode === "provider" &&
                  selectedConversation.senderContact ? (
                    <dl className="mt-4 grid gap-3 rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Sender email
                        </dt>
                        <dd className="mt-1 break-words font-medium text-stone-900">
                          {selectedConversation.senderContact.email}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Phone
                        </dt>
                        <dd className="mt-1 break-words font-medium text-stone-900">
                          {selectedConversation.senderContact.phone ??
                            "Not provided"}
                        </dd>
                      </div>
                    </dl>
                  ) : null}

                  {selectedConversation.participant.href ? (
                    <Link
                      href={selectedConversation.participant.href}
                      className="mt-4 w-fit rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
                    >
                      View provider profile
                    </Link>
                  ) : null}

                  <div className="mt-5 min-h-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 p-4">
                    {loadingConversationId === selectedConversation.id ? (
                      <div className="flex min-h-64 items-center justify-center text-sm font-medium text-stone-600">
                        Loading conversation...
                      </div>
                    ) : selectedMessages.length > 0 ? (
                      <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-1">
                        {selectedMessages.map((message) => (
                          <MessageBubble key={message.id} message={message} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        description="This thread is ready, but no messages were found."
                        title="No messages in this conversation"
                      />
                    )}
                  </div>

                  {selectedConversation.status === "archived" ? (
                    <p className="mt-4 rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                      This conversation is in Deleted and cannot receive new
                      messages.
                    </p>
                  ) : (
                    <form
                      onSubmit={handleSendMessage}
                      className="mt-4 grid gap-3"
                    >
                      <label
                        htmlFor={`${sectionId}-reply`}
                        className="text-sm font-semibold text-stone-950"
                      >
                        Reply
                      </label>
                      <textarea
                        id={`${sectionId}-reply`}
                        value={messageBody}
                        onChange={(event) =>
                          setMessageBody(event.target.value.slice(0, 2000))
                        }
                        maxLength={2000}
                        placeholder="Write a clear, helpful reply..."
                        className="min-h-28 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-medium text-stone-500">
                          {messageBody.length}/2,000 characters
                        </p>
                        <button
                          type="submit"
                          disabled={pendingSend}
                          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingSend ? "Sending..." : "Send message"}
                        </button>
                      </div>
                    </form>
                  )}

                  {data.mode === "provider" &&
                  selectedConversation.status !== "archived" ? (
                    <details className="mt-5 rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                        More inquiry actions
                      </summary>
                      <div className="mt-4 grid gap-3">
                        <label
                          htmlFor={`${sectionId}-reject-note`}
                          className="text-sm font-semibold text-stone-950"
                        >
                          Optional rejection note
                        </label>
                        <textarea
                          id={`${sectionId}-reject-note`}
                          value={rejectionNote}
                          onChange={(event) =>
                            setRejectionNote(
                              event.target.value.slice(0, 2000),
                            )
                          }
                          maxLength={2000}
                          placeholder="Add a short note if you are declining this inquiry."
                          className="min-h-24 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-red-600 focus:ring-4 focus:ring-red-100"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleStatusUpdate("rejected")}
                            disabled={Boolean(pendingStatus)}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-red-300 px-4 text-sm font-semibold text-red-700 transition hover:border-red-700 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingStatus === "rejected"
                              ? "Rejecting..."
                              : "Reject inquiry"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleStatusUpdate("archived")}
                            disabled={Boolean(pendingStatus)}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingStatus === "archived"
                              ? "Deleting..."
                              : "Delete conversation"}
                          </button>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  description="Choose a conversation from the list to read messages and reply."
                  title="Select a conversation"
                />
              )}
            </section>
          </div>
        )}
      </div>
    </article>
  );
}
