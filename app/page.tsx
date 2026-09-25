import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AudienceTabs } from "@/components/home/audience-tabs";
import { ProviderRegionFilterFields } from "@/components/providers/provider-region-filter-fields";
import { featuredProviders, serviceCategories } from "@/lib/service-directory";
import type {
  ServiceRegionOption,
  SubdivisionOption,
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

type TopRatedProvider = {
  averageRating: number;
  avatarUrl: string | null;
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
  categories: HomepageCategory[];
  regions: ServiceRegionOption[];
  subdivisions: SubdivisionOption[];
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

const ratingValues = [1, 2, 3, 4, 5];
const featuredCategoryOrder = [
  "real-estate-agent",
  "home-inspector",
  "mortgage-broker",
  "real-estate-lawyer",
  "appraiser",
  "property-manager",
  "contractor",
  "cleaner",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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
  const parts = [provider.city].filter(Boolean);

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

function refineCustomerCopy(value: string | null) {
  return value
    ?.replace(
      /pre-listing improvement\s+[a-z]+/gi,
      "pre-listing improvements",
    )
    .replace(
      /Repair\s+[a-z]+\s+before listing a property\./gi,
      "Repairs before listing a property.",
    ) ?? null;
}

function getPublicProfileImageUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.hostname === "example.com" || url.hostname.endsWith(".example.com")) {
      return null;
    }

    return value;
  } catch {
    return value.startsWith("/") ? value : null;
  }
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

function getFeaturedCategories(categories: HomepageCategory[]) {
  const orderBySlug = new Map(
    featuredCategoryOrder.map((slug, index) => [slug, index]),
  );

  return categories
    .filter((category) => orderBySlug.has(category.slug))
    .sort(
      (firstCategory, secondCategory) =>
        (orderBySlug.get(firstCategory.slug) ?? Number.MAX_SAFE_INTEGER) -
        (orderBySlug.get(secondCategory.slug) ?? Number.MAX_SAFE_INTEGER),
    );
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
    const subdivisions = (subdivisionsResult.data ??
      []) as SubdivisionOption[];
    const regions = (serviceRegionsResult.data ?? []) as ServiceRegionOption[];

    return {
      categories: getCategoryCards(categories, providers),
      regions,
      subdivisions,
    };
  } catch {
    return {
      categories: getFallbackCategories(),
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
    avatarUrl: null,
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
          avatarUrl: getPublicProfileImageUrl(provider.profile_image_url),
          bio: truncateText(
            refineCustomerCopy(provider.bio),
            provider.service_area ??
              "Profile details, service areas, and contact options are available on this provider profile.",
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
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase text-teal-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-stone-950 sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-stone-600">
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
  subdivisions: SubdivisionOption[];
}) {
  return (
    <form
      action="/search"
      method="get"
      className="mt-8 rounded-lg border border-white/70 bg-white/95 p-4 shadow-lg shadow-stone-950/15 backdrop-blur"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label
          htmlFor="homepage-keyword"
          className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-stone-700"
        >
          Need
          <input
            id="homepage-keyword"
            name="q"
            type="search"
            placeholder="Inspector, lawyer..."
            className="h-12 min-w-0 rounded-md border border-stone-300 bg-white px-3 text-base text-stone-950 outline-none motion-safe:transition placeholder:text-stone-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          />
        </label>

        <label
          htmlFor="homepage-category"
          className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-stone-700"
        >
          Service
          <select
            id="homepage-category"
            name="category"
            className="h-12 min-w-0 rounded-md border border-stone-300 bg-white px-3 text-base text-stone-950 outline-none motion-safe:transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <ProviderRegionFilterFields
          regions={regions}
          subdivisions={subdivisions}
          variant="homepage"
        />

        <button
          type="submit"
          className="h-12 rounded-md bg-stone-950 px-6 text-sm font-semibold text-white motion-safe:transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100 sm:col-span-2"
        >
          Search
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-stone-200 pt-4 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/search#provider-search-address"
          className="font-semibold text-teal-800 hover:text-teal-950"
        >
          Search by address or map pin
        </Link>
        <span>Use an address to match nearby coverage without posting it publicly.</span>
      </div>
    </form>
  );
}

function ServiceCategoryCard({ category }: { category: HomepageCategory }) {
  return (
    <Link
      href={category.href}
      className="group flex min-h-52 flex-col rounded-lg border border-stone-200 bg-white p-5 shadow-sm motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:border-teal-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-teal-100"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="grid size-10 place-items-center rounded-md bg-teal-900 text-lg font-semibold text-white"
          aria-hidden="true"
        >
          {getCategoryIcon(category.name)}
        </span>
        <span className="text-sm font-semibold text-stone-500">
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
        Compare providers, service areas, ratings, and contact preferences.
      </p>
      <span className="mt-auto pt-5 text-sm font-semibold text-teal-800">
        Search service
      </span>
    </Link>
  );
}

function TopRatedProviderCard({ provider }: { provider: TopRatedProvider }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-stone-200 bg-white p-5 shadow-sm motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:border-teal-700 hover:shadow-md">
      <div className="flex gap-4">
        <div className="size-14 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-teal-900">
          {provider.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.avatarUrl}
              alt={`${provider.name} profile`}
              className="size-full object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center text-base font-semibold text-white">
              {provider.initials}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={provider.categoryHref}
            className="text-sm font-semibold uppercase text-teal-700 hover:text-teal-950"
          >
            {provider.categoryName}
          </Link>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">
            <Link href={provider.href} className="hover:text-teal-800">
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

      <p className="mt-4 flex-1 text-sm leading-6 text-stone-600">{provider.bio}</p>

      {provider.serviceRegionNames.length > 0 ? (
        <p className="mt-4 text-sm font-semibold text-teal-800">
          Serves {provider.serviceRegionNames.slice(0, 2).join(" · ")}
        </p>
      ) : null}

      <Link
        href={provider.href}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 motion-safe:transition hover:border-teal-800 hover:text-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
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
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="flex gap-4">
            <div className="size-14 rounded-md bg-stone-200 motion-safe:animate-pulse" />
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
        "Start broad with a profession/category, then narrow by service area.",
      title: "Choose the service and area",
    },
    {
      description:
        "On the search page, enter an address or move the map pin so MyRealHub can match the property to a service area.",
      title: "Match the property location",
    },
    {
      description:
        "Open profiles, compare ratings, save providers, and contact businesses that are accepting new inquiries.",
      title: "Compare and connect",
    },
  ];

  return (
    <section className="border-y border-stone-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-16">
        <SectionHeader
          eyebrow="How it works"
          title="Move from address to provider shortlist"
          description="Start with the service you need, confirm the area, and compare providers that serve that property."
        />

        <ol className="mt-8 grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-stone-200 bg-[#fbfaf7] p-5 shadow-sm"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-stone-950 text-sm font-semibold text-white">
              {index + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold text-stone-950">
              {step.title}
            </h3>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              {step.description}
            </p>
          </li>
        ))}
        </ol>
      </div>
    </section>
  );
}

