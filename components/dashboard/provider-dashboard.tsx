import Link from "next/link";
import type { ReactNode } from "react";
import { ConversationCenter } from "@/components/messages/conversation-center";
import type { ProviderProfileFormData } from "@/components/providers/provider-profile-form";
import type { CurrentProfile } from "@/lib/auth/session";
import type { ConversationCenterData } from "@/lib/messages";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import {
  ProviderDashboardIcon,
  type ProviderDashboardIconName,
} from "./provider-dashboard-icon";
import { ProviderDashboardNavigation } from "./provider-dashboard-navigation";

export type ProviderDashboardProfile = ProviderProfileFormData & {
  slug: string | null;
  categoryName: string | null;
  serviceRegionNames: string[];
  service_area: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string | null;
};

type DashboardStatus = ProviderProfileStatus | "not_started";

const statusContent: Record<
  DashboardStatus,
  {
    label: string;
    badgeClassName: string;
    summary: string;
    nextStep: string;
  }
> = {
  not_started: {
    label: "Not started",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "Create a listing to introduce your business to customers.",
    nextStep:
      "Add your business details in settings, then submit your listing for review.",
  },
  draft: {
    label: "Draft",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-900",
    summary: "Your listing is private while you prepare it.",
    nextStep: "Finish your listing in settings and submit it for review.",
  },
  pending_approval: {
    label: "Pending approval",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-900",
    summary: "Your listing is with the MyRealHub team for review.",
    nextStep: "Your listing will appear in the directory once it is approved.",
  },
  active: {
    label: "Active",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    summary: "Your business is visible in the directory.",
    nextStep:
      "Keep your contact information and service areas up to date so customers can reach you.",
  },
  inactive: {
    label: "Inactive",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "Your listing is currently hidden from the directory.",
    nextStep:
      "Review your listing details and contact the MyRealHub team when you are ready to reactivate.",
  },
  rejected: {
    label: "Changes needed",
    badgeClassName: "border-red-200 bg-red-50 text-red-800",
    summary: "Update your listing before it can be approved.",
    nextStep:
      "Follow the review note below, update your listing in settings, and submit it again.",
  },
};

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const textLink =
  "inline-flex items-center gap-2 rounded-md text-sm font-semibold text-emerald-700 transition hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : dateFormatter.format(date);
}

function getProfileDetails(provider: ProviderDashboardProfile | null) {
  return [
    {
      label: "Business name",
      complete: Boolean(provider?.business_name),
      href: "/settings#provider-business",
    },
    {
      label: "Display name",
      complete: Boolean(provider?.display_name),
      href: "/settings#account",
    },
    {
      label: "Profession",
      complete: Boolean(provider?.category_id),
      href: "/settings#provider-business",
    },
    {
      label: "Bio",
      complete: Boolean(provider?.bio),
      href: "/settings#profile",
    },
    {
      label: "Email",
      complete: Boolean(provider?.email),
      href: "/settings#account",
    },
    {
      label: "Phone",
      complete: Boolean(provider?.phone),
      href: "/settings#communication",
    },
    {
      label: "City",
      complete: Boolean(provider?.city),
      href: "/settings#provider-business",
    },
    {
      label: "Province or state",
      complete: Boolean(provider?.province_state),
      href: "/settings#provider-business",
    },
    {
      label: "Country",
      complete: Boolean(provider?.country),
      href: "/settings#provider-business",
    },
    {
      label: "Languages",
      complete: Boolean(provider?.languageIds.length),
      href: "/settings#provider-business",
    },
    {
      label: "Specialties",
      complete: Boolean(provider?.specialtyIds.length),
      href: "/settings#provider-business",
    },
  ];
}

