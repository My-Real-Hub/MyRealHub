import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROVIDER_CONVERSION_ERROR,
  requestProviderAccess,
} from "../lib/auth/provider-onboarding";
import { getProviderJoinPath } from "../lib/auth/roles";

function clientFor({
  user = { id: "verified-caller", email_confirmed_at: "2026-11-16T00:00:00Z", is_anonymous: false } as { id: string; email_confirmed_at?: string; is_anonymous?: boolean } | null,
  userError = null as unknown,
  role = "user" as string | null,
  profileError = null as unknown,
  rpcData = "provider" as unknown,
  rpcError = null as unknown,
} = {}) {
  const calls: unknown[][] = [];
  const client = {
    auth: {
      async getUser() { calls.push(["getUser"]); return { data: { user }, error: userError }; },
    },
    from(table: string) {
      calls.push(["from", table]);
      return { select(columns: string) {
        calls.push(["select", columns]);
        return { eq(column: string, id: string) {
          calls.push(["eq", column, id]);
          return { async maybeSingle() { return { data: role ? { role } : null, error: profileError }; } };
        } };
      } };
    },
    async rpc(...args: unknown[]) { calls.push(["rpc", ...args]); return { data: rpcData, error: rpcError }; },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("provider entry sends customers to conversion and anonymous visitors to signup", () => {
  assert.equal(getProviderJoinPath("user"), "/become-provider");
  assert.equal(getProviderJoinPath(null), "/signup?role=provider");
  assert.equal(getProviderJoinPath("provider"), "/provider/dashboard");
  assert.equal(getProviderJoinPath("admin"), "/admin/dashboard");
});

test("conversion requires explicit confirmation before any account access", async () => {
  for (const confirmation of [null, undefined, "no", "", ["yes"]]) {
    const { client, calls } = clientFor();
    assert.ok((await requestProviderAccess(client, confirmation)).error);
    assert.deepEqual(calls, []);
  }
});

test("conversion verifies the session before trusting a profile or invoking the RPC", async () => {
  for (const options of [{ user: null }, { userError: { message: "Session revoked" } }]) {
    const { client, calls } = clientFor(options);
    assert.ok((await requestProviderAccess(client, "yes")).error);
    assert.deepEqual(calls, [["getUser"]]);
  }
});

test("unconfirmed and anonymous identities cannot request conversion", async () => {
  for (const user of [
    { id: "verified-caller", is_anonymous: false },
    { id: "verified-caller", email_confirmed_at: "2026-11-16T00:00:00Z", is_anonymous: true },
  ]) {
    const { client, calls } = clientFor({ user });
    assert.ok((await requestProviderAccess(client, "yes")).error);
    assert.deepEqual(calls, [["getUser"]]);
  }
});

test("administrator, missing, invalid, or unreadable profiles cannot invoke conversion", async () => {
  for (const options of [{ role: "admin" }, { role: null }, { role: "unsupported" }, { profileError: { message: "Read failed" } }]) {
    const { client, calls } = clientFor(options);
    assert.ok((await requestProviderAccess(client, "yes")).error);
    assert.ok(!calls.some(call => call[0] === "rpc"));
  }
});

test("conversion uses the verified caller profile and a zero-argument RPC", async () => {
  const { client, calls } = clientFor();
  assert.deepEqual(await requestProviderAccess(client, "yes"), { error: null });
  assert.deepEqual(calls, [
    ["getUser"], ["from", "profiles"], ["select", "role"],
    ["eq", "id", "verified-caller"], ["rpc", "become_provider"],
  ]);
});

test("a retried provider conversion still uses the guarded database operation", async () => {
  const { client, calls } = clientFor({ role: "provider" });
  assert.deepEqual(await requestProviderAccess(client, "yes"), { error: null });
  assert.deepEqual(calls.filter(call => call[0] === "rpc"), [["rpc", "become_provider"]]);
});

test("failed or unexpected RPC responses cannot be treated as successful conversion", async () => {
  for (const options of [
    { rpcError: { code: "PGRST202", message: "Internal function lookup details" } },
    { rpcError: { code: "42501", message: "Internal policy details" } },
    { rpcData: "admin" }, { rpcData: "user" }, { rpcData: null },
  ]) {
    const { client } = clientFor(options);
    assert.deepEqual(await requestProviderAccess(client, "yes"), { error: PROVIDER_CONVERSION_ERROR });
  }
});

test("network exceptions return safe retry feedback", async () => {
  const { client } = clientFor();
  client.auth.getUser = async () => { throw new Error("Internal network details"); };
  assert.deepEqual(await requestProviderAccess(client, "yes"), { error: PROVIDER_CONVERSION_ERROR });
});
