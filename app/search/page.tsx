import Link from "next/link";
import { ProviderPreviewCard } from "@/components/providers/provider-preview-card";
import { featuredProviders, serviceCategories } from "@/lib/service-directory";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ServiceCategoryRow = {
  name: string;
};

async function getActiveServiceCategories() {
  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return serviceCategories;
    }

    return ((data ?? []) as ServiceCategoryRow[]).map((category) => category.name);
  } catch {
    return serviceCategories;
  }
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const activeServiceCategories = await getActiveServiceCategories();
  const selectedService =
    typeof params.service === "string" ? params.service : "All services";

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Search
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Find real estate service providers
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Start with a service category and location. Search results will connect
          to Supabase provider data in a later task.
        </p>
      </div>

      <form className="mt-8 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 lg:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          Service
          <select
            name="service"
            defaultValue={selectedService}
            className="h-12 rounded-md border border-stone-200 bg-white px-3 text-base text-stone-950 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
          >
            <option>All services</option>
            {activeServiceCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          Location
          <input
            name="location"
            type="search"
            placeholder="City or region"
            className="h-12 rounded-md border border-stone-200 bg-white px-3 text-base text-stone-950 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <button
          type="submit"
          className="h-12 self-end rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Search
        </button>
      </form>

      <div className="mt-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">Showing preview for</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">
            {selectedService}
          </h2>
        </div>
        <Link
          href="/signup?role=provider"
          className="hidden rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 sm:inline-flex"
        >
          Join as Provider
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {featuredProviders.map((provider) => (
          <ProviderPreviewCard key={provider.name} provider={provider} />
        ))}
      </div>
    </section>
  );
}
