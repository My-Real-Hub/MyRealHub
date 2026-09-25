"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  removeProviderRating,
  submitProviderRating,
} from "@/app/providers/rating-actions";

type ProviderRatingModerationStatus = "visible" | "hidden" | "removed";

type ProviderRatingFormProps = {
  canRate: boolean;
  currentRating: number | null;
  currentReview: string | null;
  currentModerationStatus: ProviderRatingModerationStatus | null;
  isSelf: boolean;
  isSignedIn: boolean;
  providerId: string;
  returnPath: string;
};

const initialProviderRatingFormState = {
  status: "idle" as const,
  message: "",
  fieldErrors: {},
};
const ratingValues = [1, 2, 3, 4, 5];
const reviewMaxLength = 1000;

function getLoginHref(returnPath: string) {
  return `/login?next=${encodeURIComponent(returnPath)}`;
}

export function ProviderRatingForm({
  canRate,
  currentRating,
  currentReview,
  currentModerationStatus,
  isSelf,
  isSignedIn,
  providerId,
  returnPath,
}: ProviderRatingFormProps) {
  const [state, formAction, pending] = useActionState(
    submitProviderRating,
    initialProviderRatingFormState,
  );
  const [removeState, removeFormAction, removePending] = useActionState(
    removeProviderRating,
    initialProviderRatingFormState,
  );
  const [selectedRating, setSelectedRating] = useState(currentRating ?? 0);
  const [review, setReview] = useState(currentReview ?? "");
  const feedbackMessages = [state, removeState].filter(
    (message) => message.status !== "idle",
  );
  const isBusy = pending || removePending;

  if (isSelf) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
        You cannot rate your own provider profile.
      </p>
    );
  }

  if (!isSignedIn) {
    return (
      <Link
        href={getLoginHref(returnPath)}
        className="inline-flex h-11 w-full items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
      >
        Log in to rate
      </Link>
    );
  }

  if (!canRate) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
        Ratings are available to users and service providers.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="providerId" value={providerId} />
        <input type="hidden" name="returnPath" value={returnPath} />

        {feedbackMessages.map((message) => (
          <p
            key={`${message.status}-${message.message}`}
            className={`rounded-md border px-4 py-3 text-sm leading-6 ${
              message.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role={message.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {message.message}
          </p>
        ))}

        {currentModerationStatus === "hidden" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Your review is hidden by moderation. You can still edit it, but it
            will stay hidden until an admin makes it visible again.
          </p>
        ) : null}

        <fieldset className="grid gap-2">
          <legend
            id={`provider-rating-label-${providerId}`}
            className="text-sm font-semibold text-stone-900"
          >
            Your rating
          </legend>
          <input
            type="hidden"
            name="rating"
            value={selectedRating > 0 ? String(selectedRating) : ""}
          />
          <div
            role="radiogroup"
            aria-labelledby={`provider-rating-label-${providerId}`}
            className="flex items-center gap-1"
            aria-describedby={
              state.fieldErrors.rating
                ? `provider-rating-error-${providerId}`
                : undefined
            }
          >
            {ratingValues.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selectedRating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                title={`${value} star${value === 1 ? "" : "s"}`}
                disabled={isBusy}
                onClick={() => setSelectedRating(value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedRating((currentValue) =>
                      Math.min(5, Math.max(1, currentValue + 1)),
                    );
                  }

                  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedRating((currentValue) =>
                      Math.max(1, currentValue - 1 || 1),
                    );
                  }
                }}
                className={`rounded-md px-1 text-3xl leading-none transition focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed ${
                  value <= selectedRating
                    ? "text-amber-400 hover:text-amber-500"
                    : "text-stone-300 hover:text-amber-300"
                }`}
              >
                <span aria-hidden="true">★</span>
              </button>
            ))}
            <span className="ml-2 text-sm font-medium text-stone-600">
              {selectedRating > 0
                ? `${selectedRating} out of 5`
                : "Choose a rating"}
            </span>
          </div>
          {state.fieldErrors.rating ? (
            <p
              id={`provider-rating-error-${providerId}`}
              className="text-sm font-medium text-red-700"
            >
              {state.fieldErrors.rating}
            </p>
          ) : null}
        </fieldset>

        <label
          htmlFor={`provider-review-${providerId}`}
          className="grid gap-2 text-sm font-semibold text-stone-900"
        >
          Written review <span className="font-normal text-stone-500">Optional</span>
          <textarea
            id={`provider-review-${providerId}`}
            name="review"
            value={review}
            onChange={(event) => setReview(event.target.value)}
            maxLength={reviewMaxLength}
            placeholder="Share what stood out about working with this provider."
            className="min-h-28 rounded-md border border-stone-300 bg-white px-3 py-3 text-sm font-normal leading-6 text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            aria-describedby={`provider-review-help-${providerId}${
              state.fieldErrors.review
                ? ` provider-review-error-${providerId}`
                : ""
            }`}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p
            id={`provider-review-help-${providerId}`}
            className="text-xs text-stone-500"
          >
            {review.length}/{reviewMaxLength} characters
          </p>
          {state.fieldErrors.review ? (
            <p
              id={`provider-review-error-${providerId}`}
              className="text-sm font-medium text-red-700"
            >
              {state.fieldErrors.review}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex h-11 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {pending
            ? "Saving..."
            : currentRating
              ? "Update rating"
              : "Submit rating"}
        </button>
      </form>

      {currentRating ? (
        <form
          action={removeFormAction}
          className="border-t border-stone-200 pt-4"
        >
          <input type="hidden" name="providerId" value={providerId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            disabled={isBusy}
            onClick={() => {
              setSelectedRating(0);
              setReview("");
            }}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
          >
            {removePending ? "Removing..." : "Remove my rating"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
