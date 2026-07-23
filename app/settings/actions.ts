"use server";

import { revalidatePath } from "next/cache";
import { requireProfileCapability } from "@/lib/auth/session";
import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import {
  isContactDeliveryMethod,
  type ContactDeliveryMethod,
} from "@/lib/contact-requests";
import { PROVIDER_PROFILE_IMAGES_BUCKET } from "@/lib/providers/profile-image";
import { isProviderProfileId } from "@/lib/providers/slug";
import { MAX_PROVIDER_SERVICE_REGIONS } from "@/lib/service-regions";
import { PROFILE_BIO_MAX_LENGTH } from "@/lib/settings/profile";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type AccountSettingsFieldErrors = Partial<
  Record<
    "displayName" | "email" | "phone" | "bio" | "profileImagePath",
    string
  >
>;

export type AccountSettingsFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: AccountSettingsFieldErrors;
};

export type ProviderServiceRegionsFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldError: string;
};

export type ProviderCommunicationPreferencesFieldErrors = Partial<
  Record<"contactDeliveryMethod" | "notificationEmail", string>
>;

export type ProviderCommunicationPreferencesFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: ProviderCommunicationPreferencesFieldErrors;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getFormStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getFormBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function hasFieldErrors(errors: AccountSettingsFieldErrors) {
  return Object.values(errors).some(Boolean);
}

function hasProviderCommunicationPreferencesFieldErrors(
  errors: ProviderCommunicationPreferencesFieldErrors,
) {
  return Object.values(errors).some(Boolean);
}

