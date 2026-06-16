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
