import Link from "next/link";
import {
  DashboardHeader,
  DashboardShell,
  DashboardStatCard,
} from "@/components/dashboard/dashboard-shell";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileCapability } from "@/lib/auth/session";
import { getSavedProviderData } from "@/lib/saved-providers";

const savedProvidersNavItems = [
  { href: "/dashboard#overview", label: "Overview", active: false },
  { href: "#saved-providers", label: "Saved providers", active: true },
  { href: "/dashboard#sent-messages", label: "Messages" },
  { href: "/settings", label: "Settings" },
];

function EmptySavedProviders() {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      <h2 className="text-xl font-semibold text-stone-950">
        No saved providers yet
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
        Save providers from search results or public provider profiles to keep
        them here for later.
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

export default async function SavedProvidersPage() {
  const profile = await requireProfileCapability("consume_services");
  const savedProviderData = await getSavedProviderData(profile.id);
  const displayName = profile.fullName ?? profile.email ?? "MyRealHub user";

  return (
    <DashboardShell
      navItems={savedProvidersNavItems}
      navLabel="Customer"
      signedInValue={profile.email ?? displayName}
    >
      <div className="grid gap-6">
        <DashboardHeader
          eyebrow="Saved providers"
          title="Your provider shortlist"
          description="Review active providers you have saved and remove any you no longer need."
          actions={
            <>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                Back to dashboard
              </Link>
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                Search providers
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <DashboardStatCard
            description="Active providers currently shown below."
            label="Visible saves"
            tone="accent"
            value={savedProviderData.savedProviders.length}
          />
          <DashboardStatCard
            description="Saved providers that are no longer public."
            label="Hidden saves"
            value={savedProviderData.unavailableCount}
          />
          <DashboardStatCard
            description="All saved-provider records on your account."
            label="Total saved"
            value={savedProviderData.totalSaved}
          />
        </div>

        {savedProviderData.errorMessage ? (
          <p
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
            role="status"
          >
            {savedProviderData.errorMessage}
          </p>
        ) : null}

        <section id="saved-providers" className="scroll-mt-28">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Providers
              </p>
              <h2 className="mt-2 text-xl font-semibold text-stone-950">
                Saved profiles
              </h2>
            </div>
            <span className="w-fit rounded-md bg-white px-3 py-1 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-200">
              {savedProviderData.savedProviders.length} visible
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
                <EmptySavedProviders />
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
