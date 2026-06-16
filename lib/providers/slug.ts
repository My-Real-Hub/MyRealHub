export function slugifyProviderValue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function getProviderProfileSlug({
  businessName,
  displayName,
  userId,
}: {
  businessName: string;
  displayName: string;
  userId: string;
}) {
  const baseSlug =
    slugifyProviderValue(businessName || displayName || "provider") ||
    "provider";
  const accountSuffix = userId.replace(/-/g, "").slice(-12);

  return `${baseSlug}-${accountSuffix}`;
}

export function isProviderProfileSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,159}$/.test(value);
}

export function isProviderProfileId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
