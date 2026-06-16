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
  const isApprovalRequest = intent === "submit" || intent === "reactivate";
  const completeProfileErrorMessage =
    intent === "reactivate"
      ? "Complete the required fields before requesting reactivation."
      : "Complete the required fields before submitting for approval.";
  const values = getProviderProfileFormValues(formData);
  values.languageIds = dedupeIds(values.languageIds);
  values.specialtyIds = dedupeIds(values.specialtyIds);

  const fieldErrors = validateProviderProfileFormValues(values, intent);

  if (hasProviderProfileFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message:
        isApprovalRequest
          ? completeProfileErrorMessage
          : "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = await getServerSupabaseClient();
  const [categoryResult, languagesResult, specialtiesResult] = await Promise.all([
    values.categoryId
      ? supabase
          .from("categories")
          .select("id")
          .eq("id", values.categoryId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    values.languageIds.length > 0
      ? supabase.from("languages").select("id").in("id", values.languageIds)
      : Promise.resolve({ data: [], error: null }),
    values.specialtyIds.length > 0
      ? supabase
          .from("specialties")
          .select("id,category_id")
          .in("id", values.specialtyIds)
      : Promise.resolve({ data: [], error: null }),
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

  if (values.categoryId && !categoryResult.data) {
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
    if (!values.categoryId) {
      verifiedFieldErrors.categoryId =
        "Choose a profession before selecting specialties.";
    } else {
      verifiedFieldErrors.specialtyIds =
        "Choose specialties for the selected profession.";
    }
  }

  if (hasProviderProfileFieldErrors(verifiedFieldErrors)) {
    return {
      status: "error",
      message:
        isApprovalRequest
          ? completeProfileErrorMessage
          : "Please fix the highlighted fields.",
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
  const status = isApprovalRequest ? "pending_approval" : "draft";
  const providerProfilePayload: Record<string, string | null> = {
    user_id: profile.id,
    category_id: values.categoryId || null,
    business_name: values.businessName || null,
    display_name: values.fullName || null,
    bio: values.bio || null,
    phone: values.phone || null,
    email: values.email || null,
    website_url: values.websiteUrl || null,
    city: values.city || null,
    province_state: values.province || null,
    country: values.country || null,
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
    values.languageIds.length > 0
      ? supabase.from("provider_languages").insert(
          values.languageIds.map((languageId) => ({
            provider_profile_id: providerProfile.id,
            language_id: languageId,
          })),
        )
      : Promise.resolve({ error: null }),
    values.specialtyIds.length > 0
      ? supabase.from("provider_specialties").insert(
          values.specialtyIds.map((specialtyId) => ({
            provider_profile_id: providerProfile.id,
            specialty_id: specialtyId,
          })),
        )
      : Promise.resolve({ error: null }),
  ]);

  if (languageInsertResult.error || specialtyInsertResult.error) {
    return databaseErrorState(
      "Profile saved, but languages or specialties could not be updated.",
    );
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/dashboard/providers/${providerProfile.id}`);
  revalidatePath("/search");

  return {
    status: "success",
    message:
      intent === "reactivate"
        ? "Reactivation request sent for admin approval. Your listing is now pending approval."
        : status === "pending_approval"
        ? "Profile submitted for admin approval. Your listing is now pending approval."
        : "Draft saved.",
    fieldErrors: {},
  };
}
