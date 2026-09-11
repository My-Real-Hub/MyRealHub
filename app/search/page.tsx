import Link from "next/link";
import { ProviderLocationSearchFields } from "@/components/providers/provider-location-search-fields";
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
  phone: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  service_area: string | null;
  profile_image_url: string | null;
  accept_new_inquiries: boolean | null;
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
  averageRating: number;
  categoryName: string | null;
  isSaved: boolean;
  languageNames: string[];
  ratingCount: number;
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
  "phone",
  "city",
  "province_state",
  "country",
  "service_area",
  "profile_image_url",
  "accept_new_inquiries",
].join(",");
const ratingValues = [1, 2, 3, 4, 5];
const providerSearchFormId = "provider-search-form";
const providerRegionControlId = "provider-region";

type ProviderRatingSummaryRow = {
  provider_profile_id: string;
  average_rating: number | string | null;
  rating_count: number | string;
};

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

function getRatingSummaryText(averageRating: number, ratingCount: number) {
  if (ratingCount === 0) {
    return "No ratings yet";
  }

  return `${averageRating.toFixed(1)} (${ratingCount} review${
    ratingCount === 1 ? "" : "s"
  })`;
}

function refineCustomerCopy(value: string | null) {
  if (!value) {
    return "Profile details are available soon.";
  }

  return value
    .replace(
      /pre-listing improvement\s+[a-z]+/gi,
      "pre-listing improvements",
    )
    .replace(
      /Repair\s+[a-z]+\s+before listing a property\./gi,
      "Repairs before listing a property.",
    );
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
    filters.regionId || filters.provinceCode,
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
        errorMessage: "Area filter could not be applied.",
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
    providerRatingSummariesResult,
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
      supabase.rpc("get_provider_rating_summaries", {
        target_provider_profile_ids: providerIds,
      }),
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
  const ratingSummariesByProvider = new Map<string, ProviderRatingSummaryRow>();
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

  ((providerRatingSummariesResult.data ?? []) as ProviderRatingSummaryRow[])
    .forEach((row) => {
      ratingSummariesByProvider.set(row.provider_profile_id, row);
    });

  return {
    categories,
    errorMessage:
      lookupError ||
      (providerLanguagesResult.error ||
        providerSpecialtiesResult.error ||
        providerServiceRegionsResult.error ||
        providerRatingSummariesResult.error
        ? "Some result details could not be loaded."
        : null),
    filters,
    languages,
    providers: providers.map((provider) => {
      const ratingSummary = ratingSummariesByProvider.get(provider.id);

      return {
        ...provider,
        averageRating: Number(ratingSummary?.average_rating ?? 0),
        categoryName: getCategoryName(categories, provider.category_id),
        isSaved: savedProviderIds.has(provider.id),
        languageNames: getNamesById(
          languages,
          languageIdsByProvider.get(provider.id) ?? [],
        ),
        ratingCount: Number(ratingSummary?.rating_count ?? 0),
        serviceRegionNames: getNamesById(
          serviceRegions,
          serviceRegionIdsByProvider.get(provider.id) ?? [],
        ),
        specialtyNames: getNamesById(
          specialties,
          specialtyIdsByProvider.get(provider.id) ?? [],
        ),
      };
    }),
    serviceRegions,
    specialties,
    subdivisions,
  };
}

