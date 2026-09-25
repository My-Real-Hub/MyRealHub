export type ResolvedSearchLocation = {
  address: string;
  latitude: number;
  longitude: number;
  provinceCode: string;
  provinceName: string;
  regionId: string;
  regionName: string;
};

export type LocationAutocompleteResponse = {
  rejectedOutsideSupportedArea: boolean;
  suggestions: ResolvedSearchLocation[];
};

export type LocationReverseResponse = {
  location: ResolvedSearchLocation;
};

export type LocationApiErrorCode =
  | "ADDRESS_NOT_FOUND"
  | "GEOCODER_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "OUTSIDE_SUPPORTED_AREA"
  | "REGION_NOT_FOUND";

export type LocationApiErrorResponse = {
  error: {
    code: LocationApiErrorCode;
    message: string;
  };
};
