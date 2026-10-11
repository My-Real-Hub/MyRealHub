"use client";

import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { submitPlatformFeedback } from "@/app/feedback/actions";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import {
  FeedbackGuide,
  FeedbackIcon,
  feedbackPrimaryButton,
  feedbackSecondaryButton,
} from "./feedback-ui";
import {
  FEEDBACK_SCREENSHOT_MAX_SIZE,
  FEEDBACK_SCREENSHOTS_BUCKET,
  isFeedbackScreenshotMimeType,
  type PlatformFeedbackType,
} from "@/lib/feedback";
import { getSupabaseClient } from "@/lib/supabase/client";

type FeedbackFormProps = {
  accountId: string;
  initialCurrentPageUrl: string;
  reporterLabel: string;
};

type UploadStatus = {
  type: "idle" | "uploading" | "success" | "error";
  message: string;
};

const initialState = {
  status: "idle" as const,
  message: "",
  fieldErrors: {},
};

const inputClassName =
  "h-11 min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-normal text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-50";

const textareaClassName =
  "min-h-44 min-w-0 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-normal leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-50";

function getReadableFileSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function getScreenshotPath(accountId: string, file: File) {
  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${accountId}/${randomPart}.${extension}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm font-medium text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

function subscribeToPageUrl() {
  return () => undefined;
}

function getBrowserPageUrl() {
  return document.referrer || window.location.href;
}

function getServerPageUrl() {
  return "";
}

export function FeedbackForm({
  accountId,
  initialCurrentPageUrl,
  reporterLabel,
}: FeedbackFormProps) {
  const [state, formAction, pending] = useActionState(
    submitPlatformFeedback,
    initialState,
  );
  const browserPageUrl = useSyncExternalStore(
    subscribeToPageUrl,
    getBrowserPageUrl,
    getServerPageUrl,
  );
  const currentPageUrl = initialCurrentPageUrl || browserPageUrl;
  const [feedbackType, setFeedbackType] = useState<PlatformFeedbackType>("bug");
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [screenshotPath, setScreenshotPath] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    type: "idle",
    message: "",
  });
  const [screenshotName, setScreenshotName] = useState("");
  const [description, setDescription] = useState("");
  const isUploading = uploadStatus.type === "uploading";
  const isBusy = pending || isUploading;
  const fieldErrors = state.fieldErrors;

  async function handleScreenshotChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadStatus({ type: "idle", message: "" });
    setScreenshotPath("");
    setScreenshotName("");

    if (!isFeedbackScreenshotMimeType(file.type)) {
      setUploadStatus({
        type: "error",
        message: "Choose a JPG, PNG, or WebP screenshot.",
      });
      event.target.value = "";
      return;
    }

    if (file.size > FEEDBACK_SCREENSHOT_MAX_SIZE) {
      setUploadStatus({
        type: "error",
        message: "Screenshot must be 5 MB or smaller.",
      });
      event.target.value = "";
      return;
    }

    setUploadStatus({
      type: "uploading",
      message: `Uploading ${getReadableFileSize(file.size)} screenshot...`,
    });

    const storagePath = getScreenshotPath(accountId, file);
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from(FEEDBACK_SCREENSHOTS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      setUploadStatus({
        type: "error",
        message: error.message,
      });
      event.target.value = "";
      return;
    }

    setScreenshotPath(storagePath);
    setScreenshotName(file.name);
    setUploadStatus({
      type: "success",
      message: "Screenshot uploaded and will be attached.",
    });
  }

  function handleRemoveScreenshot() {
    setScreenshotPath("");
    setScreenshotName("");
    setUploadStatus({ type: "idle", message: "" });
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form
        action={formAction}
        aria-labelledby="feedback-form-title"
        aria-busy={isBusy}
        className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
      >
        <input type="hidden" name="currentPageUrl" value={currentPageUrl} />
        <input type="hidden" name="screenshotPath" value={screenshotPath} />

        <div>
          <h2
            id="feedback-form-title"
            className="text-xl font-semibold tracking-tight text-stone-950"
          >
            Feedback details
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            Tell us what you noticed and how we can make it better.
          </p>
        </div>

        {state.status !== "idle" ? (
          <p
            className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6">
          <fieldset
            disabled={pending}
            aria-describedby={
              fieldErrors.type ? "feedback-type-error" : undefined
            }
          >
            <legend className="mb-3 text-sm font-medium text-stone-800">
              Feedback type
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["bug", "suggestion"] as const).map((type) => (
                <label
                  key={type}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-4 focus-within:ring-emerald-100 ${feedbackType === type ? "border-emerald-700 bg-emerald-50" : "border-stone-200 bg-white hover:border-emerald-200"} ${pending ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type}
                    checked={feedbackType === type}
                    onChange={() => setFeedbackType(type)}
                    className="mt-1 size-4 shrink-0 accent-emerald-700"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                      <FeedbackIcon
                        name={type === "bug" ? "bug" : "idea"}
                        className="size-[18px] shrink-0 text-emerald-700"
                      />
                      {type === "bug" ? "Bug report" : "Suggestion"}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-stone-600">
                      {type === "bug"
                        ? "Something is not working as expected."
                        : "An idea to improve the experience."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError id="feedback-type-error" message={fieldErrors.type} />
          </fieldset>

          <div className="grid min-w-0 gap-2">
            <label
              htmlFor="feedback-title"
              className="text-sm font-medium text-stone-800"
            >
              Title
            </label>
            <input
              id="feedback-title"
              name="title"
              type="text"
              maxLength={160}
              required
              disabled={pending}
              placeholder={
                feedbackType === "bug"
                  ? "A short summary of the problem"
                  : "A short summary of your idea"
              }
              className={`${inputClassName} ${fieldErrors.title ? "border-red-300" : ""}`}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={
                fieldErrors.title ? "feedback-title-error" : undefined
              }
            />
            <FieldError id="feedback-title-error" message={fieldErrors.title} />
          </div>

          <div className="grid min-w-0 gap-2">
            <label
              htmlFor="feedback-description"
              className="text-sm font-medium text-stone-800"
            >
              Description
            </label>
            <textarea
              id="feedback-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={3000}
              required
              disabled={pending}
              placeholder={
                feedbackType === "bug"
                  ? "What were you doing, what happened, and what did you expect to happen?"
                  : "What would you change, and how would it help you use MyRealHub?"
              }
              className={`${textareaClassName} ${fieldErrors.description ? "border-red-300" : ""}`}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={`feedback-description-count${fieldErrors.description ? " feedback-description-error" : ""}`}
            />
            <span
              id="feedback-description-count"
              className="text-right text-xs leading-5 text-stone-500"
            >
              {description.length.toLocaleString("en-US")}/3,000 characters
            </span>
            <FieldError
              id="feedback-description-error"
              message={fieldErrors.description}
            />
          </div>

          <section
            className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 sm:p-5"
            aria-labelledby="feedback-screenshot-title"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500">
                <FeedbackIcon name="image" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="feedback-screenshot-title"
                    className="text-sm font-semibold text-stone-800"
                  >
                    Add a screenshot
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-stone-500 ring-1 ring-inset ring-stone-200">
                    Optional
                  </span>
                </div>
                <p
                  id="feedback-screenshot-help"
                  className="mt-1 text-xs leading-5 text-stone-500"
                >
                  JPG, PNG, or WebP. Up to 5 MB.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label
                className={`${feedbackSecondaryButton} w-fit focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700 ${isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {isUploading
                  ? "Uploading..."
                  : screenshotPath
                    ? "Replace screenshot"
                    : "Attach screenshot"}
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isBusy}
                  onChange={handleScreenshotChange}
                  aria-describedby="feedback-screenshot-help feedback-screenshot-privacy"
                />
              </label>
              {screenshotPath ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleRemoveScreenshot}
                  className={`${feedbackSecondaryButton} w-fit`}
                >
                  Remove screenshot
                </button>
              ) : null}
            </div>
            {screenshotName ? (
              <p className="mt-3 break-all text-sm font-medium text-stone-700">
                Attached: {screenshotName}
              </p>
            ) : null}
            {uploadStatus.type !== "idle" ? (
              <p
                className={`mt-3 text-sm font-medium ${uploadStatus.type === "error" ? "text-red-700" : uploadStatus.type === "success" ? "text-emerald-700" : "text-stone-600"}`}
                role={uploadStatus.type === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {uploadStatus.message}
              </p>
            ) : null}
            <FieldError
              id="feedback-screenshot-error"
              message={fieldErrors.screenshotPath}
            />
            <p
              id="feedback-screenshot-privacy"
              className="mt-4 flex items-start gap-2 text-xs leading-5 text-stone-500"
            >
              <FeedbackIcon name="lock" className="mt-0.5 size-3.5 shrink-0" />
              Screenshots are private and visible only to the admin team.
            </p>
          </section>

          <div className="flex flex-col gap-4 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-stone-500">
              Title and description are required.
            </p>
            <button
              type="submit"
              disabled={isBusy || !currentPageUrl}
              className={`${feedbackPrimaryButton} shrink-0`}
            >
              {pending ? "Sending..." : "Send feedback"}
              <ProviderDashboardIcon name="arrow" className="size-[18px]" />
            </button>
          </div>
        </div>
      </form>

      <aside className="min-w-0 space-y-5">
        <FeedbackGuide type={feedbackType} />
        <section
          className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
          aria-labelledby="feedback-context-title"
        >
          <h2
            id="feedback-context-title"
            className="text-base font-semibold tracking-tight text-stone-950"
          >
            Included automatically
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Your account and page context help the team understand your report.
          </p>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="flex items-center gap-2 text-xs font-medium text-stone-500">
                <ProviderDashboardIcon name="mail" className="size-4" />
                Your account
              </dt>
              <dd className="mt-1.5 break-all text-sm font-medium leading-6 text-stone-700">
                {reporterLabel}
              </dd>
            </div>
            <div className="border-t border-stone-100 pt-4">
              <dt className="flex items-center gap-2 text-xs font-medium text-stone-500">
                <ProviderDashboardIcon name="listing" className="size-4" />
                Page context
              </dt>
              <dd className="mt-1.5 break-all text-xs leading-6 text-stone-600">
                {currentPageUrl || "Capturing page context..."}
              </dd>
            </div>
          </dl>
          <FieldError
            id="feedback-page-error"
            message={fieldErrors.currentPageUrl}
          />
        </section>
      </aside>
    </div>
  );
}
