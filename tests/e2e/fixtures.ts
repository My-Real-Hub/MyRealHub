import { test as base, expect } from "@playwright/test";

// Routine tests must not repeatedly fetch community-funded map tiles. A tiny
// transparent image exercises Leaflet's successful load path without traffic.
const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    if (!testInfo.title.includes("[live-tiles]")) {
      await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({
        status: 200, contentType: "image/png", body: tile,
      }));
    }
    await runTest(page);
  },
});

export { expect };
