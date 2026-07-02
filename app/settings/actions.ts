"use server";

import { revalidatePath } from "next/cache";
import { requireProfileCapability } from "@/lib/auth/session";
import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import { PROVIDER_PROFILE_IMAGES_BUCKET } from "@/lib/providers/profile-image";
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

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function hasFieldErrors(errors: AccountSettingsFieldErrors) {
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
