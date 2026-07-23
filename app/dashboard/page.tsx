import Link from "next/link";
import { ConversationCenter } from "@/components/messages/conversation-center";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileCapability } from "@/lib/auth/session";
import { getQueryValue } from "@/lib/contact-requests";
import { getConsumerConversationCenterData } from "@/lib/messages";
import { getSavedProviderData } from "@/lib/saved-providers";

type UserDashboardPageProps = {
  searchParams: Promise<UserDashboardSearchParams>;
};

type UserDashboardSearchParams = {
  message?: string | string[];
};

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

export default async function UserDashboardPage({
  searchParams,
}: UserDashboardPageProps) {
  const query = await searchParams;
  const selectedConversationId = getQueryValue(query.message) ?? null;
  const profile = await requireProfileCapability("consume_services");
  const [savedProviderData, conversationData] = await Promise.all([
    getSavedProviderData(profile.id),
    getConsumerConversationCenterData({
      profile,
      selectedConversationId,
    }),
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
              { href: "#sent-messages", label: "Messages" },
              { href: "/settings", label: "Settings" },
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
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                  Search providers
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
                >
                  Settings
                </Link>
              </div>
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
                Conversations
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {conversationData.total}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Provider conversations in your message history.
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">Unread</p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {conversationData.unreadCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Conversations with new provider activity.
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

          <ConversationCenter data={conversationData} />
        </div>
      </div>
    </section>
  );
}
