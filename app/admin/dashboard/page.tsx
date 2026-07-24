import Link from "next/link";
import type { ReactNode } from "react";
import {
  createLookupItem,
  setLookupActive,
  updateFeedbackSubmission,
  updateLookupItem,
} from "@/app/admin/dashboard/actions";
import { requireProfileRole } from "@/lib/auth/session";
import {
  FEEDBACK_SCREENSHOTS_BUCKET,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  feedbackStatusLabels,
  feedbackTypeLabels,
  isPlatformFeedbackStatus,
  isPlatformFeedbackType,
  type PlatformFeedbackStatus,
  type PlatformFeedbackType,
} from "@/lib/feedback";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type LookupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
};

type SpecialtyLookupRow = LookupRow & {
  category_id: string | null;
};

type ProviderSummaryRow = {
  id: string;
  business_name: string | null;
  display_name: string | null;
  email: string | null;
  city: string | null;
  province_state: string | null;
  status: ProviderProfileStatus;
  submitted_at: string | null;
  updated_at: string | null;
};

type AdminDashboardSearchParams = {
  status?: string | string[];
  page?: string | string[];
  feedbackAction?: string | string[];
  feedbackStatus?: string | string[];
  feedbackType?: string | string[];
  lookup?: string | string[];
  lookupAction?: string | string[];
  categoriesSearch?: string | string[];
  categoriesPage?: string | string[];
  languagesSearch?: string | string[];
  languagesPage?: string | string[];
  specialtiesSearch?: string | string[];
  specialtiesPage?: string | string[];
};

type AdminDashboardPageProps = {
  searchParams: Promise<AdminDashboardSearchParams>;
};

type LookupKind = "categories" | "languages" | "specialties";

type LookupAction =
  | "created"
  | "updated"
  | "deactivated"
  | "activated"
  | "invalid"
  | "duplicate"
  | "error";

type DashboardCountKey =
  | "userAccounts"
  | "providerAccounts"
  | "providerProfiles"
  | "pending"
  | "active"
  | "newFeedback"
  | "categories"
  | "languages"
  | "specialties";

type FeedbackStatusFilter = PlatformFeedbackStatus | "all";
type FeedbackTypeFilter = PlatformFeedbackType | "all";
type FeedbackAction = "updated" | "invalid" | "error";

type AdminGrowthCountsRow = {
  user_count: number | string;
  provider_count: number | string;
  admin_count: number | string;
  provider_profile_count: number | string;
  active_provider_profile_count: number | string;
  feedback_count: number | string;
  new_feedback_count: number | string;
};

type FeedbackQueueRow = {
  id: string;
  type: PlatformFeedbackType;
  title: string;
  description: string;
  current_page_url: string;
  reporter_user_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  screenshot_path: string | null;
  screenshotUrl: string | null;
  status: PlatformFeedbackStatus;
  internal_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type FeedbackQueueRpcRow = Omit<FeedbackQueueRow, "screenshotUrl">;

const providerStatusFilters = [
  "all",
  "pending_approval",
  "active",
  "inactive",
  "draft",
  "rejected",
] as const;

type ProviderStatusFilter = (typeof providerStatusFilters)[number];

type ProviderPageData = {
  rows: ProviderSummaryRow[];
  total: number;
  page: number;
  totalPages: number;
  statusFilter: ProviderStatusFilter;
};

const PROVIDERS_PER_PAGE = 10;
const LOOKUPS_PER_PAGE = 10;

const lookupKinds = ["categories", "languages", "specialties"] as const;

type LookupSearchState = {
  search: string;
  page: number;
};

type LookupSearchStates = Record<LookupKind, LookupSearchState>;

type LookupPageData<Row extends LookupRow | SpecialtyLookupRow> = {
  rows: Row[];
  total: number;
  page: number;
  totalPages: number;
  search: string;
};

const lookupParamNames: Record<
  LookupKind,
  {
    search: keyof AdminDashboardSearchParams;
    page: keyof AdminDashboardSearchParams;
  }
> = {
  categories: {
    search: "categoriesSearch",
    page: "categoriesPage",
  },
  languages: {
    search: "languagesSearch",
    page: "languagesPage",
  },
  specialties: {
    search: "specialtiesSearch",
    page: "specialtiesPage",
  },
};

const lookupActionMessages: Record<
  LookupAction,
  { tone: "success" | "error"; message: string }
> = {
  created: {
    tone: "success",
    message: "Record added.",
  },
  updated: {
    tone: "success",
    message: "Record updated.",
  },
  deactivated: {
    tone: "success",
    message: "Record deactivated.",
  },
  activated: {
    tone: "success",
    message: "Record activated.",
  },
  invalid: {
    tone: "error",
    message: "Add the required fields before saving.",
  },
  duplicate: {
    tone: "error",
    message: "That slug is already in use. Choose a different slug.",
  },
  error: {
    tone: "error",
    message: "The record could not be saved. Please try again.",
  },
};

const inputClassName =
  "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "min-h-20 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const selectClassName =
  "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const dashboardNavItems = [
  { href: "#providers", label: "Providers" },
  { href: "#feedback", label: "Feedback" },
  { href: "#categories", label: "Categories" },
  { href: "#languages", label: "Languages" },
  { href: "#specialties", label: "Specialties" },
];

const statusLabels: Record<ProviderProfileStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  active: "Active",
  inactive: "Inactive",
  rejected: "Rejected",
};

const statusClassNames: Record<ProviderProfileStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-900",
  pending_approval: "border-sky-200 bg-sky-50 text-sky-900",
  active: "border-emerald-200 bg-emerald-50 text-emerald-900",
  inactive: "border-stone-200 bg-stone-100 text-stone-700",
  rejected: "border-red-200 bg-red-50 text-red-800",
};

const feedbackStatusClassNames: Record<PlatformFeedbackStatus, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-900",
  reviewing: "border-amber-200 bg-amber-50 text-amber-900",
  planned: "border-violet-200 bg-violet-50 text-violet-900",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  closed: "border-stone-200 bg-stone-100 text-stone-700",
};

