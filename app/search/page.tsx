import Link from "next/link";
import { ProviderRegionFilterFields } from "@/components/providers/provider-region-filter-fields";
import { SaveProviderButton } from "@/components/providers/save-provider-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { getSavedProviderIds } from "@/lib/saved-providers";
import type { CanadianSubdivisionOption } from "@/lib/service-regions";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type SearchPageSearchParams = {
  category?: string | string[];
  language?: string | string[];
  province?: string | string[];
  q?: string | string[];
  region?: string | string[];
  service?: string | string[];
  specialty?: string | string[];
};

type SearchPageProps = {
  searchParams: Promise<SearchPageSearchParams>;
};

type LookupRow = {
  id: string;
  name: string;
  slug: string;
};

type SpecialtyLookupRow = LookupRow & {
  category_id: string | null;
};

type ServiceRegionLookupRow = LookupRow & {
  province_code: string;
};

type ProviderProfileRow = {
  id: string;
  slug: string;
  category_id: string | null;
  business_name: string | null;
  display_name: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  service_area: string | null;
  profile_image_url: string | null;
};

type ProviderRelationRow = {
  provider_profile_id: string;
  language_id?: string;
  service_region_id?: string;
  specialty_id?: string;
};

type ProviderSearchFilters = {
  categoryId: string;
  keyword: string;
  languageId: string;
  provinceCode: string;
  regionId: string;
  specialtyId: string;
};

type ProviderSearchResult = ProviderProfileRow & {
  categoryName: string | null;
  isSaved: boolean;
  languageNames: string[];
  serviceRegionNames: string[];
  specialtyNames: string[];
};

type ProviderSearchData = {
  categories: LookupRow[];
  errorMessage: string | null;
  filters: ProviderSearchFilters;
  languages: LookupRow[];
  providers: ProviderSearchResult[];
  serviceRegions: ServiceRegionLookupRow[];
  specialties: SpecialtyLookupRow[];
  subdivisions: CanadianSubdivisionOption[];
};

const providerSelectColumns = [
  "id",
  "slug",
  "category_id",
  "business_name",
  "display_name",
  "bio",
  "email",
  "phone",
  "city",
  "province_state",
  "country",
  "service_area",
  "profile_image_url",
].join(",");

function getSearchParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim() ?? "";
}

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function resolveLookupId<TLookup extends LookupRow>(
  value: string,
  lookups: TLookup[],
) {
  const normalizedValue = normalizeLookupValue(value);

  if (!normalizedValue) {
    return "";
  }

  return (
    lookups.find(
      (lookup) =>
        lookup.id === value ||
        normalizeLookupValue(lookup.slug) === normalizedValue ||
        normalizeLookupValue(lookup.name) === normalizedValue,
    )?.id ?? ""
  );
}

function getSelectedCategoryId(
  query: SearchPageSearchParams,
  categories: LookupRow[],
) {
  const categoryId = resolveLookupId(getSearchParam(query.category), categories);

  if (categoryId) {
    return categoryId;
  }

  return resolveLookupId(getSearchParam(query.service), categories);
}

function resolveSubdivisionCode(
  value: string,
  subdivisions: CanadianSubdivisionOption[],
) {
  const normalizedValue = normalizeLookupValue(value);

  if (!normalizedValue) {
    return "";
  }

  return (
    subdivisions.find(
      (subdivision) =>
        normalizeLookupValue(subdivision.code) === normalizedValue ||
        normalizeLookupValue(subdivision.name) === normalizedValue,
    )?.code ?? ""
  );
}

