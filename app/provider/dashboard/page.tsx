import {
  ProviderDashboard,
  type ProviderDashboardProfile,
} from "@/components/dashboard/provider-dashboard";
import { requireProfileRole } from "@/lib/auth/session";
import { getQueryValue } from "@/lib/contact-requests";
import { getProviderConversationCenterData } from "@/lib/messages";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ProviderDashboardPageProps = {
  searchParams: Promise<{ inquiry?: string | string[] }>;
};

type ProviderProfileBaseRow = Omit<
  ProviderDashboardProfile,
  "languageIds" | "specialtyIds" | "categoryName" | "serviceRegionNames"
>;

async function getProviderProfile(
  userId: string,
): Promise<ProviderDashboardProfile | null> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
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

  if (!data) return null;

  const providerProfile = data as unknown as ProviderProfileBaseRow;
  const [languageRows, specialtyRows, categoryResult, regionRows] =
    await Promise.all([
      supabase
        .from("provider_languages")
        .select("language_id")
        .eq("provider_profile_id", providerProfile.id),
      supabase
        .from("provider_specialties")
        .select("specialty_id")
        .eq("provider_profile_id", providerProfile.id),
      providerProfile.category_id
        ? supabase
            .from("categories")
            .select("name")
            .eq("id", providerProfile.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("provider_service_regions")
        .select("service_region_id")
        .eq("provider_profile_id", providerProfile.id),
    ]);
  const regionIds = (
    (regionRows.data ?? []) as { service_region_id: string }[]
  ).map((row) => row.service_region_id);
  const { data: regions } =
    regionIds.length > 0
      ? await supabase
          .from("service_regions")
          .select("name")
          .in("id", regionIds)
          .eq("is_active", true)
          .order("name")
      : { data: [] };

  return {
    ...providerProfile,
    categoryName:
      (categoryResult.data as { name: string } | null)?.name ?? null,
    serviceRegionNames: ((regions ?? []) as { name: string }[]).map(
      (region) => region.name,
    ),
    languageIds: ((languageRows.data ?? []) as { language_id: string }[]).map(
      (row) => row.language_id,
    ),
    specialtyIds: (
      (specialtyRows.data ?? []) as { specialty_id: string }[]
    ).map((row) => row.specialty_id),
  };
}

export default async function ProviderDashboardPage({
  searchParams,
}: ProviderDashboardPageProps) {
  const query = await searchParams;
  const profile = await requireProfileRole("provider");
  const providerProfile = await getProviderProfile(profile.id);
  const conversationData = await getProviderConversationCenterData({
    profile,
    providerProfile,
    selectedConversationId: getQueryValue(query.inquiry) ?? null,
  });

  return (
    <ProviderDashboard
      profile={profile}
      providerProfile={providerProfile}
      conversationData={conversationData}
    />
  );
}
