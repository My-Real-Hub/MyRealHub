import Link from "next/link";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import {
  SettingsNavigation,
  type SettingsNavigationItem,
} from "@/components/settings/settings-navigation";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";
import { ProviderCommunicationPreferencesForm } from "@/components/settings/provider-communication-preferences-form";
import { ProviderServiceRegionsForm } from "@/components/settings/provider-service-regions-form";
import {
  ProviderProfileForm,
  type ProviderProfileCategoryOption,
  type ProviderProfileFormData,
  type ProviderProfileLanguageOption,
  type ProviderProfileSpecialtyOption,
} from "@/components/providers/provider-profile-form";
import { requireProfileCapability } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import {
  getContactDeliveryMethod,
  type ContactDeliveryMethod,
} from "@/lib/contact-requests";
import type {
  ServiceRegionOption,
  SubdivisionOption,
} from "@/lib/service-regions";
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
  accept_new_inquiries: boolean | null;
  contact_delivery_method: string | null;
  new_message_email_enabled: boolean | null;
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

type ProviderServiceRegionRow = {
  service_region_id: string;
};

type ProviderNotificationPreferenceRow = {
  notification_email: string | null;
};

type ProviderCommunicationSettings = {
  acceptNewInquiries: boolean;
  contactDeliveryMethod: ContactDeliveryMethod;
  newMessageEmailEnabled: boolean;
  notificationEmail: string;
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
        "accept_new_inquiries",
        "contact_delivery_method",
        "new_message_email_enabled",
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
    categories: (categoriesResult.data ??
      []) as ProviderProfileCategoryOption[],
    languages: (languagesResult.data ?? []) as ProviderProfileLanguageOption[],
    specialties: (specialtiesResult.data ??
      []) as ProviderProfileSpecialtyOption[],
  };
}

async function getProviderCommunicationSettings({
  accountEmail,
  providerProfile,
}: {
  accountEmail: string | null;
  providerProfile: ProviderProfileRow | null;
}): Promise<ProviderCommunicationSettings> {
  if (!providerProfile) {
    return {
      acceptNewInquiries: true,
      contactDeliveryMethod: "in_app",
      newMessageEmailEnabled: false,
      notificationEmail: accountEmail ?? "",
    };
  }

  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_notification_preferences")
    .select("notification_email")
    .eq("provider_profile_id", providerProfile.id)
    .maybeSingle();
  const notificationPreference = (data ??
    null) as ProviderNotificationPreferenceRow | null;

  return {
    acceptNewInquiries: providerProfile.accept_new_inquiries ?? true,
    contactDeliveryMethod: getContactDeliveryMethod(
      providerProfile.contact_delivery_method,
    ),
    newMessageEmailEnabled: providerProfile.new_message_email_enabled ?? false,
    notificationEmail:
      notificationPreference?.notification_email ??
      providerProfile.email ??
      accountEmail ??
      "",
  };
}

