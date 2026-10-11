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
  return provider.business_name ?? provider.display_name ?? "Provider profile";
}

function getLocation(provider: PublicProviderProfile) {
  const parts = [provider.city, provider.province_state].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getWebsiteHref(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
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

function getContactAuthHref(
  pathname: "/login" | "/signup",
  returnPath: string,
) {
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

    if (
      url.hostname === "example.com" ||
      url.hostname.endsWith(".example.com")
    ) {
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
  ] = await Promise.all([
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
  const [summaryResult, currentRatingResult, reviewsResult] = await Promise.all(
    [
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
    ],
  );
  const summaryData = Array.isArray(summaryResult.data)
    ? summaryResult.data[0]
    : summaryResult.data;
  const summary = (summaryData ?? null) as ProviderRatingSummaryRow | null;
  const currentRatingRow = (currentRatingResult.data ??
    null) as CurrentProviderRatingRow | null;
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
          className={
            value <= roundedRating ? "text-amber-400" : "text-stone-300"
          }
        >
          &#9733;
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
    <a
      href="#reviews"
      className="inline-flex flex-wrap items-center gap-2 rounded-lg text-sm text-stone-600 transition hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      aria-label={getRatingSummaryText(averageRating, ratingCount)}
    >
      {ratingCount > 0 ? (
        <StarRating rating={averageRating} size="text-base" />
      ) : null}
      <span>
        {ratingCount > 0
          ? `${averageRating.toFixed(1)} (${ratingCount} rating${ratingCount === 1 ? "" : "s"})`
          : "No ratings yet"}
      </span>
    </a>
  );
}

function ProviderReviews({
  reviews,
  ratingCount,
  averageRating,
  children,
}: {
  reviews: ProviderReviewRow[];
  ratingCount: number;
  averageRating: number;
  children: React.ReactNode;
}) {
  return (
    <section
      id="reviews"
      className="public-profile-card public-profile-section lg:col-start-1"
      aria-labelledby="reviews-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="reviews-heading"
            className="text-lg font-semibold tracking-tight text-stone-950"
          >
            Ratings &amp; reviews
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {ratingCount > 0
              ? `Based on ${ratingCount} member rating${ratingCount === 1 ? "" : "s"}.`
              : "No one has rated this provider yet."}
          </p>
        </div>
        {ratingCount > 0 ? (
          <div
            className="flex shrink-0 items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3"
            aria-label={getRatingSummaryText(averageRating, ratingCount)}
          >
            <span className="text-2xl font-semibold tracking-tight text-emerald-900">
              {averageRating.toFixed(1)}
            </span>
            <div>
              <StarRating rating={averageRating} size="text-base" />
              <p className="text-xs text-emerald-800">out of 5</p>
            </div>
          </div>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <div className="mt-6 divide-y divide-stone-100 border-t border-stone-100">
          {reviews.map((review) => (
            <section key={review.id} className="py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="break-words text-sm font-semibold text-stone-950">
                    {review.reviewer_name ?? "MyRealHub member"}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatReviewDate(review.updated_at ?? review.created_at)}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-2 text-xs font-medium text-stone-500"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  <StarRating rating={review.rating} size="text-base" />
                  <span>{review.rating}/5</span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-stone-600">
                {review.review}
              </p>
            </section>
          ))}
        </div>
      ) : ratingCount > 0 ? (
        <p className="mt-5 rounded-xl bg-stone-50 px-4 py-5 text-sm leading-6 text-stone-500">
          This provider has ratings, but no written reviews are visible yet.
        </p>
      ) : (
        <p className="mt-5 rounded-xl bg-stone-50 px-4 py-5 text-sm leading-6 text-stone-500">
          Have you worked with this provider? Your experience can help others
          choose.
        </p>
      )}
      <div className="mt-5 border-t border-stone-100 pt-5">{children}</div>
    </section>
  );
}

function TagList({
  items,
  fallback = "Not specified",
}: {
  items: string[];
  fallback?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-stone-500">{fallback}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {[...items]
        .sort((left, right) => left.localeCompare(right))
        .map((item) => (
          <span
            key={item}
            className="max-w-full break-words rounded-lg bg-stone-50 px-3 py-1.5 text-sm leading-5 text-stone-600"
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
  if (value === null || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium text-stone-500">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-stone-800">
        {value}
      </dd>
    </div>
  );
}

function ContactSignInPrompt({ returnPath }: { returnPath: string }) {
  return (
    <div className="rounded-xl bg-emerald-50/70 p-4">
      <p className="text-sm font-semibold text-emerald-950">
        Log in to contact this provider
      </p>
      <p className="mt-2 text-sm leading-6 text-emerald-800">
        Send an inquiry from your MyRealHub account and keep the conversation in
        one place.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href={getContactAuthHref("/login", returnPath)}
          className="public-profile-primary-button"
        >
          Log in
        </Link>
        <Link
          href={getContactAuthHref("/signup", returnPath)}
          className="public-profile-secondary-button"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

function ContactUnavailableNotice() {
  return (
    <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
      This provider is not accepting new inquiries right now. You can still save
      their profile and check back later.
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

  const websiteHref = getWebsiteHref(provider.website_url);
  const hasCredentials =
    provider.years_experience !== null || Boolean(provider.license_number);

  return (
    <div className="bg-[#f6f7f5]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/search"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-stone-500 transition hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="m10 6-6 6 6 6M4 12h16" />
          </svg>
          Back to search
        </Link>

        <header className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <ProfileImage
                src={profileImageUrl}
                alt={`${providerName} profile`}
                name={providerName}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-700">
                  {provider.categoryName ?? "Real estate service provider"}
                </p>
                <h1 className="mt-2 break-words text-2xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-3xl">
                  {providerName}
                </h1>
                {provider.display_name &&
                provider.display_name !== provider.business_name ? (
                  <p className="mt-1.5 text-sm text-stone-600">
                    {provider.display_name}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-stone-500">{location}</p>
                <div className="mt-3">
                  <RatingSummary
                    averageRating={ratingData.averageRating}
                    ratingCount={ratingData.ratingCount}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-52 lg:shrink-0 lg:grid-cols-1">
              {isOwnProviderProfile ? (
                <Link
                  href="/settings"
                  className="public-profile-primary-button"
                >
                  Edit your profile
                </Link>
              ) : (
                <a href="#contact" className="public-profile-primary-button">
                  {currentProfile && !canConsumeServices
                    ? "Contact details"
                    : "Contact provider"}
                </a>
              )}
              {!isOwnProviderProfile &&
              (!currentProfile || canConsumeServices) ? (
                <SaveProviderButton
                  appearance="profile"
                  ariaLabel={`${isSaved ? "Unsave" : "Save"} ${providerName}`}
                  isSaved={isSaved}
                  isSignedIn={Boolean(currentProfile)}
                  providerId={provider.id}
                  returnPath={returnPath}
                />
              ) : null}
            </div>
          </div>
          <nav
            aria-label="Provider profile navigation"
            className="grid grid-cols-4 gap-1 border-t border-stone-100 px-3 py-2 sm:flex sm:gap-2 sm:px-5"
          >
            {[
              { id: "about", label: "About" },
              { id: "services", label: "Services" },
              { id: "contact", label: "Contact" },
              { id: "reviews", label: "Reviews" },
            ].map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-sm font-medium text-stone-500 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:px-4"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <div className="grid min-w-0 gap-6 lg:col-start-1">
            <section
              id="about"
              className="public-profile-card public-profile-section"
              aria-labelledby="about-heading"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Meet the provider
              </p>
              <h2
                id="about-heading"
                className="mt-2 text-lg font-semibold tracking-tight text-stone-950"
              >
                About {providerName}
              </h2>
              <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-stone-600">
                {provider.bio ||
                  "This provider has not added a business introduction yet."}
              </p>
              {hasCredentials ? (
                <dl className="mt-5 grid gap-5 border-t border-stone-100 pt-5 sm:grid-cols-2">
                  <DetailItem
                    label="Experience"
                    value={
                      provider.years_experience !== null
                        ? `${provider.years_experience} year${provider.years_experience === 1 ? "" : "s"} in the profession`
                        : null
                    }
                  />
                  <DetailItem
                    label="License number"
                    value={provider.license_number}
                  />
                </dl>
              ) : null}
            </section>

            <section
              id="services"
              className="public-profile-card public-profile-section"
              aria-labelledby="services-heading"
            >
              <h2
                id="services-heading"
                className="text-lg font-semibold tracking-tight text-stone-950"
              >
                Services &amp; coverage
              </h2>
              <div className="mt-5">
                <h3 className="text-sm font-medium text-stone-800">
                  Service areas
                </h3>
                <div className="mt-3">
                  <TagList
                    items={provider.serviceRegionNames}
                    fallback={
                      provider.service_area ||
                      "Service areas have not been specified. Ask the provider about coverage for your location."
                    }
                  />
                </div>
              </div>
              <div className="mt-5 grid gap-5 border-t border-stone-100 pt-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-stone-800">
                    Specialties
                  </h3>
                  <div className="mt-3">
                    <TagList items={provider.specialtyNames} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-stone-800">
                    Languages
                  </h3>
                  <div className="mt-3">
                    <TagList items={provider.languageNames} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside
            className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2"
            aria-labelledby="contact-heading"
          >
            <section
              id="contact"
              className="public-profile-card public-profile-section"
            >
              <p
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${acceptsNewInquiries ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-500"}`}
              >
                <span
                  className={`size-1.5 rounded-full ${acceptsNewInquiries ? "bg-emerald-600" : "bg-stone-400"}`}
                  aria-hidden="true"
                />
                {acceptsNewInquiries
                  ? "Accepting inquiries"
                  : "Inquiries paused"}
              </p>
              <h2
                id="contact-heading"
                className="mt-4 text-lg font-semibold tracking-tight text-stone-950"
              >
                Get in touch
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Ask about availability, services, or support for your property.
              </p>
              {provider.phone || provider.website_url ? (
                <dl className="mt-5 grid gap-4 border-t border-stone-100 pt-5">
                  {provider.phone ? (
                    <div>
                      <dt className="text-xs text-stone-500">Phone</dt>
                      <dd className="mt-1">
                        <a
                          href={`tel:${provider.phone.replace(/[^+0-9]/g, "")}`}
                          className="inline-flex min-h-9 items-center rounded-lg text-sm font-medium text-stone-800 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                        >
                          {provider.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {provider.website_url ? (
                    <div>
                      <dt className="text-xs text-stone-500">Website</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-stone-800">
                        {websiteHref ? (
                          <a
                            href={websiteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          >
                            <span className="min-w-0 break-all">
                              {provider.website_url
                                .replace(/^https?:\/\//, "")
                                .replace(/\/$/, "")}
                            </span>
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="size-4 shrink-0"
                            >
                              <path d="M14 3h7v7m0-7L10 14M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                            </svg>
                            <span className="sr-only">opens in a new tab</span>
                          </a>
                        ) : (
                          provider.website_url
                        )}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              <div className="mt-5 border-t border-stone-100 pt-5">
                {isOwnProviderProfile ? (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                    This is your public profile. Manage your contact details and
                    inquiry preferences in{" "}
                    <Link
                      href="/settings"
                      className="font-medium text-emerald-800 underline underline-offset-4"
                    >
                      Settings
                    </Link>
                    .
                  </p>
                ) : !acceptsNewInquiries ? (
                  <ContactUnavailableNotice />
                ) : !currentProfile ? (
                  <ContactSignInPrompt returnPath={contactReturnPath} />
                ) : !canConsumeServices ? (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                    Sign in with a customer or provider account to send an
                    inquiry.
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
              </div>
            </section>
          </aside>

          <ProviderReviews
            averageRating={ratingData.averageRating}
            ratingCount={ratingData.ratingCount}
            reviews={ratingData.reviews}
          >
            {!isOwnProviderProfile &&
            (!currentProfile || canConsumeServices) ? (
              <h3 className="text-sm font-semibold text-stone-950">
                {ratingData.currentRating
                  ? "Your review"
                  : "Share your experience"}
              </h3>
            ) : null}
            {!isOwnProviderProfile && canConsumeServices ? (
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Rate your experience with this provider. You can add a written
                review or update your feedback later.
              </p>
            ) : null}
            <div className="mt-4">
              <ProviderRatingForm
                canRate={canConsumeServices}
                currentModerationStatus={ratingData.currentModerationStatus}
                currentRating={ratingData.currentRating}
                currentReview={ratingData.currentReview}
                isSelf={isOwnProviderProfile}
                isSignedIn={Boolean(currentProfile)}
                providerId={provider.id}
                returnPath={`${returnPath}#reviews`}
              />
            </div>
          </ProviderReviews>
        </div>
      </div>
    </div>
  );
}
