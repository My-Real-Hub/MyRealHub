"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  isPlatformFeedbackType,
  type PlatformFeedbackType,
} from "@/lib/feedback";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type FeedbackFormFieldErrors = Partial<
  Record<"type" | "title" | "description" | "currentPageUrl" | "screenshotPath", string>
>;

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

function validateCurrentPageUrl(value: string) {
  if (!value || value.length > 2048) {
    return false;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateScreenshotPath(value: string, accountId: string) {
  return (
    !value ||
    (value.length <= 512 &&
      value.startsWith(`${accountId}/`) &&
      !value.includes(".."))
  );
}

function validateFeedbackValues({
  accountId,
  currentPageUrl,
  description,
  screenshotPath,
  title,
  type,
}: {
  accountId: string;
  currentPageUrl: string;
  description: string;
  screenshotPath: string;
  title: string;
  type: string;
}) {
  const fieldErrors: FeedbackFormFieldErrors = {};

  if (!isPlatformFeedbackType(type)) {
    fieldErrors.type = "Choose bug or suggestion.";
  }

  if (!title) {
    fieldErrors.title = "Title is required.";
  } else if (title.length > 160) {
    fieldErrors.title = "Title must be 160 characters or fewer.";
  }

  if (!description) {
    fieldErrors.description = "Description is required.";
  } else if (description.length > 3000) {
    fieldErrors.description = "Description must be 3,000 characters or fewer.";
  }

  if (!validateCurrentPageUrl(currentPageUrl)) {
    fieldErrors.currentPageUrl =
      "The page URL could not be captured. Refresh and try again.";
  }

  if (!validateScreenshotPath(screenshotPath, accountId)) {
    fieldErrors.screenshotPath = "The screenshot upload could not be verified.";
  }

  return fieldErrors;
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
