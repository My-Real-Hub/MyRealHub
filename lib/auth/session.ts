import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getDashboardPathForRole,
  getProfileRoleForUser,
  hasRequiredRole,
  type ProfileRole,
} from "@/lib/auth/roles";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: ProfileRole;
};

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];

  return typeof value === "string" && value.trim() ? value : null;
}

export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const userId = data.claims.sub;
  const role = await getProfileRoleForUser(supabase, userId);

  if (!role) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    email: profile?.email ?? data.claims.email ?? null,
    fullName:
      profile?.full_name ??
      getMetadataString(data.claims.user_metadata, "full_name"),
    role,
  };
});

export async function requireProfileRole(requiredRole: ProfileRole) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!hasRequiredRole(profile.role, requiredRole)) {
    redirect(getDashboardPathForRole(profile.role));
  }

  return profile;
}
