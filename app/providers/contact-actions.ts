"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasProfileCapability } from "@/lib/auth/roles";
import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import {
  getContactDeliveryMethod,
  type ContactDeliveryMethod,
  type ContactEmailDeliveryStatus,
} from "@/lib/contact-requests";
import {
  getProviderConversationUrl,
  sendProviderInquiryNotificationEmail,
  sendProviderInquiryRelayEmail,
} from "@/lib/email/provider-inquiries";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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

type ActiveProvider = {
  id: string;
  user_id: string;
  business_name: string | null;
  display_name: string | null;
  email: string | null;
  accept_new_inquiries: boolean | null;
  contact_delivery_method: string | null;
  new_message_email_enabled: boolean | null;
};

type ProviderNotificationPreferenceRow = {
  notification_email: string | null;
};

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
    .select(
      [
        "id",
        "user_id",
        "business_name",
        "display_name",
        "email",
        "accept_new_inquiries",
        "contact_delivery_method",
        "new_message_email_enabled",
      ].join(","),
    )
    .eq("id", providerId)
    .eq("status", "active")
    .maybeSingle();

  return (data ?? null) as ActiveProvider | null;
}

function getProviderName(provider: ActiveProvider) {
  return (
    provider.business_name ??
    provider.display_name ??
    provider.email ??
    "this provider"
  );
}

async function getProviderNotificationEmail(providerId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      email: null,
      error: "Email delivery is not configured for this environment.",
    };
  }

  const { data, error } = await supabase
    .from("provider_notification_preferences")
    .select("notification_email")
    .eq("provider_profile_id", providerId)
    .maybeSingle();

  if (error) {
    console.error("Provider notification email lookup failed", error);

    return {
      email: null,
      error: "Notification email could not be loaded.",
    };
  }

  const notificationPreference =
    (data ?? null) as ProviderNotificationPreferenceRow | null;
  const email = normalizeEmail(notificationPreference?.notification_email ?? "");

  return email
    ? { email, error: null }
    : {
        email: null,
        error: "Provider notification email is not configured.",
      };
}

async function recordContactRequestEmailDelivery({
  error,
  requestId,
  status,
}: {
  error?: string;
  requestId: string;
  status: Exclude<ContactEmailDeliveryStatus, "pending">;
}) {
  const supabase = await getServerSupabaseClient();
  const { error: updateError } = await supabase.rpc(
    "record_contact_request_email_delivery",
    {
      target_contact_request_id: requestId,
      target_email_delivery_error: error ?? null,
      target_email_delivery_status: status,
    },
  );

  if (updateError) {
    console.error("Contact request email status update failed", updateError);
  }
}

function getInitialEmailDeliveryStatus({
  deliveryMethod,
  newMessageEmailEnabled,
}: {
  deliveryMethod: ContactDeliveryMethod;
  newMessageEmailEnabled: boolean;
}): ContactEmailDeliveryStatus {
  return deliveryMethod === "email" ||
    (deliveryMethod === "in_app" && newMessageEmailEnabled)
    ? "pending"
    : "not_requested";
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

  if (!activeProvider.accept_new_inquiries) {
    return {
      status: "error",
      message: "This provider is not accepting new inquiries right now.",
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

  const deliveryMethod = getContactDeliveryMethod(
    activeProvider.contact_delivery_method,
  );
  const newMessageEmailEnabled = Boolean(
    activeProvider.new_message_email_enabled,
  );
  const emailDeliveryStatus = getInitialEmailDeliveryStatus({
    deliveryMethod,
    newMessageEmailEnabled,
  });
  const supabase = await getServerSupabaseClient();
  const { data: contactRequest, error } = await supabase
    .from("contact_requests")
    .insert({
      delivery_method: deliveryMethod,
      email_delivery_status: emailDeliveryStatus,
      provider_profile_id: providerId,
      sender_email: values.email,
      sender_name: values.name,
      sender_phone: values.phone || null,
      sender_user_id: currentProfile.id,
      subject: values.subject,
      message: values.message,
    })
    .select("id")
    .single();

  if (error) {
    return {
      status: "error",
      message: "We could not send your message. Please try again.",
      fieldErrors: {},
    };
  }

  const shouldSendEmail =
    deliveryMethod === "email" ||
    (deliveryMethod === "in_app" && newMessageEmailEnabled);

  if (shouldSendEmail && contactRequest?.id) {
    const notificationEmail = await getProviderNotificationEmail(providerId);

    if (notificationEmail.error || !notificationEmail.email) {
      await recordContactRequestEmailDelivery({
        error: notificationEmail.error ?? undefined,
        requestId: contactRequest.id,
        status: "failed",
      });

      if (deliveryMethod === "email") {
        revalidatePath(getRevalidationPath(returnPath));
        revalidatePath("/dashboard");
        revalidatePath("/provider/dashboard");

        return {
          status: "error",
          message:
            "Your inquiry was saved, but the secure email relay could not be delivered. Please try again later.",
          fieldErrors: {},
        };
      }
    } else {
      const emailInput = {
        conversationUrl: getProviderConversationUrl(contactRequest.id),
        message: values.message,
        providerName: getProviderName(activeProvider),
        recipientEmail: notificationEmail.email,
        senderEmail: values.email,
        senderName: values.name,
        senderPhone: values.phone || null,
        subject: values.subject,
      };
      const deliveryResult =
        deliveryMethod === "email"
          ? await sendProviderInquiryRelayEmail(emailInput)
          : await sendProviderInquiryNotificationEmail(emailInput);

      await recordContactRequestEmailDelivery({
        error: deliveryResult.ok ? undefined : deliveryResult.error,
        requestId: contactRequest.id,
        status: deliveryResult.ok ? "sent" : "failed",
      });

      if (!deliveryResult.ok && deliveryMethod === "email") {
        revalidatePath(getRevalidationPath(returnPath));
        revalidatePath("/dashboard");
        revalidatePath("/provider/dashboard");

        return {
          status: "error",
          message:
            "Your inquiry was saved, but the secure email relay could not be delivered. Please try again later.",
          fieldErrors: {},
        };
      }
    }
  }

  revalidatePath(getRevalidationPath(returnPath));
  revalidatePath("/dashboard");
  revalidatePath("/provider/dashboard");

  return {
    status: "success",
    message:
      deliveryMethod === "email"
        ? "Thanks. Your message was securely relayed to this provider."
        : "Thanks. Your message has been sent to this provider.",
    fieldErrors: {},
  };
}
