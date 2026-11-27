import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

type AuthReply = { status: number; body: unknown } | "network-error";

async function interceptAuth(page: Page, replies: Record<string, AuthReply>) {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  // Intercept every browser Auth call, including unexpected ones. These tests
  // must never create hosted accounts or send real confirmation/recovery mail.
  await page.route(/\/auth\/v1\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/auth/v1/", "");
    const reply = replies[path];
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
      return;
    }
    requests.push({ path, body: request.postDataJSON() ?? {} });
    if (!reply || reply === "network-error") {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: reply.status,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "X-Supabase-Api-Version",
        "x-supabase-api-version": "2024-01-01",
      },
      body: JSON.stringify(reply.body),
    });
  });
  return requests;
}

async function fillLogin(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("demo@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

async function fillSignup(page: Page) {
  await page.getByLabel("Full name", { exact: true }).fill("Demo Customer");
  await page.getByLabel("Email", { exact: true }).fill("DEMO@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByLabel("Confirm password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
}

test("invalid login shows password-recovery guidance and allows another attempt", async ({ page }) => {
  const requests = await interceptAuth(page, {
    token: { status: 400, body: { code: "invalid_credentials", msg: "Invalid login credentials" } },
  });
  await page.goto("/login");
  await fillLogin(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email or password not recognized");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Forgot password");
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
  expect(requests).toHaveLength(1);
  expect(requests[0].body.email).toBe("demo@example.invalid");
});

test("unconfirmed login opens confirmation resend and handles an accepted resend without sending mail", async ({ page }) => {
  const requests = await interceptAuth(page, {
    token: { status: 400, body: { code: "email_not_confirmed", msg: "Email not confirmed" } },
    resend: { status: 200, body: {} },
  });
  await page.goto("/login");
  await fillLogin(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Confirm your email");
  await expect(page.getByLabel("Confirmation email", { exact: true })).toBeVisible();
  await page.getByLabel("Confirmation email", { exact: true }).fill("demo@example.invalid");
  await page.getByRole("button", { name: "Resend confirmation email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("If this account is awaiting confirmation");
  expect(requests.map((request) => request.path)).toEqual(["token", "resend"]);
});

test("a network failure leaves login usable and never reports a successful session", async ({ page }) => {
  const requests = await interceptAuth(page, { token: "network-error" });
  await page.goto("/login");
  await fillLogin(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
  expect(requests.some((request) => request.path === "token")).toBe(true);
});

test("repeat signup reports a possible existing account instead of claiming another email was sent", async ({ page }) => {
  const requests = await interceptAuth(page, {
    signup: { status: 200, body: { id: "obfuscated-test-account", identities: [] } },
  });
  await page.goto("/signup");
  await fillSignup(page);
  await expect(page.getByRole("status")).toContainText("An account may already exist");
  await expect(page.getByRole("status")).toContainText("does not change its password");
  await expect(page.getByLabel("Confirmation email", { exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].body.email).toBe("demo@example.invalid");
});

test("a new pending signup exposes confirmation instructions and resend", async ({ page }) => {
  const requests = await interceptAuth(page, {
    signup: { status: 200, body: { id: "new-test-account", identities: [{ provider: "email" }] } },
  });
  await page.goto("/signup?role=provider");
  await fillSignup(page);
  await expect(page.getByRole("status")).toContainText("Confirm your email before logging in");
  await expect(page.getByLabel("Confirmation email", { exact: true })).toHaveValue("demo@example.invalid");
  expect(requests).toHaveLength(1);
  expect(requests[0].body.data).toEqual({ full_name: "Demo Customer", role: "provider" });
});

test("an accepted recovery request uses a recovery callback and an enumeration-safe message", async ({ page }) => {
  const requests = await interceptAuth(page, { recover: { status: 200, body: {} } });
  let redirectTo: URL | undefined;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/auth/v1/recover")) redirectTo = new URL(url.searchParams.get("redirect_to")!);
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("demo@example.invalid");
  await page.getByRole("button", { name: "Send reset email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that email");
  expect(requests).toHaveLength(1);
  expect(redirectTo?.pathname).toBe("/auth/callback");
  expect(redirectTo?.searchParams.get("next")).toBe("/reset-password");
});

test("recovery rate limiting explains the retry requirement and re-enables the form", async ({ page }) => {
  const requests = await interceptAuth(page, {
    recover: { status: 429, body: { code: "over_email_send_rate_limit", msg: "Email rate limit exceeded" } },
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("demo@example.invalid");
  await page.getByRole("button", { name: "Send reset email", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Too many email requests");
  await expect(page.getByRole("button", { name: "Send reset email", exact: true })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test.describe("authentication without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("login cannot submit credentials into a URL before its client handler is ready", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeDisabled();
    await expect(page.getByRole("main").locator("form").first()).toHaveAttribute("method", "post");
    await page.getByLabel("Email", { exact: true }).fill("demo@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("test-only-password");
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/login$/);
  });
});
