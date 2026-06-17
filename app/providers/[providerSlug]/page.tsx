import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveProviderButton } from "@/components/providers/save-provider-button";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  isProviderProfileId,
  isProviderProfileSlug,
} from "@/lib/providers/slug";
import { getIsProviderSaved } from "@/lib/saved-providers";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileImage } from "./profile-image";

type PublicProviderProfilePageProps = {
  params: Promise<{ providerSlug: string }>;
};

type ProviderProfileRow = {
  id: string;
  slug: string;
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
};

type LookupNameRow = {
  id: string;
  name: string;
};

type RelationIdRow = {
  language_id?: string;
  specialty_id?: string;
};

type PublicProviderProfile = ProviderProfileRow & {
  categoryName: string | null;
  languageNames: string[];
  specialtyNames: string[];
};

function getProviderName(provider: PublicProviderProfile) {
  return (
    provider.business_name ??
    provider.display_name ??
    provider.email ??
    "Provider profile"
  );
}

function getLocation(provider: PublicProviderProfile) {
  const parts = [
    provider.city,
    provider.province_state,
    provider.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getDisplayValue(value: string | number | null) {
  return value === null || value === "" ? "Not added" : String(value);
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

function getLookupNames(rows: LookupNameRow[], ids: string[]) {
  const lookup = new Map(rows.map((row) => [row.id, row.name]));

  return ids
    .map((id) => lookup.get(id))
    .filter((value): value is string => Boolean(value));
}

async function getPublicProviderProfile(identifier: string) {
  const supabase = await getServerSupabaseClient();
  let providerQuery = supabase
    .from("provider_profiles")
    .select(
      [
        "id",
        "slug",
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
      ].join(","),
    )
    .eq("status", "active");

  providerQuery = isProviderProfileId(identifier)
    ? providerQuery.eq("id", identifier)
    : providerQuery.eq("slug", identifier);

  const { data: providerData, error } = await providerQuery.maybeSingle();

  if (error || !providerData) {
    return null;
  }

  const provider = providerData as unknown as ProviderProfileRow;
  const [categoryResult, languageRowsResult, specialtyRowsResult] =
    await Promise.all([
      provider.category_id
        ? supabase
            .from("categories")
            .select("id,name")
            .eq("id", provider.category_id)
            .eq("is_active", true)
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
      ? supabase
          .from("languages")
          .select("id,name")
          .in("id", languageIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] }),
    specialtyIds.length > 0
      ? supabase
          .from("specialties")
          .select("id,name")
          .in("id", specialtyIds)
          .eq("is_active", true)
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
  } satisfies PublicProviderProfile;
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

export default async function PublicProviderProfilePage({
  params,
}: PublicProviderProfilePageProps) {
  const { providerSlug } = await params;

  if (
    !isProviderProfileId(providerSlug) &&
    !isProviderProfileSlug(providerSlug)
  ) {
    notFound();
  }

  const provider = await getPublicProviderProfile(providerSlug);

  if (!provider) {
    notFound();
  }

  const providerName = getProviderName(provider);
  const location = getLocation(provider);
  const profileImageUrl = getPublicProfileImageUrl(provider.profile_image_url);
  const currentProfile = await getCurrentProfile();
  const isSaved = currentProfile
    ? await getIsProviderSaved(currentProfile.id, provider.id)
    : false;
  const returnPath = `/providers/${provider.slug || provider.id}`;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/search"
          className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-950"
        >
          Back to search
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
        <div className="grid gap-6">
          <header className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:items-start">
              <ProfileImage
                src={profileImageUrl}
                alt={`${providerName} profile`}
                name={providerName}
              />

              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  {provider.categoryName ?? "Real estate service provider"}
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-stone-950">
                  {providerName}
                </h1>
                {provider.display_name &&
                provider.display_name !== provider.business_name ? (
                  <p className="mt-2 text-base font-medium text-stone-700">
                    {provider.display_name}
                  </p>
                ) : null}
                <p className="mt-4 text-base leading-7 text-stone-600">
                  {location}
                </p>
              </div>
            </div>
          </header>

          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">About</h2>
            <p className="mt-4 text-sm leading-7 text-stone-700">
              {provider.bio ?? "No bio added."}
            </p>
          </article>

          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">
              Service details
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
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

        <aside className="grid gap-6 lg:sticky lg:top-28">
          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">Contact</h2>
            <div className="mt-5 grid gap-3">
              {provider.email ? (
                <a
                  href={`mailto:${provider.email}`}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                  Contact provider
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="h-11 cursor-not-allowed rounded-md bg-stone-300 px-4 text-sm font-semibold text-white"
                >
                  Contact provider
                </button>
              )}
              <SaveProviderButton
                isSaved={isSaved}
                isSignedIn={Boolean(currentProfile)}
                providerId={provider.id}
                returnPath={returnPath}
              />
            </div>
          </article>

          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">Details</h2>
            <dl className="mt-5 grid gap-4">
              <DetailItem label="Profession" value={provider.categoryName} />
              <DetailItem label="Email" value={provider.email} />
              <DetailItem label="Phone" value={provider.phone} />
              <DetailItem label="Website" value={provider.website_url} />
              <DetailItem label="Service area" value={provider.service_area} />
              <DetailItem
                label="Years experience"
                value={provider.years_experience}
              />
              <DetailItem label="License" value={provider.license_number} />
            </dl>
          </article>
        </aside>
      </div>
    </section>
  );
}
