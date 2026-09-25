import Link from "next/link";
import {
  DashboardHeader,
  DashboardSection,
  DashboardShell,
  DashboardStatCard,
} from "@/components/dashboard/dashboard-shell";
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

const customerDashboardNavItems = [
  { href: "#overview", label: "Overview" },
  { href: "#saved-providers", label: "Saved providers" },
  { href: "#sent-messages", label: "Messages" },
  { href: "/settings", label: "Settings" },
];

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
  const accountType = isProvider ? "Provider" : "Customer";

  return (
    <DashboardShell
      navItems={customerDashboardNavItems}
      navLabel={isProvider ? "Customer tools" : "Customer"}
      signedInValue={profile.email ?? displayName}
    >
      <div className="grid gap-6">
        <DashboardHeader
          eyebrow="Customer dashboard"
          title={`Welcome, ${displayName}`}
          description="Keep saved providers, messages, and next steps organized from one place."
          actions={
            <>
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                Search providers
              </Link>
              <Link
                href="/settings"
                className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                Settings
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            description="Profiles ready to revisit."
            label="Saved providers"
            tone="accent"
            value={savedProviderData.savedProviders.length}
          />
          <DashboardStatCard
            description="Provider conversations in your history."
            label="Messages"
            value={conversationData.total}
          />
          <DashboardStatCard
            description="Conversations with new activity."
            label="Unread"
            tone={conversationData.unreadCount > 0 ? "info" : "light"}
            value={conversationData.unreadCount}
          />
          <DashboardStatCard
            description={
              isProvider
                ? "Provider account with customer access."
                : "Customer account."
            }
            label="Account type"
            value={accountType}
          />
        </div>

        <DashboardSection
          id="saved-providers"
          eyebrow="Saved providers"
          title="Your shortlist"
          description="Review providers you saved while searching and reopen their public profiles when you are ready."
          actions={
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
          }
        >

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
        </DashboardSection>

        <ConversationCenter data={conversationData} />
      </div>
    </DashboardShell>
  );
}
