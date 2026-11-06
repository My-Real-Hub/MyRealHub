"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  executeSavedProviderMutation,
  type SaveProviderFormState,
} from "@/lib/providers/saved-mutation";
import { getServerSupabaseClient } from "@/lib/supabase/server";

async function runSavedProviderMutation(formData: FormData, operation: "save" | "unsave") {
  const result = await executeSavedProviderMutation(formData, operation, {
    getProfile: getCurrentProfile,
    async getActiveProvider(providerId) {
      const supabase = await getServerSupabaseClient();
      const { data } = await supabase
        .from("provider_profiles")
        .select("slug")
        .eq("id", providerId)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    async save(userId, providerId) {
      const supabase = await getServerSupabaseClient();
      return supabase.from("saved_providers").upsert(
        { provider_profile_id: providerId, user_id: userId },
        { ignoreDuplicates: true, onConflict: "user_id,provider_profile_id" },
      );
    },
    async unsave(userId, providerId) {
      const supabase = await getServerSupabaseClient();
      return supabase
        .from("saved_providers")
        .delete()
        .eq("user_id", userId)
        .eq("provider_profile_id", providerId);
    },
    revalidate(paths) {
      for (const path of new Set(paths)) revalidatePath(path);
    },
  });

  if (result.status === "redirect") redirect(result.path);
  return result;
}

export async function saveProvider(
  _previousState: SaveProviderFormState,
  formData: FormData,
): Promise<SaveProviderFormState> {
  return runSavedProviderMutation(formData, "save");
}

export async function unsaveProvider(
  _previousState: SaveProviderFormState,
  formData: FormData,
): Promise<SaveProviderFormState> {
  return runSavedProviderMutation(formData, "unsave");
}
