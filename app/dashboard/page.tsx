import Link from "next/link";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileCapability } from "@/lib/auth/session";
import {
  CONTACT_REQUESTS_PER_PAGE,
  contactRequestStatusClassNames,
  contactRequestStatusFilters,
  contactRequestStatusLabels,
  getContactRequestStatusFilter,
  getPaginationItems,
  getPositivePage,
  getQueryValue,
  type ContactRequestStatus,
  type ContactRequestStatusFilter,
} from "@/lib/contact-requests";
import { getSavedProviderData } from "@/lib/saved-providers";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type UserDashboardPageProps = {
  searchParams: Promise<UserDashboardSearchParams>;
};

type UserDashboardSearchParams = {
  messagePage?: string | string[];
  messageStatus?: string | string[];
};

type SentContactRequestRow = {
  id: string;
  provider_profile_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  provider_response: string | null;
  status: ContactRequestStatus;
  read_at: string | null;
  responded_at: string | null;
  rejected_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type SentContactProviderRow = {
  id: string;
  slug: string;
  business_name: string | null;
  display_name: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
};

type SentContactRequest = SentContactRequestRow & {
  provider: SentContactProviderRow | null;
};

type SentContactRequestPageData = {
  rows: SentContactRequest[];
  total: number;
  page: number;
  totalPages: number;
  statusFilter: ContactRequestStatusFilter;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const sentContactRequestColumns = [
  "id",
  "provider_profile_id",
  "sender_name",
  "sender_email",
  "sender_phone",
  "message",
  "provider_response",
  "status",
  "read_at",
  "responded_at",
  "rejected_at",
  "archived_at",
  "created_at",
  "updated_at",
].join(",");

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return dateFormatter.format(new Date(value));
}

function getProviderName(provider: SentContactProviderRow | null) {
  return provider?.business_name ?? provider?.display_name ?? "Provider profile";
}

function getProviderLocation(provider: SentContactProviderRow | null) {
  const parts = [
    provider?.city,
    provider?.province_state,
    provider?.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not available";
}

function getSentMessagesHref({
  page = 1,
  statusFilter = "all",
}: {
  page?: number;
  statusFilter?: ContactRequestStatusFilter;
}) {
  const params = new URLSearchParams();

  if (statusFilter !== "all") {
    params.set("messageStatus", statusFilter);
  }

  if (page > 1) {
    params.set("messagePage", String(page));
  }

  const queryString = params.toString();

  return `/dashboard${queryString ? `?${queryString}` : ""}#sent-messages`;
}

function EmptySavedProviders() {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-stone-950">
        No saved providers yet
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
        Save providers from search results or public provider profiles to build
        a shortlist here.
      </p>
      <Link
        href="/search"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        Search providers
      </Link>
    </div>
  );
}

async function getSentContactRequestPageData({
  requestedPage,
  statusFilter,
  userId,
}: {
  requestedPage: number;
  statusFilter: ContactRequestStatusFilter;
  userId: string;
}): Promise<SentContactRequestPageData> {
  const supabase = await getServerSupabaseClient();
  let countQuery = supabase
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", userId);

  if (statusFilter !== "all") {
    countQuery = countQuery.eq("status", statusFilter);
  }

  const { count } = await countQuery;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CONTACT_REQUESTS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const rangeStart = (page - 1) * CONTACT_REQUESTS_PER_PAGE;
  const rangeEnd = rangeStart + CONTACT_REQUESTS_PER_PAGE - 1;
  let requestQuery = supabase
    .from("contact_requests")
    .select(sentContactRequestColumns)
    .eq("sender_user_id", userId)
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (statusFilter !== "all") {
    requestQuery = requestQuery.eq("status", statusFilter);
  }

  const { data } = await requestQuery;
  const rows = (data ?? []) as unknown as SentContactRequestRow[];
  const providerIds = Array.from(
    new Set(rows.map((row) => row.provider_profile_id)),
  );
  const { data: providers } =
    providerIds.length > 0
      ? await supabase
          .from("provider_profiles")
          .select("id,slug,business_name,display_name,city,province_state,country")
          .in("id", providerIds)
      : { data: [] };
  const providerMap = new Map(
    ((providers ?? []) as SentContactProviderRow[]).map((provider) => [
      provider.id,
      provider,
    ]),
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      provider: providerMap.get(row.provider_profile_id) ?? null,
    })),
    total,
    page,
    totalPages,
    statusFilter,
  };
}

