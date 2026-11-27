import { expect, test } from "./fixtures";

// Real credentials are optional and never supplied by this audit. Keep traces
// off for this suite so authentication payloads cannot be saved in artifacts.
test.use({ trace: "off", video: "off" });

const roles = [
  { name: "customer", prefix: "E2E_USER", dashboard: "/dashboard", forbidden: ["/provider/dashboard", "/admin/dashboard"], settings: "/settings" },
  { name: "provider", prefix: "E2E_PROVIDER", dashboard: "/provider/dashboard", forbidden: ["/admin/dashboard"], settings: "/settings" },
  { name: "admin", prefix: "E2E_ADMIN", dashboard: "/admin/dashboard", forbidden: ["/dashboard", "/provider/dashboard"], settings: "/admin/dashboard" },
] as const;

for (const role of roles) {
  test(`${role.name} login persists after reload, enforces roles, and logout protects the dashboard`, async ({ page }) => {
    const email = process.env[`${role.prefix}_EMAIL`];
    const password = process.env[`${role.prefix}_PASSWORD`];
    test.skip(!email || !password, `Requires an existing confirmed staging account via ${role.prefix}_EMAIL and ${role.prefix}_PASSWORD; no credentials supplied.`);

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(role.dashboard);
    await expect(page.getByRole("button", { name: "Log Out", exact: true })).toBeVisible();

    await page.reload();
    await expect.poll(() => new URL(page.url()).pathname).toBe(role.dashboard);
    await expect(page.getByRole("button", { name: "Log Out", exact: true })).toBeVisible();

    for (const forbiddenPath of role.forbidden) {
      await page.goto(forbiddenPath);
      await expect.poll(() => new URL(page.url()).pathname).toBe(role.dashboard);
    }

    await page.goto("/settings");
    await expect.poll(() => new URL(page.url()).pathname).toBe(role.settings);
    if (role.name === "provider") {
      await page.goto("/dashboard/saved");
      await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard/saved");
    }

    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    await page.goto(role.dashboard);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe(role.dashboard);
  });
}
