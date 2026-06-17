import Link from "next/link";
import { SavedProviderCard } from "@/components/providers/saved-provider-card";
import { requireProfileRole } from "@/lib/auth/session";
import { getSavedProviderData } from "@/lib/saved-providers";

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

export default async function UserDashboardPage() {
  const profile = await requireProfileRole("user");
  const savedProviderData = await getSavedProviderData(profile.id);
  const displayName = profile.fullName ?? profile.email ?? "MyRealHub user";
  const previewSavedProviders = savedProviderData.savedProviders.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            User
          </p>
          <nav
            aria-label="User dashboard navigation"
            className="mt-3 grid gap-1 text-sm font-medium"
          >
            {[
              { href: "#overview", label: "Overview" },
              { href: "#saved-providers", label: "Saved providers" },
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
              User dashboard
            </p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-stone-950">
                  Welcome, {displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  Keep track of providers you want to revisit and manage basic
                  account details from one place.
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

          <div className="grid gap-4 md:grid-cols-3">
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
              <p className="mt-3 text-3xl font-semibold">User</p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Service seeker account.
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