async function getSentContactRequestTotal(userId: string) {
  const supabase = await getServerSupabaseClient();
  const { count } = await supabase
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", userId);

  return count ?? 0;
}

function SentMessageStatusBadge({ status }: { status: ContactRequestStatus }) {
  return (
    <span
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${contactRequestStatusClassNames[status]}`}
    >
      {contactRequestStatusLabels[status]}
    </span>
  );
}

function SentMessageFilters({
  selectedStatus,
}: {
  selectedStatus: ContactRequestStatusFilter;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Sent message filters">
      {contactRequestStatusFilters.map((option) => {
        const isSelected = option.value === selectedStatus;

        return (
          <Link
            key={option.value}
            href={getSentMessagesHref({
              page: 1,
              statusFilter: option.value,
            })}
            aria-current={isSelected ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition ${
              isSelected
                ? "border-stone-950 bg-stone-950 text-white"
                : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function SentMessagePagination({
  sentMessages,
}: {
  sentMessages: SentContactRequestPageData;
}) {
  if (sentMessages.totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(1, sentMessages.page - 1);
  const nextPage = Math.min(sentMessages.totalPages, sentMessages.page + 1);

  return (
    <nav
      className="mt-5 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Sent message pagination"
    >
      <Link
        href={getSentMessagesHref({
          page: previousPage,
          statusFilter: sentMessages.statusFilter,
        })}
        aria-disabled={sentMessages.page === 1}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          sentMessages.page === 1 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Previous
      </Link>

      <div className="flex flex-wrap gap-2">
        {getPaginationItems(sentMessages.page, sentMessages.totalPages).map(
          (pageNumber) => {
            if (typeof pageNumber !== "number") {
              return (
                <span
                  key={pageNumber}
                  className="inline-flex size-9 items-center justify-center text-xs font-semibold text-stone-400"
                >
                  ...
                </span>
              );
            }

            const isCurrent = pageNumber === sentMessages.page;

            return (
              <Link
                key={pageNumber}
                href={getSentMessagesHref({
                  page: pageNumber,
                  statusFilter: sentMessages.statusFilter,
                })}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex size-9 items-center justify-center rounded-md border text-xs font-semibold transition ${
                  isCurrent
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
                }`}
              >
                {pageNumber}
              </Link>
            );
          },
        )}
      </div>

      <Link
        href={getSentMessagesHref({
          page: nextPage,
          statusFilter: sentMessages.statusFilter,
        })}
        aria-disabled={sentMessages.page === sentMessages.totalPages}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          sentMessages.page === sentMessages.totalPages
            ? "pointer-events-none opacity-50"
            : ""
        }`}
      >
        Next
      </Link>
    </nav>
  );
}

function SentMessagesSection({
  sentMessages,
}: {
  sentMessages: SentContactRequestPageData;
}) {
  return (
    <article
      id="sent-messages"
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Sent messages
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Contact requests you sent
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Track whether providers have read, responded to, rejected, or deleted
            your requests.
          </p>
        </div>
        <SentMessageFilters selectedStatus={sentMessages.statusFilter} />
      </div>

      <div className="mt-6 grid gap-4">
        {sentMessages.rows.length > 0 ? (
          sentMessages.rows.map((request) => (
            <div
              key={request.id}
              className="rounded-md border border-stone-200 px-4 py-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-950">
                    {getProviderName(request.provider)}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {getProviderLocation(request.provider)}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                    Sent {formatDate(request.created_at)}
                  </p>
                </div>
                <SentMessageStatusBadge status={request.status} />
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {request.message}
              </p>

              {request.provider_response ? (
                <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-sm font-semibold text-stone-950">
                    Provider response
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                    {request.provider_response}
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-3 text-sm leading-6 text-stone-600">
                  No provider response yet.
                </p>
              )}

              {request.provider?.slug ? (
                <Link
                  href={`/providers/${request.provider.slug}`}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
                >
                  View provider
                </Link>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-stone-950">
              No sent messages found
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Messages you send from provider profiles will appear here.
            </p>
          </div>
        )}
      </div>

      <SentMessagePagination sentMessages={sentMessages} />
    </article>
  );
}

export default async function UserDashboardPage({
  searchParams,
}: UserDashboardPageProps) {
  const query = await searchParams;
  const sentMessageStatusFilter = getContactRequestStatusFilter(
    getQueryValue(query.messageStatus),
  );
  const requestedSentMessagePage = getPositivePage(
    getQueryValue(query.messagePage),
  );
  const profile = await requireProfileCapability("consume_services");
  const [savedProviderData, sentMessages, sentMessageTotal] = await Promise.all([
    getSavedProviderData(profile.id),
    getSentContactRequestPageData({
      requestedPage: requestedSentMessagePage,
      statusFilter: sentMessageStatusFilter,
      userId: profile.id,
    }),
    getSentContactRequestTotal(profile.id),
  ]);
  const displayName = profile.fullName ?? profile.email ?? "MyRealHub user";
  const isProvider = profile.role === "provider";
  const previewSavedProviders = savedProviderData.savedProviders.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {isProvider ? "Consumer tools" : "User"}
          </p>
          <nav
            aria-label="Consumer dashboard navigation"
            className="mt-3 grid gap-1 text-sm font-medium"
          >
            {[
              { href: "#overview", label: "Overview" },
              { href: "#saved-providers", label: "Saved providers" },
              { href: "#sent-messages", label: "Sent messages" },
              { href: "#account-settings", label: "Account settings" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-5 border-t border-stone-200 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Signed in
            </p>
            <p className="mt-2 break-words text-sm font-medium text-stone-950">
              {profile.email ?? displayName}
            </p>
          </div>
        </aside>

        <div className="grid gap-6">
          <header id="overview" className="scroll-mt-28">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              {isProvider ? "Consumer dashboard" : "User dashboard"}
            </p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-stone-950">
                  Welcome, {displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  Keep track of providers you want to revisit and manage
                  service-seeker activity from one place.
                </p>
              </div>
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                Search providers
              </Link>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-4">
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">
                Saved providers
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {savedProviderData.savedProviders.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Active saved providers available to view.
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">
                Sent messages
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {sentMessageTotal}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Contact requests sent to providers.
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">
                Hidden saved items
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {savedProviderData.unavailableCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Saved providers that are no longer publicly active.
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
              <p className="text-sm font-medium text-stone-300">
                Account type
              </p>
              <p className="mt-3 text-3xl font-semibold">
                {isProvider ? "Provider" : "User"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                {isProvider
                  ? "Provider account with consumer access."
                  : "Service seeker account."}
              </p>
            </article>
          </div>

          <article
            id="saved-providers"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-stone-50 p-6 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Saved providers
                </p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">
                  Providers you have starred
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="w-fit rounded-md bg-white px-3 py-1 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-200">
                  {savedProviderData.totalSaved} total saved
                </span>
                <Link
                  href="/dashboard/saved"
                  className="w-fit rounded-md bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100 transition hover:bg-emerald-50"
                >
                  View all
                </Link>
              </div>
            </div>

            {savedProviderData.errorMessage ? (
              <p
                className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                role="status"
              >
                {savedProviderData.errorMessage}
              </p>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {previewSavedProviders.length > 0 ? (
                previewSavedProviders.map((savedProvider) => (
                  <SavedProviderCard
                    key={savedProvider.id}
                    returnPath="/dashboard"
                    savedProvider={savedProvider}
                  />
                ))
              ) : (
                <div className="lg:col-span-2">
                  <EmptySavedProviders />
                </div>
              )}
            </div>
          </article>

          <SentMessagesSection sentMessages={sentMessages} />

          <article
            id="account-settings"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Account settings
                </p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">
                  Profile and preferences
                </h2>
              </div>
              <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                Placeholder
              </span>
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-stone-200 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Name
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-stone-950">
                  {profile.fullName ?? "Not added"}
                </dd>
              </div>
              <div className="rounded-md border border-stone-200 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Email
                </dt>
                <dd className="mt-2 break-words text-sm font-semibold text-stone-950">
                  {profile.email ?? "Not added"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 rounded-md border border-dashed border-stone-300 px-4 py-5">
              <p className="text-sm font-semibold text-stone-950">
                Account editing is coming later.
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                This area will hold account details, notification preferences,
                and saved-provider settings in a future ticket.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
