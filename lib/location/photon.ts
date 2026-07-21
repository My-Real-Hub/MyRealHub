import "server-only";

const DEFAULT_GEOCODER_BASE_URL = "https://photon.komoot.io";
const CANADA_BOUNDING_BOX = "-141.1,41.6,-52.5,83.2";

export type PhotonFeature = {
  geometry?: {
    coordinates?: unknown;
    type?: unknown;
  };
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
  };
};

function getGeocoderBaseUrl() {
  const configuredUrl =
    process.env.GEOCODER_BASE_URL?.trim() || DEFAULT_GEOCODER_BASE_URL;
  const url = new URL(configuredUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("GEOCODER_BASE_URL must use HTTP or HTTPS.");
  }

  return url.toString().replace(/\/+$/, "");
}

function getUserAgent() {
  return (
    process.env.GEOCODER_USER_AGENT?.trim() ||
    "MyRealHub/0.1 (Canadian provider search)"
  );
}

async function fetchPhoton(path: string, params: URLSearchParams) {
  const response = await fetch(
    `${getGeocoderBaseUrl()}${path}?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": getUserAgent(),
      },
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Geocoder returned ${response.status}.`);
  }

  const payload = (await response.json()) as { features?: unknown };

  return Array.isArray(payload.features)
    ? (payload.features as PhotonFeature[])
    : [];
}

export function getPhotonCoordinates(feature: PhotonFeature) {
  const coordinates = feature.geometry?.coordinates;

  if (
    feature.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    return null;
  }

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

export function getPhotonProperty(
  feature: PhotonFeature,
  key: keyof NonNullable<PhotonFeature["properties"]>,
) {
  const value = feature.properties?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getPhotonAddressLabel(feature: PhotonFeature) {
  const name = getPhotonProperty(feature, "name");
  const houseNumber = getPhotonProperty(feature, "housenumber");
  const street = getPhotonProperty(feature, "street");
  const city =
    getPhotonProperty(feature, "city") ??
    getPhotonProperty(feature, "district") ??
    getPhotonProperty(feature, "county");
  const state = getPhotonProperty(feature, "state");
  const postcode = getPhotonProperty(feature, "postcode");
  const country = getPhotonProperty(feature, "country") ?? "Canada";
  const streetAddress = [houseNumber, street].filter(Boolean).join(" ");
  const parts = [name, streetAddress, city, state, postcode, country].filter(
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

export async function autocompletePhotonAddress(query: string) {
  return fetchPhoton(
    "/api/",
    new URLSearchParams({
      bbox: CANADA_BOUNDING_BOX,
      lang: "en",
      limit: "8",
      q: query,
    }),
  );
}

export async function reversePhotonLocation(
  latitude: number,
  longitude: number,
) {
  return fetchPhoton(
    "/reverse",
    new URLSearchParams({
      lang: "en",
      lat: String(latitude),
      limit: "1",
      lon: String(longitude),
    }),
  );
}
