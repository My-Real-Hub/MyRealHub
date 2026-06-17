import Link from "next/link";
import {
  ProviderProfileForm,
  type ProviderProfileCategoryOption,
  type ProviderProfileFormData,
  type ProviderProfileLanguageOption,
  type ProviderProfileSpecialtyOption,
} from "@/components/providers/provider-profile-form";
import { requireProfileRole } from "@/lib/auth/session";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type DashboardStatus = ProviderProfileStatus | "not_started";

type ContactRequestStatus = "new" | "read" | "responded" | "archived";

type ProviderProfileRow = ProviderProfileFormData & {
  service_area: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string | null;
};

type ProviderProfileBaseRow = Omit<
  ProviderProfileRow,
  "languageIds" | "specialtyIds"
>;

type ProviderLanguageRow = {
  language_id: string;
};

type ProviderSpecialtyRow = {
  specialty_id: string;
};

type ContactRequestRow = {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  status: ContactRequestStatus;
  created_at: string;
};

type StatusContent = {
  label: string;
  badgeClassName: string;
  summary: string;
  nextStep: string;
};

const statusContent: Record<DashboardStatus, StatusContent> = {
  not_started: {
    label: "Not started",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "No provider listing has been started for this account yet.",
    nextStep: "Create the first draft of your provider profile.",
  },
  draft: {
    label: "Draft",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-900",
    summary: "Your listing is private while you prepare it for submission.",
    nextStep: "Finish profile details and submit for admin review.",
  },
  pending_approval: {
    label: "Pending approval",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-900",
    summary: "Your listing is waiting for admin approval.",
    nextStep: "Watch for approval updates from the MyRealHub team.",
  },
  active: {
    label: "Active",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    summary: "Your listing is approved and ready for public directory surfaces.",
    nextStep: "Keep service details and contact information current.",
  },
  inactive: {
    label: "Inactive",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "Your listing exists but is hidden from public directory surfaces.",
    nextStep: "Update profile details and request reactivation when ready.",
  },
  rejected: {
    label: "Rejected",
    badgeClassName: "border-red-200 bg-red-50 text-red-800",
    summary: "Your listing needs changes before it can be approved.",
    nextStep: "Review the admin note and update the profile draft.",
  },
};

const dashboardNavItems = [
  { href: "#overview", label: "Overview" },
  { href: "#profile", label: "Profile" },
  { href: "#inquiries", label: "Inquiries" },
  { href: "#settings", label: "Settings" },
];

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

function getDisplayName(
  providerProfile: ProviderProfileRow | null,
  fallbackName: string | null,
) {
  return (
    providerProfile?.business_name ??
    providerProfile?.display_name ??
    fallbackName ??
    "Provider account"
  );
}

