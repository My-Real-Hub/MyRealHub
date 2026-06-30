"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasProfileCapability } from "@/lib/auth/roles";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type ProviderRatingFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

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

export async function submitProviderRating(
  _previousState: ProviderRatingFormState,
  formData: FormData,
): Promise<ProviderRatingFormState> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return {
      status: "error",
      message: "Log in to rate this provider.",
    };
  }

  if (!hasProfileCapability(profile.role, "consume_services")) {
    return {
      status: "error",
      message: "This account cannot rate providers.",
    };
  }

  const providerId = getFormString(formData, "providerId");
  const returnPath = getSafeReturnPath(getFormString(formData, "returnPath"));
  const rating = Number.parseInt(getFormString(formData, "rating"), 10);

  if (!isProviderProfileId(providerId)) {
    return {
      status: "error",
      message: "This provider profile could not be found.",
    };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return {
      status: "error",
      message: "Choose a rating from 1 to 5.",
    };
  }

  const supabase = await getServerSupabaseClient();
  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id,slug,user_id")
    .eq("id", providerId)
    .eq("status", "active")
    .maybeSingle();

  if (!provider) {
    return {
      status: "error",
      message: "This provider is not available for ratings.",
    };
  }

  if (provider.user_id === profile.id) {
    return {
      status: "error",
      message: "You cannot rate your own provider profile.",
    };
  }

  const { data: existingRating } = await supabase
    .from("provider_ratings")
    .select("id")
    .eq("provider_profile_id", providerId)
    .eq("rater_user_id", profile.id)
    .maybeSingle();
  const { error } = existingRating
    ? await supabase
        .from("provider_ratings")
        .update({ rating })
        .eq("id", existingRating.id)
    : await supabase.from("provider_ratings").insert({
        provider_profile_id: providerId,
        rater_user_id: profile.id,
        rating,
      });

  if (error) {
    return {
      status: "error",
      message: "Your rating could not be saved. Please try again.",
    };
  }

  revalidatePath(returnPath);
  revalidatePath(`/providers/${provider.slug}`);
  revalidatePath("/search");

  return {
    status: "success",
    message: "Your rating has been saved.",
  };
}