export default async function Home() {
  const topProvidersPromise = getTopRatedProviderPreviews();
  const {
    categories,
    regions,
    subdivisions,
  } = await getHomepageShellData();
  const featuredCategories = getFeaturedCategories(categories);

  return (
    <>
      <section className="border-b border-stone-200 bg-white px-3 py-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-[92rem] overflow-hidden rounded-lg bg-stone-950 shadow-sm">
          <Image
            src="/images/landing-hero.png"
            alt=""
            fill
            preload
            sizes="(max-width: 1536px) calc(100vw - 3rem), 1472px"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-stone-950/45"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/70 to-stone-950/25"
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full max-w-7xl px-6 py-14 lg:py-20">
            <div className="max-w-3xl">
              <div>
                <p className="text-sm font-semibold uppercase text-emerald-100">
                  Real estate services directory
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                  One directory for anyone hiring and the providers serving
                  them
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-100">
                  Search real estate agents, mortgage pros, inspectors, lawyers,
                  contractors, photographers, stagers, and more by service and
                  area.
                </p>

                <HeroSearchForm
                  categories={categories}
                  regions={regions}
                  subdivisions={subdivisions}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <SectionHeader
            eyebrow="Start here"
            title="One directory for the people hiring and the providers serving them"
            description="Consumers can shortlist trusted help by area. Providers can keep coverage, contact preferences, and public profiles up to date."
          />
          <AudienceTabs />
        </div>
      </section>

      <section id="services" className="bg-[#fbfaf7]">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              eyebrow="Browse services"
              title="Choose the right specialist first"
              description="Start with the profession, then narrow results by area, ratings, and public profile details."
            />
            <Link
              href="/search"
              className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 motion-safe:transition hover:border-teal-800 hover:text-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
            >
              View all providers
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCategories.map((category) => (
              <ServiceCategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      <section id="providers" className="bg-[#f7f5ef]">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              eyebrow="Provider previews"
              title="Promising profiles, ready to compare"
              description="Compare active provider profiles, ratings, service areas, and contact options before you reach out."
            />
            <Link
              href="/search"
              className="inline-flex h-11 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white motion-safe:transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
            >
              Search directory
            </Link>
          </div>

          <Suspense fallback={<TopProviderSkeletonGrid />}>
            <TopRatedProviderSection providersPromise={topProvidersPromise} />
          </Suspense>
        </div>
      </section>

      <HowItWorksSection />

      <section id="join" className="bg-stone-950 text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-14 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase text-amber-300">
              Service providers
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Be found in the regions you actually serve.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
              Join MyRealHub to define your service areas, manage inquiries,
              collect ratings, and keep your profile current from Settings.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-80">
            <Link
              href="/signup?role=provider"
              className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-stone-950 motion-safe:transition hover:bg-stone-200 focus:outline-none focus:ring-4 focus:ring-white/20"
            >
              Join as Provider
            </Link>
            <Link
              href="/login?next=/provider/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-md border border-stone-600 px-5 text-sm font-semibold text-white motion-safe:transition hover:border-white focus:outline-none focus:ring-4 focus:ring-white/20"
            >
              Provider login
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
