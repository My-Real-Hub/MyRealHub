import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_PROFILE_ERROR, ensureAccountRole } from "../lib/auth/account";
import { getAuthCallbackUrl, getSafeRedirectPath } from "../lib/auth/redirects";
import {
  getSignUpRole,
  hasProfileCapability,
  getDashboardPathForRole,
} from "../lib/auth/roles";
import {
  normalizeEmail,
  validateLoginFields,
  validatePasswordFields,
  validateSignUpFields,
} from "../lib/auth/validation";

test("email normalization accepts surrounding whitespace without changing passwords", () => {
  assert.equal(
    normalizeEmail("  CUSTOMER@EXAMPLE.COM  "),
    "customer@example.com",
  );
  assert.deepEqual(
    validateLoginFields({ email: " CUSTOMER@EXAMPLE.COM ", password: "short" }),
    {},
  );
});

test("signup and reset reject short or mismatched passwords", () => {
  assert.ok(
    validatePasswordFields({ password: "short", confirmPassword: "short" })
      .password,
  );
  assert.ok(
    validatePasswordFields({
      password: "long-example",
      confirmPassword: "different-example",
    }).confirmPassword,
  );
  assert.deepEqual(
    validatePasswordFields({
      password: "long-example",
      confirmPassword: "long-example",
    }),
    {},
  );
  assert.ok(
    validateSignUpFields({
      fullName: "  ",
      email: "invalid",
      password: "long-example",
      confirmPassword: "long-example",
    }).fullName,
  );
});

test("return destinations stay on this site and cannot loop through auth callbacks", () => {
  for (const value of [
    null,
    [],
    "https://other.example",
    "//other.example",
    "/\\other.example",
    "/\n/other.example",
    "/auth/callback",
    "/search/../auth/confirm",
  ]) {
    assert.equal(getSafeRedirectPath(value), null, String(value));
  }
  assert.equal(
    getSafeRedirectPath("/search?q=plumber#results"),
    "/search?q=plumber#results",
  );
  assert.equal(getSafeRedirectPath("/dashboard"), "/dashboard");
});

test("email callbacks use the current deployment and a safe return path", () => {
  const callback = new URL(
    getAuthCallbackUrl("https://myrealhub.ca", "/reset-password"),
  );
  assert.equal(callback.origin, "https://myrealhub.ca");
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.searchParams.get("next"), "/reset-password");
  assert.equal(
    new URL(
      getAuthCallbackUrl("http://localhost:3000", "//other.example"),
    ).searchParams.has("next"),
    false,
  );
});

test("public signup cannot request admin access and role destinations remain distinct", () => {
  assert.equal(getSignUpRole("admin"), "user");
  assert.equal(getSignUpRole("provider"), "provider");
  assert.equal(hasProfileCapability("user", "administer_platform"), false);
  assert.equal(hasProfileCapability("provider", "administer_platform"), false);
  assert.equal(getDashboardPathForRole("admin"), "/admin/dashboard");
  assert.equal(getDashboardPathForRole("provider"), "/provider/dashboard");
});

function accountClient(
  profile: { data: unknown; error: unknown },
  recovery: { data: unknown; error: unknown } = { data: "user", error: null },
) {
  const calls: unknown[][] = [];
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return {
        select(columns: string) {
          calls.push(["select", columns]);
          return {
            eq(column: string, id: string) {
              calls.push(["eq", column, id]);
              return {
                async maybeSingle() {
                  return profile;
                },
              };
            },
          };
        },
      };
    },
    async rpc(...args: unknown[]) {
      calls.push(["rpc", ...args]);
      return recovery;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("existing admin access is preserved without requesting profile recovery", async () => {
  const { client, calls } = accountClient({
    data: { role: "admin" },
    error: null,
  });
  assert.equal(await ensureAccountRole(client, "own-account"), "admin");
  assert.ok(
    calls.some((call) => call[0] === "eq" && call[2] === "own-account"),
  );
  assert.equal(
    calls.some((call) => call[0] === "rpc"),
    false,
  );
});

test("a missing profile is recovered only through the self-scoped server function", async () => {
  const { client, calls } = accountClient(
    { data: null, error: null },
    { data: "provider", error: null },
  );
  assert.equal(await ensureAccountRole(client, "own-account"), "provider");
  assert.deepEqual(
    calls.filter((call) => call[0] === "rpc"),
    [["rpc", "ensure_current_user_profile"]],
  );
});

test("profile read errors do not trigger recovery or silently grant a default role", async () => {
  const { client, calls } = accountClient({
    data: null,
    error: { message: "unavailable" },
  });
  await assert.rejects(ensureAccountRole(client, "own-account"), {
    message: ACCOUNT_PROFILE_ERROR,
  });
  assert.equal(
    calls.some((call) => call[0] === "rpc"),
    false,
  );
});

test("failed or invalid recovery stops login with a visible error", async () => {
  for (const recovery of [
    { data: null, error: { message: "unavailable" } },
    { data: "invalid-role", error: null },
  ]) {
    const { client } = accountClient({ data: null, error: null }, recovery);
    await assert.rejects(ensureAccountRole(client, "own-account"), {
      message: ACCOUNT_PROFILE_ERROR,
    });
  }
});
