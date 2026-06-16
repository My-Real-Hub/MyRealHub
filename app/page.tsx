import Link from "next/link";
import { ProviderPreviewCard } from "@/components/providers/provider-preview-card";
import { featuredProviders, serviceCategories } from "@/lib/service-directory";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type HomepageCategoryRow = {
  id: string;
  name: string;
};

function getFallbackCategories() {
  return serviceCategories.map((category) => ({
    name: category,
    value: category,
  }));
}

async function getHomepageData() {
  try {
    const supabase = await getServerSupabaseClient();
    const [categoriesResult, providersResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id,name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("provider_profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);
    const fallbackCategories = getFallbackCategories();
    const categories =
      categoriesResult.error ||
      !categoriesResult.data ||
      categoriesResult.data.length === 0
        ? fallbackCategories
        : (categoriesResult.data as HomepageCategoryRow[]).map((category) => ({
            name: category.name,
            value: category.id,
          }));

    return {
      activeProviderCount: providersResult.count ?? featuredProviders.length,
      categories,
    };
  } catch {
    return {
      activeProviderCount: featuredProviders.length,
      categories: getFallbackCategories(),
    };
  }
}

export default async function Home() {
  const { activeProviderCount, categories: homepageCategories } =
    await getHomepageData();

  return (
    <>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Real estate services directory
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
              Find trusted real estate pros for every step of the move.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              Search agents, mortgage brokers, inspectors, lawyers, appraisers,
              contractors, photographers, stagers, and property managers in one
              focused place.
            </p>

            <form
              action="/search"
              method="get"
              className="mt-8 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 lg:grid-cols-[1fr_1fr_auto]"
            >
              <label htmlFor="homepage-category" className="sr-only">
                Service category
              </label>
              <select
                id="homepage-category"
                name="category"
                className="h-12 min-w-0 rounded-md border border-stone-200 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">All service categories</option>
                {homepageCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.name}
                  </option>
                ))}
              </select>

              <label htmlFor="homepage-location" className="sr-only">
                Location
              </label>
              <input
                id="homepage-location"
                name="location"
                type="search"
                placeholder="City, province, or service area"
                className="h-12 min-w-0 rounded-md border border-stone-200 bg-white px-4 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
              />

              <button
                type="submit"
                className="h-12 rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                Search
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-950 p-6 text-white shadow-sm">
            <p className="text-sm font-medium text-amber-200">Directory snapshot</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-white/10 p-4">
                <p className="text-2xl font-semibold">
                  {homepageCategories.length}
                </p>
                <p className="mt-1 text-stone-300">Service categories</p>
              </div>
              <div className="rounded-md bg-white/10 p-4">
                <p className="text-2xl font-semibold">{activeProviderCount}</p>
                <p className="mt-1 text-stone-300">Active providers</p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-6 text-stone-300">
              Compare service categories, locations, and provider summaries
              from a focused real estate services directory.
            </p>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Browse services
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">
              Real estate help, organized by need
            </h2>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {homepageCategories.map((category) => (
            <Link
              key={category.value}
              href={`/search?category=${encodeURIComponent(category.value)}`}
              className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section id="providers" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Provider preview
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950">
            A simple public directory surface
          </h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {featuredProviders.map((provider) => (
            <ProviderPreviewCard key={provider.name} provider={provider} />
          ))}
        </div>
      </section>

      <section id="join" className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Service providers
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">
              Join the provider directory.
            </h2>
          </div>
          <Link
            href="/signup?role=provider"
            className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
          >
            Join as Provider
          </Link>
        </div>
      </section>
    </>
  );
}
