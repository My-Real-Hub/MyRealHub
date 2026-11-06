export const SUPPORTED_AREA_BOUNDS = {
  minLatitude: 41.6,
  maxLatitude: 83.2,
  minLongitude: -141.1,
  maxLongitude: -52.5,
} as const;

export function isValidCoordinatePair(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function isWithinSupportedAreaBounds(latitude: number, longitude: number) {
  return (
    isValidCoordinatePair(latitude, longitude) &&
    latitude >= SUPPORTED_AREA_BOUNDS.minLatitude &&
    latitude <= SUPPORTED_AREA_BOUNDS.maxLatitude &&
    longitude >= SUPPORTED_AREA_BOUNDS.minLongitude &&
    longitude <= SUPPORTED_AREA_BOUNDS.maxLongitude
  );
}
