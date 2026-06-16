import Link from "next/link";
import { requireProfileRole } from "@/lib/auth/session";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type LookupRow = {
  id: string;
  name: string;
  slug: string;
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

type DashboardCountKey =
  | "providers"
  | "pending"
  | "active"
  | "categories"
  | "languages"
  | "specialties";

const dashboardNavItems = [
  { href: "#providers", label: "Providers" },
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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return dateFormatter.format(new Date(value));
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

async function getAdminDashboardData() {
  const supabase = await getServerSupabaseClient();
  const [
    providers,
    pending,
    active,
    categories,
    languages,
    specialties,
    pendingProviders,
    categoryRows,
    languageRows,
    specialtyRows,
  ] = await Promise.all([
    getTableCount("provider_profiles"),
    getProviderCountByStatus("pending_approval"),
    getProviderCountByStatus("active"),
    getTableCount("categories"),
    getTableCount("languages"),
    getTableCount("specialties"),
    supabase
      .from("provider_profiles")
      .select(
        [
          "id",
          "business_name",
          "display_name",
          "email",
          "city",
          "province_state",
          "status",
          "submitted_at",
          "updated_at",
        ].join(","),
      )
      .eq("status", "pending_approval")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(6),
    supabase
      .from("categories")
      .select("id,name,slug")
      .order("name")
      .limit(8),
    supabase
      .from("languages")
      .select("id,name,slug")
      .order("name")
      .limit(8),
    supabase
      .from("specialties")
      .select("id,name,slug")
      .order("name")
      .limit(8),
  ]);

  return {
    counts: {
      providers,
      pending,
      active,
      categories,
      languages,
      specialties,
    } satisfies Record<DashboardCountKey, number>,
    pendingProviders: (pendingProviders.data ?? []) as unknown as ProviderSummaryRow[],
    categories: (categoryRows.data ?? []) as unknown as LookupRow[],
    languages: (languageRows.data ?? []) as unknown as LookupRow[],
    specialties: (specialtyRows.data ?? []) as unknown as LookupRow[],
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

function LookupSection({
  id,
  title,
  count,
  rows,
}: {
  id: string;
  title: string;
  count: number;
  rows: LookupRow[];
}) {
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
        </div>
        <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
          {count}
        </span>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-md border border-stone-200 px-4 py-3"
            >
              <p className="text-sm font-semibold text-stone-950">{row.name}</p>
              <p className="mt-1 text-xs text-stone-500">{row.slug}</p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">
            No records found.
          </p>
        )}
      </div>
    </article>
  );
}

export default async function AdminDashboardPage() {
  const profile = await requireProfileRole("admin");
  const dashboardData = await getAdminDashboardData();

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
                  Review provider status and directory lookup data from one
                  admin workspace.
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
              label="Pending approval"
              value={dashboardData.counts.pending}
              tone="dark"
            />
            <CountCard label="Providers" value={dashboardData.counts.providers} />
            <CountCard label="Active listings" value={dashboardData.counts.active} />
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
                  <div
                    key={provider.id}
                    className="rounded-md border border-stone-200 px-4 py-3"
                  >
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
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center text-sm font-medium text-stone-600">
                  No providers are pending approval.
                </p>
              )}
            </div>
          </article>

          <div className="grid gap-6 xl:grid-cols-2">
            <LookupSection
              id="categories"
              title="Categories"
              count={dashboardData.counts.categories}
              rows={dashboardData.categories}
            />
            <LookupSection
              id="languages"
              title="Languages"
              count={dashboardData.counts.languages}
              rows={dashboardData.languages}
            />
            <LookupSection
              id="specialties"
              title="Specialties"
              count={dashboardData.counts.specialties}
              rows={dashboardData.specialties}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
