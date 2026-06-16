import Link from "next/link";
import { requireProfileRole } from "@/lib/auth/session";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type SavedProviderRow = {
  id: string;
  provider_profile_id: string;
  created_at: string;
};

type ProviderProfileRow = {
  id: string;
  slug: string;
  category_id: string | null;
  business_name: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  service_area: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type SavedProvider = SavedProviderRow & {
  provider: ProviderProfileRow;
  categoryName: string | null;
};

type SavedProviderData = {
  errorMessage: string | null;
  savedProviders: SavedProvider[];
  totalSaved: number;
  unavailableCount: number;
};

const savedProviderSelectColumns = [
  "id",
  "slug",
  "category_id",
  "business_name",
  "display_name",
  "bio",
  "city",
  "province_state",
  "country",
  "service_area",
].join(",");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getProviderName(provider: ProviderProfileRow) {
  return (
    provider.business_name ??
    provider.display_name ??
    "Provider profile"
  );
}

function getProviderLocation(provider: ProviderProfileRow) {
  const parts = [
    provider.city,
    provider.province_state,
    provider.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getCategoryName(categories: CategoryRow[], categoryId: string | null) {
  return categories.find((category) => category.id === categoryId)?.name ?? null;
}

async function getSavedProviderData(userId: string): Promise<SavedProviderData> {
  const supabase = await getServerSupabaseClient();
  const { data: savedRows, error: savedError } = await supabase
    .from("saved_providers")
    .select("id,provider_profile_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (savedError) {
    return {
      errorMessage: "Saved providers could not be loaded.",
      savedProviders: [],
      totalSaved: 0,
      unavailableCount: 0,
    };
  }

  const savedProviders = (savedRows ?? []) as SavedProviderRow[];
  const providerIds = savedProviders.map((row) => row.provider_profile_id);

  if (providerIds.length === 0) {
    return {
      errorMessage: null,
      savedProviders: [],
      totalSaved: 0,
      unavailableCount: 0,
    };
  }

  const { data: providerRows, error: providerError } = await supabase
    .from("provider_profiles")
    .select(savedProviderSelectColumns)
    .eq("status", "active")
    .in("id", providerIds);

  if (providerError) {
    return {
      errorMessage: "Saved provider details could not be loaded.",
      savedProviders: [],
      totalSaved: savedProviders.length,
      unavailableCount: savedProviders.length,
    };
  }

  const providers = (providerRows ?? []) as unknown as ProviderProfileRow[];
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const categoryIds = Array.from(
    new Set(providers.map((provider) => provider.category_id).filter(Boolean)),
  ) as string[];
  const { data: categoryRows } =
    categoryIds.length > 0
      ? await supabase
          .from("categories")
          .select("id,name")
          .in("id", categoryIds)
          .eq("is_active", true)
      : { data: [] };
  const categories = (categoryRows ?? []) as CategoryRow[];
  const visibleSavedProviders = savedProviders
    .map((savedProvider) => {
      const provider = providerMap.get(savedProvider.provider_profile_id);

      if (!provider) {
        return null;
      }

      return {
        ...savedProvider,
        categoryName: getCategoryName(categories, provider.category_id),
        provider,
      };
    })
    .filter((savedProvider): savedProvider is SavedProvider =>
      Boolean(savedProvider),
    );

  return {
    errorMessage: null,
    savedProviders: visibleSavedProviders,
    totalSaved: savedProviders.length,
    unavailableCount: savedProviders.length - visibleSavedProviders.length,
  };
}

function SavedProviderCard({ savedProvider }: { savedProvider: SavedProvider }) {
  const providerName = getProviderName(savedProvider.provider);
  const providerHref = `/providers/${savedProvider.provider.slug || savedProvider.provider.id}`;

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {savedProvider.categoryName ?? "Real estate service"}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-stone-950">
            {providerName}
          </h3>
          <p className="mt-2 text-sm font-medium text-stone-700">
            {getProviderLocation(savedProvider.provider)}
          </p>
        </div>
        <span className="w-fit rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
          Saved {formatDate(savedProvider.created_at)}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-600">
        {savedProvider.provider.bio ?? "No bio added yet."}
      </p>

      <div className="mt-5 flex flex-col gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={providerHref}
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          View profile
        </Link>
        <Link
          href="/search"
          className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
        >
          Find more
        </Link>
      </div>
    </article>
  );
}

function EmptySavedProviders() {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-stone-950">
        No saved providers yet
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
        Saved providers will appear here after the save button is connected.
        For now, use search to find providers you may want to revisit.
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
              <span className="w-fit rounded-md bg-white px-3 py-1 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-200">
                {savedProviderData.totalSaved} total saved
              </span>
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
              {savedProviderData.savedProviders.length > 0 ? (
                savedProviderData.savedProviders.map((savedProvider) => (
                  <SavedProviderCard
                    key={savedProvider.id}
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
