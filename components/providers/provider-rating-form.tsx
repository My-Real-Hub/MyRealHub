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
      <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
        You cannot rate your own provider profile.
      </p>
    );
  }

  if (!isSignedIn) {
    return (
      <Link
        href={getLoginHref(returnPath)}
        className="public-profile-secondary-button w-full sm:w-auto"
      >
        Log in to rate
      </Link>
    );
  }

  if (!canRate) {
    return (
      <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
        Ratings are available to users and service providers.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <form action={formAction} className="grid min-w-0 gap-4">
        <input type="hidden" name="providerId" value={providerId} />
        <input type="hidden" name="returnPath" value={returnPath} />

        {feedbackMessages.map((message) => (
          <p
            key={`${message.status}-${message.message}`}
            className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
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
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Your review is hidden by moderation. You can still edit it, but it
            will stay hidden until an admin makes it visible again.
          </p>
        ) : null}

        <fieldset className="grid min-w-0 gap-2">
          <legend
            id={`provider-rating-label-${providerId}`}
            className="mb-2 text-sm font-medium text-stone-700"
          >
            Your rating
          </legend>
          <div
            role="radiogroup"
            aria-labelledby={`provider-rating-label-${providerId}`}
            className="flex flex-wrap items-center gap-2"
            aria-describedby={
              state.fieldErrors.rating
                ? `provider-rating-error-${providerId}`
                : undefined
            }
          >
            {ratingValues.map((value) => (
              <label
                key={value}
                title={`${value} star${value === 1 ? "" : "s"}`}
                className="relative cursor-pointer"
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={selectedRating === value}
                  onChange={() => setSelectedRating(value)}
                  required
                  disabled={isBusy}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`grid size-11 place-items-center rounded-xl border text-2xl leading-none transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${
                    value <= selectedRating
                      ? "border-amber-200 bg-amber-50 text-amber-500 hover:bg-amber-100"
                      : "border-stone-200 bg-white text-stone-300 hover:border-amber-200 hover:text-amber-400"
                  }`}
                >
                  &#9733;
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {selectedRating > 0
              ? `${selectedRating} out of 5`
              : "Choose 1 to 5 stars"}
          </p>
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
          className="grid min-w-0 gap-2 text-sm font-medium text-stone-700"
        >
          <span className="flex items-center justify-between">
            Written review{" "}
            <span className="text-xs font-normal text-stone-400">Optional</span>
          </span>
          <textarea
            id={`provider-review-${providerId}`}
            name="review"
            value={review}
            onChange={(event) => setReview(event.target.value)}
            maxLength={reviewMaxLength}
            placeholder="Share what stood out about working with this provider."
            className="public-profile-textarea"
            aria-invalid={Boolean(state.fieldErrors.review)}
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
          className="public-profile-primary-button w-full sm:w-fit"
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
          className="border-t border-stone-100 pt-4"
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
            className="public-profile-secondary-button w-full hover:border-red-300 hover:text-red-700 sm:w-auto"
          >
            {removePending ? "Removing..." : "Remove my rating"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
