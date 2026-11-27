"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasProfileCapability } from "@/lib/auth/roles";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { parseProviderRating, validateProviderRating } from "@/lib/providers/rating";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type ProviderRatingFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Partial<Record<"rating" | "review", string>>;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getSafeReturnPath(value: string) {
  return getSafeRedirectPath(value) ?? "/search";
}

function getRevalidationPath(returnPath: string) {
  try {
    return new URL(returnPath, "https://myrealhub.local").pathname;
  } catch {
    return "/search";
  }
}

function hasFieldErrors(
  fieldErrors: ProviderRatingFormState["fieldErrors"],
) {
  return Object.values(fieldErrors).some(Boolean);
}

function getBaseErrorState(message: string): ProviderRatingFormState {
  return {
    status: "error",
    message,
    fieldErrors: {},
  };
}

function revalidateRatingPaths(returnPath: string, providerSlug: string) {
  revalidatePath(getRevalidationPath(returnPath));
  revalidatePath(`/providers/${providerSlug}`);
  revalidatePath("/search");
}

type ActiveProvider = {
  id: string;
  slug: string;
  user_id: string;
};

async function getActiveProvider(providerId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select("id,slug,user_id")
    .eq("id", providerId)
    .eq("status", "active")
    .maybeSingle();

  return (data ?? null) as ActiveProvider | null;
}

export async function submitProviderRating(
  _previousState: ProviderRatingFormState,
  formData: FormData,
): Promise<ProviderRatingFormState> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return getBaseErrorState("Log in to rate this provider.");
  }

  if (!hasProfileCapability(profile.role, "consume_services")) {
    return getBaseErrorState("This account cannot rate providers.");
  }

  const providerId = getFormString(formData, "providerId");
  const returnPath = getSafeReturnPath(getFormString(formData, "returnPath"));
  const rating = parseProviderRating(getFormString(formData, "rating"));
  const review = getFormString(formData, "review");
  const fieldErrors = validateProviderRating({ rating, review });

  if (!isProviderProfileId(providerId)) {
    return getBaseErrorState("This provider profile could not be found.");
  }

  if (hasFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const provider = await getActiveProvider(providerId);

  if (!provider) {
    return getBaseErrorState("This provider is not available for ratings.");
  }

  if (provider.user_id === profile.id) {
    return getBaseErrorState("You cannot rate your own provider profile.");
  }

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_provider_rating", {
    target_provider_profile_id: providerId,
    target_rating: rating,
    target_review: review || null,
  });

  if (error) {
    return getBaseErrorState(
      "Your rating could not be saved. Please try again.",
    );
  }

  const savedRating = Array.isArray(data) ? data[0] : data;
  const isHidden =
    savedRating &&
    typeof savedRating === "object" &&
    "moderation_status" in savedRating &&
    savedRating.moderation_status === "hidden";

  revalidateRatingPaths(returnPath, provider.slug);

  return {
    status: "success",
    message: isHidden
      ? "Your rating has been updated. It remains hidden while it is under moderation."
      : "Your rating has been saved.",
    fieldErrors: {},
  };
}

export async function removeProviderRating(
  _previousState: ProviderRatingFormState,
  formData: FormData,
): Promise<ProviderRatingFormState> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return getBaseErrorState("Log in to remove this rating.");
  }

  if (!hasProfileCapability(profile.role, "consume_services")) {
    return getBaseErrorState("This account cannot manage provider ratings.");
  }

  const providerId = getFormString(formData, "providerId");
  const returnPath = getSafeReturnPath(getFormString(formData, "returnPath"));

  if (!isProviderProfileId(providerId)) {
    return getBaseErrorState("This provider profile could not be found.");
  }

  const [provider, supabase] = await Promise.all([
    getActiveProvider(providerId),
    getServerSupabaseClient(),
  ]);

  if (!provider) {
    return getBaseErrorState("This provider is not available for ratings.");
  }

  const { error } = await supabase.rpc("remove_provider_rating", {
    target_provider_profile_id: providerId,
  });

  if (error) {
    return getBaseErrorState(
      "Your rating could not be removed. Please try again.",
    );
  }

  revalidateRatingPaths(returnPath, provider.slug);

  return {
    status: "success",
    message: "Your rating has been removed.",
    fieldErrors: {},
  };
}
