import { isValidCoordinatePair } from "./coordinates";

export type PhotonFeature = {
  geometry?: {
    coordinates?: unknown;
    type?: unknown;
  } | null;
  properties?: {
    city?: unknown;
    country?: unknown;
    countrycode?: unknown;
    county?: unknown;
    district?: unknown;
    housenumber?: unknown;
    name?: unknown;
    postcode?: unknown;
    state?: unknown;
    statecode?: unknown;
    street?: unknown;
  } | null;
};

export function parsePhotonFeatures(payload: unknown): PhotonFeature[] {
  if (!payload || typeof payload !== "object" || !("features" in payload)) {
    return [];
  }

  return Array.isArray(payload.features)
    ? payload.features.filter(
        (feature): feature is PhotonFeature =>
          Boolean(feature) && typeof feature === "object" && !Array.isArray(feature),
      )
    : [];
}

export function getPhotonCoordinates(feature: PhotonFeature | null | undefined) {
  const coordinates = feature?.geometry?.coordinates;

  if (
    feature?.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    return null;
  }

  // GeoJSON positions contain numbers in longitude, latitude order. Coercing
  // null/empty strings to zero silently turns malformed responses into places.
  const [longitude, latitude] = coordinates;

  return isValidCoordinatePair(latitude, longitude)
    ? { latitude: latitude as number, longitude: longitude as number }
    : null;
}

export function getPhotonProperty(
  feature: PhotonFeature | null | undefined,
  key: keyof NonNullable<PhotonFeature["properties"]>,
) {
  const value = feature?.properties?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getPhotonAddressLabel(feature: PhotonFeature | null | undefined) {
  const name = getPhotonProperty(feature, "name");
  const houseNumber = getPhotonProperty(feature, "housenumber");
  const street = getPhotonProperty(feature, "street");
  const city =
    getPhotonProperty(feature, "city") ??
    getPhotonProperty(feature, "district") ??
    getPhotonProperty(feature, "county");
  const state = getPhotonProperty(feature, "state");
  const postcode = getPhotonProperty(feature, "postcode");
  const streetAddress = [houseNumber, street].filter(Boolean).join(" ");
  const parts = [name, streetAddress, city, state, postcode].filter(
    (value, index, values): value is string =>
      Boolean(value) &&
      values.findIndex(
        (candidate) =>
          candidate?.toLocaleLowerCase("en-CA") ===
          value?.toLocaleLowerCase("en-CA"),
      ) === index,
  );

  return parts.join(", ");
}
