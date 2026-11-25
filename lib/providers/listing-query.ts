import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderProfileStatus, ProviderListingReviewStatus } from "./profile-form";
import { getListingRevision } from "./listing-save";

// The authorized RPC reads approved/proposed content, assignments and versions
// in one statement. Its private proposal data is never used for public reads.
export const LISTING_EDITOR_RPC = "get_provider_listing_editor";

export type ListingEditorSnapshot = {
  id: string; slug: string; revision: string; details_revision: string; regions_revision: string;
  category_id: string | null; business_name: string | null; display_name: string | null;
  bio: string | null; phone: string | null; email: string | null; website_url: string | null;
  city: string | null; province_state: string | null; country: string | null;
  service_area: string | null; years_experience: number | null; license_number: string | null;
  profile_image_path: string | null; profile_image_url: string | null;
  status: ProviderProfileStatus; rejection_reason: string | null;
  review_status: ProviderListingReviewStatus | null;
  review_submitted_at: string | null;
  published: Record<string, string | null>;
  submitted_at: string | null; approved_at: string | null; updated_at: string | null; created_at: string | null;
  accept_new_inquiries: boolean | null; contact_delivery_method: string | null; new_message_email_enabled: boolean | null;
  categoryName: string | null; languageIds: string[]; specialtyIds: string[]; serviceRegionIds: string[];
  languageNames: string[]; specialtyNames: string[]; serviceRegionNames: string[];
};

type EditorRow = Omit<ListingEditorSnapshot, "revision" | "details_revision" | "regions_revision"> & {
  revision: unknown;
  details_revision: unknown;
  regions_revision: unknown;
};

export async function getListingEditorSnapshot(
  supabase: SupabaseClient, field: "id" | "user_id", id: string,
): Promise<ListingEditorSnapshot | null> {
  const { data, error } = await supabase.rpc(LISTING_EDITOR_RPC, { lookup_field: field, lookup_id: id });
  if (error) throw new Error("The listing could not be loaded. Please reload and try again.");
  if (!data) return null;
  const row = data as unknown as EditorRow;
  const revision = getListingRevision(row.revision);
  const detailsRevision = getListingRevision(row.details_revision);
  const regionsRevision = getListingRevision(row.regions_revision);
  if (!revision || revision === "0"
    || !detailsRevision || detailsRevision === "0" || !regionsRevision || regionsRevision === "0"
    || ![row.languageIds, row.specialtyIds, row.serviceRegionIds, row.languageNames, row.specialtyNames, row.serviceRegionNames]
      .every(values => Array.isArray(values) && values.every(value => typeof value === "string"))
    || (row.review_status !== null && !["draft", "pending_edit", "rejected"].includes(row.review_status))) {
    throw new Error("The complete listing could not be loaded. Please reload and try again.");
  }
  return {
    ...row, revision, details_revision: detailsRevision, regions_revision: regionsRevision,
  };
}
