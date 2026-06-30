"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import {
  getProviderProfileSlug,
  isProviderProfileId,
} from "@/lib/providers/slug";
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

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getSafeProviderDashboardReturnPath(value: string) {
  if (!value.startsWith("/provider/dashboard") || value.startsWith("//")) {
    return "/provider/dashboard#inquiries";
  }

  return value;
}

function getProviderContactActionReturnPath(
  returnPath: string,
  outcome: string,
) {
  const [pathWithQuery, hash] = returnPath.split("#");
  const url = new URL(pathWithQuery, "http://myrealhub.local");
  url.searchParams.set("contactAction", outcome);

  return `${url.pathname}${url.search}${hash ? `#${hash}` : "#inquiries"}`;
}

function redirectToContactRequestOutcome(formData: FormData, outcome: string) {
  const returnPath = getSafeProviderDashboardReturnPath(
    getFormString(formData, "returnPath"),
  );

  redirect(getProviderContactActionReturnPath(returnPath, outcome));
}

async function getProviderOwnedContactRequest(requestId: string) {
  await requireProfileRole("provider");

  if (!isProviderProfileId(requestId)) {
    return null;
  }

  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("contact_requests")
    .select("id,status")
    .eq("id", requestId)
    .maybeSingle();

  return (data ?? null) as { id: string; status: string } | null;
}

function revalidateContactRequestDashboards() {
  revalidatePath("/provider/dashboard");
  revalidatePath("/dashboard");
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
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    values.languageIds.length > 0
      ? supabase
          .from("languages")
          .select("id")
          .in("id", values.languageIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    values.specialtyIds.length > 0
      ? supabase
          .from("specialties")
          .select("id,category_id")
          .in("id", values.specialtyIds)
          .eq("is_active", true)
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
  const slug = getProviderProfileSlug({
    businessName: values.businessName,
    displayName: values.fullName,
    userId: profile.id,
  });
  const providerProfilePayload: Record<string, string | null> = {
    user_id: profile.id,
    slug,
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
  revalidatePath(`/providers/${slug}`);
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

export async function markContactRequestRead(formData: FormData) {
  const requestId = getFormString(formData, "requestId");
  const contactRequest = await getProviderOwnedContactRequest(requestId);

  if (!contactRequest) {
    redirectToContactRequestOutcome(formData, "not-found");
  }

  const now = new Date().toISOString();
  const supabase = await getServerSupabaseClient();
  const { error } = await supabase
    .from("contact_requests")
    .update({
      status: "read",
      read_at: now,
    })
    .eq("id", requestId)
    .eq("status", "new");

  if (error) {
    redirectToContactRequestOutcome(formData, "error");
  }

  revalidateContactRequestDashboards();
  redirectToContactRequestOutcome(formData, "read");
}

export async function respondToContactRequest(formData: FormData) {
  const requestId = getFormString(formData, "requestId");
  const providerResponse = getFormString(formData, "providerResponse");
  const contactRequest = await getProviderOwnedContactRequest(requestId);

  if (!contactRequest) {
    redirectToContactRequestOutcome(formData, "not-found");
  }

  if (!providerResponse) {
    redirectToContactRequestOutcome(formData, "response-empty");
  }

  if (providerResponse.length > 2000) {
    redirectToContactRequestOutcome(formData, "response-too-long");
  }

  const now = new Date().toISOString();
  const supabase = await getServerSupabaseClient();
  const { error } = await supabase
    .from("contact_requests")
    .update({
      status: "responded",
      provider_response: providerResponse,
      read_at: now,
      responded_at: now,
      rejected_at: null,
      archived_at: null,
    })
    .eq("id", requestId)
    .neq("status", "archived");

  if (error) {
    redirectToContactRequestOutcome(formData, "error");
  }

  revalidateContactRequestDashboards();
  redirectToContactRequestOutcome(formData, "responded");
}

export async function rejectContactRequest(formData: FormData) {
  const requestId = getFormString(formData, "requestId");
  const providerResponse = getFormString(formData, "providerResponse");
  const contactRequest = await getProviderOwnedContactRequest(requestId);

  if (!contactRequest) {
    redirectToContactRequestOutcome(formData, "not-found");
  }

  if (providerResponse.length > 2000) {
    redirectToContactRequestOutcome(formData, "response-too-long");
  }

  const now = new Date().toISOString();
  const supabase = await getServerSupabaseClient();
  const { error } = await supabase
    .from("contact_requests")
    .update({
      status: "rejected",
      provider_response: providerResponse || null,
      read_at: now,
      responded_at: null,
      rejected_at: now,
      archived_at: null,
    })
    .eq("id", requestId)
    .neq("status", "archived");

  if (error) {
    redirectToContactRequestOutcome(formData, "error");
  }

  revalidateContactRequestDashboards();
  redirectToContactRequestOutcome(formData, "rejected");
}

export async function archiveContactRequest(formData: FormData) {
  const requestId = getFormString(formData, "requestId");
  const contactRequest = await getProviderOwnedContactRequest(requestId);

  if (!contactRequest) {
    redirectToContactRequestOutcome(formData, "not-found");
  }

  const now = new Date().toISOString();
  const supabase = await getServerSupabaseClient();
  const { error } = await supabase
    .from("contact_requests")
    .update({
      status: "archived",
      read_at: now,
      archived_at: now,
    })
    .eq("id", requestId);

  if (error) {
    redirectToContactRequestOutcome(formData, "error");
  }

  revalidateContactRequestDashboards();
  redirectToContactRequestOutcome(formData, "archived");
}