const feedbackTypeClassNames: Record<PlatformFeedbackType, string> = {
  bug: "border-red-200 bg-red-50 text-red-800",
  suggestion: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const feedbackActionMessages: Record<
  FeedbackAction,
  { tone: "success" | "error"; message: string }
> = {
  updated: {
    tone: "success",
    message: "Feedback updated.",
  },
  invalid: {
    tone: "error",
    message: "Choose a valid status and keep internal notes under 3,000 characters.",
  },
  error: {
    tone: "error",
    message: "Feedback could not be updated. Please try again.",
  },
};

const providerStatusFilterOptions: Array<{
  value: ProviderStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
];

const providerSummaryColumns = [
  "id",
  "business_name",
  "display_name",
  "email",
  "city",
  "province_state",
  "status",
  "submitted_at",
  "updated_at",
].join(",");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return dateFormatter.format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return dateTimeFormatter.format(new Date(value));
}

function getProviderName(provider: ProviderSummaryRow) {
  return (
    provider.business_name ??
    provider.display_name ??
    provider.email ??
    "Unnamed provider"
  );
}

function getProviderLocation(provider: ProviderSummaryRow) {
  const parts = [provider.city, provider.province_state].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getLookupKind(value: string | string[] | undefined) {
  const lookupKind = getQueryValue(value);

  return lookupKinds.includes(lookupKind as LookupKind)
    ? (lookupKind as LookupKind)
    : null;
}

function getLookupAction(value: string | string[] | undefined) {
  const lookupAction = getQueryValue(value);

  return lookupAction && lookupAction in lookupActionMessages
    ? (lookupAction as LookupAction)
    : null;
}

function getFeedbackAction(value: string | string[] | undefined) {
  const feedbackAction = getQueryValue(value);

  return feedbackAction && feedbackAction in feedbackActionMessages
    ? (feedbackAction as FeedbackAction)
    : null;
}

function getFeedbackStatusFilter(
  value: string | string[] | undefined,
): FeedbackStatusFilter {
  const status = getQueryValue(value);

  return isPlatformFeedbackStatus(status) ? status : "all";
}

function getFeedbackTypeFilter(
  value: string | string[] | undefined,
): FeedbackTypeFilter {
  const type = getQueryValue(value);

  return isPlatformFeedbackType(type) ? type : "all";
}

function getLookupSearch(value: string | string[] | undefined) {
  return (getQueryValue(value) ?? "").trim().slice(0, 120);
}

function getLookupSearchStates(
  query: AdminDashboardSearchParams,
): LookupSearchStates {
  return {
    categories: {
      search: getLookupSearch(query.categoriesSearch),
      page: getProviderPageNumber(query.categoriesPage),
    },
    languages: {
      search: getLookupSearch(query.languagesSearch),
      page: getProviderPageNumber(query.languagesPage),
    },
    specialties: {
      search: getLookupSearch(query.specialtiesSearch),
      page: getProviderPageNumber(query.specialtiesPage),
    },
  };
}

function getLookupSearchExpression(search: string) {
  const normalizedSearch = search
    .replace(/[,%()]/g, " ")
    .trim()
    .replace(/\s+/g, "%");

  return normalizedSearch
    ? `name.ilike.%${normalizedSearch}%,slug.ilike.%${normalizedSearch}%`
    : null;
}

function getLookupMessage({
  activeKind,
  currentKind,
  currentAction,
}: {
  activeKind: LookupKind;
  currentKind: LookupKind | null;
  currentAction: LookupAction | null;
}) {
  if (activeKind !== currentKind || !currentAction) {
    return null;
  }

  return lookupActionMessages[currentAction];
}

function getProviderStatusFilter(
  value: string | string[] | undefined,
): ProviderStatusFilter {
  const status = getQueryValue(value);

  return providerStatusFilters.includes(status as ProviderStatusFilter)
    ? (status as ProviderStatusFilter)
    : "all";
}

function getProviderPageNumber(value: string | string[] | undefined) {
  const parsedPage = Number.parseInt(getQueryValue(value) ?? "1", 10);

  return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function getProviderDashboardHref(
  statusFilter: ProviderStatusFilter,
  page: number,
) {
  const params = new URLSearchParams();

  if (statusFilter !== "all") {
    params.set("status", statusFilter);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return `/admin/dashboard${queryString ? `?${queryString}` : ""}#providers`;
}

function appendProviderParams(
  params: URLSearchParams,
  statusFilter: ProviderStatusFilter,
  page: number,
) {
  if (statusFilter !== "all") {
    params.set("status", statusFilter);
  }

  if (page > 1) {
    params.set("page", String(page));
  }
}

function appendLookupParams(
  params: URLSearchParams,
  lookupStates: LookupSearchStates,
  overrides?: Partial<Record<LookupKind, Partial<LookupSearchState>>>,
) {
  lookupKinds.forEach((kind) => {
    const state = {
      ...lookupStates[kind],
      ...overrides?.[kind],
    };
    const names = lookupParamNames[kind];

    if (state.search) {
      params.set(names.search, state.search);
    }

    if (state.page > 1) {
      params.set(names.page, String(state.page));
    }
  });
}

function appendFeedbackParams(
  params: URLSearchParams,
  statusFilter: FeedbackStatusFilter,
  typeFilter: FeedbackTypeFilter,
) {
  if (statusFilter !== "all") {
    params.set("feedbackStatus", statusFilter);
  }

  if (typeFilter !== "all") {
    params.set("feedbackType", typeFilter);
  }
}

function getFeedbackDashboardHref({
  statusFilter,
  typeFilter,
}: {
  statusFilter: FeedbackStatusFilter;
  typeFilter: FeedbackTypeFilter;
}) {
  const params = new URLSearchParams();
  appendFeedbackParams(params, statusFilter, typeFilter);

  const queryString = params.toString();

  return `/admin/dashboard${queryString ? `?${queryString}` : ""}#feedback`;
}

function getLookupDashboardHref({
  kind,
  lookupStates,
  providerStatusFilter,
  providerPage,
  search,
  page,
}: {
  kind: LookupKind;
  lookupStates: LookupSearchStates;
  providerStatusFilter: ProviderStatusFilter;
  providerPage: number;
  search: string;
  page: number;
}) {
  const params = new URLSearchParams();
  appendProviderParams(params, providerStatusFilter, providerPage);
  appendLookupParams(params, lookupStates, {
    [kind]: {
      search,
      page,
    },
  });

  const queryString = params.toString();

  return `/admin/dashboard${queryString ? `?${queryString}` : ""}#${kind}`;
}

function getProviderRangeLabel(providerPage: ProviderPageData) {
  if (providerPage.total === 0) {
    return "0 providers";
  }

  const start = (providerPage.page - 1) * PROVIDERS_PER_PAGE + 1;
  const end = Math.min(providerPage.total, providerPage.page * PROVIDERS_PER_PAGE);

  return `${start}-${end} of ${providerPage.total}`;
}

function getLookupRangeLabel<Row extends LookupRow | SpecialtyLookupRow>(
  lookupPage: LookupPageData<Row>,
) {
  if (lookupPage.total === 0) {
    return "0 records";
  }

  const start = (lookupPage.page - 1) * LOOKUPS_PER_PAGE + 1;
  const end = Math.min(lookupPage.total, lookupPage.page * LOOKUPS_PER_PAGE);

  return `${start}-${end} of ${lookupPage.total}`;
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    items.push("ellipsis-start");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) {
    items.push("ellipsis-end");
  }

  items.push(totalPages);

  return items;
}

async function getTableCount(tableName: string) {
  const supabase = await getServerSupabaseClient();
  const { count } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true });

  return count ?? 0;
}

