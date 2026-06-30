"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitProviderRating } from "@/app/providers/rating-actions";

type ProviderRatingFormProps = {
  canRate: boolean;
  currentRating: number | null;
  isSelf: boolean;
  isSignedIn: boolean;
  providerId: string;
  returnPath: string;
};

const initialProviderRatingFormState = {
  status: "idle" as const,
  message: "",
};

function getLoginHref(returnPath: string) {
  return `/login?next=${encodeURIComponent(returnPath)}`;
}

export function ProviderRatingForm({
  canRate,
  currentRating,
  isSelf,
  isSignedIn,
  providerId,
  returnPath,
}: ProviderRatingFormProps) {
  const [state, formAction, pending] = useActionState(
    submitProviderRating,
    initialProviderRatingFormState,
  );

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
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="returnPath" value={returnPath} />

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

      <label
        htmlFor={`provider-rating-${providerId}`}
        className="text-sm font-semibold text-stone-900"
      >
        Your rating
      </label>
      <select
        id={`provider-rating-${providerId}`}
        name="rating"
        defaultValue={currentRating ? String(currentRating) : ""}
        required
        className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
      >
        <option value="" disabled>
          Choose 1 to 5
        </option>
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Very good</option>
        <option value="3">3 - Good</option>
        <option value="2">2 - Fair</option>
        <option value="1">1 - Poor</option>
      </select>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {pending
          ? "Saving..."
          : currentRating
            ? "Update rating"
            : "Submit rating"}
      </button>
    </form>
  );
}
