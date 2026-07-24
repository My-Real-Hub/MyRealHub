import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactProviderForm } from "@/components/providers/contact-provider-form";
import { ProviderRatingForm } from "@/components/providers/provider-rating-form";
import { SaveProviderButton } from "@/components/providers/save-provider-button";
import { hasProfileCapability } from "@/lib/auth/roles";
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
  user_id: string;
  slug: string;
  category_id: string | null;
  business_name: string | null;
  display_name: string | null;
  bio: string | null;
  phone: string | null;
  website_url: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  service_area: string | null;
  years_experience: number | null;
  license_number: string | null;
  profile_image_url: string | null;
  accept_new_inquiries: boolean | null;
  contact_delivery_method: string | null;
};

type LookupNameRow = {
  id: string;
  name: string;
};

type ServiceRegionNameRow = LookupNameRow & {
  province_code: string;
};

type RelationIdRow = {
  language_id?: string;
  service_region_id?: string;
  specialty_id?: string;
};

type PublicProviderProfile = ProviderProfileRow & {
  categoryName: string | null;
  languageNames: string[];
  serviceRegionNames: string[];
  specialtyNames: string[];
};

type ProviderRatingSummaryRow = {
  average_rating: number | string | null;
  rating_count: number | string;
};

type ProviderRatingModerationStatus = "visible" | "hidden" | "removed";

type CurrentProviderRatingRow = {
  rating: number | null;
  review: string | null;
  moderation_status: ProviderRatingModerationStatus;
};

type ProviderReviewRow = {
  id: string;
  rating: number;
  review: string | null;
  reviewer_name: string | null;
  created_at: string;
  updated_at: string;
};