async function getProviderCountByStatus(status: ProviderProfileStatus) {
  const supabase = await getServerSupabaseClient();
  const { count } = await supabase
    .from("provider_profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  return count ?? 0;
}

function getCountValue(value: number | string | null | undefined) {
  const normalizedValue =
    typeof value === "number" ? value : Number.parseInt(value ?? "0", 10);

  return Number.isFinite(normalizedValue) ? normalizedValue : 0;
}

function getDefaultGrowthCounts(): AdminGrowthCountsRow {
  return {
    user_count: 0,
    provider_count: 0,
    admin_count: 0,
    provider_profile_count: 0,
    active_provider_profile_count: 0,
    feedback_count: 0,
    new_feedback_count: 0,
  };
}

async function getAdminGrowthCounts(): Promise<AdminGrowthCountsRow> {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_admin_platform_growth_counts",
  );

  if (error) {
    console.error("Unable to load admin growth counts", error);

    return getDefaultGrowthCounts();
  }

  const row = Array.isArray(data) ? data[0] : data;

  return row ? (row as AdminGrowthCountsRow) : getDefaultGrowthCounts();
}

async function addFeedbackScreenshotUrls(
  rows: FeedbackQueueRpcRow[],
): Promise<FeedbackQueueRow[]> {
  const supabase = await getServerSupabaseClient();

  return Promise.all(
    rows.map(async (row) => {
      if (!row.screenshot_path) {
        return {
          ...row,
          screenshotUrl: null,
        };
      }

      const { data, error } = await supabase.storage
        .from(FEEDBACK_SCREENSHOTS_BUCKET)
        .createSignedUrl(row.screenshot_path, 60 * 60);

      return {
        ...row,
        screenshotUrl: error ? null : data?.signedUrl ?? null,
      };
    }),
  );
}

async function getFeedbackQueueData(
  statusFilter: FeedbackStatusFilter,
  typeFilter: FeedbackTypeFilter,
) {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_admin_platform_feedback", {
    result_limit: 50,
    target_status: statusFilter === "all" ? null : statusFilter,
    target_type: typeFilter === "all" ? null : typeFilter,
  });

  if (error) {
    console.error("Unable to load admin feedback queue", error);

    return [];
  }

  return addFeedbackScreenshotUrls((data ?? []) as FeedbackQueueRpcRow[]);
}

async function getProviderPageData(
  statusFilter: ProviderStatusFilter,
  requestedPage: number,
): Promise<ProviderPageData> {
  const supabase = await getServerSupabaseClient();
  let countQuery = supabase
    .from("provider_profiles")
    .select("id", { count: "exact", head: true });

  if (statusFilter !== "all") {
    countQuery = countQuery.eq("status", statusFilter);
  }

  const { count } = await countQuery;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PROVIDERS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const rangeStart = (page - 1) * PROVIDERS_PER_PAGE;
  const rangeEnd = rangeStart + PROVIDERS_PER_PAGE - 1;
  let providerQuery = supabase
    .from("provider_profiles")
    .select(providerSummaryColumns)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(rangeStart, rangeEnd);

  if (statusFilter !== "all") {
    providerQuery = providerQuery.eq("status", statusFilter);
  }

  const { data } = await providerQuery;

  return {
    rows: (data ?? []) as unknown as ProviderSummaryRow[],
    total,
    page,
    totalPages,
    statusFilter,
  };
}

async function getLookupPageData<Row extends LookupRow | SpecialtyLookupRow>({
  kind,
  columns,
  search,
  requestedPage,
}: {
  kind: LookupKind;
  columns: string;
  search: string;
  requestedPage: number;
}): Promise<LookupPageData<Row>> {
  const supabase = await getServerSupabaseClient();
  const searchExpression = getLookupSearchExpression(search);
  let countQuery = supabase
    .from(kind)
    .select("id", { count: "exact", head: true });

  if (searchExpression) {
    countQuery = countQuery.or(searchExpression);
  }

  const { count } = await countQuery;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LOOKUPS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const rangeStart = (page - 1) * LOOKUPS_PER_PAGE;
  const rangeEnd = rangeStart + LOOKUPS_PER_PAGE - 1;
  let lookupQuery = supabase
    .from(kind)
    .select(columns)
    .order("is_active", { ascending: false })
    .order("name")
    .range(rangeStart, rangeEnd);

  if (searchExpression) {
    lookupQuery = lookupQuery.or(searchExpression);
  }

  const { data } = await lookupQuery;

  return {
    rows: (data ?? []) as unknown as Row[],
    total,
    page,
    totalPages,
    search,
  };
}

