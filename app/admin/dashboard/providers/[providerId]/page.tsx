/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveProviderProfile,
  rejectProviderProfile,
  setProviderActive,
  setProviderInactive,
} from "@/app/admin/dashboard/actions";
import { requireProfileRole } from "@/lib/auth/session";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type AdminProviderReviewPageProps = {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ review?: string | string[] }>;
};

type ProviderDetailRow = {
  id: string;
  category_id: string | null;
  business_name: string | null;
  display_name: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  service_area: string | null;
  years_experience: number | null;
  license_number: string | null;
  profile_image_url: string | null;
  status: ProviderProfileStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type LookupNameRow = {
  id: string;
  name: string;
};

type RelationIdRow = {
  language_id?: string;
  specialty_id?: string;
};

type ProviderReviewProfile = ProviderDetailRow & {
  categoryName: string | null;
  languageNames: string[];
  specialtyNames: string[];
};

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

const reviewMessages: Record<
  string,
  { tone: "success" | "error"; message: string }
> = {
  approved: {
    tone: "success",
    message: "Provider approved. The profile is now active and public.",
  },
  rejected: {
    tone: "success",
    message: "Provider rejected. The profile is not visible publicly.",
  },
  inactive: {
    tone: "success",
    message: "Provider set inactive. The profile is hidden from public listings.",
  },
  active: {
    tone: "success",
    message: "Provider set active. The profile is visible publicly again.",
  },
  "missing-rejection-reason": {
    tone: "error",
    message: "Add a rejection reason before rejecting this profile.",
  },
  "not-updated": {
    tone: "error",
    message:
      "The provider status could not be updated. Refresh and check the current status.",
  },
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

function getProviderName(provider: ProviderReviewProfile) {
  return (
    provider.business_name ??
    provider.display_name ??
    provider.email ??
    "Unnamed provider"
  );
}

function getLocation(provider: ProviderReviewProfile) {
  const parts = [
    provider.city,
    provider.province_state,
    provider.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getReviewMessage(value: string | string[] | undefined) {
  const review = Array.isArray(value) ? value[0] : value;

  return review ? reviewMessages[review] : null;
}

function getDisplayValue(value: string | number | null) {
  return value === null || value === "" ? "Not added" : String(value);
}

function getLookupNames(rows: LookupNameRow[], ids: string[]) {
  const lookup = new Map(rows.map((row) => [row.id, row.name]));

  return ids
    .map((id) => lookup.get(id))
    .filter((value): value is string => Boolean(value));
}

async function getProviderReviewProfile(providerId: string) {
  const supabase = await getServerSupabaseClient();
  const { data: providerData } = await supabase
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
        "years_experience",
        "license_number",
        "profile_image_url",
        "status",
        "rejection_reason",
        "submitted_at",
        "approved_at",
        "updated_at",
        "created_at",
      ].join(","),
    )
    .eq("id", providerId)
    .maybeSingle();

  if (!providerData) {
    return null;
  }

  const provider = providerData as unknown as ProviderDetailRow;
  const [categoryResult, languageRowsResult, specialtyRowsResult] =
    await Promise.all([
      provider.category_id
        ? supabase
            .from("categories")
            .select("id,name")
            .eq("id", provider.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("provider_languages")
        .select("language_id")
        .eq("provider_profile_id", provider.id),
      supabase
        .from("provider_specialties")
        .select("specialty_id")
        .eq("provider_profile_id", provider.id),
    ]);

  const languageIds = ((languageRowsResult.data ?? []) as RelationIdRow[])
    .map((row) => row.language_id)
    .filter((value): value is string => Boolean(value));
  const specialtyIds = ((specialtyRowsResult.data ?? []) as RelationIdRow[])
    .map((row) => row.specialty_id)
    .filter((value): value is string => Boolean(value));

  const [languageResult, specialtyResult] = await Promise.all([
    languageIds.length > 0
      ? supabase.from("languages").select("id,name").in("id", languageIds)
      : Promise.resolve({ data: [] }),
    specialtyIds.length > 0
      ? supabase.from("specialties").select("id,name").in("id", specialtyIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    ...provider,
    categoryName:
      ((categoryResult.data ?? null) as LookupNameRow | null)?.name ?? null,
    languageNames: getLookupNames(
      (languageResult.data ?? []) as LookupNameRow[],
      languageIds,
    ),
    specialtyNames: getLookupNames(
      (specialtyResult.data ?? []) as LookupNameRow[],
      specialtyIds,
    ),
  } satisfies ProviderReviewProfile;
}

function StatusBadge({ status }: { status: ProviderProfileStatus }) {
  return (
    <span
      className={`inline-flex w-fit rounded-md border px-3 py-1 text-sm font-semibold ${statusClassNames[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-stone-900">
        {getDisplayValue(value)}
      </dd>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-500">None selected.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-md bg-stone-100 px-2.5 py-1.5 text-sm font-medium text-stone-800"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ReviewMessage({
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
      className={`rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
      role={message.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message.message}
    </p>
  );
}

function ReviewActions({ provider }: { provider: ProviderReviewProfile }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Review
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Status controls
          </h2>
        </div>
        <StatusBadge status={provider.status} />
      </div>

      {provider.status === "pending_approval" ? (
        <div className="mt-6 grid gap-4">
          <form action={approveProviderProfile}>
            <input name="providerId" type="hidden" value={provider.id} />
            <button
              type="submit"
              className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              Approve provider
            </button>
          </form>

          <form
            action={rejectProviderProfile}
            className="grid gap-3 rounded-md border border-red-100 bg-red-50 p-4"
          >
            <input name="providerId" type="hidden" value={provider.id} />
            <label
              htmlFor="rejection-reason"
              className="grid gap-2 text-sm font-medium text-red-900"
            >
              Rejection reason
              <textarea
                id="rejection-reason"
                name="rejectionReason"
                defaultValue={provider.rejection_reason ?? ""}
                className="min-h-28 rounded-md border border-red-200 bg-white px-3 py-3 text-sm leading-6 text-stone-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                required
              />
            </label>
            <button
              type="submit"
              className="h-11 w-fit rounded-md bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-100"
            >
              Reject provider
            </button>
          </form>
        </div>
      ) : null}

      {provider.status === "active" ? (
        <form action={setProviderInactive} className="mt-6">
          <input name="providerId" type="hidden" value={provider.id} />
          <button
            type="submit"
            className="h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
          >
            Set provider inactive
          </button>
        </form>
      ) : null}

      {provider.status === "inactive" ? (
        <form action={setProviderActive} className="mt-6">
          <input name="providerId" type="hidden" value={provider.id} />
          <button
            type="submit"
            className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            Set provider active
          </button>
        </form>
      ) : null}

      {!["pending_approval", "active", "inactive"].includes(provider.status) ? (
        <p className="mt-6 rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm leading-6 text-stone-600">
          No review action is available for this status.
        </p>
      ) : null}
    </article>
  );
}

export default async function AdminProviderReviewPage({
  params,
  searchParams,
}: AdminProviderReviewPageProps) {
  await requireProfileRole("admin");

  const { providerId } = await params;
  const query = await searchParams;
  const provider = await getProviderReviewProfile(providerId);

  if (!provider) {
    notFound();
  }

  const reviewMessage = getReviewMessage(query.review);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/admin/dashboard#providers"
          className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-950"
        >
          Back to admin dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
        <div className="grid gap-6">
          <header className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Provider review
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-stone-950">
                  {getProviderName(provider)}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  {getLocation(provider)}
                </p>
              </div>
              <StatusBadge status={provider.status} />
            </div>
            {provider.rejection_reason ? (
              <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                {provider.rejection_reason}
              </p>
            ) : null}
          </header>

          <ReviewMessage message={reviewMessage} />

          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">
              Profile details
            </h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-[13rem_1fr]">
              <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                <div className="grid aspect-square place-items-center">
                  {provider.profile_image_url ? (
                    <img
                      src={provider.profile_image_url}
                      alt={`${getProviderName(provider)} profile`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-semibold text-stone-500">
                      MRH
                    </span>
                  )}
                </div>
              </div>

              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailItem label="Full name" value={provider.display_name} />
                <DetailItem label="Business name" value={provider.business_name} />
                <DetailItem label="Profession" value={provider.categoryName} />
                <DetailItem label="Email" value={provider.email} />
                <DetailItem label="Phone" value={provider.phone} />
                <DetailItem label="Website" value={provider.website_url} />
                <DetailItem label="City" value={provider.city} />
                <DetailItem label="Province" value={provider.province_state} />
                <DetailItem label="Country" value={provider.country} />
                <DetailItem label="Service area" value={provider.service_area} />
                <DetailItem
                  label="Years experience"
                  value={provider.years_experience}
                />
                <DetailItem label="License" value={provider.license_number} />
              </dl>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Bio
              </h3>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                {provider.bio ?? "No bio added."}
              </p>
            </div>

            <div className="mt-6 grid gap-6 border-t border-stone-200 pt-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Languages
                </h3>
                <div className="mt-3">
                  <TagList items={provider.languageNames} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Specialties
                </h3>
                <div className="mt-3">
                  <TagList items={provider.specialtyNames} />
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-28">
          <ReviewActions provider={provider} />

          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">Timeline</h2>
            <dl className="mt-5 grid gap-4">
              <DetailItem label="Created" value={formatDate(provider.created_at)} />
              <DetailItem
                label="Submitted"
                value={formatDate(provider.submitted_at)}
              />
              <DetailItem
                label="Approved"
                value={formatDate(provider.approved_at)}
              />
              <DetailItem label="Updated" value={formatDate(provider.updated_at)} />
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}
