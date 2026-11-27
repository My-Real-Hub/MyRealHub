import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isValidCoordinatePair,
  isWithinSupportedAreaBounds,
  SUPPORTED_AREA_BOUNDS,
} from "../lib/location/coordinates";
import {
  getPhotonAddressLabel,
  getPhotonCoordinates,
  getPhotonProperty,
  parsePhotonFeatures,
  type PhotonFeature,
} from "../lib/location/photon-data";
import {
  matchServiceRegion,
  type GeocodedLocation,
  type ServiceRegionMatchRow,
} from "../lib/location/region-match";

function region(overrides: Partial<ServiceRegionMatchRow> = {}): ServiceRegionMatchRow {
  return {
    id: "toronto",
    name: "Greater Toronto Area",
    slug: "on-greater-toronto-area",
    province_code: "ON",
    center_latitude: 43.6532,
    center_longitude: -79.3832,
    location_match_terms: ["Toronto", "Mississauga", "North York"],
    ...overrides,
  };
}

function location(overrides: Partial<GeocodedLocation> = {}): GeocodedLocation {
  return {
    countryCode: "CA",
    state: "Ontario",
    stateCode: null,
    city: null,
    district: null,
    county: null,
    name: null,
    latitude: 43.6532,
    longitude: -79.3832,
    ...overrides,
  };
}

function matched(input: GeocodedLocation, rows: ServiceRegionMatchRow[]) {
  const result = matchServiceRegion(input, rows);
  assert.equal(result.status, "matched");
  assert.ok("region" in result);
  return result;
}

test("coordinate validation accepts only finite numeric latitude/longitude within the world", () => {
  for (const [latitude, longitude] of [[0, 0], [90, 180], [-90, -180], [43.65, -79.38]]) {
    assert.equal(isValidCoordinatePair(latitude, longitude), true);
  }
  for (const [latitude, longitude] of [
    [NaN, -79], [43, Infinity], [-Infinity, -79], [90.001, 0], [-90.001, 0],
    [0, 180.001], [0, -180.001], [null, -79], [43, null], ["43", -79],
    [43, "-79"], [false, -79], [undefined, -79],
  ]) {
    assert.equal(isValidCoordinatePair(latitude, longitude), false, `${String(latitude)}, ${String(longitude)}`);
  }
});

test("Canadian search bounds include their edges and reject each outside edge", () => {
  const bounds = SUPPORTED_AREA_BOUNDS;
  assert.equal(isWithinSupportedAreaBounds(bounds.minLatitude, bounds.minLongitude), true);
  assert.equal(isWithinSupportedAreaBounds(bounds.maxLatitude, bounds.maxLongitude), true);
  for (const [latitude, longitude] of [
    [bounds.minLatitude - 0.001, -79], [bounds.maxLatitude + 0.001, -79],
    [43, bounds.minLongitude - 0.001], [43, bounds.maxLongitude + 0.001],
    [NaN, -79], [43, Infinity],
  ]) {
    assert.equal(isWithinSupportedAreaBounds(latitude, longitude), false);
  }
});

test("GeoJSON point positions use longitude first and can include altitude", () => {
  for (const coordinates of [[-79.3832, 43.6532], [-79.3832, 43.6532, 100]]) {
    assert.deepEqual(getPhotonCoordinates({ geometry: { type: "Point", coordinates } }), {
      latitude: 43.6532,
      longitude: -79.3832,
    });
  }
});

test("malformed and non-numeric GeoJSON points cannot become plausible locations", () => {
  for (const coordinates of [
    null, {}, "-79,43", [], [-79], [null, 43], [-79, null], ["", 43],
    ["-79", 43], [-79, "43"], [false, 43], [NaN, 43], [-79, Infinity],
    [-181, 43], [-79, 91],
  ]) {
    assert.equal(getPhotonCoordinates({ geometry: { type: "Point", coordinates } }), null);
  }
  for (const feature of [null, undefined, {}, { geometry: null }, { geometry: { type: "LineString", coordinates: [-79, 43] } }]) {
    assert.equal(getPhotonCoordinates(feature), null);
  }
});

