import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_ROLES = ["user", "provider", "admin"] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

export type SignUpRole = Exclude<ProfileRole, "admin">;

export const DEFAULT_PROFILE_ROLE: SignUpRole = "user";

const DASHBOARD_PATHS: Record<ProfileRole, string> = {
  user: "/dashboard",
  provider: "/provider/dashboard",
  admin: "/admin/dashboard",
};

const PROTECTED_ROUTE_PREFIXES: Record<ProfileRole, string[]> = {
  user: ["/dashboard"],
  provider: ["/provider"],
  admin: ["/admin"],
};

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProfileRole(value: unknown): value is ProfileRole {
  return (
    typeof value === "string" &&
    PROFILE_ROLES.includes(value as ProfileRole)
  );
}

export function isUserRole(role: ProfileRole | null | undefined) {
  return role === "user";
}

export function isProviderRole(role: ProfileRole | null | undefined) {
  return role === "provider";
}

export function isAdminRole(role: ProfileRole | null | undefined) {
  return role === "admin";
}

export function hasRequiredRole(
  role: ProfileRole | null | undefined,
  requiredRole: ProfileRole,
) {
  return role === requiredRole;
}

export function getDashboardPathForRole(role: ProfileRole) {
  return DASHBOARD_PATHS[role];
}

export function getRequiredRoleForPath(pathname: string) {
  return PROFILE_ROLES.find((role) =>
    PROTECTED_ROUTE_PREFIXES[role].some((prefix) =>
      matchesPathPrefix(pathname, prefix),
    ),
  ) ?? null;
}

export function getSignUpRole(value: unknown): SignUpRole {
  return value === "provider" ? "provider" : DEFAULT_PROFILE_ROLE;
}

export async function getProfileRoleForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return isProfileRole(data?.role) ? data.role : null;
}
