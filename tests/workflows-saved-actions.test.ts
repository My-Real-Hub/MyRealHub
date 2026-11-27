import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProfileRole } from "../lib/auth/roles";
import { executeSavedProviderMutation } from "../lib/providers/saved-mutation";

const userId = "11111111-2222-4333-8444-555555555555";
const providerId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function createHarness(options: {
  profile?: { id: string; role: ProfileRole } | null;
  provider?: { slug: string } | null;
  error?: unknown;
} = {}) {
  const calls: Array<{ action: string; args: unknown[] }> = [];
  const dependencies = {
    async getProfile() {
      calls.push({ action: "profile", args: [] });
      return options.profile === undefined ? { id: userId, role: "user" as const } : options.profile;
    },
    async getActiveProvider(id: string) {
      calls.push({ action: "provider", args: [id] });
      return options.provider === undefined ? { slug: "test-provider" } : options.provider;
    },
    async save(account: string, provider: string) {
      calls.push({ action: "save", args: [account, provider] });
      return { error: options.error ?? null };
    },
    async unsave(account: string, provider: string) {
      calls.push({ action: "unsave", args: [account, provider] });
      return { error: options.error ?? null };
    },
    revalidate(paths: string[]) {
      calls.push({ action: "revalidate", args: paths });
    },
  };
  const formData = new FormData();
  formData.set("providerId", providerId);
  formData.set("returnPath", "/search?category=inspector#results");
  return { calls, dependencies, formData };
}

test("saving while signed out redirects to login and performs no database mutation", async () => {
  const { calls, dependencies, formData } = createHarness({ profile: null });
  const result = await executeSavedProviderMutation(formData, "save", dependencies);
  assert.deepEqual(result, {
    status: "redirect",
    path: "/login?next=%2Fsearch%3Fcategory%3Dinspector%23results&reason=save-provider",
  });
  assert.deepEqual(calls.map((call) => call.action), ["profile"]);
});

test("administrator accounts cannot mutate consumer saved lists", async () => {
  const { calls, dependencies, formData } = createHarness({ profile: { id: userId, role: "admin" } });
  const result = await executeSavedProviderMutation(formData, "save", dependencies);
  assert.deepEqual(result, { status: "redirect", path: "/admin/dashboard" });
  assert.deepEqual(calls.map((call) => call.action), ["profile"]);
});

for (const operation of ["save", "unsave"] as const) {
  test(`${operation} ignores submitted account identity and uses the authenticated user`, async () => {
    const { calls, dependencies, formData } = createHarness();
    formData.set("userId", "attacker-controlled-user-id");
    formData.set("role", "admin");
    const result = await executeSavedProviderMutation(formData, operation, dependencies);
    assert.equal(result.status, "redirect");
    assert.deepEqual(calls.find((call) => call.action === operation)?.args, [userId, providerId]);
  });

  test(`${operation} rejects malformed provider IDs without querying providers`, async () => {
    const { calls, dependencies, formData } = createHarness();
    formData.set("providerId", "../other-user");
    const result = await executeSavedProviderMutation(formData, operation, dependencies);
    assert.equal(result.status, "error");
    assert.deepEqual(calls.map((call) => call.action), ["profile"]);
  });

  test(`${operation} database failures return visible feedback and do not report success`, async () => {
    const { calls, dependencies, formData } = createHarness({ error: { message: "permission denied" } });
    const result = await executeSavedProviderMutation(formData, operation, dependencies);
    assert.equal(result.status, "error");
    if (result.status === "error") assert.match(result.message, /Please try again/);
    assert.equal(calls.some((call) => call.action === "revalidate"), false);
  });

  test(`${operation} success revalidates affected surfaces and returns to the original query`, async () => {
    const { calls, dependencies, formData } = createHarness();
    const result = await executeSavedProviderMutation(formData, operation, dependencies);
    assert.deepEqual(result, { status: "redirect", path: "/search?category=inspector#results" });
    const paths = calls.find((call) => call.action === "revalidate")?.args;
    assert.ok(paths?.includes("/search"));
    assert.ok(paths?.includes("/dashboard/saved"));
    assert.ok(paths?.includes("/providers/test-provider"));
    assert.equal(paths?.some((path) => String(path).includes("?")), false);
  });
}

test("an inactive provider cannot be newly saved", async () => {
  const { calls, dependencies, formData } = createHarness({ provider: null });
  const result = await executeSavedProviderMutation(formData, "save", dependencies);
  assert.equal(result.status, "error");
  assert.equal(calls.some((call) => call.action === "save"), false);
});

test("an unavailable provider can still be removed from saved lists", async () => {
  const { calls, dependencies, formData } = createHarness({ provider: null });
  const result = await executeSavedProviderMutation(formData, "unsave", dependencies);
  assert.equal(result.status, "redirect");
  assert.deepEqual(calls.find((call) => call.action === "unsave")?.args, [userId, providerId]);
});

test("provider accounts can use consumer saved lists", async () => {
  const { calls, dependencies, formData } = createHarness({ profile: { id: userId, role: "provider" } });
  const result = await executeSavedProviderMutation(formData, "save", dependencies);
  assert.equal(result.status, "redirect");
  assert.deepEqual(calls.find((call) => call.action === "save")?.args, [userId, providerId]);
});

test("tampered external return paths fall back to the local directory", async () => {
  for (const returnPath of ["https://outside.example", "//outside.example", "/\\outside.example", "/auth/callback"]) {
    const { dependencies, formData } = createHarness();
    formData.set("returnPath", returnPath);
    const result = await executeSavedProviderMutation(formData, "save", dependencies);
    assert.deepEqual(result, { status: "redirect", path: "/search" });
  }
});