async function getProviderRegionSettings(providerProfileId: string | null) {
  const supabase = await getServerSupabaseClient();
  const [subdivisionsResult, regionsResult, selectedRegionsResult] =
    await Promise.all([
      supabase
        .from("canadian_subdivisions")
        .select("code,name,kind")
        .order("display_order"),
      supabase
        .from("service_regions")
        .select("id,name,province_code,slug")
        .eq("is_active", true)
        .order("name"),
      providerProfileId
        ? supabase
            .from("provider_service_regions")
            .select("service_region_id")
            .eq("provider_profile_id", providerProfileId)
        : Promise.resolve({ data: [] }),
    ]);

  return {
    regions: (regionsResult.data ?? []) as ServiceRegionOption[],
    selectedRegionIds: (
      (selectedRegionsResult.data ?? []) as ProviderServiceRegionRow[]
    ).map((row) => row.service_region_id),
    subdivisions: (subdivisionsResult.data ?? []) as SubdivisionOption[],
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
  const providerRegionSettings = isProvider
    ? await getProviderRegionSettings(providerProfile?.id ?? null)
    : { regions: [], selectedRegionIds: [], subdivisions: [] };
  const displayName =
    accountProfile?.full_name ??
    providerProfile?.display_name ??
    profile.fullName;
  const email =
    accountProfile?.email ?? providerProfile?.email ?? profile.email;
  const providerCommunicationSettings = isProvider
    ? await getProviderCommunicationSettings({
        accountEmail: email,
        providerProfile,
      })
    : null;
  const phone = accountProfile?.phone ?? providerProfile?.phone ?? null;
  const bio = accountProfile?.bio ?? providerProfile?.bio ?? null;
  const avatarPath =
    accountProfile?.avatar_path ?? providerProfile?.profile_image_path ?? null;
  const avatarUrl =
    accountProfile?.avatar_url ?? providerProfile?.profile_image_url ?? null;
  const dashboardPath = getDashboardPathForRole(profile.role);

  const navigationItems: SettingsNavigationItem[] = [
    {
      id: "account",
      label: "Account identity",
      icon: "overview",
      group: "account",
    },
    { id: "profile", label: "Photo & bio", icon: "listing", group: "account" },
    {
      id: "communication",
      label: "Contact details",
      icon: "phone",
      group: "account",
    },
    ...(isProvider
      ? ([
          {
            id: "provider-business",
            label: "Business listing",
            icon: "listing",
            group: "business",
          },
          {
            id: "service-areas",
            label: "Service areas",
            icon: "location",
            group: "business",
          },
          {
            id: "provider-communication",
            label: "Inquiry preferences",
            icon: "inquiries",
            group: "business",
          },
        ] satisfies SettingsNavigationItem[])
      : []),
    { id: "security", label: "Security", icon: "settings", group: "security" },
  ];

  return (
    <div className="settings-workspace min-h-screen border-t border-stone-200 bg-[#f6f7f5]">
      <div className="mx-auto grid w-full max-w-[1440px] gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        <SettingsNavigation
          items={navigationItems}
          displayName={displayName || "Your account"}
          email={email}
          dashboardPath={dashboardPath}
        />
        <div className="min-w-0 space-y-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                {isProvider ? "Provider workspace" : "Your account"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
                Account settings
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                {isProvider
                  ? "Keep your account, public listing, and inquiry preferences up to date."
                  : "Manage your personal details, profile, and account access."}
              </p>
            </div>
            <Link
              href={dashboardPath}
              className="settings-secondary-button shrink-0 self-start sm:self-auto"
            >
              <ProviderDashboardIcon
                name="arrow"
                className="size-[18px] rotate-180"
              />
              Back to dashboard
            </Link>
          </header>

          <AccountSettingsForm
            accountId={profile.id}
            avatarPath={avatarPath}
            avatarUrl={avatarUrl}
            bio={bio}
            displayName={displayName}
            email={email}
            phone={phone}
            roleLabel={
              isProvider
                ? "Provider"
                : profile.role === "admin"
                  ? "Administrator"
                  : "Customer"
            }
          />

          {isProvider ? (
            <>
              <section
                id="provider-business"
                className="settings-section settings-card"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                      Business listing
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-stone-500">
                      The business details customers see in the directory.
                    </p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold capitalize text-stone-600">
                    {providerProfile?.status?.replaceAll("_", " ") ??
                      "Not started"}
                  </span>
                </div>
                {providerProfile?.rejection_reason ? (
                  <div
                    role="note"
                    className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <h3 className="text-sm font-semibold text-red-800">
                      Review note
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-red-800">
                      {providerProfile.rejection_reason}
                    </p>
                  </div>
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
              </section>

              <ProviderServiceRegionsForm
                providerProfileId={providerProfile?.id ?? null}
                regions={providerRegionSettings.regions}
                selectedRegionIds={providerRegionSettings.selectedRegionIds}
                subdivisions={providerRegionSettings.subdivisions}
              />

              {providerCommunicationSettings ? (
                <ProviderCommunicationPreferencesForm
                  acceptNewInquiries={
                    providerCommunicationSettings.acceptNewInquiries
                  }
                  contactDeliveryMethod={
                    providerCommunicationSettings.contactDeliveryMethod
                  }
                  newMessageEmailEnabled={
                    providerCommunicationSettings.newMessageEmailEnabled
                  }
                  notificationEmail={
                    providerCommunicationSettings.notificationEmail
                  }
                  providerProfileId={providerProfile?.id ?? null}
                />
              ) : null}
            </>
          ) : null}

          <section id="security" className="settings-section settings-card">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <ProviderDashboardIcon name="settings" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                    Security
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    Reset your password through the secure email recovery flow.
                  </p>
                </div>
              </div>
              <Link
                href="/forgot-password"
                className="settings-secondary-button shrink-0"
              >
                Reset password
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