function getLocationLabel(providerProfile: ProviderProfileRow | null) {
  const parts = [
    providerProfile?.city,
    providerProfile?.province_state,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getStatusTimestamp(providerProfile: ProviderProfileRow | null) {
  if (!providerProfile) {
    return "Profile not created";
  }

  if (providerProfile.approved_at) {
    return `Approved ${formatDate(providerProfile.approved_at)}`;
  }

  if (providerProfile.submitted_at) {
    return `Submitted ${formatDate(providerProfile.submitted_at)}`;
  }

  return `Updated ${formatDate(providerProfile.updated_at)}`;
}

function countCompletedProfileFields(providerProfile: ProviderProfileRow | null) {
  if (!providerProfile) {
    return 0;
  }

  return [
    providerProfile.business_name,
    providerProfile.display_name,
    providerProfile.category_id,
    providerProfile.bio,
    providerProfile.email,
    providerProfile.phone,
    providerProfile.city,
    providerProfile.province_state,
    providerProfile.country,
    providerProfile.languageIds.length > 0 ? "languages" : null,
    providerProfile.specialtyIds.length > 0 ? "specialties" : null,
  ].filter(Boolean).length;
}

async function getProviderProfile(userId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select(
      [
        "id",
        "category_id",
        "business_name",
        "display_name",
        "bio",
        "phone",
        "email",
        "website_url",
        "city",
        "province_state",
        "country",
        "service_area",
        "profile_image_path",
        "profile_image_url",
        "status",
        "rejection_reason",
        "submitted_at",
        "approved_at",
        "updated_at",
      ].join(","),
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const providerProfile = data as unknown as ProviderProfileBaseRow;
  const [languageRows, specialtyRows] = await Promise.all([
    supabase
      .from("provider_languages")
      .select("language_id")
      .eq("provider_profile_id", providerProfile.id),
    supabase
      .from("provider_specialties")
      .select("specialty_id")
      .eq("provider_profile_id", providerProfile.id),
  ]);

  return {
    ...providerProfile,
    languageIds: ((languageRows.data ?? []) as ProviderLanguageRow[]).map(
      (row) => row.language_id,
    ),
    specialtyIds: ((specialtyRows.data ?? []) as ProviderSpecialtyRow[]).map(
      (row) => row.specialty_id,
    ),
  };
}

async function getProviderProfileLookups() {
  const supabase = await getServerSupabaseClient();
  const [categoriesResult, languagesResult, specialtiesResult] =
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
    ]);

  return {
    categories: (categoriesResult.data ?? []) as ProviderProfileCategoryOption[],
    languages: (languagesResult.data ?? []) as ProviderProfileLanguageOption[],
    specialties: (specialtiesResult.data ?? []) as ProviderProfileSpecialtyOption[],
  };
}

async function getInquirySummary(providerProfileId: string | null) {
  if (!providerProfileId) {
    return {
      total: 0,
      unread: 0,
      recent: [] as ContactRequestRow[],
    };
  }

  const supabase = await getServerSupabaseClient();
  const [totalResult, unreadResult, recentResult] = await Promise.all([
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("provider_profile_id", providerProfileId),
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("provider_profile_id", providerProfileId)
      .eq("status", "new"),
    supabase
      .from("contact_requests")
      .select("id,sender_name,sender_email,sender_phone,message,status,created_at")
      .eq("provider_profile_id", providerProfileId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return {
    total: totalResult.count ?? 0,
    unread: unreadResult.count ?? 0,
    recent: (recentResult.data ?? []) as ContactRequestRow[],
  };
}

export default async function ProviderDashboardPage() {
  const profile = await requireProfileRole("provider");
  const providerProfile = await getProviderProfile(profile.id);
  const [inquirySummary, lookups] = await Promise.all([
    getInquirySummary(providerProfile?.id ?? null),
    getProviderProfileLookups(),
  ]);
  const statusKey = providerProfile?.status ?? "not_started";
  const status = statusContent[statusKey];
  const completedFields = countCompletedProfileFields(providerProfile);
  const displayName = getDisplayName(providerProfile, profile.fullName);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Provider
          </p>
          <nav
            aria-label="Provider dashboard navigation"
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
              {profile.email ?? displayName}
            </p>
          </div>
        </aside>

        <div className="grid gap-6">
          <header id="overview" className="scroll-mt-28">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Provider dashboard
            </p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-stone-950">
                  {displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  Manage your listing, approval status, and contact requests from
                  one provider workspace.
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

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-500">
                    Profile status
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                    {status.label}
                  </h2>
                </div>
                <span
                  className={`inline-flex w-fit rounded-md border px-3 py-1 text-sm font-semibold ${status.badgeClassName}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                {status.summary}
              </p>
              <dl className="mt-5 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Status date
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stone-900">
                    {getStatusTimestamp(providerProfile)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Next step
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stone-900">
                    {status.nextStep}
                  </dd>
                </div>
              </dl>
              {providerProfile?.rejection_reason ? (
                <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  {providerProfile.rejection_reason}
                </p>
              ) : null}
            </article>

            <article className="rounded-lg border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
              <p className="text-sm font-medium text-stone-300">
                Inquiry snapshot
              </p>
              <p className="mt-3 text-4xl font-semibold">
                {inquirySummary.unread}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                New requests out of {inquirySummary.total} total.
              </p>
            </article>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">
                Profile fields
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {completedFields}/11
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Core listing fields currently populated.
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">Location</p>
              <p className="mt-3 text-lg font-semibold text-stone-950">
                {getLocationLabel(providerProfile)}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {providerProfile?.service_area ?? "Service area not added"}
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">Contact</p>
              <p className="mt-3 break-words text-sm font-semibold text-stone-950">
                {providerProfile?.email ?? profile.email ?? "Email not added"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {providerProfile?.phone ?? "Phone not added"}
              </p>
            </article>
          </div>

          <div className="grid gap-6">
            <article
              id="profile"
              className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                    Profile editing
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">
                    Listing workspace
                  </h2>
                </div>
                <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                  {status.label}
                </span>
              </div>

              <div className="mt-6">
                <ProviderProfileForm
                  profile={providerProfile}
                  categories={lookups.categories}
                  languages={lookups.languages}
                  specialties={lookups.specialties}
                  accountId={profile.id}
                  accountEmail={profile.email}
                  accountFullName={profile.fullName}
                />
              </div>
            </article>

            <article
              id="inquiries"
              className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                    Inquiries
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">
                    Contact requests
                  </h2>
                </div>
                <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                  Placeholder
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {inquirySummary.recent.length > 0 ? (
                  inquirySummary.recent.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-md border border-stone-200 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-stone-950">
                            {request.sender_name}
                          </p>
                          <p className="mt-1 break-words text-sm text-stone-600">
                            {request.sender_email}
                          </p>
                          {request.sender_phone ? (
                            <p className="mt-1 break-words text-sm text-stone-600">
                              {request.sender_phone}
                            </p>
                          ) : null}
                        </div>
                        <span className="w-fit rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
                          {request.status}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-700">
                        {request.message}
                      </p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-stone-950">
                      No contact requests yet
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      New inquiries will appear here after visitors contact your
                      profile.
                    </p>
                  </div>
                )}
              </div>
            </article>
          </div>

          <article
            id="settings"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Settings
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">
              Account and listing controls
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                "Profile visibility",
                "Notification preferences",
                "Approval history",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm font-semibold text-stone-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
