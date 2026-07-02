import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_ROLES = ["user", "provider", "admin"] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

export type SignUpRole = Exclude<ProfileRole, "admin">;

export const DEFAULT_PROFILE_ROLE: SignUpRole = "user";

export const PROFILE_CAPABILITIES = [
  "consume_services",
  "manage_account_settings",
  "manage_provider_profile",
  "administer_platform",
] as const;

export type ProfileCapability = (typeof PROFILE_CAPABILITIES)[number];

const CAPABILITIES_BY_ROLE: Record<ProfileRole, ProfileCapability[]> = {
  user: ["consume_services", "manage_account_settings"],
  provider: [
    "consume_services",
    "manage_account_settings",
    "manage_provider_profile",
  ],
  admin: ["administer_platform"],
};

const DASHBOARD_PATHS: Record<ProfileRole, string> = {
  user: "/dashboard",
  provider: "/provider/dashboard",
  admin: "/admin/dashboard",
};

const PROTECTED_ROUTE_CAPABILITIES: Array<{
  capability: ProfileCapability;
  prefix: string;
}> = [
  { prefix: "/dashboard", capability: "consume_services" },
  { prefix: "/settings", capability: "manage_account_settings" },
  { prefix: "/provider", capability: "manage_provider_profile" },
  { prefix: "/admin", capability: "administer_platform" },
];

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

export function hasProfileCapability(
  role: ProfileRole | null | undefined,
  capability: ProfileCapability,
) {
  return role ? CAPABILITIES_BY_ROLE[role].includes(capability) : false;
}

export function getDashboardPathForRole(role: ProfileRole) {
  return DASHBOARD_PATHS[role];
}

export function getRequiredCapabilityForPath(pathname: string) {
  return (
    PROTECTED_ROUTE_CAPABILITIES.find(({ prefix }) =>
      matchesPathPrefix(pathname, prefix),
    )?.capability ?? null
  );
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
