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
