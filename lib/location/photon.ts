import "server-only";

import { parsePhotonFeatures } from "./photon-data";
export {
  getPhotonAddressLabel,
  getPhotonCoordinates,
  getPhotonProperty,
  type PhotonFeature,
} from "./photon-data";

const DEFAULT_GEOCODER_BASE_URL = "https://photon.komoot.io";
const SUPPORTED_AREA_BOUNDING_BOX = "-141.1,41.6,-52.5,83.2";

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
    "MyRealHub/0.1 (provider search)"
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

  const payload: unknown = await response.json();

  return parsePhotonFeatures(payload);
}

export async function autocompletePhotonAddress(query: string) {
  return fetchPhoton(
    "/api/",
    new URLSearchParams({
      bbox: SUPPORTED_AREA_BOUNDING_BOX,
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
