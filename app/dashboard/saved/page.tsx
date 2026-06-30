import Link from "next/link";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileCapability } from "@/lib/auth/session";
import { getSavedProviderData } from "@/lib/saved-providers";

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

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-950"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Saved providers
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-950">
            Your provider shortlist
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
            Review active providers you have saved and remove any you no longer
            need.
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Search providers
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Visible saves</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">
            {savedProviderData.savedProviders.length}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Active providers currently shown below.
          </p>
        </article>
        <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Hidden saves</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">
            {savedProviderData.unavailableCount}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Saved providers that are no longer publicly active.
          </p>
        </article>
        <article className="rounded-lg border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-stone-300">Total saved</p>
          <p className="mt-3 text-3xl font-semibold">
            {savedProviderData.totalSaved}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            All saved-provider records on your account.
          </p>
        </article>
      </div>

      {savedProviderData.errorMessage ? (
        <p
          className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          role="status"
        >
          {savedProviderData.errorMessage}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
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
  );
}
