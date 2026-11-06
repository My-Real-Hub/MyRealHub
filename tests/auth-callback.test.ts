import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthCallback } from "../lib/auth/callback";
import type { ProfileRole } from "../lib/auth/roles";

function callbackClient({
  role = "user",
  result = {
    data: { user: { id: "verified-account" }, session: { access_token: "test-only" } },
    error: null,
  },
  profileError = null,
}: {
  role?: ProfileRole | null;
  result?: { data: { user?: { id: string } | null; session?: object | null; redirectType?: string }; error: unknown };
  profileError?: unknown;
} = {}) {
  const calls: unknown[][] = [];
  const client = {
    auth: {
      async exchangeCodeForSession(code: string) {
        calls.push(["exchange", code]);
        return result;
      },
      async verifyOtp(value: unknown) {
        calls.push(["verify", value]);
        return result;
      },
    },
    from(table: string) {
      calls.push(["from", table]);
      return {
        select() {
          return {
            eq(column: string, id: string) {
              calls.push(["eq", column, id]);
              return {
                async maybeSingle() {
                  return { data: role ? { role } : null, error: profileError };
                },
              };
            },
          };
        },
      };
    },
    async rpc() {
      return { data: null, error: { message: "Recovery unavailable" } };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

test("PKCE callbacks establish the account's role and select its dashboard", async () => {
  for (const [role, destination] of [
    ["user", "/dashboard"],
    ["provider", "/provider/dashboard"],
    ["admin", "/admin/dashboard"],
  ] as const) {
    const { client, calls } = callbackClient({ role });
    assert.equal(await resolveAuthCallback(new URLSearchParams({ code: "test-code" }), async () => client), destination);
    assert.deepEqual(calls[0], ["exchange", "test-code"]);
    assert.ok(calls.some((call) => call[0] === "eq" && call[2] === "verified-account"));
  }
});

test("email token verification uses the declared supported token type", async () => {
  const { client, calls } = callbackClient();
  assert.equal(await resolveAuthCallback(new URLSearchParams({ token_hash: "test-hash", type: "signup", next: "/providers/jane" }), async () => client), "/providers/jane");
  assert.deepEqual(calls[0], ["verify", { token_hash: "test-hash", type: "signup" }]);
});

test("invalid and incomplete callbacks never create an auth client or verify a token", async () => {
  for (const params of [
    {},
    { token_hash: "test-hash", type: "unsupported" },
    { token_hash: "test-hash" },
    { code: "test-code", error: "access_denied" },
  ] as Record<string, string>[]) {
    let initialized = false;
    assert.equal(await resolveAuthCallback(new URLSearchParams(params), async () => {
      initialized = true;
      throw new Error("Must not initialize");
    }), "/login?auth=confirmation-expired");
    assert.equal(initialized, false);
  }
});

test("expired recovery callbacks return to password recovery", async () => {
  const { client } = callbackClient({ result: { data: {}, error: { message: "Token expired" } } });
  assert.equal(await resolveAuthCallback(new URLSearchParams({ token_hash: "expired", type: "recovery" }), async () => client), "/forgot-password?auth=recovery-expired");
});

test("successful recovery bypasses profile lookup so a missing application profile cannot block a password reset", async () => {
  for (const params of [
    { token_hash: "test-hash", type: "recovery" },
    { code: "test-code", next: "/reset-password" },
    { code: "test-code" },
  ] as Record<string, string>[]) {
    const { client, calls } = callbackClient({ role: null, result: { data: { user: { id: "verified-account" }, session: {}, redirectType: "recovery" }, error: null } });
    assert.equal(await resolveAuthCallback(new URLSearchParams(params), async () => client), "/reset-password");
    assert.equal(calls.some((call) => call[0] === "from"), false);
  }
});

test("unverified, missing-session, and errored exchanges cannot enter a dashboard", async () => {
  for (const result of [
    { data: { user: null, session: {} }, error: null },
    { data: { user: { id: "verified-account" }, session: null }, error: null },
    { data: { user: { id: "verified-account" }, session: {} }, error: { message: "Rejected" } },
  ]) {
    const { client, calls } = callbackClient({ result });
    assert.equal(await resolveAuthCallback(new URLSearchParams({ code: "test-code" }), async () => client), "/login?auth=confirmation-expired");
    assert.equal(calls.some((call) => call[0] === "from"), false);
  }
});

test("profile read or recovery failure produces a visible profile error instead of a redirect loop", async () => {
  for (const options of [{ profileError: { message: "Unavailable" } }, { role: null }]) {
    const { client } = callbackClient(options);
    assert.equal(await resolveAuthCallback(new URLSearchParams({ code: "test-code" }), async () => client), "/login?auth=profile-unavailable");
  }
});

test("service and network exceptions produce the relevant recoverable error destination", async () => {
  for (const [params, expected] of [
    [{ code: "test-code" }, "/login?auth=confirmation-expired"],
    [{ code: "test-code", type: "recovery" }, "/forgot-password?auth=recovery-expired"],
  ] as const) {
    assert.equal(await resolveAuthCallback(new URLSearchParams(params), async () => {
      throw new Error("Network unavailable");
    }), expected);
  }
});

test("callbacks reject external and unauthorized return paths after verifying the account", async () => {
  for (const next of ["//other.example", "/\\other.example", "/admin/dashboard", "/login", "/auth/callback"]) {
    const { client } = callbackClient();
    assert.equal(await resolveAuthCallback(new URLSearchParams({ code: "test-code", next }), async () => client), "/dashboard");
  }
});