function sanitizeSearchTerm(value: string) {
  return value
    .replace(/[%_*,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIlikeExpression(columns: string[], value: string) {
  const sanitizedValue = sanitizeSearchTerm(value);

  if (!sanitizedValue) {
    return "";
  }

  return columns
    .map((column) => `${column}.ilike.%${sanitizedValue}%`)
    .join(",");
}

function intersectProviderIds(firstIds: string[], secondIds: string[]) {
  const secondIdSet = new Set(secondIds);

  return firstIds.filter((id) => secondIdSet.has(id));
}

function getProviderName(provider: ProviderSearchResult) {
  return (
    provider.business_name ??
    provider.display_name ??
    provider.email ??
    "Provider profile"
  );
}

function getProviderLocation(provider: ProviderSearchResult) {
  const parts = [
    provider.city,
    provider.province_state,
    provider.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
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

function getNamesById<TLookup extends LookupRow>(
  lookups: TLookup[],
  ids: string[],
) {
  const lookupMap = new Map(lookups.map((lookup) => [lookup.id, lookup.name]));

  return ids
    .map((id) => lookupMap.get(id))
    .filter((name): name is string => Boolean(name));
}

function getCategoryName(categories: LookupRow[], categoryId: string | null) {
  return categories.find((category) => category.id === categoryId)?.name ?? null;
}

function getActiveFilterCount(filters: ProviderSearchFilters) {
  return [
    filters.categoryId,
    filters.languageId,
    filters.provinceCode,
    filters.regionId,
    filters.specialtyId,
    filters.keyword,
  ].filter(Boolean).length;
}

function getSearchReturnPath(query: SearchPageSearchParams) {
  const params = new URLSearchParams();

  (
    [
      "category",
      "language",
      "province",
      "q",
      "region",
      "service",
      "specialty",
    ] as const
  )
    .map((key) => [key, getSearchParam(query[key])] as const)
    .forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

  const queryString = params.toString();

  return `/search${queryString ? `?${queryString}` : ""}`;
}

async function getProviderIdsForRelation(
  tableName:
    | "provider_languages"
    | "provider_service_regions"
    | "provider_specialties",
  filterColumn: "language_id" | "service_region_id" | "specialty_id",
  filterValue: string,
) {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from(tableName)
    .select("provider_profile_id")
    .eq(filterColumn, filterValue);

  if (error) {
    return { ids: [] as string[], ok: false };
  }

  return {
    ids: ((data ?? []) as ProviderRelationRow[]).map(
      (row) => row.provider_profile_id,
    ),
    ok: true,
  };
}

async function getProviderIdsForServiceRegions(serviceRegionIds: string[]) {
  if (serviceRegionIds.length === 0) {
    return { ids: [] as string[], ok: true };
  }

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("provider_service_regions")
    .select("provider_profile_id")
    .in("service_region_id", serviceRegionIds);

  if (error) {
    return { ids: [] as string[], ok: false };
  }

  return {
    ids: Array.from(
      new Set(
        ((data ?? []) as ProviderRelationRow[]).map(
          (row) => row.provider_profile_id,
        ),
      ),
    ),
    ok: true,
  };
}

async function getSearchData(
  query: SearchPageSearchParams,
  currentUserId: string | null,
): Promise<ProviderSearchData> {
  const supabase = await getServerSupabaseClient();
  const [
    categoriesResult,
    languagesResult,
    specialtiesResult,
    serviceRegionsResult,
    subdivisionsResult,
  ] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("languages")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("specialties")
        .select("id,category_id,name,slug")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("service_regions")
        .select("id,name,province_code,slug")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("canadian_subdivisions")
        .select("code,name,kind")
        .order("display_order"),
    ]);

  const categories = (categoriesResult.data ?? []) as LookupRow[];
  const languages = (languagesResult.data ?? []) as LookupRow[];
  const specialties = (specialtiesResult.data ?? []) as SpecialtyLookupRow[];
  const serviceRegions = (serviceRegionsResult.data ??
    []) as ServiceRegionLookupRow[];
  const subdivisions = (subdivisionsResult.data ??
    []) as CanadianSubdivisionOption[];
  const requestedRegionId = resolveLookupId(
    getSearchParam(query.region),
    serviceRegions,
  );
  const requestedRegion = serviceRegions.find(
    (region) => region.id === requestedRegionId,
  );
  const requestedProvinceCode = resolveSubdivisionCode(
    getSearchParam(query.province),
    subdivisions,
  );
  const provinceCode =
    requestedProvinceCode || requestedRegion?.province_code || "";
  const regionId =
    requestedRegion?.province_code === provinceCode ? requestedRegion.id : "";
  const filters: ProviderSearchFilters = {
    categoryId: getSelectedCategoryId(query, categories),
    keyword: getSearchParam(query.q),
    languageId: resolveLookupId(getSearchParam(query.language), languages),
    provinceCode,
    regionId,
    specialtyId: resolveLookupId(getSearchParam(query.specialty), specialties),
  };
  const lookupError =
    categoriesResult.error ||
    languagesResult.error ||
    specialtiesResult.error ||
    serviceRegionsResult.error ||
    subdivisionsResult.error
      ? "Some filter options could not be loaded."
      : null;
  const relationFilters: string[][] = [];

  if (filters.languageId) {
    const languageProviderIds = await getProviderIdsForRelation(
      "provider_languages",
      "language_id",
      filters.languageId,
    );

    if (!languageProviderIds.ok) {
      return {
        categories,
        errorMessage: "Language filter could not be applied.",
        filters,
        languages,
        providers: [],
        serviceRegions,
        specialties,
        subdivisions,
      };
    }

    relationFilters.push(languageProviderIds.ids);
  }

  if (filters.specialtyId) {
    const specialtyProviderIds = await getProviderIdsForRelation(
      "provider_specialties",
      "specialty_id",
      filters.specialtyId,
    );

    if (!specialtyProviderIds.ok) {
      return {
        categories,
        errorMessage: "Specialty filter could not be applied.",
        filters,
        languages,
        providers: [],
        serviceRegions,
        specialties,
        subdivisions,
      };
    }

    relationFilters.push(specialtyProviderIds.ids);
  }

  if (filters.regionId) {
    const regionProviderIds = await getProviderIdsForRelation(
      "provider_service_regions",
      "service_region_id",
      filters.regionId,
    );

    if (!regionProviderIds.ok) {
      return {
        categories,
        errorMessage: "Service-region filter could not be applied.",
        filters,
        languages,
        providers: [],
        serviceRegions,
        specialties,
        subdivisions,
      };
    }

    relationFilters.push(regionProviderIds.ids);
  } else if (filters.provinceCode) {
    const provinceServiceRegionIds = serviceRegions
      .filter((region) => region.province_code === filters.provinceCode)
      .map((region) => region.id);
    const provinceProviderIds = await getProviderIdsForServiceRegions(
      provinceServiceRegionIds,
    );

    if (!provinceProviderIds.ok) {
      return {
        categories,
        errorMessage: "Province filter could not be applied.",
        filters,
        languages,
        providers: [],
        serviceRegions,
        specialties,
        subdivisions,
      };
    }

    relationFilters.push(provinceProviderIds.ids);
  }

  const relationProviderIds =
    relationFilters.length === 0
      ? null
      : relationFilters.reduce((currentIds, nextIds) =>
          intersectProviderIds(currentIds, nextIds),
        );

  if (relationProviderIds?.length === 0) {
    return {
      categories,
      errorMessage: lookupError,
      filters,
      languages,
      providers: [],
      serviceRegions,
      specialties,
      subdivisions,
    };
  }

  let providerQuery = supabase
    .from("provider_profiles")
    .select(providerSelectColumns)
    .eq("status", "active")
    .order("business_name", { ascending: true, nullsFirst: false });

  if (filters.categoryId) {
    providerQuery = providerQuery.eq("category_id", filters.categoryId);
  }

  if (relationProviderIds) {
    providerQuery = providerQuery.in("id", relationProviderIds);
  }

  const keywordExpression = getIlikeExpression(
    ["business_name", "display_name", "bio", "service_area"],
    filters.keyword,
  );

  if (keywordExpression) {
    providerQuery = providerQuery.or(keywordExpression);
  }

  const { data: providerRows, error: providerError } = await providerQuery;

  if (providerError) {
    return {
      categories,
      errorMessage: "Provider results could not be loaded.",
      filters,
      languages,
      providers: [],
      serviceRegions,
      specialties,
      subdivisions,
    };
  }

  const providers = (providerRows ?? []) as unknown as ProviderProfileRow[];
  const providerIds = providers.map((provider) => provider.id);

  if (providerIds.length === 0) {
    return {
      categories,
      errorMessage: lookupError,
      filters,
      languages,
      providers: [],
      serviceRegions,
      specialties,
      subdivisions,
    };
  }

  const [
    providerLanguagesResult,
    providerSpecialtiesResult,
    providerServiceRegionsResult,
  ] =
    await Promise.all([
      supabase
        .from("provider_languages")
        .select("provider_profile_id,language_id")
        .in("provider_profile_id", providerIds),
      supabase
        .from("provider_specialties")
        .select("provider_profile_id,specialty_id")
        .in("provider_profile_id", providerIds),
      supabase
        .from("provider_service_regions")
        .select("provider_profile_id,service_region_id")
        .in("provider_profile_id", providerIds)
        .order("created_at"),
    ]);
  const savedProviderIds = currentUserId
    ? await getSavedProviderIds(currentUserId, providerIds)
    : new Set<string>();

  const providerLanguageRows =
    (providerLanguagesResult.data ?? []) as ProviderRelationRow[];
  const providerSpecialtyRows =
    (providerSpecialtiesResult.data ?? []) as ProviderRelationRow[];
  const providerServiceRegionRows =
    (providerServiceRegionsResult.data ?? []) as ProviderRelationRow[];
  const languageIdsByProvider = new Map<string, string[]>();
  const serviceRegionIdsByProvider = new Map<string, string[]>();
  const specialtyIdsByProvider = new Map<string, string[]>();

  providerLanguageRows.forEach((row) => {
    if (!row.language_id) {
      return;
    }

    languageIdsByProvider.set(row.provider_profile_id, [
      ...(languageIdsByProvider.get(row.provider_profile_id) ?? []),
      row.language_id,
    ]);
  });

  providerSpecialtyRows.forEach((row) => {
    if (!row.specialty_id) {
      return;
    }

    specialtyIdsByProvider.set(row.provider_profile_id, [
      ...(specialtyIdsByProvider.get(row.provider_profile_id) ?? []),
      row.specialty_id,
    ]);
  });

  providerServiceRegionRows.forEach((row) => {
    if (!row.service_region_id) {
      return;
    }

    serviceRegionIdsByProvider.set(row.provider_profile_id, [
      ...(serviceRegionIdsByProvider.get(row.provider_profile_id) ?? []),
      row.service_region_id,
    ]);
  });

  return {
    categories,
    errorMessage:
      lookupError ||
      (providerLanguagesResult.error ||
        providerSpecialtiesResult.error ||
        providerServiceRegionsResult.error
        ? "Some result details could not be loaded."
        : null),
    filters,
    languages,
    providers: providers.map((provider) => ({
      ...provider,
      categoryName: getCategoryName(categories, provider.category_id),
      isSaved: savedProviderIds.has(provider.id),
      languageNames: getNamesById(
        languages,
        languageIdsByProvider.get(provider.id) ?? [],
      ),
      serviceRegionNames: getNamesById(
        serviceRegions,
        serviceRegionIdsByProvider.get(provider.id) ?? [],
      ),
      specialtyNames: getNamesById(
        specialties,
        specialtyIdsByProvider.get(provider.id) ?? [],
      ),
    })),
    serviceRegions,
    specialties,
    subdivisions,
  };
}

function FilterSelect({
  children,
  defaultValue,
  id,
  label,
  name,
}: {
  children: React.ReactNode;
  defaultValue: string;
  id: string;
  label: string;
  name: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-medium text-stone-800">
      {label}
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
      >
        {children}
      </select>
    </label>
  );
}

function FilterSummary({
  categories,
  filters,
  languages,
  serviceRegions,
  specialties,
  subdivisions,
}: {
  categories: LookupRow[];
  filters: ProviderSearchFilters;
  languages: LookupRow[];
  serviceRegions: ServiceRegionLookupRow[];
  specialties: SpecialtyLookupRow[];
  subdivisions: CanadianSubdivisionOption[];
}) {
  const filterLabels = [
    filters.provinceCode
      ? `Province: ${
          subdivisions.find(
            (subdivision) => subdivision.code === filters.provinceCode,
          )?.name ?? filters.provinceCode
        }`
      : null,
    filters.categoryId
      ? `Profession: ${getCategoryName(categories, filters.categoryId)}`
      : null,
    filters.languageId
      ? `Language: ${getCategoryName(languages, filters.languageId)}`
      : null,
    filters.regionId
      ? `Service region: ${getCategoryName(serviceRegions, filters.regionId)}`
      : null,
    filters.specialtyId
      ? `Specialty: ${getCategoryName(specialties, filters.specialtyId)}`
      : null,
    filters.keyword ? `Keyword: ${filters.keyword}` : null,
  ].filter((label): label is string => Boolean(label));

  if (filterLabels.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filterLabels.map((label) => (
        <span
          key={label}
          className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-100"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function ProviderResultCard({
  isSignedIn,
  provider,
  returnPath,
}: {
  isSignedIn: boolean;
  provider: ProviderSearchResult;
  returnPath: string;
}) {
  const providerName = getProviderName(provider);
  const profileImageUrl = getPublicProfileImageUrl(provider.profile_image_url);
  const providerHref = `/providers/${provider.slug || provider.id}`;
  const visibleTags = [
    ...provider.languageNames.slice(0, 2),
    ...provider.specialtyNames.slice(0, 3),
  ].slice(0, 4);
  const hiddenTagCount =
    provider.languageNames.length + provider.specialtyNames.length - visibleTags.length;

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-emerald-50">
          {profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileImageUrl}
              alt={`${providerName} profile`}
              className="size-full object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center bg-emerald-700 text-lg font-semibold text-white">
              {getProviderInitials(providerName)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {provider.categoryName ?? "Real estate service"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">
            <Link href={providerHref} className="transition hover:text-emerald-800">
              {providerName}
            </Link>
          </h2>
          {provider.display_name && provider.display_name !== provider.business_name ? (
            <p className="mt-1 text-sm font-medium text-stone-600">
              {provider.display_name}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-medium text-stone-700">
            {getProviderLocation(provider)}
          </p>
        </div>
      </div>

      {provider.serviceRegionNames.length > 0 ? (
        <p className="mt-4 text-sm font-semibold text-emerald-800">
          Serves {provider.serviceRegionNames.join(" · ")}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-stone-600">
        {provider.bio ?? "No bio added yet."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleTags.length > 0 ? (
          visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
            Details available on profile
          </span>
        )}
        {hiddenTagCount > 0 ? (
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
            +{hiddenTagCount} more
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 border-t border-stone-200 pt-4 sm:grid-cols-3">
        <Link
          href={providerHref}
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          View profile
        </Link>
        {provider.email ? (
          <a
            href={`mailto:${provider.email}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
          >
            Contact
          </a>
        ) : null}
        <SaveProviderButton
          isSaved={provider.isSaved}
          isSignedIn={isSignedIn}
          providerId={provider.id}
          returnPath={returnPath}
          size="compact"
        />
      </div>
    </article>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      <h2 className="text-xl font-semibold text-stone-950">
        No providers found
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
        {hasFilters
          ? "No active providers match those filters yet. Try clearing one filter or choosing another region."
          : "No active providers are listed yet. Approved provider profiles will appear here."}
      </p>
      {hasFilters ? (
        <Link
          href="/search"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
        >
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = await searchParams;
  const currentProfile = await getCurrentProfile();
  const searchData = await getSearchData(query, currentProfile?.id ?? null);
  const returnPath = getSearchReturnPath(query);
  const activeFilterCount = getActiveFilterCount(searchData.filters);
  const filteredSpecialties = searchData.filters.categoryId
    ? searchData.specialties.filter(
        (specialty) =>
          specialty.category_id === null ||
          specialty.category_id === searchData.filters.categoryId,
      )
    : searchData.specialties;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Provider search
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-950">
            Find active real estate service providers
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
            Choose a province or territory, then narrow to a service region,
            profession, language, or specialty.
          </p>
        </div>
        <Link
          href="/signup?role=provider"
          className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
        >
          Join as Provider
        </Link>
      </div>

      <form className="mt-8 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        {searchData.filters.keyword ? (
          <input type="hidden" name="q" value={searchData.filters.keyword} />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
          <ProviderRegionFilterFields
            initialProvinceCode={searchData.filters.provinceCode}
            initialRegionId={searchData.filters.regionId}
            regions={searchData.serviceRegions}
            subdivisions={searchData.subdivisions}
          />

          <FilterSelect
            id="provider-category"
            name="category"
            label="Profession/category"
            defaultValue={searchData.filters.categoryId}
          >
            <option value="">All professions</option>
            {searchData.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="provider-language"
            name="language"
            label="Language"
            defaultValue={searchData.filters.languageId}
          >
            <option value="">All languages</option>
            {searchData.languages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="provider-specialty"
            name="specialty"
            label="Specialty"
            defaultValue={searchData.filters.specialtyId}
          >
            <option value="">All specialties</option>
            {filteredSpecialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </FilterSelect>

          <button
            type="submit"
            className="h-11 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            Search
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <FilterSummary
            categories={searchData.categories}
            filters={searchData.filters}
            languages={searchData.languages}
            serviceRegions={searchData.serviceRegions}
            specialties={searchData.specialties}
            subdivisions={searchData.subdivisions}
          />
          {activeFilterCount > 0 ? (
            <Link
              href="/search"
              className="text-sm font-semibold text-stone-700 transition hover:text-stone-950"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      {searchData.errorMessage ? (
        <p
          className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          role="status"
        >
          {searchData.errorMessage}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">Search results</p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-950">
            {searchData.providers.length} active provider
            {searchData.providers.length === 1 ? "" : "s"}
          </h2>
        </div>
        <p className="text-sm text-stone-500">
          {activeFilterCount > 0
            ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
            : "Showing all active providers"}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {searchData.providers.length > 0 ? (
          searchData.providers.map((provider) => (
            <ProviderResultCard
              key={provider.id}
              isSignedIn={Boolean(currentProfile)}
              provider={provider}
              returnPath={returnPath}
            />
          ))
        ) : (
          <div className="lg:col-span-2">
            <EmptyState hasFilters={activeFilterCount > 0} />
          </div>
        )}
      </div>
    </section>
  );
}