async function getAdminDashboardData({
  statusFilter,
  feedbackStatusFilter,
  feedbackTypeFilter,
  page,
  lookupStates,
}: {
  statusFilter: ProviderStatusFilter;
  feedbackStatusFilter: FeedbackStatusFilter;
  feedbackTypeFilter: FeedbackTypeFilter;
  page: number;
  lookupStates: LookupSearchStates;
}) {
  const supabase = await getServerSupabaseClient();
  const [
    growthCounts,
    providerProfiles,
    pending,
    active,
    categories,
    languages,
    specialties,
    feedbackQueue,
    pendingProviders,
    providerPage,
    categoryPage,
    languagePage,
    specialtyPage,
    categoryOptions,
  ] = await Promise.all([
    getAdminGrowthCounts(),
    getTableCount("provider_profiles"),
    getProviderCountByStatus("pending_approval"),
    getProviderCountByStatus("active"),
    getTableCount("categories"),
    getTableCount("languages"),
    getTableCount("specialties"),
    getFeedbackQueueData(feedbackStatusFilter, feedbackTypeFilter),
    supabase
      .from("provider_profiles")
      .select(providerSummaryColumns)
      .eq("status", "pending_approval")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(6),
    getProviderPageData(statusFilter, page),
    getLookupPageData<LookupRow>({
      kind: "categories",
      columns: "id,name,slug,description,is_active",
      search: lookupStates.categories.search,
      requestedPage: lookupStates.categories.page,
    }),
    getLookupPageData<LookupRow>({
      kind: "languages",
      columns: "id,name,slug,is_active",
      search: lookupStates.languages.search,
      requestedPage: lookupStates.languages.page,
    }),
    getLookupPageData<SpecialtyLookupRow>({
      kind: "specialties",
      columns: "id,name,slug,description,category_id,is_active",
      search: lookupStates.specialties.search,
      requestedPage: lookupStates.specialties.page,
    }),
    supabase
      .from("categories")
      .select("id,name,slug,description,is_active")
      .order("is_active", { ascending: false })
      .order("name")
      .limit(500),
  ]);

  return {
    counts: {
      userAccounts: getCountValue(growthCounts.user_count),
      providerAccounts: getCountValue(growthCounts.provider_count),
      providerProfiles:
        getCountValue(growthCounts.provider_profile_count) || providerProfiles,
      pending,
      active: getCountValue(growthCounts.active_provider_profile_count) || active,
      newFeedback: getCountValue(growthCounts.new_feedback_count),
      categories,
      languages,
      specialties,
    } satisfies Record<DashboardCountKey, number>,
    pendingProviders: (pendingProviders.data ?? []) as unknown as ProviderSummaryRow[],
    feedbackQueue,
    providerPage,
    categoryPage,
    languagePage,
    specialtyPage,
    categoryOptions: (categoryOptions.data ?? []) as unknown as LookupRow[],
  };
}

function CountCard({
  label,
  value,
  tone = "light",
}: {
  label: string;
  value: number;
  tone?: "light" | "dark";
}) {
  const className =
    tone === "dark"
      ? "border-stone-950 bg-stone-950 text-white"
      : "border-stone-200 bg-white text-stone-950";

  return (
    <article className={`rounded-lg border p-5 shadow-sm ${className}`}>
      <p
        className={`text-sm font-medium ${
          tone === "dark" ? "text-stone-300" : "text-stone-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function ProviderReviewListItem({ provider }: { provider: ProviderSummaryRow }) {
  return (
    <div className="rounded-md border border-stone-200 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">
            {getProviderName(provider)}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {getProviderLocation(provider)}
          </p>
          <p className="mt-1 break-words text-xs text-stone-500">
            {provider.email ?? "Email not added"}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <span
            className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClassNames[provider.status]}`}
          >
            {statusLabels[provider.status]}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {formatDate(provider.submitted_at ?? provider.updated_at)}
          </p>
          <Link
            href={`/admin/dashboard/providers/${provider.id}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
          >
            Review profile
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProviderStatusFilters({
  selectedStatus,
}: {
  selectedStatus: ProviderStatusFilter;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Provider status filters">
      {providerStatusFilterOptions.map((option) => {
        const isSelected = option.value === selectedStatus;

        return (
          <Link
            key={option.value}
            href={getProviderDashboardHref(option.value, 1)}
            aria-current={isSelected ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition ${
              isSelected
                ? "border-stone-950 bg-stone-950 text-white"
                : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function ProviderPagination({ providerPage }: { providerPage: ProviderPageData }) {
  if (providerPage.totalPages <= 1) {
    return null;
  }

  const pageNumbers = Array.from(
    { length: providerPage.totalPages },
    (_, index) => index + 1,
  );
  const previousPage = Math.max(1, providerPage.page - 1);
  const nextPage = Math.min(providerPage.totalPages, providerPage.page + 1);

  return (
    <nav
      className="mt-5 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Provider pagination"
    >
      <Link
        href={getProviderDashboardHref(providerPage.statusFilter, previousPage)}
        aria-disabled={providerPage.page === 1}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          providerPage.page === 1 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Previous
      </Link>

      <div className="flex flex-wrap gap-2">
        {pageNumbers.map((pageNumber) => {
          const isCurrent = pageNumber === providerPage.page;

          return (
            <Link
              key={pageNumber}
              href={getProviderDashboardHref(
                providerPage.statusFilter,
                pageNumber,
              )}
              aria-current={isCurrent ? "page" : undefined}
              className={`inline-flex size-9 items-center justify-center rounded-md border text-xs font-semibold transition ${
                isCurrent
                  ? "border-stone-950 bg-stone-950 text-white"
                  : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
              }`}
            >
              {pageNumber}
            </Link>
          );
        })}
      </div>

      <Link
        href={getProviderDashboardHref(providerPage.statusFilter, nextPage)}
        aria-disabled={providerPage.page === providerPage.totalPages}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          providerPage.page === providerPage.totalPages
            ? "pointer-events-none opacity-50"
            : ""
        }`}
      >
        Next
      </Link>
    </nav>
  );
}

