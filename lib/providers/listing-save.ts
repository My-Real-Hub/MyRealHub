import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderProfileFormIntent, ProviderProfileStatus, ProviderListingReviewStatus } from "./profile-form";
import { isProviderProfileId, isProviderProfileSlug } from "./slug";

export const LISTING_CONFLICT_MESSAGE =
  "This listing changed after you opened the form. Copy any edits you want to keep, then reload and review the latest listing before saving again.";

// Keep PostgreSQL bigint revisions as decimal strings throughout the form/RPC.
export function getListingRevision(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return null;
    value = String(value);
  }
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,18})$/.test(value)) return null;
  return BigInt(value) <= BigInt("9223372036854775807") ? value : null;
}

export type ListingMutationResult = {
  id: string;
  slug: string;
  revision: string;
  details_revision?: string;
  regions_revision?: string;
  already_pending?: boolean;
  review_status?: ProviderListingReviewStatus | null;
  no_changes?: boolean;
  reviewed_edit?: boolean;
  already_inactive?: boolean;
  status: ProviderProfileStatus;
};

export type ListingOperation =
  | "save_provider_listing"
  | "save_provider_listing_details"
  | "save_provider_service_regions"
  | "replace_provider_service_regions"
  | "review_provider_listing"
  | "deactivate_provider_listing";

export async function runListingOperation(
  supabase: Pick<SupabaseClient, "rpc">,
  operation: ListingOperation,
  args: Record<string, unknown>,
): Promise<{ data: ListingMutationResult; error: null; conflict: false } | {
  data: null; error: string; conflict: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc(operation, args);
    if (error) {
      if (error.code === "PT409" || error.code === "40001") {
        return { data: null, error: LISTING_CONFLICT_MESSAGE, conflict: true };
      }
      const message = error.code === "42501" || error.code === "28000"
        ? "Your account cannot make this change. Sign in again and check your access."
        : ["22023", "22P02", "23514"].includes(error.code)
          ? "The listing could not be saved. Check the fields, selected service options, and current listing status."
          : "The save could not be confirmed. Copy any edits you want to keep, then reload the listing before trying again.";
      return { data: null, error: message, conflict: false };
    }
    const revision = getListingRevision(data?.revision);
    const editorOperation = operation === "save_provider_listing_details" || operation === "save_provider_service_regions";
    const detailsRevision = getListingRevision(data?.details_revision);
    const regionsRevision = getListingRevision(data?.regions_revision);
    if (!data || !isProviderProfileId(data.id) || typeof data.slug !== "string"
      || !isProviderProfileSlug(data.slug)
      || !revision || revision === "0"
      || (editorOperation && (!detailsRevision || detailsRevision === "0" || !regionsRevision || regionsRevision === "0"))
      || (operation === "save_provider_listing_details" && typeof data.already_pending !== "boolean")
      || (data.already_pending !== undefined && typeof data.already_pending !== "boolean")
      || (data.already_pending === true && data.status !== "pending_approval"
        && !(data.status === "active" && data.review_status === "pending_edit"))
      || (data.review_status !== undefined && data.review_status !== null && !["draft", "pending_edit", "rejected"].includes(data.review_status))
      || (data.review_status === "pending_edit" && data.status !== "active")
      || ["no_changes", "reviewed_edit", "already_inactive"].some(flag => data[flag] !== undefined && typeof data[flag] !== "boolean")
      || (data.no_changes === true && (data.status !== "active" || data.review_status !== null))
      || !["draft", "pending_approval", "active", "inactive", "rejected"].includes(data.status)) {
      throw new Error("Unexpected listing result");
    }
    const versions = editorOperation ? { details_revision: detailsRevision!, regions_revision: regionsRevision! } : {};
    const submission = typeof data.already_pending === "boolean" ? { already_pending: data.already_pending } : {};
    const review = data.review_status !== undefined ? { review_status: data.review_status } : {};
    const flags: Pick<ListingMutationResult, "no_changes" | "reviewed_edit" | "already_inactive"> = {};
    for (const flag of ["no_changes", "reviewed_edit", "already_inactive"] as const) {
      if (typeof data[flag] === "boolean") flags[flag] = data[flag];
    }
    return { data: { id: data.id, slug: data.slug, revision, status: data.status, ...versions, ...submission, ...review, ...flags }, error: null, conflict: false };
  } catch {
    return {
      data: null, conflict: false,
      error: "The save could not be confirmed. Copy any edits you want to keep, then reload the listing before trying again.",
    };
  }
}

export function getListingSaveMessage(
  intent: ProviderProfileFormIntent,
  listing: Pick<ListingMutationResult, "status" | "already_pending" | "review_status" | "no_changes">,
) {
  if (listing.already_pending && listing.review_status === "pending_edit") {
    return "Already awaiting edit approval. Your published listing remains active.";
  }
  if (listing.no_changes) return "Your published listing is unchanged.";
  if (listing.review_status === "pending_edit") {
    return "Edits submitted for approval. Your published listing remains active.";
  }
  if (listing.status === "active" && listing.review_status === "draft") {
    return "Draft edits saved. Your published listing remains active.";
  }
  if (listing.already_pending && listing.status === "pending_approval") {
    return "Already awaiting approval. Your existing submission is unchanged.";
  }
  if (intent === "reactivate") {
    return "Reactivation request sent for admin approval. Your listing is now pending approval.";
  }
  if (listing.status === "pending_approval") {
    return "Profile submitted for admin approval. Your listing is now pending approval.";
  }
  return listing.status === "inactive"
    ? "Draft saved. Your listing remains inactive."
    : "Draft saved. Submit for approval when ready to publish.";
}
