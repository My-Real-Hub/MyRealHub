import {
  autocompletePhotonAddress,
  getPhotonAddressLabel,
  getPhotonCoordinates,
  getPhotonProperty,
  reversePhotonLocation,
  type PhotonFeature,
} from "@/lib/location/photon";
import {
  getServiceRegionMatchRows,
  matchServiceRegion,
} from "@/lib/location/region-matching";
import type {
  LocationApiErrorCode,
  LocationApiErrorResponse,
  ResolvedSearchLocation,
} from "@/lib/location/types";

const MAX_REQUEST_BYTES = 2_048;
const MAX_ADDRESS_LENGTH = 120;
const SUPPORTED_AREA_BOUNDS = {
  minLatitude: 41.6,
  maxLatitude: 83.2,
  minLongitude: -141.1,
  maxLongitude: -52.5,
};

type AutocompleteRequest = {
  mode: "autocomplete";
  query: string;
};

type ReverseRequest = {
  mode: "reverse";
  latitude: number;
  longitude: number;
};

function errorResponse(
  code: LocationApiErrorCode,
  message: string,
  status: number,
) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    } satisfies LocationApiErrorResponse,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function isFiniteCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isWithinSupportedAreaBounds(latitude: number, longitude: number) {
  return (
    latitude >= SUPPORTED_AREA_BOUNDS.minLatitude &&
    latitude <= SUPPORTED_AREA_BOUNDS.maxLatitude &&
    longitude >= SUPPORTED_AREA_BOUNDS.minLongitude &&
    longitude <= SUPPORTED_AREA_BOUNDS.maxLongitude
  );
}

function parseRequest(value: unknown): AutocompleteRequest | ReverseRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const request = value as Record<string, unknown>;

  if (request.mode === "autocomplete" && typeof request.query === "string") {
    return {
      mode: "autocomplete",
      query: request.query.trim(),
    };
  }

  if (
    request.mode === "reverse" &&
    isFiniteCoordinate(request.latitude) &&
    isFiniteCoordinate(request.longitude)
  ) {
    return {
      mode: "reverse",
      latitude: request.latitude as number,
      longitude: request.longitude as number,
    };
  }

  return null;
}

function resolveFeature(
  feature: PhotonFeature,
  regionRows: Awaited<ReturnType<typeof getServiceRegionMatchRows>>,
): ResolvedSearchLocation | null {
  const coordinates = getPhotonCoordinates(feature);

  if (!coordinates) {
    return null;
  }

  const countryCode = getPhotonProperty(feature, "countrycode") ?? "";
  const match = matchServiceRegion(
    {
      ...coordinates,
      countryCode,
      state: getPhotonProperty(feature, "state"),
      stateCode: getPhotonProperty(feature, "statecode"),
      city: getPhotonProperty(feature, "city"),
      district: getPhotonProperty(feature, "district"),
      county: getPhotonProperty(feature, "county"),
      name: getPhotonProperty(feature, "name"),
    },
    regionRows,
  );

  if (match.status !== "matched") {
    return null;
  }

  return {
    address: getPhotonAddressLabel(feature),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    provinceCode: match.provinceCode,
    provinceName: match.provinceName,
    regionId: match.region.id,
    regionName: match.region.name,
  };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(
      "INVALID_REQUEST",
      "Location request is too large.",
      413,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "Enter a valid address or map location.",
      400,
    );
  }

  const locationRequest = parseRequest(body);

  if (!locationRequest) {
    return errorResponse(
      "INVALID_REQUEST",
      "Enter a valid address or map location.",
      400,
    );
  }

  try {
    const regionRows = await getServiceRegionMatchRows();

    if (locationRequest.mode === "autocomplete") {
      if (
        locationRequest.query.length < 3 ||
        locationRequest.query.length > MAX_ADDRESS_LENGTH
      ) {
        return errorResponse(
          "INVALID_REQUEST",
          "Enter between 3 and 120 characters.",
          400,
        );
      }

      const features = await autocompletePhotonAddress(locationRequest.query);
      const rejectedOutsideSupportedArea = features.some(
        (feature) =>
          (getPhotonProperty(feature, "countrycode") ?? "").toUpperCase() !==
          "CA",
      );
      const seenSuggestions = new Set<string>();
      const suggestions = features
        .map((feature) => resolveFeature(feature, regionRows))
        .filter(
          (suggestion): suggestion is ResolvedSearchLocation =>
            Boolean(suggestion),
        )
        .filter((suggestion) => {
          const key = `${suggestion.address}|${suggestion.latitude.toFixed(
            5,
          )}|${suggestion.longitude.toFixed(5)}`;

          if (seenSuggestions.has(key)) {
            return false;
          }

          seenSuggestions.add(key);
          return true;
        })
        .slice(0, 5);

      return Response.json(
        {
          rejectedOutsideSupportedArea:
            suggestions.length === 0 && rejectedOutsideSupportedArea,
          suggestions,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (
      !isWithinSupportedAreaBounds(
        locationRequest.latitude,
        locationRequest.longitude,
      )
    ) {
      return errorResponse(
        "OUTSIDE_SUPPORTED_AREA",
        "Choose a location within the supported service area.",
        422,
      );
    }

    const features = await reversePhotonLocation(
      locationRequest.latitude,
      locationRequest.longitude,
    );
    const feature = features[0];

    if (!feature) {
      return errorResponse(
        "ADDRESS_NOT_FOUND",
        "No address was found at that map location.",
        404,
      );
    }

    const countryCode = getPhotonProperty(feature, "countrycode") ?? "";

    if (countryCode.toUpperCase() !== "CA") {
      return errorResponse(
        "OUTSIDE_SUPPORTED_AREA",
        "Choose a location within the supported service area.",
        422,
      );
    }

    const location = resolveFeature(feature, regionRows);

    if (!location) {
      return errorResponse(
        "REGION_NOT_FOUND",
        "That location could not be matched to a service region.",
        422,
      );
    }

    return Response.json(
      { location },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return errorResponse(
      "GEOCODER_UNAVAILABLE",
      "Address search is temporarily unavailable. Please try again.",
      503,
    );
  }
}
