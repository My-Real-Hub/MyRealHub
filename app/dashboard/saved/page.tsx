import Link from "next/link";
import {
  ConsumerMetric,
  ConsumerWorkspace,
  ConsumerWorkspaceHeader,
  EmptySavedProviders,
  SavedProviderNotice,
  consumerPrimaryButton,
  consumerSecondaryButton,
} from "@/components/dashboard/consumer-workspace";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileCapability } from "@/lib/auth/session";
import { getSavedProviderData } from "@/lib/saved-providers";

export default async function SavedProvidersPage() {
  const profile = await requireProfileCapability("consume_services");
  const savedProviderData = await getSavedProviderData(profile.id);
  const displayName = profile.fullName ?? profile.email ?? "Your account";
  const hasError = Boolean(savedProviderData.errorMessage);

  return (
    <ConsumerWorkspace
      displayName={displayName}
      email={profile.email}
      isProvider={profile.role === "provider"}
      page="saved"
    >
      <ConsumerWorkspaceHeader
        title="Saved providers"
        description="Your shortlist of services, ready to revisit."
        actions={
          <>
            <Link href="/dashboard" className={consumerSecondaryButton}>
              <ProviderDashboardIcon
                name="arrow"
                className="size-[18px] rotate-180"
              />
              Overview
            </Link>
            <Link href="/search" className={consumerPrimaryButton}>
              <ProviderDashboardIcon name="search" className="size-[18px]" />
              Find providers
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <ConsumerMetric
          href="#saved-providers"
          icon="bookmark"
          label="Available providers"
          value={hasError ? "—" : savedProviderData.savedProviders.length}
          description="Public profiles you can revisit."
          accent
        />
        <ConsumerMetric
          href="#saved-providers"
          icon="listing"
          label="Currently unavailable"
          value={hasError ? "—" : savedProviderData.unavailableCount}
          description="Saved profiles no longer in the directory."
        />
        <ConsumerMetric
          href="#saved-providers"
          icon="overview"
          label="Total saved"
          value={hasError ? "—" : savedProviderData.totalSaved}
          description="All providers saved to your account."
        />
      </div>
      <section id="saved-providers" className="consumer-dashboard-section">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">
              Your shortlist
            </h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Open a profile to learn more, or remove a provider from your
              saves.
            </p>
          </div>
          {!hasError ? (
            <span className="w-fit shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
              {savedProviderData.savedProviders.length} available
            </span>
          ) : null}
        </div>
        <SavedProviderNotice data={savedProviderData} />
        {!hasError ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {savedProviderData.savedProviders.length > 0 ? (
              savedProviderData.savedProviders.map((savedProvider) => (
                <SavedProviderCard
                  key={savedProvider.id}
                  returnPath="/dashboard/saved"
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
