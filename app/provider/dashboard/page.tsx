import Link from "next/link";
import {
  DashboardHeader,
  DashboardSection,
  DashboardShell,
  DashboardStatCard,
} from "@/components/dashboard/dashboard-shell";
import { ConversationCenter } from "@/components/messages/conversation-center";
import type { ProviderProfileFormData } from "@/components/providers/provider-profile-form";
import { requireProfileRole } from "@/lib/auth/session";
import { getQueryValue } from "@/lib/contact-requests";
import { getProviderConversationCenterData } from "@/lib/messages";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ProviderDashboardPageProps = {
  searchParams: Promise<ProviderDashboardSearchParams>;
};

type ProviderDashboardSearchParams = {
  inquiry?: string | string[];
};

type DashboardStatus = ProviderProfileStatus | "not_started";

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
    summary: "Your listing is approved and visible in the directory.",
    nextStep: "Keep service details and contact information current.",
  },
  inactive: {
    label: "Inactive",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "Your listing exists but is hidden from public search.",
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
  { href: "#listing", label: "Listing" },
  { href: "#inquiries", label: "Inquiries" },
  { href: "#customer-tools", label: "Customer tools" },
  { href: "/settings", label: "Settings" },
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

export default async function ProviderDashboardPage({
  searchParams,
}: ProviderDashboardPageProps) {
  const query = await searchParams;
  const selectedConversationId = getQueryValue(query.inquiry) ?? null;
  const profile = await requireProfileRole("provider");
  const providerProfile = await getProviderProfile(profile.id);
  const conversationData = await getProviderConversationCenterData({
    profile,
    providerProfile,
    selectedConversationId,
  });
  const statusKey = providerProfile?.status ?? "not_started";
  const status = statusContent[statusKey];
  const completedFields = countCompletedProfileFields(providerProfile);
  const displayName = getDisplayName(providerProfile, profile.fullName);

  return (
    <DashboardShell
      navItems={dashboardNavItems}
      navLabel="Provider"
      signedInValue={profile.email ?? displayName}
    >
      <div className="grid gap-6">
        <DashboardHeader
          eyebrow="Provider dashboard"
          title={displayName}
          description="Manage your public profile, service areas, contact details, and inquiries."
          actions={
            <>
              <Link
                href="/settings"
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                Edit listing
              </Link>
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                View directory
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                Customer dashboard
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            description="Current review state."
            label="Listing status"
            tone={statusKey === "active" ? "accent" : "warning"}
            value={status.label}
          />
          <DashboardStatCard
            description="Core profile fields completed."
            label="Profile readiness"
            value={`${completedFields}/11`}
          />
          <DashboardStatCard
            description="Total customer conversations."
            label="Inquiries"
            value={conversationData.total}
          />
          <DashboardStatCard
            description="Customer conversations needing review."
            label="Unread"
            tone={conversationData.unreadCount > 0 ? "info" : "light"}
            value={conversationData.unreadCount}
          />
        </div>

        <DashboardSection
          id="listing"
          eyebrow="Listing"
          title="Public profile readiness"
          description="Check what customers see before they decide to contact you."
        >
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-500">
                    Approval status
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-stone-950">
                    {status.label}
                  </h3>
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

            <div className="grid gap-4">
              <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-stone-500">
                  Service area
                </p>
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
          </div>
        </DashboardSection>

        <DashboardSection
          id="customer-tools"
          eyebrow="Customer tools"
          title="Find services for your own real estate needs"
          description="Use the same directory tools available to customers when you need support from another provider."
          actions={
            <>
              <Link
                href="/search"
                className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                Browse directory
              </Link>
              <Link
                href="/dashboard#saved-providers"
                className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
              >
                Saved providers
              </Link>
            </>
          }
        >
          <div className="mt-5 rounded-lg border border-stone-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm leading-6 text-stone-600">
              Search by service, compare public profiles, save providers, and
              start conversations from your customer dashboard.
            </p>
          </div>
        </DashboardSection>

        <ConversationCenter data={conversationData} />
      </div>
    </DashboardShell>
  );
}
