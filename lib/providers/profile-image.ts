export const PROVIDER_PROFILE_IMAGES_BUCKET = "provider-profile-images";
export const PROVIDER_PROFILE_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

export const PROVIDER_PROFILE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isProviderProfileImageType(type: string) {
  return PROVIDER_PROFILE_IMAGE_TYPES.some((allowedType) => allowedType === type);
}

export function isOwnedProfileImagePath(path: string, accountId: string) {
  return (
    path.startsWith(`${accountId}/`) &&
    path.length > accountId.length + 1 &&
    path.length <= 512 &&
    !path.includes("..") &&
    !/[\\\u0000-\u001f\u007f]/.test(path)
  );
}
