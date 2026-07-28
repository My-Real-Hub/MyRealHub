import Link from "next/link";
import { Suspense } from "react";
import { AudienceTabs } from "@/components/home/audience-tabs";
import { ProviderRegionFilterFields } from "@/components/providers/provider-region-filter-fields";
import { featuredProviders, serviceCategories } from "@/lib/service-directory";
import type {
  CanadianSubdivisionOption,
  ServiceRegionOption,
} from "@/lib/service-regions";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type HomepageCategoryRow = {
  id: string;
  name: string;
  slug: string;
};

type HomepageProviderRow = {
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
  profile_image_url: string | null;
};

type HomepageProviderRegionRow = {
  provider_profile_id: string;
  service_region_id: string;
};

type ProviderRatingSummaryRow = {
  provider_profile_id: string;
  average_rating: number | string | null;
  rating_count: number | string;
};

type HomepageCategory = {
  href: string;
  id: string;
  name: string;
  providerCount: number;
  slug: string;
};

type PopularRegion = {
  href: string;
  id: string;
  name: string;
  providerCount: number;
  provinceCode: string;
  provinceName: string;
};

type TopRatedProvider = {
  averageRating: number;
  bio: string;
  categoryHref: string;
  categoryName: string;
  href: string;
  id: string;
  initials: string;
  location: string;
  name: string;
  ratingCount: number;
  serviceRegionNames: string[];
};

type HomepageShellData = {
  activeProviderCount: number;
  categories: HomepageCategory[];
  popularRegions: PopularRegion[];
  regions: ServiceRegionOption[];
  subdivisions: CanadianSubdivisionOption[];
};

const categoryIcons: Record<string, string> = {
  appraiser: "◇",
  cleaner: "✦",
  contractor: "▣",
  inspector: "⌕",
  lawyer: "§",
  mortgage: "$",
  photographer: "◎",
  property: "⌂",
  realtor: "⌂",
  stager: "✧",
};

const numberFormatter = new Intl.NumberFormat("en-US");
const ratingValues = [1, 2, 3, 4, 5];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function getFallbackCategories(): HomepageCategory[] {
  return serviceCategories.map((category) => ({
    href: `/search?service=${encodeURIComponent(category)}`,
    id: slugify(category),
    name: category,
    providerCount: 0,
    slug: slugify(category),
  }));
}

function getProviderName(provider: HomepageProviderRow) {
  return (
    provider.business_name ??
    provider.display_name ??
    "Provider profile"
  );
}