function Metric({
  children,
  description,
  href,
  icon,
  label,
  value,
  accent = false,
  compact = false,
}: {
  children?: ReactNode;
  description: string;
  href: string;
  icon: ProviderDashboardIconName;
  label: string;
  value: ReactNode;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      className={`group flex min-w-0 flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:p-5 ${accent ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-stone-600">{label}</span>
        <ProviderDashboardIcon
          name={icon}
          className={`size-[18px] shrink-0 ${accent ? "text-emerald-700" : "text-stone-400"}`}
        />
      </div>
      <p
        className={`mt-4 break-words font-semibold tracking-tight text-stone-950 ${compact ? "text-xl leading-9" : "text-3xl leading-9"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
      {children}
    </a>
  );
}

function SectionHeading({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ListingDetail({
  icon,
  label,
  value,
}: {
  icon: ProviderDashboardIconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <ProviderDashboardIcon
        name={icon}
        className="mt-0.5 size-[18px] shrink-0 text-stone-400"
      />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-stone-500">{label}</dt>
        <dd className="mt-1 break-words text-sm leading-6 text-stone-800">
          {value}
        </dd>
      </div>
    </div>
  );
}

function ToolCard({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string;
  icon: ProviderDashboardIconName;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-start gap-4 rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
        <ProviderDashboardIcon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
      </div>
      <ProviderDashboardIcon
        name="arrow"
        className="mt-1 size-[18px] shrink-0 text-stone-400 transition group-hover:text-emerald-700"
      />
    </Link>
  );
}

export function ProviderDashboard({
  conversationData,
  profile,
  providerProfile,
}: {
  conversationData: ConversationCenterData;
  profile: CurrentProfile;
  providerProfile: ProviderDashboardProfile | null;
}) {
  const displayName =
    providerProfile?.business_name ||
    providerProfile?.display_name ||
    profile.fullName ||
    "Your business";
  const statusKey = providerProfile?.status ?? "not_started";
  const status = statusContent[statusKey];
  const details = getProfileDetails(providerProfile);
  const completedFields = details.filter((detail) => detail.complete).length;
  const missingDetails = details.filter((detail) => !detail.complete);
  const completion = Math.round((completedFields / details.length) * 100);
  const location = [providerProfile?.city, providerProfile?.province_state]
    .filter(Boolean)
    .join(", ");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div className="provider-dashboard min-h-screen border-t border-stone-200 bg-[#f6f7f5]">
      <div className="mx-auto grid w-full max-w-[1440px] gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        <ProviderDashboardNavigation
          displayName={displayName}
          email={profile.email}
        />
        <div className="min-w-0 space-y-9 sm:space-y-10">
          <section
            id="overview"
            aria-labelledby="provider-dashboard-title"
            className="provider-dashboard-section"
          >
            <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Provider dashboard
                </p>
                <h1
                  id="provider-dashboard-title"
                  className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl"
                >
                  Your business, at a glance
                </h1>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Manage your inquiries and keep your public listing ready for
                  customers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Link
                  href="/settings#provider-business"
                  className={primaryButton}
                >
                  <ProviderDashboardIcon
                    name="listing"
                    className="size-[18px]"
                  />
                  {providerProfile ? "Edit listing" : "Create listing"}
                </Link>
                {statusKey === "active" && providerProfile ? (
                  <Link
                    href={`/providers/${providerProfile.slug || providerProfile.id}`}
                    className={secondaryButton}
                  >
                    View public profile
                  </Link>
                ) : null}
                <Link
                  href="/settings"
                  aria-label="Account settings"
                  className={`${secondaryButton} lg:hidden`}
                >
                  <ProviderDashboardIcon
                    name="settings"
                    className="size-[18px]"
                  />
                  Settings
                </Link>
              </div>
            </header>

            <div
              className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4"
              aria-label="Business overview"
            >
              <Metric
                href="#inquiries"
                icon="inquiries"
                label="Unread inquiries"
                value={conversationData.unreadCount}
                description={
                  conversationData.unreadCount > 0
                    ? "Ready for your review"
                    : "You're all caught up"
                }
                accent={conversationData.unreadCount > 0}
              />
              <Metric
                href="#inquiries"
                icon="overview"
                label="Total inquiries"
                value={conversationData.total}
                description="Customer conversations"
              />
              <Metric
                href="#listing"
                icon="check"
                label="Profile details"
                value={`${completion}%`}
                description={`${completedFields} of ${details.length} details added`}
              >
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-emerald-700"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </Metric>
              <Metric
                href="#listing"
                icon="listing"
                label="Listing status"
                value={status.label}
                description={
                  statusKey === "active"
                    ? "Visible in the directory"
                    : "View listing details below"
                }
                compact
              />
            </div>
          </section>

          <ConversationCenter
            data={conversationData}
            appearance="workspace"
            copy={{
              eyebrow: "",
              title: "Inquiries",
              description:
                "Read customer messages and manage your conversations.",
              emptyDescription:
                "When a customer contacts your listing, their conversation will appear here.",
            }}
          />

          <section id="listing" className="provider-dashboard-section">
            <SectionHeading
              title="Your listing"
              description="A quick look at your public profile and what to update next."
              action={
                <Link href="/settings#provider-business" className={textLink}>
                  {providerProfile ? "Manage listing" : "Set up listing"}
                  <ProviderDashboardIcon name="arrow" className="size-4" />
                </Link>
              }
            />
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  {providerProfile?.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={providerProfile.profile_image_url}
                      alt=""
                      className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-stone-200"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-semibold text-emerald-800"
                    >
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-lg font-semibold tracking-tight text-stone-950">
                      {displayName}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {providerProfile?.categoryName ?? "Profession not added"}
                    </p>
                    <span
                      className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClassName}`}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-stone-600">
                  {status.summary}
                </p>
                <dl className="mt-5 grid gap-5 border-t border-stone-100 pt-5 sm:grid-cols-2">
                  <ListingDetail
                    icon="location"
                    label="Location"
                    value={location || "Location not added"}
                  />
                  <ListingDetail
                    icon="phone"
                    label="Phone"
                    value={providerProfile?.phone || "Phone not added"}
                  />
                  <div className="sm:col-span-2">
                    <ListingDetail
                      icon="mail"
                      label="Contact email"
                      value={providerProfile?.email || "Email not added"}
                    />
                  </div>
                </dl>
                <div className="mt-5 border-t border-stone-100 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-medium text-stone-500">
                      Service areas
                    </h4>
                    <Link
                      href="/settings#service-areas"
                      className="rounded text-xs font-semibold text-emerald-700 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      Edit areas
                    </Link>
                  </div>
                  {providerProfile?.serviceRegionNames.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {providerProfile.serviceRegionNames.map((name) => (
                        <li
                          key={name}
                          className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-medium text-stone-700"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 break-words text-sm leading-6 text-stone-800">
                      {providerProfile?.service_area ||
                        "Service areas not added"}
                    </p>
                  )}
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
                  <div>
                    <dt className="text-xs text-stone-500">Last updated</dt>
                    <dd className="mt-1 text-xs font-medium text-stone-700">
                      {formatDate(providerProfile?.updated_at ?? null)}
                    </dd>
                  </div>
                  {providerProfile?.approved_at ? (
                    <div>
                      <dt className="text-xs text-stone-500">Approved</dt>
                      <dd className="mt-1 text-xs font-medium text-stone-700">
                        {formatDate(providerProfile.approved_at)}
                      </dd>
                    </div>
                  ) : providerProfile?.submitted_at ? (
                    <div>
                      <dt className="text-xs text-stone-500">Submitted</dt>
                      <dd className="mt-1 text-xs font-medium text-stone-700">
                        {formatDate(providerProfile.submitted_at)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </article>

              <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <h3 className="text-base font-semibold text-stone-950">
                  Profile details
                </h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Help customers get to know your business.
                </p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold tracking-tight text-stone-950">
                    {completion}%
                  </p>
                  <p className="pb-1 text-xs text-stone-500">
                    {completedFields} of {details.length} added
                  </p>
                </div>
                <progress
                  aria-label="Profile details completed"
                  max={details.length}
                  value={completedFields}
                  className="provider-profile-progress mt-3 block h-2 w-full overflow-hidden rounded-full"
                />
                {missingDetails.length > 0 ? (
                  <details className="mt-4 rounded-xl border border-stone-200">
                    <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-stone-700 focus-visible:outline-2 focus-visible:outline-emerald-700">
                      Review {missingDetails.length} missing{" "}
                      {missingDetails.length === 1 ? "detail" : "details"}
                    </summary>
                    <ul className="space-y-1 border-t border-stone-100 px-3 py-2">
                      {missingDetails.map((detail) => (
                        <li key={detail.label}>
                          <Link
                            href={detail.href}
                            className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700"
                          >
                            {detail.label}
                            <ProviderDashboardIcon
                              name="arrow"
                              className="size-4 shrink-0"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <ProviderDashboardIcon name="check" className="size-4" />
                    All core details are added
                  </p>
                )}
                <div className="mt-5 rounded-xl bg-stone-50 p-4">
                  <h4 className="text-sm font-semibold text-stone-800">
                    {statusKey === "active"
                      ? "Keep your listing current"
                      : "Next step"}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {status.nextStep}
                  </p>
                </div>
                {providerProfile?.rejection_reason ? (
                  <div
                    role="note"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
                  >
                    <h4 className="text-sm font-semibold text-red-800">
                      Review note
                    </h4>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-red-800">
                      {providerProfile.rejection_reason}
                    </p>
                  </div>
                ) : null}
                <Link
                  href="/settings#provider-business"
                  className={`${textLink} mt-5`}
                >
                  {providerProfile
                    ? "Update profile details"
                    : "Create your listing"}
                  <ProviderDashboardIcon name="arrow" className="size-4" />
                </Link>
              </article>
            </div>
          </section>

          <section id="customer-tools" className="provider-dashboard-section">
            <SectionHeading
              title="Customer tools"
              description="Find and connect with other professionals when you need a service."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ToolCard
                href="/search"
                icon="search"
                title="Browse the directory"
                description="Find professionals by service and location."
              />
              <ToolCard
                href="/dashboard/saved"
                icon="bookmark"
                title="Saved providers"
                description="Return to the professionals you've saved."
              />
              <ToolCard
                href="/dashboard#sent-messages"
                icon="inquiries"
                title="Your sent messages"
                description="Follow up with providers you've contacted."
              />
              <ToolCard
                href="/dashboard"
                icon="overview"
                title="Customer dashboard"
                description="See your saved providers and conversations."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