test("unexpected geocoder payloads return an empty feature list safely", () => {
  for (const payload of [null, undefined, false, 5, "response", [], {}, { features: null }, { features: {} }]) {
    assert.deepEqual(parsePhotonFeatures(payload), []);
  }
  const point: PhotonFeature = { geometry: { type: "Point", coordinates: [-79, 43] } };
  assert.deepEqual(parsePhotonFeatures({ features: [null, false, [], "bad", 5, point] }), [point]);
});

test("geocoder properties reject unexpected values and trim text", () => {
  assert.equal(getPhotonProperty({ properties: { city: "  Montréal  " } }, "city"), "Montréal");
  for (const feature of [null, {}, { properties: null }, { properties: { city: 123 } }, { properties: { city: " " } }]) {
    assert.equal(getPhotonProperty(feature, "city"), null);
  }
});

test("address labels include street numbers, locality, province, and postal code", () => {
  assert.equal(getPhotonAddressLabel({ properties: {
    name: "Library", housenumber: "123", street: "Main Street",
    city: "Ottawa", state: "Ontario", postcode: "K1A 0B1",
  } }), "Library, 123 Main Street, Ottawa, Ontario, K1A 0B1");
});

test("address labels deduplicate locality names and use district/county fallbacks", () => {
  assert.equal(getPhotonAddressLabel({ properties: { name: "Toronto", city: "toronto", state: "Ontario" } }), "Toronto, Ontario");
  assert.equal(getPhotonAddressLabel({ properties: { district: "North York", county: "York", state: "Ontario" } }), "North York, Ontario");
  assert.equal(getPhotonAddressLabel({ properties: { county: "York", state: "Ontario" } }), "York, Ontario");
  assert.equal(getPhotonAddressLabel(null), "");
});

const subdivisions = [
  ["AB", "Alberta", 53.5461, -113.4938],
  ["BC", "British Columbia", 49.2827, -123.1207],
  ["MB", "Manitoba", 49.8951, -97.1384],
  ["NB", "New Brunswick", 45.9636, -66.6431],
  ["NL", "Newfoundland and Labrador", 47.5615, -52.7126],
  ["NS", "Nova Scotia", 44.6488, -63.5752],
  ["NT", "Northwest Territories", 62.454, -114.3718],
  ["NU", "Nunavut", 63.7467, -68.517],
  ["ON", "Ontario", 43.6532, -79.3832],
  ["PE", "Prince Edward Island", 46.2382, -63.1311],
  ["QC", "Quebec", 46.8139, -71.208],
  ["SK", "Saskatchewan", 50.4452, -104.6189],
  ["YT", "Yukon", 60.7212, -135.0568],
] as const;

for (const [code, name, latitude, longitude] of subdivisions) {
  test(`${name} matches by full name, abbreviated code, and prefixed ISO code`, () => {
    const rows = [region({ province_code: code, center_latitude: latitude, center_longitude: longitude })];
    for (const state of [name, name.toLowerCase(), ` ${code.toLowerCase()} `]) {
      const result = matched(location({ state, latitude, longitude }), rows);
      assert.equal(result.provinceCode, code);
      assert.equal(result.provinceName, name);
    }
    const result = matched(location({ state: "unrecognized", stateCode: ` ca-${code.toLowerCase()} `, latitude, longitude }), rows);
    assert.equal(result.provinceCode, code);
  });
}

test("accented and decomposed Québec/Montréal names match their normalized service region", () => {
  const rows = [region({ id: "montreal", province_code: "QC", name: "Greater Montreal", location_match_terms: ["Montreal"], center_latitude: 45.5017, center_longitude: -73.5673 })];
  for (const state of ["Québec", "QUEBEC", "Que\u0301bec"]) {
    assert.equal(matched(location({ state, city: "Montréal", latitude: 45.5017, longitude: -73.5673 }), rows).region.id, "montreal");
  }
});

