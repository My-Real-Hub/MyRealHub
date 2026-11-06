import { expect, test } from "./fixtures";

const resolvedLocation = {
  address: "Toronto, Ontario",
  latitude: 43.6532,
  longitude: -79.3832,
  provinceCode: "ON",
  provinceName: "Ontario",
  regionId: "90000000-0000-4000-8000-000000000001",
  regionName: "Toronto test service area",
};

test("address suggestions support keyboard selection and editing clears the selected area", async ({ page }) => {
  await page.route("**/api/location/resolve", (route) => route.fulfill({ json: { suggestions: [resolvedLocation], rejectedOutsideSupportedArea: false } }));
  await page.goto("/search");
  await expect(page.getByRole("button", { name: "Zoom map in" })).toBeEnabled();
  const address = page.getByRole("combobox", { name: "Address or postal code" });
  await address.fill("Toronto");
  await expect(page.getByRole("option", { name: /Toronto, Ontario/ })).toBeVisible();
  await address.press("Enter");
  await expect(address).toHaveValue(resolvedLocation.address);
  await expect(page.getByRole("status").filter({ hasText: "Matched to Toronto test service area." })).toBeVisible();
  expect(await address.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(true);
  await address.fill("Ottawa");
  expect(await address.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
  await expect(page.locator("#provider-region")).toHaveValue("");
});

test("geocoder failures show a recoverable error while directory filters remain usable", async ({ page }) => {
  await page.route("**/api/location/resolve", (route) => route.fulfill({ status: 503, json: { error: { code: "GEOCODER_UNAVAILABLE", message: "Address search is temporarily unavailable. Please try again." } } }));
  await page.goto("/search");
  await expect(page.getByRole("button", { name: "Zoom map in" })).toBeEnabled();
  await page.getByRole("combobox", { name: "Address or postal code" }).fill("Toronto");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Address search is temporarily unavailable");
  await expect(page.locator('select[name="category"]')).toBeEnabled();
  await expect(page.getByRole("complementary").getByRole("button", { name: "Search providers", exact: true })).toBeEnabled();
});

test("device location uses the resolved service area without exposing coordinates in the search URL", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.6532, longitude: -79.3832 });
  let requestBody: Record<string, unknown> | undefined;
  let selectedRegionId = resolvedLocation.regionId;
  await page.route("**/api/location/resolve", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ json: { location: { ...resolvedLocation, regionId: selectedRegionId } } });
  });
  await page.goto("/search");
  await expect(page.getByRole("button", { name: "Zoom map in" })).toBeEnabled();
  const regionOption = page.locator('#provider-region option:not([value=""])').first();
  const hasRegionData = await regionOption.count() > 0;
  if (hasRegionData) selectedRegionId = (await regionOption.getAttribute("value"))!;
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Matched to Toronto test service area." })).toBeVisible();
  expect(requestBody).toEqual({ mode: "reverse", latitude: 43.6532, longitude: -79.3832 });
  await page.getByRole("complementary").getByRole("button", { name: "Search providers", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?/);
  const search = new URL(page.url()).searchParams;
  for (const key of ["latitude", "longitude", "lat", "lon", "address"]) expect(search.has(key)).toBe(false);
  expect(page.url()).not.toContain("43.6532");
  expect(page.url()).not.toContain("79.3832");
  if (hasRegionData) expect(search.get("region")).toBe(selectedRegionId);
});

test("configured geocoder resolves a Canadian address @hosted", async ({ request }) => {
  test.skip(process.env.E2E_CHECK_BACKEND !== "1", "Set E2E_CHECK_BACKEND=1 to check the configured geocoder and service-region data.");
  const response = await request.post("/api/location/resolve", { data: { mode: "autocomplete", query: "Toronto Ontario" } });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.suggestions.length).toBeGreaterThan(0);
  expect(result.suggestions[0].provinceCode).toBe("ON");
});

test("default OpenStreetMap tile service loads the visible map [live-tiles]", async ({ page }, testInfo) => {
  test.skip(process.env.E2E_CHECK_TILES !== "1", "Set E2E_CHECK_TILES=1 for a single explicit live tile-provider check.");
  test.skip(testInfo.project.name !== "desktop-chromium", "One live viewport avoids duplicate public tile-service traffic.");
  const tileResponse = page.waitForResponse((response) => response.url().startsWith("https://tile.openstreetmap.org/") && response.url().endsWith(".png"));
  await page.goto("/search");
  const response = await tileResponse;
  expect(response.request().headers().referer).toBeTruthy();
  expect(response.status()).toBe(200);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: testInfo.outputPath("live-map.png") });
});