function getProviderLocation(provider: HomepageProviderRow) {
  const parts = [
    provider.city,
    provider.province_state,
    provider.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location available on profile";
}

function getProviderInitials(providerName: string) {
  const initials = providerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "MRH";
}

function truncateText(value: string | null, fallback: string, limit = 150) {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue.length > limit
    ? `${normalizedValue.slice(0, limit - 1).trim()}…`
    : normalizedValue;
}

function getCategoryIcon(categoryName: string) {
  const normalizedCategory = categoryName.toLowerCase();
  const iconKey = Object.keys(categoryIcons).find((key) =>
    normalizedCategory.includes(key),
  );

  return iconKey ? categoryIcons[iconKey] : "•";
}

function getCategoryHref(categoryId: string, categoryName: string) {
  return categoryId
    ? `/search?category=${encodeURIComponent(categoryId)}`
    : `/search?service=${encodeURIComponent(categoryName)}`;
}

function getRegionHref(region: ServiceRegionOption) {
  const params = new URLSearchParams({
    province: region.province_code,
    region: region.id,
  });

  return `/search?${params.toString()}#provider-search-address`;
}

function getCategoryCards(
  categories: HomepageCategoryRow[],
  providers: HomepageProviderRow[],
) {
  const providerCountByCategory = new Map<string, number>();

  providers.forEach((provider) => {
    if (!provider.category_id) {
      return;
    }

    providerCountByCategory.set(
      provider.category_id,
      (providerCountByCategory.get(provider.category_id) ?? 0) + 1,
    );
  });

  const categoryCards =
    categories.length > 0
      ? categories.map((category) => ({
          href: getCategoryHref(category.id, category.name),
          id: category.id,
          name: category.name,
          providerCount: providerCountByCategory.get(category.id) ?? 0,
          slug: category.slug,
        }))
      : getFallbackCategories();

  return categoryCards.sort(
    (firstCategory, secondCategory) =>
      secondCategory.providerCount - firstCategory.providerCount ||
      firstCategory.name.localeCompare(secondCategory.name),
  );
}

function getPopularRegions({
  providerRegionRows,
  regions,
  subdivisions,
}: {
  providerRegionRows: HomepageProviderRegionRow[];
  regions: ServiceRegionOption[];
  subdivisions: CanadianSubdivisionOption[];
}) {
  const providerCountByRegion = new Map<string, number>();
  const provinceNameByCode = new Map(
    subdivisions.map((subdivision) => [subdivision.code, subdivision.name]),
  );

  providerRegionRows.forEach((row) => {
    providerCountByRegion.set(
      row.service_region_id,
      (providerCountByRegion.get(row.service_region_id) ?? 0) + 1,
    );
  });

  const regionsWithCounts = regions.map((region) => ({
    href: getRegionHref(region),
    id: region.id,
    name: region.name,
    providerCount: providerCountByRegion.get(region.id) ?? 0,
    provinceCode: region.province_code,
    provinceName:
      provinceNameByCode.get(region.province_code) ?? region.province_code,
  }));
  const popularRegions = regionsWithCounts
    .filter((region) => region.providerCount > 0)
    .sort(
      (firstRegion, secondRegion) =>
        secondRegion.providerCount - firstRegion.providerCount ||
        firstRegion.name.localeCompare(secondRegion.name),
    )
    .slice(0, 6);

  return popularRegions.length > 0
    ? popularRegions
    : regionsWithCounts.slice(0, 6);
}

async function getHomepageShellData(): Promise<HomepageShellData> {
  try {
    const supabase = await getServerSupabaseClient();
    const [
      categoriesResult,
      providersResult,
      subdivisionsResult,
      serviceRegionsResult,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("provider_profiles")
        .select("id,category_id")
        .eq("status", "active"),
      supabase
        .from("canadian_subdivisions")
        .select("code,name,kind")
        .order("display_order"),
      supabase
        .from("service_regions")
        .select("id,name,province_code,slug")
        .eq("is_active", true)
        .order("name"),
    ]);
    const categories = (categoriesResult.data ?? []) as HomepageCategoryRow[];
    const providers = (providersResult.data ?? []) as unknown as HomepageProviderRow[];
    const activeProviderIds = providers.map((provider) => provider.id);
    const subdivisions = (subdivisionsResult.data ??
      []) as CanadianSubdivisionOption[];
    const regions = (serviceRegionsResult.data ?? []) as ServiceRegionOption[];
    const providerRegionRows =
      activeProviderIds.length > 0
        ? await supabase
            .from("provider_service_regions")
            .select("provider_profile_id,service_region_id")
            .in("provider_profile_id", activeProviderIds)
            .then(
              ({ data }) => (data ?? []) as HomepageProviderRegionRow[],
            )
        : [];

    return {
      activeProviderCount: providers.length,
      categories: getCategoryCards(categories, providers),
      popularRegions: getPopularRegions({
        providerRegionRows,
        regions,
        subdivisions,
      }),
      regions,
      subdivisions,
    };
  } catch {
    return {
      activeProviderCount: featuredProviders.length,
      categories: getFallbackCategories(),
      popularRegions: [],
      regions: [],
      subdivisions: [],
    };
  }
}

function getRegionNamesByProvider({
  providerRegionRows,
  regions,
}: {
  providerRegionRows: HomepageProviderRegionRow[];
  regions: ServiceRegionOption[];
}) {
  const regionNameById = new Map(regions.map((region) => [region.id, region.name]));
  const regionNamesByProvider = new Map<string, string[]>();

  providerRegionRows.forEach((row) => {
    const regionName = regionNameById.get(row.service_region_id);

    if (!regionName) {
      return;
    }

    regionNamesByProvider.set(row.provider_profile_id, [
      ...(regionNamesByProvider.get(row.provider_profile_id) ?? []),
      regionName,
    ]);
  });

  return regionNamesByProvider;
}

function getFallbackTopProviders(): TopRatedProvider[] {
  return featuredProviders.map((provider) => ({
    averageRating: 0,
    bio: provider.summary,
    categoryHref: `/search?service=${encodeURIComponent(provider.category)}`,
    categoryName: provider.category,
    href: `/search?service=${encodeURIComponent(provider.category)}`,
    id: provider.name,
    initials: getProviderInitials(provider.name),
    location: provider.location,
    name: provider.name,
    ratingCount: 0,
    serviceRegionNames: [],
  }));
}

