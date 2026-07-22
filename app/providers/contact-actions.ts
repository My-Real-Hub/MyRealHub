"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasProfileCapability } from "@/lib/auth/roles";
import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type ContactProviderFieldErrors = Partial<
  Record<"name" | "email" | "phone" | "subject" | "message", string>
>;

export type ContactProviderFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: ContactProviderFieldErrors;
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

function getRevalidationPath(returnPath: string) {
  try {
    return new URL(returnPath, "https://myrealhub.local").pathname;
  } catch {
    return "/search";
  }
}

function hasFieldErrors(errors: ContactProviderFieldErrors) {
  return Object.values(errors).some(Boolean);
}

function validateContactRequest(values: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}) {
  const errors: ContactProviderFieldErrors = {};

  if (!values.name) {
    errors.name = "Name is required.";
  } else if (values.name.length > 120) {
    errors.name = "Name must be 120 characters or fewer.";
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (values.phone.length > 40) {
    errors.phone = "Phone must be 40 characters or fewer.";
  }

  if (!values.subject) {
    errors.subject = "Subject is required.";
  } else if (values.subject.length > 160) {
    errors.subject = "Subject must be 160 characters or fewer.";
  }

  if (!values.message) {
    errors.message = "Message is required.";
  } else if (values.message.length > 2000) {
    errors.message = "Message must be 2,000 characters or fewer.";
  }

  return errors;
}

async function getActiveProvider(providerId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select("id,user_id")
    .eq("id", providerId)
    .eq("status", "active")
    .maybeSingle();

  return (data ?? null) as { id: string; user_id: string } | null;
}

export async function submitContactRequest(
  _previousState: ContactProviderFormState,
  formData: FormData,
): Promise<ContactProviderFormState> {
  const providerId = getFormString(formData, "providerId");
  const returnPath = getSafeReturnPath(getFormString(formData, "returnPath"));
  const values = {
    name: getFormString(formData, "name"),
    email: normalizeEmail(getFormString(formData, "email")),
    phone: getFormString(formData, "phone"),
    subject: getFormString(formData, "subject"),
    message: getFormString(formData, "message"),
  };
  const fieldErrors = validateContactRequest(values);

  if (hasFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  if (!isProviderProfileId(providerId)) {
    return {
      status: "error",
      message: "This provider profile could not be found.",
      fieldErrors: {},
    };
  }

  const [activeProvider, currentProfile] = await Promise.all([
    getActiveProvider(providerId),
    getCurrentProfile(),
  ]);

  if (!currentProfile) {
    return {
      status: "error",
      message: "Log in or create an account to contact this provider.",
      fieldErrors: {},
    };
  }

  if (!activeProvider) {
    return {
      status: "error",
      message: "This provider is not accepting public contact requests.",
      fieldErrors: {},
    };
  }

  if (currentProfile?.id === activeProvider.user_id) {
    return {
      status: "error",
      message: "You cannot contact your own provider profile.",
      fieldErrors: {},
    };
  }

  if (
    currentProfile &&
    !hasProfileCapability(currentProfile.role, "consume_services")
  ) {
    return {
      status: "error",
      message: "This account cannot send provider contact requests.",
      fieldErrors: {},
    };
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.from("contact_requests").insert({
    provider_profile_id: providerId,
    sender_user_id: currentProfile.id,
    sender_name: values.name,
    sender_email: values.email,
    sender_phone: values.phone || null,
    subject: values.subject,
    message: values.message,
  });

  if (error) {
    return {
      status: "error",
      message: "We could not send your message. Please try again.",
      fieldErrors: {},
    };
  }

  revalidatePath(getRevalidationPath(returnPath));
  revalidatePath("/provider/dashboard");

  return {
    status: "success",
    message: "Thanks. Your message has been sent to this provider.",
    fieldErrors: {},
  };
}
