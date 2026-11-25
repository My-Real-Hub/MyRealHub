import { getListingEditorSnapshot } from "@/lib/providers/listing-query";
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

async function getProviderProfile(
  userId: string,
): Promise<ProviderDashboardProfile | null> {
  const supabase = await getServerSupabaseClient();
  return getListingEditorSnapshot(supabase, "user_id", userId);
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
