export const FEEDBACK_TYPES = ["bug", "suggestion"] as const;
export const FEEDBACK_STATUSES = [
  "new",
  "reviewing",
  "planned",
  "resolved",
  "closed",
] as const;

export type PlatformFeedbackType = (typeof FEEDBACK_TYPES)[number];
export type PlatformFeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_SCREENSHOTS_BUCKET = "feedback-screenshots";
export const FEEDBACK_SCREENSHOT_MAX_SIZE = 5 * 1024 * 1024;
export const FEEDBACK_SCREENSHOT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const feedbackTypeLabels: Record<PlatformFeedbackType, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
};

export const feedbackStatusLabels: Record<PlatformFeedbackStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  planned: "Planned",
  resolved: "Resolved",
  closed: "Closed",
};

export function isPlatformFeedbackType(
  value: unknown,
): value is PlatformFeedbackType {
  return (
    typeof value === "string" &&
    FEEDBACK_TYPES.includes(value as PlatformFeedbackType)
  );
}

export function isPlatformFeedbackStatus(
  value: unknown,
): value is PlatformFeedbackStatus {
  return (
    typeof value === "string" &&
    FEEDBACK_STATUSES.includes(value as PlatformFeedbackStatus)
  );
}

export function isFeedbackScreenshotMimeType(value: string) {
  return FEEDBACK_SCREENSHOT_MIME_TYPES.includes(
    value as (typeof FEEDBACK_SCREENSHOT_MIME_TYPES)[number],
  );
}

export type FeedbackFormFieldErrors = Partial<
  Record<"type" | "title" | "description" | "currentPageUrl" | "screenshotPath", string>
>;

export function validateFeedbackPageUrl(value: string) {
  if (!value || value.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateFeedbackScreenshotPath(value: string, accountId: string) {
  return (
    !value ||
    (value.length <= 512 &&
      value.startsWith(`${accountId}/`) &&
      value.length > accountId.length + 1 &&
      !/[\\\u0000-\u001f\u007f]/.test(value) &&
      !value.includes(".."))
  );
}

export function validateFeedbackValues({
  accountId, currentPageUrl, description, screenshotPath, title, type,
}: {
  accountId: string;
  currentPageUrl: string;
  description: string;
  screenshotPath: string;
  title: string;
  type: string;
}): FeedbackFormFieldErrors {
  const fieldErrors: FeedbackFormFieldErrors = {};

  if (!isPlatformFeedbackType(type)) fieldErrors.type = "Choose bug or suggestion.";

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

  if (!validateFeedbackPageUrl(currentPageUrl)) {
    fieldErrors.currentPageUrl = "The page URL could not be captured. Refresh and try again.";
  }
  if (!validateFeedbackScreenshotPath(screenshotPath, accountId)) {
    fieldErrors.screenshotPath = "The screenshot upload could not be verified.";
  }

  return fieldErrors;
}
