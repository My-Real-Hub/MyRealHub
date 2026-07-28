"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { submitPlatformFeedback } from "@/app/feedback/actions";
import {
  FEEDBACK_SCREENSHOT_MAX_SIZE,
  FEEDBACK_SCREENSHOTS_BUCKET,
  feedbackTypeLabels,
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
  "h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "min-h-40 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-7 text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

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

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-700" role="alert">
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
  }

  return (
    <form
      action={formAction}
      className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="currentPageUrl" value={currentPageUrl} />
      <input type="hidden" name="screenshotPath" value={screenshotPath} />

      {state.status !== "idle" ? (
        <p
          className={`rounded-md border px-4 py-3 text-sm leading-6 ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <div className={state.status !== "idle" ? "mt-5 grid gap-5" : "grid gap-5"}>
        <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Reporter
          </p>
          <p className="mt-1 break-words text-sm font-medium text-stone-900">
            {reporterLabel}
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Captured page
          </p>
          <p className="mt-1 break-all text-sm text-stone-600">
            {currentPageUrl || "Capturing page context..."}
          </p>
          <FieldError message={fieldErrors.currentPageUrl} />
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-stone-900">
            Feedback type
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["bug", "suggestion"] as PlatformFeedbackType[]).map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-200 bg-white p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <input
                  type="radio"
                  name="type"
                  value={type}
                  defaultChecked={type === "bug"}
                  className="mt-1 size-4 accent-emerald-700"
                />
                <span>
                  <span className="block text-sm font-semibold text-stone-950">
                    {feedbackTypeLabels[type]}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-stone-600">
                    {type === "bug"
                      ? "Something is broken, confusing, or not working as expected."
                      : "An idea that would make MyRealHub more useful."}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <FieldError message={fieldErrors.type} />
        </fieldset>

        <label className="grid gap-2 text-sm font-semibold text-stone-900">
          Title
          <input
            name="title"
            type="text"
            maxLength={160}
            required
            placeholder="Short summary"
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors.title)}
          />
          <FieldError message={fieldErrors.title} />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-stone-900">
          Description
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={3000}
            required
            placeholder="Tell us what happened, what you expected, or what would improve the experience."
            className={textareaClassName}
            aria-invalid={Boolean(fieldErrors.description)}
          />
          <span className="text-right text-xs font-semibold text-stone-500">
            {description.length}/3000 characters
          </span>
          <FieldError message={fieldErrors.description} />
        </label>

        <div className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-4">
          <div>
            <p className="text-sm font-semibold text-stone-900">
              Screenshot
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Optional, private to administrators. JPG, PNG, or WebP up to 5 MB.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 disabled:cursor-not-allowed">
              {isUploading ? "Uploading..." : "Attach screenshot"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={isBusy}
                onChange={handleScreenshotChange}
              />
            </label>
            {screenshotPath ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleRemoveScreenshot}
                className="h-10 w-fit rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove screenshot
              </button>
            ) : null}
          </div>
          {screenshotName ? (
            <p className="text-sm font-medium text-stone-700">
              Attached: {screenshotName}
            </p>
          ) : null}
          {uploadStatus.type !== "idle" ? (
            <p
              className={`text-sm font-medium ${
                uploadStatus.type === "error"
                  ? "text-red-700"
                  : uploadStatus.type === "success"
                    ? "text-emerald-700"
                    : "text-stone-600"
              }`}
            >
              {uploadStatus.message}
            </p>
          ) : null}
          <FieldError message={fieldErrors.screenshotPath} />
        </div>

        <div className="flex justify-end border-t border-stone-200 pt-5">
          <button
            type="submit"
            disabled={isBusy || !currentPageUrl}
            className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {pending ? "Sending..." : "Send feedback"}
          </button>
        </div>
      </div>
    </form>
  );
}
