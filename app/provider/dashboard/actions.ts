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
import { isOwnedProfileImagePath, PROVIDER_PROFILE_IMAGES_BUCKET } from "@/lib/providers/profile-image";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getListingRevision, getListingSaveMessage, LISTING_CONFLICT_MESSAGE, runListingOperation } from "@/lib/providers/listing-save";
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
  state: ProviderProfileFormState,
  formData: FormData,
): Promise<ProviderProfileFormState> {
  const profile = await requireProfileRole("provider");
  const revision = getListingRevision(formData.get("expectedDetailsRevision"));
  if (revision === null) return { ...databaseErrorState(LISTING_CONFLICT_MESSAGE), reloadRequired: true };
  const result = await saveProviderListing(formData, revision, profile.id);
  return { revision, listingRevision: state.listingRevision, listingStatus: state.listingStatus, reviewStatus: state.reviewStatus, ...result };
}

export async function deactivateOwnProviderListing(
  state: ProviderProfileFormState,
  formData: FormData,
): Promise<ProviderProfileFormState> {
  await requireProfileRole("provider");
  const revision = getListingRevision(formData.get("expectedRevision"));
  if (!revision || revision === "0") {
    return { ...state, ...databaseErrorState(LISTING_CONFLICT_MESSAGE), reloadRequired: true };
  }
  const supabase = await getServerSupabaseClient();
  const result = await runListingOperation(supabase, "deactivate_provider_listing", { expected_revision: revision });
  if (result.error !== null) return { ...state, ...databaseErrorState(result.error), reloadRequired: true };
  revalidatePath("/settings");
  revalidatePath("/provider/dashboard");
  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/dashboard/providers/${result.data.id}`);
  revalidatePath(`/providers/${result.data.slug}`);
  revalidatePath("/search");
  return {
    status: "success", fieldErrors: {}, message: "Your listing is inactive and hidden from the directory. Your account remains available.",
    listingRevision: result.data.revision, listingStatus: result.data.status, reviewStatus: result.data.review_status ?? null,
  };
}

async function saveProviderListing(formData: FormData, revision: string, accountId: string): Promise<ProviderProfileFormState> {
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
  if (imagePath && !isOwnedProfileImagePath(imagePath, accountId)) {
    return {
      status: "error",
      message: "The uploaded image could not be linked to this provider account.",
      fieldErrors: {},
    };
  }

  const providerProfilePayload: Record<string, string | null> = {
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
  };
  if (imagePath) {
    const { data: { publicUrl } } = supabase.storage.from(PROVIDER_PROFILE_IMAGES_BUCKET).getPublicUrl(imagePath);
    providerProfilePayload.profile_image_path = imagePath;
    providerProfilePayload.profile_image_url = publicUrl;
  } else if (formData.get("removeProfileImage") === "yes") {
    providerProfilePayload.profile_image_path = null;
    providerProfilePayload.profile_image_url = null;
  }
  const result = await runListingOperation(supabase, "save_provider_listing_details", {
    expected_details_revision: revision,
    fields: providerProfilePayload,
    language_ids: values.languageIds,
    specialty_ids: values.specialtyIds,
    intent,
  });
  if (result.error !== null) return { ...databaseErrorState(result.error), reloadRequired: true };
  const providerProfile = result.data;

  revalidatePath("/provider/dashboard");
  revalidatePath("/settings");
  if (!providerProfile.already_pending) {
    revalidatePath("/admin/dashboard");
    revalidatePath(`/admin/dashboard/providers/${providerProfile.id}`);
    revalidatePath(`/providers/${providerProfile.slug}`);
    revalidatePath("/search");
  }

  return {
    status: "success",
    revision: providerProfile.details_revision,
    listingRevision: providerProfile.revision,
    listingStatus: providerProfile.status,
    reviewStatus: providerProfile.review_status ?? null,
    alreadyPending: providerProfile.already_pending,
    message: getListingSaveMessage(intent, providerProfile),
    fieldErrors: {},
  };
}

export async function markContactRequestRead(formData: FormData) {
  const requestId = getFormString(formData, "requestId");
  const contactRequest = await getProviderOwnedContactRequest(requestId);

  if (!contactRequest) {
    redirectToContactRequestOutcome(formData, "not-found");
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc(
    "mark_contact_request_conversation_read",
    {
      target_contact_request_id: requestId,
    },
  );

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

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc("send_contact_request_message", {
    message_body: providerResponse,
    target_contact_request_id: requestId,
  });

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

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc(
    "update_contact_request_conversation_status",
    {
      target_contact_request_id: requestId,
      target_provider_note: providerResponse || null,
      target_status: "rejected",
    },
  );

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

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc(
    "update_contact_request_conversation_status",
    {
      target_contact_request_id: requestId,
      target_provider_note: null,
      target_status: "archived",
    },
  );

  if (error) {
    redirectToContactRequestOutcome(formData, "error");
  }

  revalidateContactRequestDashboards();
  redirectToContactRequestOutcome(formData, "archived");
}
