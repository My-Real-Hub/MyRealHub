import { isValidCoordinatePair, isWithinSupportedAreaBounds } from "./coordinates";

export type GeocodedLocation = {
  countryCode: string;
  state: string | null;
  stateCode: string | null;
  city: string | null;
  district: string | null;
  county: string | null;
  name: string | null;
  latitude: number;
  longitude: number;
};

export type ServiceRegionMatchRow = {
  id: string;
  name: string;
  slug: string;
  province_code: string;
  center_latitude: number;
  center_longitude: number;
  location_match_terms: string[];
};

const PROVINCE_NAMES_BY_CODE: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

const PROVINCE_CODES_BY_NAME = new Map(
  Object.entries(PROVINCE_NAMES_BY_CODE).flatMap(([code, name]) => [
    [normalizeLocationText(code), code],
    [normalizeLocationText(name), code],
  ]),
);

function normalizeLocationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-CA")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProvinceCode(location: GeocodedLocation) {
  const normalizedStateCode = normalizeLocationText(
    location.stateCode?.trim().replace(/^CA-/i, "") ?? "",
  );
  const normalizedState = normalizeLocationText(location.state ?? "");

  return (
    PROVINCE_CODES_BY_NAME.get(normalizedStateCode) ??
    PROVINCE_CODES_BY_NAME.get(normalizedState) ??
    null
  );
}

function getLocationMatchScore(
  region: ServiceRegionMatchRow,
  components: string[],
) {
  const normalizedComponents = components
    .map(normalizeLocationText)
    .filter(Boolean);
  const combinedLocation = normalizedComponents.join(" ");
  const terms = [region.name, ...region.location_match_terms]
    .map(normalizeLocationText)
    .filter(Boolean);

  return terms.reduce((bestScore, term) => {
    if (normalizedComponents.includes(term)) {
      return Math.max(bestScore, 100_000 + term.length);
    }

    if (
      normalizedComponents.some(
        (component) =>
          containsLocationPhrase(component, term) ||
          (component.length >= 4 && containsLocationPhrase(term, component)),
      )
    ) {
      return Math.max(bestScore, 10_000 + term.length);
    }

    if (containsLocationPhrase(combinedLocation, term)) {
      return Math.max(bestScore, 1_000 + term.length);
    }

    return bestScore;
  }, 0);
}

function containsLocationPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

function getDistanceSquared(
  latitude: number,
  longitude: number,
  region: ServiceRegionMatchRow,
) {
  const latitudeDistance = latitude - region.center_latitude;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  const longitudeDistance =
    (longitude - region.center_longitude) * longitudeScale;

  return (
    latitudeDistance * latitudeDistance +
    longitudeDistance * longitudeDistance
  );
}

export function matchServiceRegion(
  location: GeocodedLocation,
  regions: ServiceRegionMatchRow[],
) {
  if (
    location.countryCode.trim().toUpperCase() !== "CA" ||
    !isWithinSupportedAreaBounds(location.latitude, location.longitude)
  ) {
    return { status: "outside_supported_area" as const };
  }

  const provinceCode = getProvinceCode(location);

  if (!provinceCode) {
    return { status: "province_not_found" as const };
  }

  const provinceRegions = regions.filter(
    (region) =>
      region.province_code === provinceCode &&
      isValidCoordinatePair(region.center_latitude, region.center_longitude),
  );

  if (provinceRegions.length === 0) {
    return { status: "region_not_found" as const };
  }

  const components = [
    location.name,
    location.city,
    location.district,
    location.county,
  ].filter((value): value is string => Boolean(value));
  const scoredRegions = provinceRegions
    .map((region) => ({
      region,
      score: getLocationMatchScore(region, components),
      distance: getDistanceSquared(location.latitude, location.longitude, region),
    }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.distance - second.distance ||
        first.region.slug.localeCompare(second.region.slug),
    );
  const matchedRegion = scoredRegions[0]?.region;

  if (!matchedRegion) {
    return { status: "region_not_found" as const };
  }

  return {
    status: "matched" as const,
    provinceCode,
    provinceName: PROVINCE_NAMES_BY_CODE[provinceCode],
    region: matchedRegion,
  };
}
