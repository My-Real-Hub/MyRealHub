import type { SupabaseClient } from "@supabase/supabase-js";
import { isProfileRole, type ProfileRole } from "./roles";

export const ACCOUNT_PROFILE_ERROR =
  "Your email and password were accepted, but your account profile could not be loaded. Please try again or contact support.";

export async function ensureAccountRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRole> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(ACCOUNT_PROFILE_ERROR);
  if (isProfileRole(data?.role)) return data.role;

  // The server derives the account ID and signup role from the verified user.
  // Existing profiles, including admin assignments, are never overwritten.
  const restored = await supabase.rpc("ensure_current_user_profile");
  if (restored.error || !isProfileRole(restored.data)) {
    throw new Error(ACCOUNT_PROFILE_ERROR);
  }
  return restored.data;
}