const ratingValues = [1, 2, 3, 4, 5];
const reviewDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function getProviderName(provider: PublicProviderProfile) {
  return (
    provider.business_name ??
    provider.display_name ??
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

function getRatingSummaryText(averageRating: number, ratingCount: number) {
  if (ratingCount === 0) {
    return "No ratings yet";
  }

  return `${averageRating.toFixed(1)} out of 5 from ${ratingCount} rating${
    ratingCount === 1 ? "" : "s"
  }`;
}

function formatReviewDate(value: string) {
  return reviewDateFormatter.format(new Date(value));
}

function getContactReturnPath(provider: PublicProviderProfile) {
  return `/providers/${provider.slug || provider.id}#contact`;
}

function getDefaultContactSubject(providerName: string) {
  return `Inquiry for ${providerName}`.slice(0, 160);
}

function getContactAuthHref(pathname: "/login" | "/signup", returnPath: string) {
  const params = new URLSearchParams({
    next: returnPath,
    reason: "contact-provider",
  });

  return `${pathname}?${params.toString()}`;
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

function getServiceRegionNames(rows: ServiceRegionNameRow[], ids: string[]) {
  const lookup = new Map(
    rows.map((row) => [row.id, `${row.name}, ${row.province_code}`]),
  );

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
        "user_id",
        "slug",
        "category_id",
        "business_name",
        "display_name",
        "bio",
        "phone",
        "website_url",
        "city",
        "province_state",
        "country",
        "service_area",
        "years_experience",
        "license_number",
        "profile_image_url",
        "accept_new_inquiries",
        "contact_delivery_method",
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
  const [
    categoryResult,
    languageRowsResult,
    specialtyRowsResult,
    serviceRegionRowsResult,
  ] =
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
      supabase
        .from("provider_service_regions")
        .select("service_region_id")
        .eq("provider_profile_id", provider.id)
        .order("created_at"),
    ]);

  const languageIds = ((languageRowsResult.data ?? []) as RelationIdRow[])
    .map((row) => row.language_id)
    .filter((value): value is string => Boolean(value));
  const specialtyIds = ((specialtyRowsResult.data ?? []) as RelationIdRow[])
    .map((row) => row.specialty_id)
    .filter((value): value is string => Boolean(value));
  const serviceRegionIds = (
    (serviceRegionRowsResult.data ?? []) as RelationIdRow[]
  )
    .map((row) => row.service_region_id)
    .filter((value): value is string => Boolean(value));

  const [languageResult, specialtyResult, serviceRegionResult] =
    await Promise.all([
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
    serviceRegionIds.length > 0
      ? supabase
          .from("service_regions")
          .select("id,name,province_code")
          .in("id", serviceRegionIds)
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
    serviceRegionNames: getServiceRegionNames(
      (serviceRegionResult.data ?? []) as ServiceRegionNameRow[],
      serviceRegionIds,
    ),
    specialtyNames: getLookupNames(
      (specialtyResult.data ?? []) as LookupNameRow[],
      specialtyIds,
    ),
  } satisfies PublicProviderProfile;
}

async function getProviderRatingData(
  providerId: string,
  currentProfileId: string | null,
) {
  const supabase = await getServerSupabaseClient();
  const [summaryResult, currentRatingResult, reviewsResult] = await Promise.all([
    supabase.rpc("get_provider_rating_summary", {
      target_provider_profile_id: providerId,
    }),
    currentProfileId
      ? supabase
          .from("provider_ratings")
          .select("rating,review,moderation_status")
          .eq("provider_profile_id", providerId)
          .eq("rater_user_id", currentProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("get_provider_visible_reviews", {
      target_provider_profile_id: providerId,
      result_limit: 10,
    }),
  ]);
  const summaryData = Array.isArray(summaryResult.data)
    ? summaryResult.data[0]
    : summaryResult.data;
  const summary = (summaryData ?? null) as ProviderRatingSummaryRow | null;
  const currentRatingRow =
    (currentRatingResult.data ?? null) as CurrentProviderRatingRow | null;
  const hasCurrentRating =
    currentRatingRow !== null &&
    currentRatingRow.moderation_status !== "removed";

  return {
    averageRating: Number(summary?.average_rating ?? 0),
    currentModerationStatus: hasCurrentRating
      ? currentRatingRow.moderation_status
      : null,
    currentRating: hasCurrentRating ? currentRatingRow.rating : null,
    currentReview: hasCurrentRating ? currentRatingRow.review : null,
    ratingCount: Number(summary?.rating_count ?? 0),
    reviews: (reviewsResult.data ?? []) as ProviderReviewRow[],
  };
}

function StarRating({
  rating,
  size = "text-lg",
}: {
  rating: number;
  size?: string;
}) {
  const roundedRating = Math.round(rating);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center gap-0.5 ${size}`}
    >
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

function RatingSummary({
  averageRating,
  ratingCount,
}: {
  averageRating: number;
  ratingCount: number;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-800">
      {ratingCount > 0 ? (
        <StarRating rating={averageRating} />
      ) : null}
      <span>{getRatingSummaryText(averageRating, ratingCount)}</span>
    </div>
  );
}

function ProviderReviews({
  reviews,
  ratingCount,
}: {
  reviews: ProviderReviewRow[];
  ratingCount: number;
}) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-950">Reviews</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {ratingCount > 0
              ? `${ratingCount} visible rating${ratingCount === 1 ? "" : "s"}`
              : "No one has rated this provider yet."}
          </p>
        </div>
      </div>

      {reviews.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {reviews.map((review) => (
            <section
              key={review.id}
              className="rounded-md border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-stone-950">
                    {review.reviewer_name ?? "MyRealHub member"}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {formatReviewDate(review.updated_at ?? review.created_at)}
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 text-sm font-semibold text-stone-800"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  <StarRating rating={review.rating} size="text-base" />
                  <span>{review.rating}/5</span>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-stone-700">
                {review.review}
              </p>
            </section>
          ))}
        </div>
      ) : ratingCount > 0 ? (
        <p className="mt-5 rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm leading-6 text-stone-600">
          This provider has ratings, but no written reviews are visible yet.
        </p>
      ) : null}
    </article>
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

function ContactSignInPrompt({ returnPath }: { returnPath: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4">
      <p className="text-sm font-semibold text-emerald-950">
        Log in to contact this provider
      </p>
      <p className="mt-2 text-sm leading-6 text-emerald-900">
        Contact requests require a verified MyRealHub sender account so
        providers can respond safely.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href={getContactAuthHref("/login", returnPath)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Log in
        </Link>
        <Link
          href={getContactAuthHref("/signup", returnPath)}
          className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

function ContactUnavailableNotice() {
  return (
    <p className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
      This provider is not accepting new inquiries right now. You can still
      save their profile and check back later.
    </p>
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
  const [isSaved, ratingData] = await Promise.all([
    currentProfile
      ? getIsProviderSaved(currentProfile.id, provider.id)
      : Promise.resolve(false),
    getProviderRatingData(provider.id, currentProfile?.id ?? null),
  ]);
  const returnPath = `/providers/${provider.slug || provider.id}`;
  const contactReturnPath = getContactReturnPath(provider);
  const isOwnProviderProfile = currentProfile?.id === provider.user_id;
  const acceptsNewInquiries = provider.accept_new_inquiries ?? true;
  const canConsumeServices = hasProfileCapability(
    currentProfile?.role,
    "consume_services",
  );

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
                <RatingSummary
                  averageRating={ratingData.averageRating}
                  ratingCount={ratingData.ratingCount}
                />
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
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Service regions
                </h3>
                <div className="mt-3">
                  <TagList items={provider.serviceRegionNames} />
                </div>
              </div>
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

          <ProviderReviews
            ratingCount={ratingData.ratingCount}
            reviews={ratingData.reviews}
          />
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-28">
          <article
            id="contact"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-stone-950">Contact</h2>
            <div className="mt-5 grid gap-4">
              {isOwnProviderProfile ? (
                <p className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                  You cannot contact your own provider profile.
                </p>
              ) : !acceptsNewInquiries ? (
                <ContactUnavailableNotice />
              ) : !currentProfile ? (
                <ContactSignInPrompt returnPath={contactReturnPath} />
              ) : !canConsumeServices ? (
                <p className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                  Contact requests are available to users and service
                  providers.
                </p>
              ) : (
                <ContactProviderForm
                  defaultEmail={currentProfile.email ?? ""}
                  defaultName={currentProfile.fullName ?? ""}
                  defaultSubject={getDefaultContactSubject(providerName)}
                  providerId={provider.id}
                  returnPath={contactReturnPath}
                />
              )}
              <div className="border-t border-stone-200 pt-4">
                <SaveProviderButton
                  isSaved={isSaved}
                  isSignedIn={Boolean(currentProfile)}
                  providerId={provider.id}
                  returnPath={returnPath}
                />
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-950">
              Rate this provider
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {ratingData.ratingCount > 0
                ? `Current average: ${ratingData.averageRating.toFixed(1)} out of 5.`
                : "Be the first to submit a rating."}
            </p>
            <div className="mt-5">
              <ProviderRatingForm
                canRate={canConsumeServices}
                currentModerationStatus={ratingData.currentModerationStatus}
                currentRating={ratingData.currentRating}
                currentReview={ratingData.currentReview}
                isSelf={isOwnProviderProfile}
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
              <DetailItem
                label="Inquiries"
                value={
                  acceptsNewInquiries
                    ? "Available through secure contact"
                    : "Paused by provider"
                }
              />
              <DetailItem label="Phone" value={provider.phone} />
              <DetailItem label="Website" value={provider.website_url} />
              {provider.serviceRegionNames.length === 0 ? (
                <DetailItem
                  label="Service area"
                  value={provider.service_area}
                />
              ) : null}
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
