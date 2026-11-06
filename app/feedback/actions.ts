"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  validateFeedbackValues,
  type FeedbackFormFieldErrors,
  type PlatformFeedbackType,
} from "@/lib/feedback";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type { FeedbackFormFieldErrors } from "@/lib/feedback";

export type FeedbackFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: FeedbackFormFieldErrors;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getBaseErrorState(message: string): FeedbackFormState {
  return {
    status: "error",
    message,
    fieldErrors: {},
  };
}

function hasFieldErrors(fieldErrors: FeedbackFormFieldErrors) {
  return Object.values(fieldErrors).some(Boolean);
}

export async function submitPlatformFeedback(
  _previousState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return getBaseErrorState("Log in to send feedback.");
  }

  const type = getFormString(formData, "type");
  const title = getFormString(formData, "title");
  const description = getFormString(formData, "description");
  const currentPageUrl = getFormString(formData, "currentPageUrl");
  const screenshotPath = getFormString(formData, "screenshotPath");
  const fieldErrors = validateFeedbackValues({
    accountId: profile.id,
    currentPageUrl,
    description,
    screenshotPath,
    title,
    type,
  });

  if (hasFieldErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc("submit_platform_feedback", {
    target_current_page_url: currentPageUrl,
    target_description: description,
    target_screenshot_path: screenshotPath || null,
    target_title: title,
    target_type: type as PlatformFeedbackType,
  });

  if (error) {
    return getBaseErrorState(
      "Your feedback could not be submitted. Please try again.",
    );
  }

  revalidatePath("/admin/dashboard");

  return {
    status: "success",
    message:
      "Thanks — your feedback has been sent to the MyRealHub admin team.",
    fieldErrors: {},
  };
}
