"use client";

import { useActionState } from "react";
import { deactivateOwnProviderListing } from "@/app/provider/dashboard/actions";
import { getProviderProfileListingState, initialProviderProfileFormState, type ProviderProfileStatus } from "@/lib/providers/profile-form";

export function ProviderListingVisibilityForm({ revision, status }: { revision: string; status: ProviderProfileStatus }) {
  const [state, formAction, pending] = useActionState(deactivateOwnProviderListing, {
    ...initialProviderProfileFormState, listingRevision: revision, listingStatus: status,
  });
  const current = getProviderProfileListingState(state, { revision, status, review_status: null });
  const expectedRevision = BigInt(revision) > BigInt(state.listingRevision ?? "0") ? revision : state.listingRevision ?? revision;
  return (
    <form id="listing-visibility" action={formAction} className="settings-section settings-card space-y-4">
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">Listing visibility</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          {current.status === "active"
            ? "Hide your business from the directory while keeping access to your account and conversations."
            : current.status === "inactive"
              ? "Your listing is hidden. You can request reactivation from Business listing."
              : "Your listing is not public yet."}
        </p>
      </div>
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-emerald-800"}>
          {state.message}
        </p>
      ) : null}
      <button className="settings-secondary-button" type="submit" disabled={pending || current.status !== "active" || state.reloadRequired}>
        {pending ? "Deactivating..." : current.status === "inactive" ? "Listing inactive" : "Deactivate listing"}
      </button>
      {state.reloadRequired ? (
        <button type="button" className="settings-secondary-button" onClick={() => window.location.reload()}>
          Reload settings (discards unsaved edits)
        </button>
      ) : null}
    </form>
  );
}
