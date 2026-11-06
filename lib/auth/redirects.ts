import {
  getDashboardPathForRole,
  getRequiredCapabilityForPath,
  hasProfileCapability,
  type ProfileRole,
} from "./roles";

export function getSafeRedirectPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return null;
  }

  const url = new URL(value, "https://myrealhub.invalid");
  if (url.origin !== "https://myrealhub.invalid") return null;
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/"))
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getLoginRedirectPath(returnTo: unknown) {
  const params = new URLSearchParams();
  const next = getSafeRedirectPath(returnTo);
  if (next) params.set("next", next);
  return `/login${params.size ? `?${params}` : ""}`;
}

export function getPostAuthRedirectPath(role: ProfileRole, returnTo: unknown) {
  const next = getSafeRedirectPath(returnTo);
  if (!next) return getDashboardPathForRole(role);

  const pathname = new URL(next, "https://myrealhub.invalid").pathname;
  const requiredCapability = getRequiredCapabilityForPath(pathname);
  if (
    ["/login", "/signup"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    (requiredCapability && !hasProfileCapability(role, requiredCapability))
  ) {
    return getDashboardPathForRole(role);
  }

  return next;
}

export function getAuthCallbackUrl(origin: string, next: string | null) {
  const url = new URL("/auth/callback", origin);
  const path = getSafeRedirectPath(next);
  if (path) url.searchParams.set("next", path);
  return url.toString();
}

export function getFallbackAuthCallbackPath(
  pathname: string,
  params: URLSearchParams,
) {
  if (!["/", "/login", "/signup"].includes(pathname)) return null;
  if (
    !params.get("code") &&
    !params.get("token_hash") &&
    !params.has("error")
  ) {
    return null;
  }

  // Supabase can fall back to its Site URL when the requested callback is not
  // allowlisted, or when an older email template links to the homepage.
  const callbackParams = new URLSearchParams();
  for (const key of ["code", "token_hash", "type", "next", "error"]) {
    const value = params.get(key);
    if (value !== null) callbackParams.set(key, value);
  }
  return `/auth/callback?${callbackParams}`;
}

export function isPasswordRecoveryCallback(
  params: URLSearchParams,
  redirectType?: unknown,
) {
  return (
    params.get("type") === "recovery" ||
    getSafeRedirectPath(params.get("next")) === "/reset-password" ||
    redirectType === "recovery"
  );
}
