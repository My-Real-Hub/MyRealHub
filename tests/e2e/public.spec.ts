import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const publicPages = ["/", "/search", "/login", "/signup", "/signup?role=provider", "/forgot-password", "/feedback"];

for (const path of publicPages) {
  test(`public page ${path} renders accessibly without overflow`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page).toHaveTitle(/MyRealHub/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    // Full-page serious/critical automated WCAG findings are a release gate.
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    expect(errors).toEqual([]);
    if (path === "/" || path === "/search") {
      await page.screenshot({ path: testInfo.outputPath("page.png"), fullPage: true });
      await page.screenshot({ path: testInfo.outputPath("viewport.png") });
    }
  });
}

test("homepage search submits a keyword and directory preserves it", async ({ page }) => {
  await page.goto("/");
  await page.locator("#homepage-keyword").fill("home inspector");
  await page.locator("#homepage-keyword").press("Enter");
  await expect(page).toHaveURL(/\/search\?.*q=home/);
  await expect(page.getByLabel("Keyword", { exact: true })).toHaveValue("home inspector");
  await expect(page.getByRole("heading", { name: /providers? available/ })).toBeVisible();
});

test("directory keyword filters through the attached form", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel("Keyword", { exact: true }).fill("audit-no-matching-provider-8281");
  await page.getByRole("complementary").getByRole("button", { name: "Search providers", exact: true }).click();
  await expect(page).toHaveURL(/q=audit-no-matching-provider-8281/);
  await expect(page.getByRole("heading", { name: "0 providers available" })).toBeVisible();
});

test("login fields reject empty submissions and password visibility works", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("#login-email")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#login-password").fill("test-only-secret");
  await page.getByRole("button", { name: /show password/i }).click();
  await expect(page.locator("#login-password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /hide password/i }).click();
  await expect(page.locator("#login-password")).toHaveAttribute("type", "password");
});

test("signup rejects mismatched passwords before contacting auth", async ({ page }) => {
  let authRequests = 0;
  await page.route("**/auth/v1/signup**", async (route) => { authRequests++; await route.abort(); });
  await page.goto("/signup");
  await page.locator("#signup-email").fill("audit@example.test");
  await page.locator("#signup-password").fill("Test-only-pass-372!");
  await page.locator("#signup-confirm-password").fill("Different-pass-372!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.locator("#signup-confirm-password")).toHaveAttribute("aria-invalid", "true");
  expect(authRequests).toBe(0);
});

for (const path of ["/dashboard", "/dashboard/saved", "/provider/dashboard", "/admin/dashboard", "/admin/dashboard/providers/not-a-provider", "/settings"]) {
  test(`anonymous guard ${path} preserves destination`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    const destination = new URL(response.headers().location, response.url());
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("next")).toBe(path);
  });
}

test("expired confirmation, recovery and missing session offer recovery paths", async ({ request }) => {
  for (const [path, target] of [
    ["/auth/callback?error=access_denied", "/login"],
    ["/auth/confirm?error=access_denied&type=recovery", "/forgot-password"],
    ["/reset-password", "/forgot-password"],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(new URL(response.headers().location, response.url()).pathname).toBe(target);
  }
});

test("unknown routes and providers render useful 404 pages", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist-audit");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto("/providers/does-not-exist-audit");
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
});

test("location API rejects invalid requests before dependency calls", async ({ request }) => {
  for (const [body, expectedStatus] of [
    ["not-json", 400],
    [JSON.stringify({ mode: "autocomplete", query: "a" }), 400],
    [JSON.stringify({ mode: "autocomplete", query: "a".repeat(121) }), 400],
    [JSON.stringify({ mode: "reverse", latitude: "45", longitude: -75 }), 400],
    [JSON.stringify({ mode: "reverse", latitude: 0, longitude: 0 }), 422],
    [JSON.stringify({ mode: "autocomplete", query: "a".repeat(3000) }), 413],
  ] as const) {
    const response = await request.post("/api/location/resolve", { data: body, headers: { "Content-Type": "application/json" } });
    expect(response.status()).toBe(expectedStatus);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect((await response.json()).error.code).toBeTruthy();
  }
  expect((await request.get("/api/location/resolve")).status()).toBe(405);
});

test("responses enforce baseline browser security headers", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["permissions-policy"]).toContain("geolocation=(self)");
  const callback = await request.get("/auth/callback?error=access_denied", { maxRedirects: 0 });
  expect(callback.headers()["referrer-policy"]).toBe("no-referrer");
  expect(callback.headers()["cache-control"]).toContain("no-store");
  const legacyCallback = await request.get("/?token_hash=test-only&type=recovery", { maxRedirects: 0 });
  expect(legacyCallback.headers()["referrer-policy"]).toBe("no-referrer");
  const search = await request.get("/search");
  expect(search.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("hosted directory and database integration @hosted", async ({ page, request }) => {
  test.skip(process.env.E2E_CHECK_BACKEND !== "1", "Set E2E_CHECK_BACKEND=1 against an explicitly configured backend.");
  const health = await request.get("/api/supabase/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).ok).toBe(true);
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: /[1-9]\d* providers? available/ })).toBeVisible();
  const providerLink = page.locator('main a[href^="/providers/"]').first();
  await expect(providerLink).toBeVisible();
  await providerLink.click();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByText(/could not be loaded|temporarily unavailable/i)).toHaveCount(0);
});
