"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  getDashboardPathForRole,
  hasProfileCapability,
} from "@/lib/auth/roles";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getServerSupabaseClient } from "@/lib/supabase/server";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getSafeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/search";
  }

  return value;
}

async function getActiveProvider(providerId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select("id,slug")
    .eq("id", providerId)
    .eq("status", "active")
    .maybeSingle();

  return (data ?? null) as { id: string; slug: string } | null;
}

function revalidateSavedProviderPaths(returnPath: string, providerSlug: string) {
  revalidatePath(returnPath);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/saved");
  revalidatePath("/search");
  revalidatePath(`/providers/${providerSlug}`);
}

export async function saveProvider(formData: FormData) {
  const returnPath = getSafeReturnPath(getFormString(formData, "returnPath"));
  const providerId = getFormString(formData, "providerId");
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(returnPath)}&reason=save-provider`);
  }

  if (!hasProfileCapability(profile.role, "consume_services")) {
    redirect(getDashboardPathForRole(profile.role));
  }

  if (!isProviderProfileId(providerId)) {
    redirect(returnPath);
  }

  const activeProvider = await getActiveProvider(providerId);

  if (!activeProvider) {
    redirect(returnPath);
  }

  const supabase = await getServerSupabaseClient();
  await supabase.from("saved_providers").upsert(
    {
      provider_profile_id: providerId,
      user_id: profile.id,
    },
    {
      ignoreDuplicates: true,
      onConflict: "user_id,provider_profile_id",
    },
  );

  revalidateSavedProviderPaths(returnPath, activeProvider.slug);
  redirect(returnPath);
}

export async function unsaveProvider(formData: FormData) {
  const returnPath = getSafeReturnPath(getFormString(formData, "returnPath"));
  const providerId = getFormString(formData, "providerId");
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(returnPath)}&reason=save-provider`);
  }

  if (!hasProfileCapability(profile.role, "consume_services")) {
    redirect(getDashboardPathForRole(profile.role));
  }

  if (!isProviderProfileId(providerId)) {
    redirect(returnPath);
  }

  const activeProvider = await getActiveProvider(providerId);
  const supabase = await getServerSupabaseClient();
  await supabase
    .from("saved_providers")
    .delete()
    .eq("user_id", profile.id)
    .eq("provider_profile_id", providerId);

  revalidateSavedProviderPaths(returnPath, activeProvider?.slug ?? providerId);
  redirect(returnPath);
}