export async function saveAccountSettings(
  _previousState: AccountSettingsFormState,
  formData: FormData,
): Promise<AccountSettingsFormState> {
  const profile = await requireProfileCapability("manage_account_settings");
  const values = {
    displayName: getFormString(formData, "displayName"),
    email: normalizeEmail(getFormString(formData, "email")),
    phone: getFormString(formData, "phone"),
    bio: getFormString(formData, "bio"),
    profileImagePath: getFormString(formData, "profileImagePath"),
  };
  const fieldErrors: AccountSettingsFieldErrors = {};

  if (!values.displayName) {
    fieldErrors.displayName = "Display name is required.";
  } else if (values.displayName.length > 120) {
    fieldErrors.displayName = "Display name must be 120 characters or fewer.";
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    fieldErrors.email = emailError;
  }

  if (values.phone.length > 40) {
    fieldErrors.phone = "Phone must be 40 characters or fewer.";
  }

  if (values.bio.length > PROFILE_BIO_MAX_LENGTH) {
    fieldErrors.bio = `Biography must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`;
  }

  if (
    values.profileImagePath &&
    !values.profileImagePath.startsWith(`${profile.id}/`)
  ) {
    fieldErrors.profileImagePath =
      "The uploaded image does not belong to this account.";
  }

  if (hasFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const emailChanged = normalizeEmail(user?.email ?? "") !== values.email;
  const authUpdate = await supabase.auth.updateUser({
    ...(emailChanged ? { email: values.email } : {}),
    data: {
      full_name: values.displayName,
    },
  });

  if (authUpdate.error) {
    return {
      status: "error",
      message: "Account settings could not be saved.",
      fieldErrors: {
        email: authUpdate.error.message,
      },
    };
  }

  let profileImageUrl: string | null = null;

  if (values.profileImagePath) {
    const {
      data: { publicUrl },
    } = supabase.storage
      .from(PROVIDER_PROFILE_IMAGES_BUCKET)
      .getPublicUrl(values.profileImagePath);

    profileImageUrl = publicUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: values.displayName,
      email: values.email,
      phone: values.phone || null,
      bio: values.bio || null,
      avatar_path: values.profileImagePath || null,
      avatar_url: profileImageUrl,
    })
    .eq("id", profile.id);

  if (error) {
    return {
      status: "error",
      message: "Profile settings could not be saved. Please try again.",
      fieldErrors: {},
    };
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("slug")
    .eq("user_id", profile.id)
    .maybeSingle();

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/provider/dashboard");
  revalidatePath("/search");

  if (providerProfile?.slug) {
    revalidatePath(`/providers/${providerProfile.slug}`);
  }

  return {
    status: "success",
    message: emailChanged
      ? "Settings saved. Check your new email address to confirm the change."
      : "Settings saved.",
    fieldErrors: {},
  };
}

export async function saveProviderServiceRegions(
  _previousState: ProviderServiceRegionsFormState,
  formData: FormData,
): Promise<ProviderServiceRegionsFormState> {
  const profile = await requireProfileCapability("manage_provider_profile");
  const serviceRegionIds = getFormStrings(formData, "serviceRegionIds");
  const uniqueServiceRegionIds = Array.from(new Set(serviceRegionIds));

  if (uniqueServiceRegionIds.length !== serviceRegionIds.length) {
    return {
      status: "error",
      message: "Service regions could not be saved.",
      fieldError: "Choose unique service regions.",
    };
  }

  if (serviceRegionIds.length > MAX_PROVIDER_SERVICE_REGIONS) {
    return {
      status: "error",
      message: "Service regions could not be saved.",
      fieldError: `Choose no more than ${MAX_PROVIDER_SERVICE_REGIONS} service regions.`,
    };
  }

  if (serviceRegionIds.some((regionId) => !isProviderProfileId(regionId))) {
    return {
      status: "error",
      message: "Service regions could not be saved.",
      fieldError: "Choose valid Canadian service regions.",
    };
  }

  const supabase = await getServerSupabaseClient();
  const { data: providerProfile, error: providerProfileError } = await supabase
    .from("provider_profiles")
    .select("id,slug")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (providerProfileError || !providerProfile) {
    return {
      status: "error",
      message: "Create and save your provider listing before adding regions.",
      fieldError: "",
    };
  }

  if (serviceRegionIds.length > 0) {
    const { data: verifiedRegions, error: regionError } = await supabase
      .from("service_regions")
      .select("id")
      .in("id", serviceRegionIds)
      .eq("is_active", true);

    if (
      regionError ||
      (verifiedRegions ?? []).length !== serviceRegionIds.length
    ) {
      return {
        status: "error",
        message: "Service regions could not be saved.",
        fieldError: "Choose valid active Canadian service regions.",
      };
    }
  }

  const { error } = await supabase.rpc("replace_provider_service_regions", {
    selected_service_region_ids: serviceRegionIds,
    target_provider_profile_id: providerProfile.id,
  });

  if (error) {
    return {
      status: "error",
      message: "Service regions could not be saved. Please try again.",
      fieldError: "",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/provider/dashboard");
  revalidatePath("/search");
  revalidatePath(`/providers/${providerProfile.slug}`);

  return {
    status: "success",
    message: "Service regions saved.",
    fieldError: "",
  };
}

export async function saveProviderCommunicationPreferences(
  _previousState: ProviderCommunicationPreferencesFormState,
  formData: FormData,
): Promise<ProviderCommunicationPreferencesFormState> {
  const profile = await requireProfileCapability("manage_provider_profile");
  const contactDeliveryMethodValue = getFormString(
    formData,
    "contactDeliveryMethod",
  );
  const contactDeliveryMethod: ContactDeliveryMethod | null =
    isContactDeliveryMethod(contactDeliveryMethodValue)
      ? contactDeliveryMethodValue
      : null;
  const values = {
    acceptNewInquiries: getFormBoolean(formData, "acceptNewInquiries"),
    contactDeliveryMethod,
    newMessageEmailEnabled: getFormBoolean(
      formData,
      "newMessageEmailEnabled",
    ),
    notificationEmail: normalizeEmail(
      getFormString(formData, "notificationEmail"),
    ),
  };
  const fieldErrors: ProviderCommunicationPreferencesFieldErrors = {};

  if (!values.contactDeliveryMethod) {
    fieldErrors.contactDeliveryMethod = "Choose a contact delivery method.";
  }

  if (
    values.notificationEmail ||
    (values.acceptNewInquiries && values.contactDeliveryMethod === "email") ||
    values.newMessageEmailEnabled
  ) {
    const notificationEmailError = validateEmail(values.notificationEmail);

    if (notificationEmailError) {
      fieldErrors.notificationEmail = notificationEmailError;
    }
  }

  if (hasProviderCommunicationPreferencesFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = await getServerSupabaseClient();
  const { data: providerProfile, error: providerProfileError } = await supabase
    .from("provider_profiles")
    .select("id,slug")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (providerProfileError || !providerProfile) {
    return {
      status: "error",
      message:
        "Create and save your provider listing before changing inquiry preferences.",
      fieldErrors: {},
    };
  }

  const { error } = await supabase.rpc(
    "update_provider_communication_preferences",
    {
      target_accept_new_inquiries: values.acceptNewInquiries,
      target_contact_delivery_method:
        values.contactDeliveryMethod ?? "in_app",
      target_new_message_email_enabled: values.newMessageEmailEnabled,
      target_notification_email: values.notificationEmail || null,
      target_provider_profile_id: providerProfile.id,
    },
  );

  if (error) {
    return {
      status: "error",
      message:
        "Inquiry preferences could not be saved. Please review the fields and try again.",
      fieldErrors: {},
    };
  }

  revalidatePath("/settings");
  revalidatePath("/provider/dashboard");
  revalidatePath("/search");
  revalidatePath(`/providers/${providerProfile.slug}`);

  return {
    status: "success",
    message: values.acceptNewInquiries
      ? "Inquiry preferences saved."
      : "Inquiry preferences saved. New inquiries are currently disabled.",
    fieldErrors: {},
  };
}
