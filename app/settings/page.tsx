import Link from "next/link";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";
import {
  ProviderProfileForm,
  type ProviderProfileCategoryOption,
  type ProviderProfileFormData,
  type ProviderProfileLanguageOption,
  type ProviderProfileSpecialtyOption,
} from "@/components/providers/provider-profile-form";
import { requireProfileCapability } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type AccountProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
};

type ProviderProfileRow = ProviderProfileFormData & {
  rejection_reason: string | null;
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

async function getAccountProfile(userId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,bio,avatar_path,avatar_url")
    .eq("id", userId)
    .maybeSingle();

  return (data ?? null) as AccountProfileRow | null;
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
        "profile_image_path",
        "profile_image_url",
        "status",
        "rejection_reason",
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
  } satisfies ProviderProfileRow;
}

async function getProviderLookups() {
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
    specialties: (specialtiesResult.data ??
      []) as ProviderProfileSpecialtyOption[],
  };
}

export default async function SettingsPage() {
  const profile = await requireProfileCapability("manage_account_settings");
  const isProvider = profile.role === "provider";
  const [accountProfile, providerProfile, providerLookups] = await Promise.all([
    getAccountProfile(profile.id),
    isProvider ? getProviderProfile(profile.id) : Promise.resolve(null),
    isProvider
      ? getProviderLookups()
      : Promise.resolve({
          categories: [],
          languages: [],
          specialties: [],
        }),
  ]);
  const displayName =
    accountProfile?.full_name ??
    providerProfile?.display_name ??
    profile.fullName;
  const email =
    accountProfile?.email ?? providerProfile?.email ?? profile.email;
  const phone = accountProfile?.phone ?? providerProfile?.phone ?? null;
  const bio = accountProfile?.bio ?? providerProfile?.bio ?? null;
  const avatarPath =
    accountProfile?.avatar_path ??
    providerProfile?.profile_image_path ??
    null;
  const avatarUrl =
    accountProfile?.avatar_url ?? providerProfile?.profile_image_url ?? null;
  const dashboardPath = getDashboardPathForRole(profile.role);

  const navigationItems = [
    { href: "#account", label: "Account" },
    { href: "#profile", label: "Profile" },
    { href: "#communication", label: "Communication" },
    ...(isProvider
      ? [{ href: "#provider-business", label: "Provider business" }]
      : []),
    { href: "#security", label: "Security" },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Settings
          </p>
          <nav
            aria-label="Settings navigation"
            className="mt-3 grid gap-1 text-sm font-medium"
          >
            {navigationItems.map((item) => (
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
            <Link
              href={dashboardPath}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
            >
              Back to dashboard
            </Link>
          </div>
        </aside>

        <div className="grid gap-6">
          <header>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Shared settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-stone-950">
              Account settings
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
              Manage account identity, public profile details, communication
              information, and security from one place.
            </p>
          </header>

          <AccountSettingsForm
            accountId={profile.id}
            avatarPath={avatarPath}
            avatarUrl={avatarUrl}
            bio={bio}
            displayName={displayName}
            email={email}
            phone={phone}
            roleLabel={isProvider ? "Provider" : "User"}
          />

          {isProvider ? (
            <article
              id="provider-business"
              className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                    Provider business
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">
                    Public listing details
                  </h2>
                </div>
                <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold capitalize text-stone-600">
                  {providerProfile?.status?.replace("_", " ") ?? "Not started"}
                </span>
              </div>

              {providerProfile?.rejection_reason ? (
                <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  {providerProfile.rejection_reason}
                </p>
              ) : null}

              <div className="mt-6">
                <ProviderProfileForm
                  profile={providerProfile}
                  categories={providerLookups.categories}
                  languages={providerLookups.languages}
                  specialties={providerLookups.specialties}
                  accountId={profile.id}
                  accountBio={bio}
                  accountEmail={email}
                  accountFullName={displayName}
                  accountPhone={phone}
                  accountProfileImagePath={avatarPath}
                  accountProfileImageUrl={avatarUrl}
                  manageSharedFieldsExternally
                />
              </div>
            </article>
          ) : null}

          <article
            id="security"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Security
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">
              Password and account access
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Reset your password through the secure email recovery flow.
            </p>
            <Link
              href="/forgot-password"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
            >
              Reset password
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
