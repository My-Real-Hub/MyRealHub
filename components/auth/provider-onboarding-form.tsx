"use client";

import { useActionState } from "react";
import { becomeProvider } from "@/app/become-provider/actions";
import { initialProviderOnboardingState } from "@/lib/auth/provider-onboarding";

export function ProviderOnboardingForm() {
  const [state, action, pending] = useActionState(
    becomeProvider,
    initialProviderOnboardingState,
  );

  return (
    <form action={action} className="space-y-5">
      <label className="flex items-start gap-3 text-sm leading-6 text-stone-700">
        <input
          type="checkbox"
          name="confirmProvider"
          value="yes"
          required
          disabled={pending}
          className="mt-1 size-4 accent-emerald-700"
        />
        <span>I want to add provider tools to my existing account.</span>
      </label>
      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Adding provider tools..." : "Add provider tools"}
      </button>
    </form>
  );
}