test("country, province, and missing service coverage produce distinct results", () => {
  assert.deepEqual(matchServiceRegion(location({ countryCode: "US" }), [region()]), { status: "outside_supported_area" });
  assert.deepEqual(matchServiceRegion(location({ state: "Unknown", stateCode: "XX" }), [region()]), { status: "province_not_found" });
  assert.deepEqual(matchServiceRegion(location(), []), { status: "region_not_found" });
  assert.equal(matched(location({ countryCode: " ca " }), [region()]).provinceCode, "ON");
});

test("a Canadian country label cannot admit invalid or out-of-bounds coordinates", () => {
  for (const [latitude, longitude] of [[NaN, -79], [43, Infinity], [0, 0], [91, -79], [43, -181]]) {
    assert.deepEqual(matchServiceRegion(location({ latitude, longitude }), [region()]), { status: "outside_supported_area" });
  }
});

const toronto = region();
const ottawa = region({ id: "ottawa", name: "Ottawa Region", slug: "on-ottawa-region", center_latitude: 45.4215, center_longitude: -75.6972, location_match_terms: ["Ottawa", "Kanata"] });

test("exact locality matches take precedence over proximity", () => {
  assert.equal(matched(location({ city: "Toronto", latitude: ottawa.center_latitude, longitude: ottawa.center_longitude }), [ottawa, toronto]).region.id, "toronto");
});

test("nearest region is selected when no locality terms match", () => {
  const input = location({ city: "An unmatched locality", latitude: 45.4, longitude: -75.7 });
  assert.equal(matched(input, [toronto, ottawa]).region.id, "ottawa");
  assert.equal(matched(input, [ottawa, toronto]).region.id, "ottawa");
});

test("matching never crosses a province boundary to a geographically closer region", () => {
  const quebec = region({ id: "gatineau", province_code: "QC", center_latitude: 45.4765, center_longitude: -75.7013, location_match_terms: ["Ottawa"] });
  assert.equal(matched(location({ city: "Ottawa", latitude: 45.47, longitude: -75.7 }), [quebec, ottawa]).region.id, "ottawa");
});

test("textual ties choose the nearer region instead of depending on database row order", () => {
  const first = { ...toronto, location_match_terms: ["Springfield"] };
  const second = { ...ottawa, location_match_terms: ["Springfield"] };
  const input = location({ city: "Springfield", latitude: 45.4, longitude: -75.7 });
  assert.equal(matched(input, [first, second]).region.id, "ottawa");
  assert.equal(matched(input, [second, first]).region.id, "ottawa");
});

test("region terms match whole words and do not confuse Hopewell with Hope", () => {
  const hope = region({ id: "hope", province_code: "BC", location_match_terms: ["Hope"], center_latitude: 49.05, center_longitude: -122.3 });
  const northern = region({ id: "north", province_code: "BC", location_match_terms: [], center_latitude: 55, center_longitude: -123 });
  assert.equal(matched(location({ state: "British Columbia", city: "Hopewell", latitude: 54.9, longitude: -123 }), [hope, northern]).region.id, "north");
  assert.equal(matched(location({ state: "British Columbia", county: "District of Hope", latitude: 54.9, longitude: -123 }), [hope, northern]).region.id, "hope");
});

test("invalid region centers are ignored and the input order is preserved", () => {
  const invalid = region({ id: "bad", center_latitude: NaN });
  const rows = [invalid, ottawa, toronto];
  assert.equal(matched(location({ city: "Toronto" }), rows).region.id, "toronto");
  assert.deepEqual(rows, [invalid, ottawa, toronto]);
  assert.deepEqual(matchServiceRegion(location(), [invalid]), { status: "region_not_found" });
});
