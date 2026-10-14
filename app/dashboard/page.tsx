import Link from "next/link";
import {
  ConsumerMetric,
  ConsumerWorkspace,
  ConsumerWorkspaceHeader,
  EmptySavedProviders,
  SavedProviderNotice,
  consumerPrimaryButton,
} from "@/components/dashboard/consumer-workspace";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import { ConversationCenter } from "@/components/messages/conversation-center";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileCapability } from "@/lib/auth/session";
import { getQueryValue } from "@/lib/contact-requests";
import { getConsumerConversationCenterData } from "@/lib/messages";
import { getSavedProviderData } from "@/lib/saved-providers";

type UserDashboardPageProps = {
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function UserDashboardPage({
  searchParams,
}: UserDashboardPageProps) {
  const query = await searchParams;
  const selectedConversationId = getQueryValue(query.message) ?? null;
  const profile = await requireProfileCapability("consume_services");
  const [savedProviderData, conversationData] = await Promise.all([
    getSavedProviderData(profile.id),
    getConsumerConversationCenterData({ profile, selectedConversationId }),
  ]);
  const displayName = profile.fullName ?? profile.email ?? "Your account";
  const previewSavedProviders = savedProviderData.savedProviders.slice(0, 4);

  return (
    <ConsumerWorkspace
      displayName={displayName}
      email={profile.email}
      isProvider={profile.role === "provider"}
    >
      <section id="overview" className="consumer-dashboard-section space-y-6">
        <ConsumerWorkspaceHeader
          title={
            profile.role === "provider" ? "Consumer tools" : "Your dashboard"
          }
          description="Catch up on provider replies and keep your shortlist close at hand."
          actions={
            <Link href="/search" className={consumerPrimaryButton}>
              <ProviderDashboardIcon name="search" className="size-[18px]" />
              Find providers
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <ConsumerMetric
            href="#sent-messages"
            icon="inquiries"
            label="Conversations"
            value={conversationData.total}
            description="Keep your provider messages together."
          />
          <ConsumerMetric
            href="#sent-messages"
            icon="mail"
            label="Unread conversations"
            accent={conversationData.unreadCount > 0}
            value={conversationData.unreadCount}
            description={
              conversationData.unreadCount > 0
                ? "New activity waiting for you."
                : "You are all caught up."
            }
          />
          <ConsumerMetric
            href="#saved-providers"
            icon="bookmark"
            label="Saved providers"
            value={
              savedProviderData.errorMessage
                ? "—"
                : savedProviderData.savedProviders.length
            }
            description="Available profiles in your shortlist."
          />
        </div>
      </section>

      <ConversationCenter
        appearance="workspace"
        copy={{
          eyebrow: "",
          title: "Your conversations",
          description: "Read provider replies and pick up where you left off.",
          emptyDescription:
            "Contact a provider from their profile to start a conversation. Your messages will appear here.",
        }}
        data={conversationData}
      />

      <section id="saved-providers" className="consumer-dashboard-section">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">
              Your saved providers
            </h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              A shortlist of services to revisit when you are ready.
            </p>
          </div>
          <Link
            href="/dashboard/saved"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            View all saved providers
            <ProviderDashboardIcon name="arrow" className="size-[18px]" />
          </Link>
        </div>
        <SavedProviderNotice data={savedProviderData} />
        {!savedProviderData.errorMessage ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                <EmptySavedProviders
                  hasUnavailable={savedProviderData.unavailableCount > 0}
                />
              </div>
            )}
          </div>
        ) : null}
      </section>
    </ConsumerWorkspace>
  );
}
