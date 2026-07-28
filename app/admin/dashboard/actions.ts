"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfileRole } from "@/lib/auth/session";
import {
  isPlatformFeedbackStatus,
  type PlatformFeedbackStatus,
} from "@/lib/feedback";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ReviewOutcome =
  | "approved"
  | "rejected"
  | "inactive"
  | "active"
  | "rating-hidden"
  | "rating-removed"
  | "rating-visible"
  | "missing-rejection-reason"
  | "not-updated";

type LookupKind = "categories" | "languages" | "specialties";

type LookupOutcome =
  | "created"
  | "updated"
  | "deactivated"
  | "activated"
  | "invalid"
  | "duplicate"
  | "error";

type LookupPayload = Record<string, string | boolean | null>;

type FeedbackOutcome = "updated" | "invalid" | "error";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ratingModerationStatuses = ["visible", "hidden", "removed"] as const;

type RatingModerationStatus = (typeof ratingModerationStatuses)[number];

const lookupAnchors: Record<LookupKind, string> = {
  categories: "categories",
  languages: "languages",
  specialties: "specialties",
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getLookupKind(formData: FormData): LookupKind {
  const kind = getFormString(formData, "lookupKind");

  if (
    kind === "categories" ||
    kind === "languages" ||
    kind === "specialties"
  ) {
    return kind;
  }

  redirect("/admin/dashboard#categories");
}

function getLookupId(formData: FormData, kind: LookupKind) {
  const lookupId = getFormString(formData, "lookupId");

  if (!uuidPattern.test(lookupId)) {
    redirect(getLookupDashboardPath(kind, "invalid"));
  }

  return lookupId;
}

function getLookupDashboardPath(kind: LookupKind, outcome: LookupOutcome) {
  const params = new URLSearchParams({
    lookup: kind,
    lookupAction: outcome,
  });

  return `/admin/dashboard?${params.toString()}#${lookupAnchors[kind]}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isDuplicateError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || /duplicate key/i.test(error?.message ?? "");
}

function getLookupPayload(kind: LookupKind, formData: FormData) {
  const name = getFormString(formData, "name");
  const slug = slugify(getFormString(formData, "slug") || name);
  const description = getFormString(formData, "description");
  const categoryId = getFormString(formData, "categoryId");

  if (!name || !slug) {
    return null;
  }

  if (kind === "specialties" && !uuidPattern.test(categoryId)) {
    return null;
  }

  const payload: LookupPayload = {
    name,
    slug,
  };

  if (kind === "categories" || kind === "specialties") {
    payload.description = description || null;
  }

  if (kind === "specialties") {
    payload.category_id = categoryId;
  }

  return payload;
}

function revalidateLookupPaths() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/provider/dashboard");
  revalidatePath("/search");
}

function getProviderId(formData: FormData) {
  const providerId = getFormString(formData, "providerId");

  if (!uuidPattern.test(providerId)) {
    redirect("/admin/dashboard#providers");
  }

  return providerId;
}

function getRatingId(formData: FormData) {
  const ratingId = getFormString(formData, "ratingId");

  if (!uuidPattern.test(ratingId)) {
    redirect("/admin/dashboard#providers");
  }

  return ratingId;
}

function getRatingModerationStatus(formData: FormData): RatingModerationStatus {
  const status = getFormString(formData, "moderationStatus");

  if (
    ratingModerationStatuses.includes(status as RatingModerationStatus)
  ) {
    return status as RatingModerationStatus;
  }

  redirect("/admin/dashboard#providers");
}

function getFeedbackId(formData: FormData) {
  const feedbackId = getFormString(formData, "feedbackId");

  if (!uuidPattern.test(feedbackId)) {
    redirect(getFeedbackDashboardPath("all", "all", "invalid"));
  }

  return feedbackId;
}

function getFeedbackStatus(formData: FormData) {
  const status = getFormString(formData, "status");

  if (!isPlatformFeedbackStatus(status)) {
    redirect(getFeedbackDashboardPath("all", "all", "invalid"));
  }

  return status;
}

function getFeedbackFilter(value: string) {
  return isPlatformFeedbackStatus(value) ? value : "all";
}

function getFeedbackTypeFilter(value: string) {
  return value === "bug" || value === "suggestion" ? value : "all";
}

function getFeedbackDashboardPath(
  statusFilter: PlatformFeedbackStatus | "all",
  typeFilter: "bug" | "suggestion" | "all",
  outcome: FeedbackOutcome,
) {
  const params = new URLSearchParams({
    feedbackAction: outcome,
  });

  if (statusFilter !== "all") {
    params.set("feedbackStatus", statusFilter);
  }

  if (typeFilter !== "all") {
    params.set("feedbackType", typeFilter);
  }

  return `/admin/dashboard?${params.toString()}#feedback`;
}

function getProviderReviewPath(providerId: string, outcome: ReviewOutcome) {
  return `/admin/dashboard/providers/${providerId}?review=${outcome}`;
}

function revalidateProviderReviewPaths(providerId: string) {
  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/dashboard/providers/${providerId}`);
  revalidatePath("/search");
}

function getRatingModerationOutcome(
  status: RatingModerationStatus,
): ReviewOutcome {
  if (status === "hidden") {
    return "rating-hidden";
  }

  if (status === "removed") {
    return "rating-removed";
  }

  return "rating-visible";
}

async function getProviderSlug(providerId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select("slug")
    .eq("id", providerId)
    .maybeSingle();

  return typeof data?.slug === "string" ? data.slug : null;
}

async function updateProviderStatus({
  providerId,
  fromStatus,
  nextStatus,
  payload,
}: {
  providerId: string;
  fromStatus?: ProviderProfileStatus;
  nextStatus: ProviderProfileStatus;
  payload: Record<string, string | null>;
}) {
  await requireProfileRole("admin");

  const supabase = await getServerSupabaseClient();
  let updateQuery = supabase
    .from("provider_profiles")
    .update({
      ...payload,
      status: nextStatus,
    })
    .eq("id", providerId);

  if (fromStatus) {
    updateQuery = updateQuery.eq("status", fromStatus);
  }

  const { data, error } = await updateQuery.select("id").maybeSingle();

  if (error || !data) {
    return false;
  }

  revalidateProviderReviewPaths(providerId);
  return true;
}

export async function approveProviderProfile(formData: FormData) {
  await requireProfileRole("admin");

  const providerId = getProviderId(formData);
  const now = new Date().toISOString();
  const isUpdated = await updateProviderStatus({
    providerId,
    fromStatus: "pending_approval",
    nextStatus: "active",
    payload: {
      approved_at: now,
      rejection_reason: null,
    },
  });

  redirect(
    getProviderReviewPath(providerId, isUpdated ? "approved" : "not-updated"),
  );
}

export async function rejectProviderProfile(formData: FormData) {
  await requireProfileRole("admin");

  const providerId = getProviderId(formData);
  const rejectionReason = getFormString(formData, "rejectionReason");

  if (!rejectionReason) {
    redirect(getProviderReviewPath(providerId, "missing-rejection-reason"));
  }

  const isUpdated = await updateProviderStatus({
    providerId,
    fromStatus: "pending_approval",
    nextStatus: "rejected",
    payload: {
      approved_at: null,
      rejection_reason: rejectionReason,
    },
  });

  redirect(
    getProviderReviewPath(providerId, isUpdated ? "rejected" : "not-updated"),
  );
}

export async function setProviderInactive(formData: FormData) {
  await requireProfileRole("admin");

  const providerId = getProviderId(formData);
  const isUpdated = await updateProviderStatus({
    providerId,
    fromStatus: "active",
    nextStatus: "inactive",
    payload: {
      rejection_reason: null,
    },
  });

  redirect(
    getProviderReviewPath(providerId, isUpdated ? "inactive" : "not-updated"),
  );
}

export async function setProviderActive(formData: FormData) {
  await requireProfileRole("admin");

  const providerId = getProviderId(formData);
  const now = new Date().toISOString();
  const isUpdated = await updateProviderStatus({
    providerId,
    fromStatus: "inactive",
    nextStatus: "active",
    payload: {
      approved_at: now,
      rejection_reason: null,
    },
  });

  redirect(
    getProviderReviewPath(providerId, isUpdated ? "active" : "not-updated"),
  );
}

export async function setProviderRatingModerationStatus(formData: FormData) {
  await requireProfileRole("admin");

  const fallbackProviderId = getProviderId(formData);
  const ratingId = getRatingId(formData);
  const moderationStatus = getRatingModerationStatus(formData);
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.rpc("moderate_provider_rating", {
    target_rating_id: ratingId,
    target_status: moderationStatus,
  });

  if (error) {
    redirect(getProviderReviewPath(fallbackProviderId, "not-updated"));
  }

  const moderatedRating = Array.isArray(data) ? data[0] : data;
  const providerId =
    moderatedRating &&
    typeof moderatedRating === "object" &&
    "provider_profile_id" in moderatedRating &&
    typeof moderatedRating.provider_profile_id === "string"
      ? moderatedRating.provider_profile_id
      : fallbackProviderId;
  const providerSlug = await getProviderSlug(providerId);

  revalidateProviderReviewPaths(providerId);

  if (providerSlug) {
    revalidatePath(`/providers/${providerSlug}`);
  }

  redirect(
    getProviderReviewPath(
      providerId,
      getRatingModerationOutcome(moderationStatus),
    ),
  );
}

export async function updateFeedbackSubmission(formData: FormData) {
  await requireProfileRole("admin");

  const feedbackId = getFeedbackId(formData);
  const status = getFeedbackStatus(formData);
  const internalNotes = getFormString(formData, "internalNotes");
  const returnStatus = getFeedbackFilter(
    getFormString(formData, "returnFeedbackStatus"),
  );
  const returnType = getFeedbackTypeFilter(
    getFormString(formData, "returnFeedbackType"),
  );

  if (internalNotes.length > 3000) {
    redirect(getFeedbackDashboardPath(returnStatus, returnType, "invalid"));
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.rpc("update_platform_feedback", {
    target_feedback_id: feedbackId,
    target_internal_notes: internalNotes || null,
    target_status: status,
  });

  if (error) {
    redirect(getFeedbackDashboardPath(returnStatus, returnType, "error"));
  }

  revalidatePath("/admin/dashboard");
  redirect(getFeedbackDashboardPath(returnStatus, returnType, "updated"));
}

export async function createLookupItem(formData: FormData) {
  await requireProfileRole("admin");

  const kind = getLookupKind(formData);
  const payload = getLookupPayload(kind, formData);

  if (!payload) {
    redirect(getLookupDashboardPath(kind, "invalid"));
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.from(kind).insert({
    ...payload,
    is_active: true,
  });

  if (error) {
    redirect(
      getLookupDashboardPath(kind, isDuplicateError(error) ? "duplicate" : "error"),
    );
  }

  revalidateLookupPaths();
  redirect(getLookupDashboardPath(kind, "created"));
}

export async function updateLookupItem(formData: FormData) {
  await requireProfileRole("admin");

  const kind = getLookupKind(formData);
  const lookupId = getLookupId(formData, kind);
  const payload = getLookupPayload(kind, formData);

  if (!payload) {
    redirect(getLookupDashboardPath(kind, "invalid"));
  }

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from(kind)
    .update(payload)
    .eq("id", lookupId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(
      getLookupDashboardPath(kind, isDuplicateError(error) ? "duplicate" : "error"),
    );
  }

  revalidateLookupPaths();
  redirect(getLookupDashboardPath(kind, "updated"));
}

export async function setLookupActive(formData: FormData) {
  await requireProfileRole("admin");

  const kind = getLookupKind(formData);
  const lookupId = getLookupId(formData, kind);
  const isActive = getFormString(formData, "isActive") === "true";

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from(kind)
    .update({ is_active: isActive })
    .eq("id", lookupId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(getLookupDashboardPath(kind, "error"));
  }

  revalidateLookupPaths();
  redirect(
    getLookupDashboardPath(kind, isActive ? "activated" : "deactivated"),
  );
}
