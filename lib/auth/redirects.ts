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

export function getAuthCallbackUrl(origin: string, next: string | null) {
  const url = new URL("/auth/callback", origin);
  const path = getSafeRedirectPath(next);
  if (path) url.searchParams.set("next", path);
  return url.toString();
}