function FeedbackStatusBadge({ status }: { status: PlatformFeedbackStatus }) {
  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${feedbackStatusClassNames[status]}`}
    >
      {feedbackStatusLabels[status]}
    </span>
  );
}

function FeedbackTypeBadge({ type }: { type: PlatformFeedbackType }) {
  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${feedbackTypeClassNames[type]}`}
    >
      {feedbackTypeLabels[type]}
    </span>
  );
}

function FeedbackActionMessage({
  message,
}: {
  message: { tone: "success" | "error"; message: string } | null;
}) {
  if (!message) {
    return null;
  }

  const className =
    message.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      className={`mt-5 rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
      role={message.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message.message}
    </p>
  );
}

function FeedbackFilterLink({
  href,
  isSelected,
  children,
}: {
  href: string;
  isSelected: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isSelected ? "page" : undefined}
      className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition ${
        isSelected
          ? "border-stone-950 bg-stone-950 text-white"
          : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
      }`}
    >
      {children}
    </Link>
  );
}

function FeedbackFilters({
  statusFilter,
  typeFilter,
}: {
  statusFilter: FeedbackStatusFilter;
  typeFilter: FeedbackTypeFilter;
}) {
  return (
    <div className="mt-6 grid gap-4 rounded-md border border-stone-200 bg-stone-50 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Status
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <FeedbackFilterLink
            href={getFeedbackDashboardHref({
              statusFilter: "all",
              typeFilter,
            })}
            isSelected={statusFilter === "all"}
          >
            All statuses
          </FeedbackFilterLink>
          {FEEDBACK_STATUSES.map((status) => (
            <FeedbackFilterLink
              key={status}
              href={getFeedbackDashboardHref({
                statusFilter: status,
                typeFilter,
              })}
              isSelected={statusFilter === status}
            >
              {feedbackStatusLabels[status]}
            </FeedbackFilterLink>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Type
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <FeedbackFilterLink
            href={getFeedbackDashboardHref({
              statusFilter,
              typeFilter: "all",
            })}
            isSelected={typeFilter === "all"}
          >
            All feedback
          </FeedbackFilterLink>
          {FEEDBACK_TYPES.map((type) => (
            <FeedbackFilterLink
              key={type}
              href={getFeedbackDashboardHref({
                statusFilter,
                typeFilter: type,
              })}
              isSelected={typeFilter === type}
            >
              {feedbackTypeLabels[type]}
            </FeedbackFilterLink>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackQueueSection({
  rows,
  statusFilter,
  typeFilter,
  actionMessage,
}: {
  rows: FeedbackQueueRow[];
  statusFilter: FeedbackStatusFilter;
  typeFilter: FeedbackTypeFilter;
  actionMessage: { tone: "success" | "error"; message: string } | null;
}) {
  const queueLabel =
    rows.length === 1 ? "1 submission" : `${rows.length} submissions`;

  return (
    <article
      id="feedback"
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Feedback
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Bug reports and suggestions
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Review user-submitted feedback, keep internal notes, and move items
            through the product queue.
          </p>
        </div>
        <span className="w-fit rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          {queueLabel}
        </span>
      </div>

      <FeedbackActionMessage message={actionMessage} />

      <FeedbackFilters statusFilter={statusFilter} typeFilter={typeFilter} />

      <div className="mt-6 grid gap-3">
        {rows.length > 0 ? (
          rows.map((feedback) => (
            <details
              key={feedback.id}
              className="group rounded-md border border-stone-200 bg-white px-4 py-3"
            >
              <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&::-webkit-details-marker]:hidden">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 text-stone-400 transition group-open:rotate-90"
                    aria-hidden="true"
                  >
                    &gt;
                  </span>
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <FeedbackTypeBadge type={feedback.type} />
                      <FeedbackStatusBadge status={feedback.status} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-stone-950">
                      {feedback.title}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Submitted {formatDateTime(feedback.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium text-stone-900">
                    {feedback.reporter_name ?? "Deleted account"}
                  </p>
                  <p className="mt-1 break-words text-xs text-stone-500">
                    {feedback.reporter_email ?? "No email snapshot"}
                  </p>
                </div>
              </summary>

              <div className="mt-4 grid gap-4 border-t border-stone-200 pt-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Description
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">
                      {feedback.description}
                    </p>
                  </div>
                  <div className="grid gap-3 rounded-md bg-stone-50 p-4 text-sm text-stone-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Page
                      </p>
                      <a
                        href={feedback.current_page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all font-medium text-emerald-800 hover:text-emerald-900"
                      >
                        {feedback.current_page_url}
                      </a>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Screenshot
                      </p>
                      {feedback.screenshotUrl ? (
                        <a
                          href={feedback.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex font-semibold text-emerald-800 hover:text-emerald-900"
                        >
                          View screenshot
                        </a>
                      ) : (
                        <p className="mt-1 text-stone-500">
                          {feedback.screenshot_path
                            ? "Screenshot unavailable"
                            : "No screenshot attached"}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Last updated
                      </p>
                      <p className="mt-1">{formatDateTime(feedback.updated_at)}</p>
                    </div>
                    {feedback.reviewed_at ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Reviewed
                        </p>
                        <p className="mt-1">
                          {formatDateTime(feedback.reviewed_at)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <form
                  action={updateFeedbackSubmission}
                  className="grid gap-4 rounded-md border border-stone-200 bg-stone-50 p-4"
                >
                  <input name="feedbackId" type="hidden" value={feedback.id} />
                  <input
                    name="returnFeedbackStatus"
                    type="hidden"
                    value={statusFilter}
                  />
                  <input
                    name="returnFeedbackType"
                    type="hidden"
                    value={typeFilter}
                  />
                  <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
                    <label
                      htmlFor={`feedback-${feedback.id}-status`}
                      className="grid gap-2 text-sm font-medium text-stone-800"
                    >
                      Status
                      <select
                        id={`feedback-${feedback.id}-status`}
                        name="status"
                        defaultValue={feedback.status}
                        className={selectClassName}
                      >
                        {FEEDBACK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {feedbackStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label
                      htmlFor={`feedback-${feedback.id}-notes`}
                      className="grid gap-2 text-sm font-medium text-stone-800"
                    >
                      Internal notes
                      <textarea
                        id={`feedback-${feedback.id}-notes`}
                        name="internalNotes"
                        defaultValue={feedback.internal_notes ?? ""}
                        maxLength={3000}
                        placeholder="Add internal triage notes for other admins."
                        className={textareaClassName}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    >
                      Save feedback
                    </button>
                  </div>
                </form>
              </div>
            </details>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center">
            <p className="text-sm font-medium text-stone-700">
              No feedback matches these filters.
            </p>
            <Link
              href={getFeedbackDashboardHref({
                statusFilter: "all",
                typeFilter: "all",
              })}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
            >
              Clear filters
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function LookupStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-stone-200 bg-stone-100 text-stone-700"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function LookupActionMessage({
  message,
}: {
  message: { tone: "success" | "error"; message: string } | null;
}) {
  if (!message) {
    return null;
  }

  const className =
    message.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      className={`mt-5 rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
      role={message.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message.message}
    </p>
  );
}

function PreservedLookupSearchInputs({
  currentKind,
  lookupStates,
  providerStatusFilter,
  providerPage,
}: {
  currentKind: LookupKind;
  lookupStates: LookupSearchStates;
  providerStatusFilter: ProviderStatusFilter;
  providerPage: number;
}) {
  return (
    <>
      {providerStatusFilter !== "all" ? (
        <input name="status" type="hidden" value={providerStatusFilter} />
      ) : null}
      {providerPage > 1 ? (
        <input name="page" type="hidden" value={providerPage} />
      ) : null}
      {lookupKinds
        .filter((kind) => kind !== currentKind)
        .flatMap((kind) => {
          const state = lookupStates[kind];
          const names = lookupParamNames[kind];
          const inputs = [];

          if (state.search) {
            inputs.push(
              <input
                key={`${kind}-search`}
                name={names.search}
                type="hidden"
                value={state.search}
              />,
            );
          }

          if (state.page > 1) {
            inputs.push(
              <input
                key={`${kind}-page`}
                name={names.page}
                type="hidden"
                value={state.page}
              />,
            );
          }

          return inputs;
        })}
    </>
  );
}

function LookupSearchControls({
  id,
  kind,
  title,
  lookupPage,
  lookupStates,
  providerStatusFilter,
  providerPage,
}: {
  id: string;
  kind: LookupKind;
  title: string;
  lookupPage: LookupPageData<LookupRow | SpecialtyLookupRow>;
  lookupStates: LookupSearchStates;
  providerStatusFilter: ProviderStatusFilter;
  providerPage: number;
}) {
  return (
    <form
      action={`/admin/dashboard#${id}`}
      className="mt-6 grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[1fr_auto_auto]"
    >
      <PreservedLookupSearchInputs
        currentKind={kind}
        lookupStates={lookupStates}
        providerStatusFilter={providerStatusFilter}
        providerPage={providerPage}
      />
      <label
        htmlFor={`${kind}-search`}
        className="grid gap-2 text-sm font-medium text-stone-800"
      >
        Search {title.toLowerCase()}
        <input
          id={`${kind}-search`}
          name={lookupParamNames[kind].search}
          type="search"
          defaultValue={lookupPage.search}
          placeholder={`Search ${title.toLowerCase()}`}
          className={inputClassName}
        />
      </label>
      <button
        type="submit"
        className="h-10 self-end rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-100"
      >
        Search
      </button>
      {lookupPage.search ? (
        <Link
          href={getLookupDashboardHref({
            kind,
            lookupStates,
            providerStatusFilter,
            providerPage,
            search: "",
            page: 1,
          })}
          className="inline-flex h-10 items-center justify-center self-end rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

function LookupPagination({
  kind,
  lookupPage,
  lookupStates,
  providerStatusFilter,
  providerPage,
}: {
  kind: LookupKind;
  lookupPage: LookupPageData<LookupRow | SpecialtyLookupRow>;
  lookupStates: LookupSearchStates;
  providerStatusFilter: ProviderStatusFilter;
  providerPage: number;
}) {
  if (lookupPage.totalPages <= 1) {
    return null;
  }

  const paginationItems = getPaginationItems(
    lookupPage.page,
    lookupPage.totalPages,
  );
  const previousPage = Math.max(1, lookupPage.page - 1);
  const nextPage = Math.min(lookupPage.totalPages, lookupPage.page + 1);

  return (
    <nav
      className="mt-5 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`${kind} pagination`}
    >
      <Link
        href={getLookupDashboardHref({
          kind,
          lookupStates,
          providerStatusFilter,
          providerPage,
          search: lookupPage.search,
          page: previousPage,
        })}
        aria-disabled={lookupPage.page === 1}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          lookupPage.page === 1 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Previous
      </Link>

      <div className="flex flex-wrap gap-2">
        {paginationItems.map((pageNumber) => {
          if (typeof pageNumber !== "number") {
            return (
              <span
                key={pageNumber}
                className="inline-flex size-9 items-center justify-center text-xs font-semibold text-stone-400"
              >
                ...
              </span>
            );
          }

          const isCurrent = pageNumber === lookupPage.page;

          return (
            <Link
              key={pageNumber}
              href={getLookupDashboardHref({
                kind,
                lookupStates,
                providerStatusFilter,
                providerPage,
                search: lookupPage.search,
                page: pageNumber,
              })}
              aria-current={isCurrent ? "page" : undefined}
              className={`inline-flex size-9 items-center justify-center rounded-md border text-xs font-semibold transition ${
                isCurrent
                  ? "border-stone-950 bg-stone-950 text-white"
                  : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
              }`}
            >
              {pageNumber}
            </Link>
          );
        })}
      </div>

      <Link
        href={getLookupDashboardHref({
          kind,
          lookupStates,
          providerStatusFilter,
          providerPage,
          search: lookupPage.search,
          page: nextPage,
        })}
        aria-disabled={lookupPage.page === lookupPage.totalPages}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          lookupPage.page === lookupPage.totalPages
            ? "pointer-events-none opacity-50"
            : ""
        }`}
      >
        Next
      </Link>
    </nav>
  );
}

function getLookupRowCategoryId(row: LookupRow | SpecialtyLookupRow | null) {
  return row && "category_id" in row ? row.category_id ?? "" : "";
}

function LookupFormFields({
  kind,
  row,
  categories,
  idPrefix,
}: {
  kind: LookupKind;
  row: LookupRow | SpecialtyLookupRow | null;
  categories: LookupRow[];
  idPrefix: string;
}) {
  const showDescription = kind === "categories" || kind === "specialties";
  const showCategory = kind === "specialties";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <label
        htmlFor={`${idPrefix}-name`}
        className="grid gap-2 text-sm font-medium text-stone-800"
      >
        Name
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          defaultValue={row?.name ?? ""}
          className={inputClassName}
          required
        />
      </label>

      <label
        htmlFor={`${idPrefix}-slug`}
        className="grid gap-2 text-sm font-medium text-stone-800"
      >
        Slug
        <input
          id={`${idPrefix}-slug`}
          name="slug"
          type="text"
          defaultValue={row?.slug ?? ""}
          placeholder="Auto-generated if blank"
          className={inputClassName}
        />
      </label>

      {showCategory ? (
        <label
          htmlFor={`${idPrefix}-category`}
          className="grid gap-2 text-sm font-medium text-stone-800"
        >
          Category
          <select
            id={`${idPrefix}-category`}
            name="categoryId"
            defaultValue={getLookupRowCategoryId(row)}
            className={selectClassName}
            required
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showDescription ? (
        <label
          htmlFor={`${idPrefix}-description`}
          className={`grid gap-2 text-sm font-medium text-stone-800 ${
            showCategory ? "" : "lg:col-span-2"
          }`}
        >
          Description
          <textarea
            id={`${idPrefix}-description`}
            name="description"
            defaultValue={row?.description ?? ""}
            className={textareaClassName}
          />
        </label>
      ) : null}
    </div>
  );
}

function LookupManagementSection({
  id,
  kind,
  title,
  count,
  lookupPage,
  categories,
  message,
  lookupStates,
  providerStatusFilter,
  providerPage,
}: {
  id: string;
  kind: LookupKind;
  title: string;
  count: number;
  lookupPage: LookupPageData<LookupRow | SpecialtyLookupRow>;
  categories: LookupRow[];
  message: { tone: "success" | "error"; message: string } | null;
  lookupStates: LookupSearchStates;
  providerStatusFilter: ProviderStatusFilter;
  providerPage: number;
}) {
  const singularTitle = title.endsWith("ies")
    ? title.replace(/ies$/, "y")
    : title.replace(/s$/, "");
  const rangeLabel = getLookupRangeLabel(lookupPage);

  return (
    <article
      id={id}
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Directory data
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">{title}</h2>
          <p className="mt-2 text-sm text-stone-600">
            Showing {rangeLabel}
            {lookupPage.search ? ` for "${lookupPage.search}"` : ""}
          </p>
        </div>
        <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
          {count}
        </span>
      </div>

      <LookupActionMessage message={message} />

      <LookupSearchControls
        id={id}
        kind={kind}
        title={title}
        lookupPage={lookupPage}
        lookupStates={lookupStates}
        providerStatusFilter={providerStatusFilter}
        providerPage={providerPage}
      />

      <form
        action={createLookupItem}
        className="mt-6 grid gap-4 rounded-md border border-stone-200 bg-stone-50 p-4"
      >
        <input name="lookupKind" type="hidden" value={kind} />
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Add {singularTitle}
          </h3>
          <button
            type="submit"
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            Add
          </button>
        </div>
        <LookupFormFields
          kind={kind}
          row={null}
          categories={categories}
          idPrefix={`${kind}-new`}
        />
      </form>

      <div className="mt-6 grid gap-3">
        {lookupPage.rows.length > 0 ? (
          lookupPage.rows.map((row) => (
            <details
              key={row.id}
              className={`group rounded-md border px-4 py-3 ${
                row.is_active
                  ? "border-stone-200 bg-white"
                  : "border-stone-200 bg-stone-50"
              }`}
            >
              <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&::-webkit-details-marker]:hidden">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 text-stone-400 transition group-open:rotate-90"
                    aria-hidden="true"
                  >
                    &gt;
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-stone-950">
                      {row.name}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">{row.slug}</p>
                  </div>
                </div>
                <LookupStatusBadge isActive={row.is_active} />
              </summary>

              <div className="mt-4 grid gap-4 border-t border-stone-200 pt-4">
                <form action={updateLookupItem} className="grid gap-4">
                  <input name="lookupKind" type="hidden" value={kind} />
                  <input name="lookupId" type="hidden" value={row.id} />
                  <LookupFormFields
                    kind={kind}
                    row={row}
                    categories={categories}
                    idPrefix={`${kind}-${row.id}`}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="submit"
                      className="h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
                    >
                      Save changes
                    </button>
                  </div>
                </form>
                <form action={setLookupActive} className="flex justify-end">
                  <input name="lookupKind" type="hidden" value={kind} />
                  <input name="lookupId" type="hidden" value={row.id} />
                  <input
                    name="isActive"
                    type="hidden"
                    value={row.is_active ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className={`h-10 rounded-md px-4 text-sm font-semibold transition focus:outline-none focus:ring-4 ${
                      row.is_active
                        ? "border border-red-200 text-red-700 hover:border-red-700 hover:text-red-800 focus:ring-red-100"
                        : "bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-100"
                    }`}
                  >
                    {row.is_active ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            </details>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">
            No records found.
          </p>
        )}
      </div>

      <LookupPagination
        kind={kind}
        lookupPage={lookupPage}
        lookupStates={lookupStates}
        providerStatusFilter={providerStatusFilter}
        providerPage={providerPage}
      />
    </article>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const profile = await requireProfileRole("admin");
  const query = await searchParams;
  const statusFilter = getProviderStatusFilter(query.status);
  const feedbackStatusFilter = getFeedbackStatusFilter(query.feedbackStatus);
  const feedbackTypeFilter = getFeedbackTypeFilter(query.feedbackType);
  const feedbackAction = getFeedbackAction(query.feedbackAction);
  const providerPageNumber = getProviderPageNumber(query.page);
  const lookupStates = getLookupSearchStates(query);
  const activeLookupKind = getLookupKind(query.lookup);
  const activeLookupAction = getLookupAction(query.lookupAction);
  const dashboardData = await getAdminDashboardData({
    statusFilter,
    feedbackStatusFilter,
    feedbackTypeFilter,
    page: providerPageNumber,
    lookupStates,
  });

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Admin
          </p>
          <nav
            aria-label="Admin dashboard navigation"
            className="mt-3 grid gap-1 text-sm font-medium"
          >
            {dashboardNavItems.map((item) => (
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
              {profile.email ?? profile.fullName ?? "Admin account"}
            </p>
          </div>
        </aside>

        <div className="grid gap-6">
          <header className="scroll-mt-28">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Admin dashboard
            </p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-stone-950">
                  Platform operations
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  Review provider status, platform feedback, and directory
                  lookup data from one admin workspace.
                </p>
              </div>
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                View Directory
              </Link>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CountCard
              label="User accounts"
              value={dashboardData.counts.userAccounts}
            />
            <CountCard
              label="Provider accounts"
              value={dashboardData.counts.providerAccounts}
            />
            <CountCard
              label="Pending approval"
              value={dashboardData.counts.pending}
              tone="dark"
            />
            <CountCard label="Active listings" value={dashboardData.counts.active} />
            <CountCard
              label="Provider profiles"
              value={dashboardData.counts.providerProfiles}
            />
            <CountCard
              label="New feedback"
              value={dashboardData.counts.newFeedback}
            />
            <CountCard label="Categories" value={dashboardData.counts.categories} />
            <CountCard label="Languages" value={dashboardData.counts.languages} />
            <CountCard label="Specialties" value={dashboardData.counts.specialties} />
          </div>

          <article
            id="providers"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Providers
                </p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">
                  Approval queue
                </h2>
              </div>
              <span className="w-fit rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
                {dashboardData.counts.pending} pending
              </span>
            </div>

            <div className="mt-6 grid gap-3">
              {dashboardData.pendingProviders.length > 0 ? (
                dashboardData.pendingProviders.map((provider) => (
                  <ProviderReviewListItem key={provider.id} provider={provider} />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center text-sm font-medium text-stone-600">
                  No providers are pending approval.
                </p>
              )}
            </div>

            <div className="mt-8 border-t border-stone-200 pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                    All provider profiles
                  </h3>
                  <p className="mt-2 text-sm text-stone-600">
                    Showing {getProviderRangeLabel(dashboardData.providerPage)}
                  </p>
                </div>
                <ProviderStatusFilters
                  selectedStatus={dashboardData.providerPage.statusFilter}
                />
              </div>

              <div className="mt-4 grid gap-3">
                {dashboardData.providerPage.rows.length > 0 ? (
                  dashboardData.providerPage.rows.map((provider) => (
                    <ProviderReviewListItem
                      key={provider.id}
                      provider={provider}
                    />
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center text-sm font-medium text-stone-600">
                    No provider profiles found for this filter.
                  </p>
                )}
              </div>

              <ProviderPagination providerPage={dashboardData.providerPage} />
            </div>
          </article>

          <FeedbackQueueSection
            rows={dashboardData.feedbackQueue}
            statusFilter={feedbackStatusFilter}
            typeFilter={feedbackTypeFilter}
            actionMessage={
              feedbackAction ? feedbackActionMessages[feedbackAction] : null
            }
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <LookupManagementSection
              id="categories"
              kind="categories"
              title="Categories"
              count={dashboardData.counts.categories}
              lookupPage={dashboardData.categoryPage}
              categories={dashboardData.categoryOptions}
              lookupStates={lookupStates}
              providerStatusFilter={statusFilter}
              providerPage={providerPageNumber}
              message={getLookupMessage({
                activeKind: "categories",
                currentKind: activeLookupKind,
                currentAction: activeLookupAction,
              })}
            />
            <LookupManagementSection
              id="languages"
              kind="languages"
              title="Languages"
              count={dashboardData.counts.languages}
              lookupPage={dashboardData.languagePage}
              categories={dashboardData.categoryOptions}
              lookupStates={lookupStates}
              providerStatusFilter={statusFilter}
              providerPage={providerPageNumber}
              message={getLookupMessage({
                activeKind: "languages",
                currentKind: activeLookupKind,
                currentAction: activeLookupAction,
              })}
            />
            <LookupManagementSection
              id="specialties"
              kind="specialties"
              title="Specialties"
              count={dashboardData.counts.specialties}
              lookupPage={dashboardData.specialtyPage}
              categories={dashboardData.categoryOptions}
              lookupStates={lookupStates}
              providerStatusFilter={statusFilter}
              providerPage={providerPageNumber}
              message={getLookupMessage({
                activeKind: "specialties",
                currentKind: activeLookupKind,
                currentAction: activeLookupAction,
              })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