async function getTopRatedProviderPreviews(): Promise<TopRatedProvider[]> {
  try {
    const supabase = await getServerSupabaseClient();
    const [providersResult, categoriesResult, serviceRegionsResult] =
      await Promise.all([
        supabase
          .from("provider_profiles")
          .select(
            [
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
              "profile_image_url",
            ].join(","),
          )
          .eq("status", "active")
          .order("business_name", { ascending: true, nullsFirst: false }),
        supabase
          .from("categories")
          .select("id,name,slug")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("service_regions")
          .select("id,name,province_code,slug")
          .eq("is_active", true)
          .order("name"),
      ]);
    const providers = (providersResult.data ?? []) as unknown as HomepageProviderRow[];

    if (providers.length === 0) {
      return getFallbackTopProviders();
    }

    const providerIds = providers.map((provider) => provider.id);
    const [providerRegionsResult, ratingsResult] = await Promise.all([
      supabase
        .from("provider_service_regions")
        .select("provider_profile_id,service_region_id")
        .in("provider_profile_id", providerIds)
        .order("created_at"),
      supabase.rpc("get_provider_rating_summaries", {
        target_provider_profile_ids: providerIds,
      }),
    ]);
    const categories = (categoriesResult.data ?? []) as HomepageCategoryRow[];
    const regions = (serviceRegionsResult.data ?? []) as ServiceRegionOption[];
    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const ratingByProvider = new Map<string, ProviderRatingSummaryRow>();
    const regionNamesByProvider = getRegionNamesByProvider({
      providerRegionRows: (providerRegionsResult.data ??
        []) as HomepageProviderRegionRow[],
      regions,
    });

    ((ratingsResult.data ?? []) as ProviderRatingSummaryRow[]).forEach((row) => {
      ratingByProvider.set(row.provider_profile_id, row);
    });

    return providers
      .map((provider) => {
        const providerName = getProviderName(provider);
        const category = provider.category_id
          ? categoryById.get(provider.category_id)
          : null;
        const rating = ratingByProvider.get(provider.id);
        const averageRating = Number(rating?.average_rating ?? 0);
        const ratingCount = Number(rating?.rating_count ?? 0);

        return {
          averageRating,
          bio: truncateText(
            provider.bio,
            provider.service_area ??
              "Profile details, service regions, and contact options are available on this provider profile.",
          ),
          categoryHref: getCategoryHref(category?.id ?? "", category?.name ?? ""),
          categoryName: category?.name ?? "Real estate service",
          href: `/providers/${provider.slug || provider.id}`,
          id: provider.id,
          initials: getProviderInitials(providerName),
          location: getProviderLocation(provider),
          name: providerName,
          ratingCount,
          serviceRegionNames: regionNamesByProvider.get(provider.id) ?? [],
        };
      })
      .sort(
        (firstProvider, secondProvider) =>
          Number(secondProvider.ratingCount > 0) -
            Number(firstProvider.ratingCount > 0) ||
          secondProvider.averageRating - firstProvider.averageRating ||
          secondProvider.ratingCount - firstProvider.ratingCount ||
          firstProvider.name.localeCompare(secondProvider.name),
      )
      .slice(0, 3);
  } catch {
    return getFallbackTopProviders();
  }
}

