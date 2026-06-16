"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfileRole } from "@/lib/auth/session";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ReviewOutcome =
  | "approved"
  | "rejected"
  | "inactive"
  | "active"
  | "missing-rejection-reason"
  | "not-updated";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getProviderId(formData: FormData) {
  const providerId = getFormString(formData, "providerId");

  if (!uuidPattern.test(providerId)) {
    redirect("/admin/dashboard#providers");
  }

  return providerId;
}

function getProviderReviewPath(providerId: string, outcome: ReviewOutcome) {
  return `/admin/dashboard/providers/${providerId}?review=${outcome}`;
}

function revalidateProviderReviewPaths(providerId: string) {
  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/dashboard/providers/${providerId}`);
  revalidatePath("/search");
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