function FilterSelect({
  children,
  defaultValue,
  formId,
  id,
  label,
  name,
}: {
  children: React.ReactNode;
  defaultValue: string;
  formId?: string;
  id: string;
  label: string;
  name: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-stone-800"
    >
      {label}
      <select
        id={id}
        form={formId}
        name={name}
        defaultValue={defaultValue}
        className="h-12 rounded-md border border-stone-300 bg-white px-3 text-base text-stone-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({
  defaultValue,
  formId,
  id,
  label,
  name,
  placeholder,
}: {
  defaultValue: string;
  formId?: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-stone-800"
    >
      {label}
      <input
        id={id}
        form={formId}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-12 rounded-md border border-stone-300 bg-white px-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
      />
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
  const selectedAreaLabel = filters.regionId
    ? getCategoryName(serviceRegions, filters.regionId)
    : filters.provinceCode
      ? (subdivisions.find(
          (subdivision) => subdivision.code === filters.provinceCode,
        )?.name ?? filters.provinceCode)
      : null;
  const filterLabels = [
    selectedAreaLabel ? `Region: ${selectedAreaLabel}` : null,
    filters.categoryId
      ? `Profession: ${getCategoryName(categories, filters.categoryId)}`
      : null,
    filters.languageId
      ? `Language: ${getCategoryName(languages, filters.languageId)}`
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
          className="rounded-md border border-teal-100 bg-teal-50 px-2.5 py-1.5 text-sm font-semibold text-teal-900"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function getContactLoginHref(returnPath: string) {
  const params = new URLSearchParams({
    next: returnPath,
    reason: "contact-provider",
  });

  return `/login?${params.toString()}`;
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
  const contactHref = `${providerHref}#contact`;
  const acceptsNewInquiries = provider.accept_new_inquiries ?? true;
  const visibleTags = [
    ...provider.languageNames.slice(0, 2),
    ...provider.specialtyNames.slice(0, 3),
  ].slice(0, 4);
  const hiddenTagCount =
    provider.languageNames.length + provider.specialtyNames.length - visibleTags.length;

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-teal-700 hover:shadow-md">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-teal-900">
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileImageUrl}
                alt={`${providerName} profile`}
                className="size-full object-cover"
              />
            ) : (
              <span className="grid size-full place-items-center text-lg font-semibold text-white">
                {getProviderInitials(providerName)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase text-teal-700">
              {provider.categoryName ?? "Real estate service"}
            </p>

            <h2 className="mt-2 text-xl font-semibold leading-tight text-stone-950">
              <Link href={providerHref} className="transition hover:text-teal-800">
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
            <p
              className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-700"
              aria-label={getRatingSummaryText(
                provider.averageRating,
                provider.ratingCount,
              )}
            >
              {provider.ratingCount > 0 ? (
                <StarRating rating={provider.averageRating} />
              ) : null}
              <span>
                {getRatingSummaryText(provider.averageRating, provider.ratingCount)}
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:w-48 xl:grid-cols-1">
          <Link
            href={providerHref}
            className="inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
          >
            View profile
          </Link>
          {acceptsNewInquiries ? (
            <Link
              href={isSignedIn ? contactHref : getContactLoginHref(contactHref)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-teal-800 hover:text-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
            >
              {isSignedIn ? "Contact" : "Log in to contact"}
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-500">
              Contact paused
            </span>
          )}
          <SaveProviderButton
            isSaved={provider.isSaved}
            isSignedIn={isSignedIn}
            providerId={provider.id}
            returnPath={returnPath}
            size="compact"
          />
        </div>
      </div>

      {provider.serviceRegionNames.length > 0 ? (
        <p className="mt-5 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900">
          Serves {provider.serviceRegionNames.join(" · ")}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-stone-600">
        {refineCustomerCopy(provider.bio)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleTags.length > 0 ? (
          visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-stone-100 px-2.5 py-1.5 text-sm font-semibold text-stone-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-stone-100 px-2.5 py-1.5 text-sm font-semibold text-stone-600">
            Details available on profile
          </span>
        )}
        {hiddenTagCount > 0 ? (
          <span className="rounded-md bg-stone-100 px-2.5 py-1.5 text-sm font-semibold text-stone-600">
            +{hiddenTagCount} more
          </span>
        ) : null}
      </div>
    </article>
  );
}

function EmptyState({
  hasFilters,
  regionName,
}: {
  hasFilters: boolean;
  regionName: string | null;
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-14 text-center shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-950">
        No providers found
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-stone-600">
        {hasFilters
          ? regionName
            ? `No active providers currently serve ${regionName}. Try another location or clear a filter.`
            : "No active providers match those filters yet. Try clearing one filter or choosing another area."
          : "No active providers are listed yet. Approved provider profiles will appear here."}
      </p>
      {hasFilters ? (
        <Link
          href="/search"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
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
  const selectedSubdivision =
    searchData.subdivisions.find(
      (subdivision) =>
        subdivision.code === searchData.filters.provinceCode,
    ) ?? null;
  const selectedServiceRegion =
    searchData.serviceRegions.find(
      (region) => region.id === searchData.filters.regionId,
    ) ?? null;

  return (
    <div className="bg-[#f7f5ef]">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">
              Provider search
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-stone-950">
              Find real estate services that cover your area.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
              Filter by service, address, language, and specialty, then compare
              active providers.
            </p>
          </div>
          <Link
            href="/signup?role=provider"
            className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-teal-800 hover:text-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
          >
            Join as Provider
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <form
          id={providerSearchFormId}
          action="/search"
          method="get"
          className="hidden"
          aria-hidden="true"
        />

        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          <ProviderLocationSearchFields
            formId={providerSearchFormId}
            initialProvinceCode={searchData.filters.provinceCode}
            initialProvinceName={selectedSubdivision?.name ?? null}
            initialRegionId={searchData.filters.regionId}
            initialRegionName={selectedServiceRegion?.name ?? null}
            regionControlId={providerRegionControlId}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase text-teal-700">
                    Filters
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">
                    Search providers
                  </h2>
                </div>
                <span className="rounded-md border border-stone-200 px-2.5 py-1.5 text-sm font-semibold text-stone-700">
                  {activeFilterCount} filter
                  {activeFilterCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 grid gap-4">
                <FilterInput
                  id="provider-keyword"
                  formId={providerSearchFormId}
                  name="q"
                  label="Keyword"
                  defaultValue={searchData.filters.keyword}
                  placeholder="Name, service, or keyword"
                />

                <FilterSelect
                  id={providerRegionControlId}
                  formId={providerSearchFormId}
                  name="region"
                  label="Region"
                  defaultValue={searchData.filters.regionId}
                >
                  <option value="">All regions</option>
                  {searchData.serviceRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}, {region.province_code}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect
                  id="provider-category"
                  formId={providerSearchFormId}
                  name="category"
                  label="Profession"
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
                  id="provider-specialty"
                  formId={providerSearchFormId}
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

                <FilterSelect
                  id="provider-language"
                  formId={providerSearchFormId}
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
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <button
                type="submit"
                form={providerSearchFormId}
                className="h-12 w-full rounded-md bg-stone-950 px-6 text-sm font-semibold text-white transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
              >
                Search providers
              </button>
              {activeFilterCount > 0 ? (
                <Link
                  href="/search"
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 text-sm font-semibold text-stone-800 transition hover:border-teal-800 hover:text-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
            </div>
          </aside>

          <div className="min-w-0">
          {searchData.errorMessage ? (
            <p
              className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
              role="status"
            >
              {searchData.errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-teal-700">
                Results
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                {searchData.providers.length} provider
                {searchData.providers.length === 1 ? "" : "s"} available
              </h2>
            </div>
            {activeFilterCount > 0 ? (
              <Link
                href="/search"
                className="text-sm font-semibold text-teal-800 transition hover:text-teal-950"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          {activeFilterCount > 0 ? (
            <div className="mt-4">
              <FilterSummary
                categories={searchData.categories}
                filters={searchData.filters}
                languages={searchData.languages}
                serviceRegions={searchData.serviceRegions}
                specialties={searchData.specialties}
                subdivisions={searchData.subdivisions}
              />
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
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
              <EmptyState
                hasFilters={activeFilterCount > 0}
                regionName={selectedServiceRegion?.name ?? null}
              />
            )}
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