function StarRating({ rating }: { rating: number }) {
  const roundedRating = Math.round(rating);

  return (
    <span aria-hidden="true" className="inline-flex items-center gap-0.5">
      {ratingValues.map((value) => (
        <span
          key={value}
          className={value <= roundedRating ? "text-amber-400" : "text-stone-300"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-950 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function HeroSearchForm({
  categories,
  regions,
  subdivisions,
}: {
  categories: HomepageCategory[];
  regions: ServiceRegionOption[];
  subdivisions: CanadianSubdivisionOption[];
}) {
  return (
    <form
      action="/search"
      method="get"
      className="mt-8 grid gap-3 rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-lg shadow-stone-200/60 backdrop-blur sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr_auto]"
    >
      <label htmlFor="homepage-keyword" className="sr-only">
        Search keywords
      </label>
      <input
        id="homepage-keyword"
        name="q"
        type="search"
        placeholder="What do you need help with?"
        className="h-12 min-w-0 rounded-md border border-stone-200 bg-white px-4 text-base text-stone-950 outline-none motion-safe:transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
      />

      <label htmlFor="homepage-category" className="sr-only">
        Service category
      </label>
      <select
        id="homepage-category"
        name="category"
        className="h-12 min-w-0 rounded-md border border-stone-200 bg-white px-4 text-base text-stone-950 outline-none motion-safe:transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
      >
        <option value="">All service categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <ProviderRegionFilterFields
        regions={regions}
        subdivisions={subdivisions}
        variant="homepage"
      />

      <button
        type="submit"
        className="h-12 rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white motion-safe:transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:col-span-2 lg:col-span-1"
      >
        Search
      </button>
    </form>
  );
}

function ActivityStatCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/10 p-4">
      <p className="text-3xl font-semibold text-white">{formatCount(value)}</p>
      <p className="mt-1 text-sm font-semibold text-stone-100">{label}</p>
      <p className="mt-2 text-xs leading-5 text-stone-300">{detail}</p>
    </article>
  );
}

function ServiceCategoryCard({ category }: { category: HomepageCategory }) {
  return (
    <Link
      href={category.href}
      className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-xl font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100"
          aria-hidden="true"
        >
          {getCategoryIcon(category.name)}
        </span>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
          {category.providerCount > 0
            ? `${category.providerCount} provider${
                category.providerCount === 1 ? "" : "s"
              }`
            : "Explore"}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-semibold text-stone-950">
        {category.name}
      </h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Compare providers, service regions, ratings, and contact preferences.
      </p>
      <span className="mt-5 inline-flex text-sm font-semibold text-emerald-800 motion-safe:transition group-hover:translate-x-1">
        Search this service →
      </span>
    </Link>
  );
}

function PopularRegionCard({ region }: { region: PopularRegion }) {
  return (
    <Link
      href={region.href}
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {region.provinceName}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-stone-950">
        {region.name}
      </h3>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        {region.providerCount > 0
          ? `${region.providerCount} active provider${
              region.providerCount === 1 ? "" : "s"
            } serving this region.`
          : "Open map-based discovery for this Canadian service region."}
      </p>
    </Link>
  );
}

function TopRatedProviderCard({ provider }: { provider: TopRatedProvider }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md">
      <div className="flex gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-emerald-700 text-base font-semibold text-white shadow-sm">
          {provider.initials}
        </div>
        <div className="min-w-0">
          <Link
            href={provider.categoryHref}
            className="text-xs font-semibold uppercase tracking-wide text-emerald-700 hover:text-emerald-900"
          >
            {provider.categoryName}
          </Link>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">
            <Link href={provider.href} className="hover:text-emerald-800">
              {provider.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm font-medium text-stone-600">
            {provider.location}
          </p>
        </div>
      </div>

      <p
        className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-700"
        aria-label={
          provider.ratingCount > 0
            ? `${provider.averageRating.toFixed(1)} rating from ${
                provider.ratingCount
              } review${provider.ratingCount === 1 ? "" : "s"}`
            : "No ratings yet"
        }
      >
        {provider.ratingCount > 0 ? (
          <StarRating rating={provider.averageRating} />
        ) : null}
        <span>
          {provider.ratingCount > 0
            ? `${provider.averageRating.toFixed(1)} · ${
                provider.ratingCount
              } review${provider.ratingCount === 1 ? "" : "s"}`
            : "Ratings coming soon"}
        </span>
      </p>

      <p className="mt-4 text-sm leading-6 text-stone-600">{provider.bio}</p>

      {provider.serviceRegionNames.length > 0 ? (
        <p className="mt-4 text-sm font-semibold text-emerald-800">
          Serves {provider.serviceRegionNames.slice(0, 2).join(" · ")}
        </p>
      ) : null}

      <Link
        href={provider.href}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 motion-safe:transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
      >
        View profile
      </Link>
    </article>
  );
}

function TopProviderSkeletonGrid() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Loading providers">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="flex gap-4">
            <div className="size-14 rounded-xl bg-stone-200 motion-safe:animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-24 rounded bg-stone-200 motion-safe:animate-pulse" />
              <div className="mt-3 h-5 w-3/4 rounded bg-stone-200 motion-safe:animate-pulse" />
              <div className="mt-2 h-4 w-1/2 rounded bg-stone-100 motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="mt-5 h-4 w-32 rounded bg-stone-100 motion-safe:animate-pulse" />
          <div className="mt-4 space-y-2">
            <div className="h-3 rounded bg-stone-100 motion-safe:animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-stone-100 motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function TopRatedProviderSection({
  providersPromise,
}: {
  providersPromise: Promise<TopRatedProvider[]>;
}) {
  const providers = await providersPromise;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {providers.map((provider) => (
        <TopRatedProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      description:
        "Start broad with a profession/category, then narrow by province and service region.",
      title: "Choose the service and area",
    },
    {
      description:
        "On the search page, enter an address or move the map pin so MyRealHub can match the property to a Canadian service region.",
      title: "Match a project location",
    },
    {
      description:
        "Open profiles, compare ratings, save providers, and contact businesses that are accepting new inquiries.",
      title: "Compare and connect",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-14">
      <SectionHeader
        eyebrow="How it works"
        title="A cleaner path from project location to provider shortlist"
        description="Open each step to see how homepage discovery connects to the richer search workflow."
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => (
          <details
            key={step.title}
            open={index === 0}
            className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Step {index + 1}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-stone-950">
                  {step.title}
                </h3>
              </div>
              <span
                className="rounded-full border border-stone-200 px-2 text-stone-500 motion-safe:transition group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              {step.description}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const topProvidersPromise = getTopRatedProviderPreviews();
  const {
    activeProviderCount,
    categories,
    popularRegions,
    regions,
    subdivisions,
  } = await getHomepageShellData();
  const featuredCategories = categories.slice(0, 8);
  const activityStats = [
    {
      detail: "Approved listings available in public search.",
      label: "Active providers",
      value: activeProviderCount,
    },
    {
      detail: "Professional categories spanning the moving journey.",
      label: "Service categories",
      value: categories.length,
    },
    {
      detail: "Canadian regions connected to map discovery.",
      label: "Service regions",
      value: regions.length,
    },
    {
      detail: "Frequently served areas surfaced from provider coverage.",
      label: "Popular regions",
      value: popularRegions.length,
    },
  ];

  return (
    <>
      <section className="overflow-hidden border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,#ecfdf5,transparent_34rem),linear-gradient(180deg,#ffffff,#fafaf9)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Canadian real estate services directory
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl lg:text-6xl">
              Find the provider who serves your exact project area.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              Search real estate agents, mortgage pros, inspectors, lawyers,
              contractors, photographers, stagers, and more by service and
              Canadian service region.
            </p>

            <HeroSearchForm
              categories={categories}
              regions={regions}
              subdivisions={subdivisions}
            />

            <div className="mt-4 flex flex-col gap-3 text-sm text-stone-600 sm:flex-row sm:items-center">
              <Link
                href="/search#provider-search-address"
                className="font-semibold text-emerald-800 hover:text-emerald-900"
              >
                Search by address or map pin →
              </Link>
              <span className="hidden text-stone-300 sm:inline" aria-hidden="true">
                |
              </span>
              <span>Exact addresses stay private and are only used for region matching.</span>
            </div>
          </div>

          <div className="grid gap-4">
            <AudienceTabs />
            <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5 text-white shadow-xl">
              <p className="text-sm font-medium text-amber-200">
                Platform activity
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {activityStats.map((stat) => (
                  <ActivityStatCard
                    key={stat.label}
                    detail={stat.detail}
                    label={stat.label}
                    value={stat.value}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            eyebrow="Browse services"
            title="Pick a category and jump into real results"
            description="Each card opens the provider search with that service selected."
          />
          <Link
            href="/search"
            className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 motion-safe:transition hover:border-stone-950 hover:text-stone-950"
          >
            View all providers
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredCategories.map((category) => (
            <ServiceCategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader
            eyebrow="Popular service regions"
            title="Start with areas providers already serve"
            description="Region cards connect directly to map-based discovery on the search page."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {popularRegions.length > 0 ? (
              popularRegions.map((region) => (
                <PopularRegionCard key={region.id} region={region} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-6 text-stone-600 sm:col-span-2">
                Service regions are being prepared. Use provider search to
                browse available Canadian locations.
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="providers" className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            eyebrow="Provider previews"
            title="Top-rated providers surface as reviews come in"
            description="Preview active profiles, ratings, and service regions without exposing private home addresses."
          />
          <Link
            href="/search"
            className="inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white motion-safe:transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-100"
          >
            Search directory
          </Link>
        </div>

        <Suspense fallback={<TopProviderSkeletonGrid />}>
          <TopRatedProviderSection providersPromise={topProvidersPromise} />
        </Suspense>
      </section>

      <HowItWorksSection />

      <section id="join" className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-12 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Service providers
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-950">
              Grow where consumers are already searching.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Join MyRealHub to define your service regions, manage inquiries,
              collect ratings, and keep your profile current from Settings.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-80">
            <Link
              href="/signup?role=provider"
              className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white motion-safe:transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              Join as Provider
            </Link>
            <Link
              href="/login?next=/provider/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-semibold text-stone-800 motion-safe:transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
            >
              Provider login
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
