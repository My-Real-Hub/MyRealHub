"use server";

import { revalidatePath } from "next/cache";
import { requireProfileRole } from "@/lib/auth/session";
import {
  getProviderProfileFormIntent,
  getProviderProfileFormValues,
  hasProviderProfileFieldErrors,
  initialProviderProfileFormState,
  validateProviderProfileFormValues,
  type ProviderProfileFieldErrors,
  type ProviderProfileFormState,
} from "@/lib/providers/profile-form";
import { PROVIDER_PROFILE_IMAGES_BUCKET } from "@/lib/providers/profile-image";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type SpecialtyRow = {
  id: string;
  category_id: string | null;
};

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function databaseErrorState(message: string): ProviderProfileFormState {
  return {
    ...initialProviderProfileFormState,
    status: "error",
    message,
  };
}

export async function saveProviderProfile(
  _state: ProviderProfileFormState,
  formData: FormData,
): Promise<ProviderProfileFormState> {
  const profile = await requireProfileRole("provider");
  const intent = getProviderProfileFormIntent(formData);
  const values = getProviderProfileFormValues(formData);
  values.languageIds = dedupeIds(values.languageIds);
  values.specialtyIds = dedupeIds(values.specialtyIds);

  const fieldErrors = validateProviderProfileFormValues(values);

  if (hasProviderProfileFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = await getServerSupabaseClient();
  const [categoryResult, languagesResult, specialtiesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id")
      .eq("id", values.categoryId)
      .maybeSingle(),
    supabase.from("languages").select("id").in("id", values.languageIds),
    supabase
      .from("specialties")
      .select("id,category_id")
      .in("id", values.specialtyIds),
  ]);

  if (categoryResult.error) {
    return databaseErrorState("Could not verify the selected profession.");
  }

  if (languagesResult.error) {
    return databaseErrorState("Could not verify the selected languages.");
  }

  if (specialtiesResult.error) {
    return databaseErrorState("Could not verify the selected specialties.");
  }

  const verifiedFieldErrors: ProviderProfileFieldErrors = {};
  const languageIds = new Set(
    (languagesResult.data ?? []).map((language) => language.id),
  );
  const specialties = (specialtiesResult.data ?? []) as SpecialtyRow[];
  const specialtyIds = new Set(specialties.map((specialty) => specialty.id));

  if (!categoryResult.data) {
    verifiedFieldErrors.categoryId = "Choose a valid profession.";
  }

  if (values.languageIds.some((languageId) => !languageIds.has(languageId))) {
    verifiedFieldErrors.languageIds = "Choose valid languages.";
  }

  if (values.specialtyIds.some((specialtyId) => !specialtyIds.has(specialtyId))) {
    verifiedFieldErrors.specialtyIds = "Choose valid specialties.";
  }

  if (
    specialties.some(
      (specialty) =>
        specialty.category_id !== null &&
        specialty.category_id !== values.categoryId,
    )
  ) {
    verifiedFieldErrors.specialtyIds =
      "Choose specialties for the selected profession.";
  }

  if (hasProviderProfileFieldErrors(verifiedFieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: verifiedFieldErrors,
    };
  }

  const imagePath = values.profileImagePath;
  const providerImagePrefix = `${profile.id}/`;

  if (imagePath && !imagePath.startsWith(providerImagePrefix)) {
    return {
      status: "error",
      message: "The uploaded image could not be linked to this provider account.",
      fieldErrors: {},
    };
  }

  const now = new Date().toISOString();
  const status = intent === "submit" ? "pending_approval" : "draft";
  const providerProfilePayload: Record<string, string | null> = {
    user_id: profile.id,
    category_id: values.categoryId,
    business_name: values.businessName,
    display_name: values.fullName,
    bio: values.bio,
    phone: values.phone,
    email: values.email,
    website_url: values.websiteUrl || null,
    city: values.city,
    province_state: values.province,
    country: values.country,
    status,
    rejection_reason: null,
    submitted_at: status === "pending_approval" ? now : null,
    approved_at: null,
  };

  if (imagePath) {
    const {
      data: { publicUrl },
    } = supabase.storage
      .from(PROVIDER_PROFILE_IMAGES_BUCKET)
      .getPublicUrl(imagePath);

    providerProfilePayload.profile_image_path = imagePath;
    providerProfilePayload.profile_image_url = publicUrl;
  }

  const { data: providerProfile, error: providerProfileError } = await supabase
    .from("provider_profiles")
    .upsert(providerProfilePayload, { onConflict: "user_id" })
    .select("id")
    .single();

  if (providerProfileError || !providerProfile) {
    return databaseErrorState("Profile could not be saved. Please try again.");
  }

  const [languageDeleteResult, specialtyDeleteResult] = await Promise.all([
    supabase
      .from("provider_languages")
      .delete()
      .eq("provider_profile_id", providerProfile.id),
    supabase
      .from("provider_specialties")
      .delete()
      .eq("provider_profile_id", providerProfile.id),
  ]);

  if (languageDeleteResult.error || specialtyDeleteResult.error) {
    return databaseErrorState(
      "Profile saved, but service details could not be refreshed.",
    );
  }

  const [languageInsertResult, specialtyInsertResult] = await Promise.all([
    supabase.from("provider_languages").insert(
      values.languageIds.map((languageId) => ({
        provider_profile_id: providerProfile.id,
        language_id: languageId,
      })),
    ),
    supabase.from("provider_specialties").insert(
      values.specialtyIds.map((specialtyId) => ({
        provider_profile_id: providerProfile.id,
        specialty_id: specialtyId,
      })),
    ),
  ]);

  if (languageInsertResult.error || specialtyInsertResult.error) {
    return databaseErrorState(
      "Profile saved, but languages or specialties could not be updated.",
    );
  }

  revalidatePath("/provider/dashboard");

  return {
    status: "success",
    message:
      status === "pending_approval"
        ? "Profile submitted for approval."
        : "Draft saved.",
    fieldErrors: {},
  };
}
