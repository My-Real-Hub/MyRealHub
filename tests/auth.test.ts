import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_PROFILE_ERROR, ensureAccountRole } from "../lib/auth/account";
import {
  getAuthCallbackUrl,
  getSafeRedirectPath,
  getFallbackAuthCallbackPath,
  isPasswordRecoveryCallback,
  getLoginRedirectPath,
  getPostAuthRedirectPath,
} from "../lib/auth/redirects";
import {
  EXISTING_ACCOUNT_MESSAGE,
  getAuthErrorMessage,
  getPendingSignUpState,
} from "../lib/auth/feedback";
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

test("repeat signup's obfuscated response is not treated as a new confirmation email", () => {
  assert.equal(
    getPendingSignUpState({ id: "obfuscated-account", identities: [] }),
    "account-may-exist",
  );
  assert.equal(
    getAuthErrorMessage({ code: "user_already_exists" }, "failed"),
    EXISTING_ACCOUNT_MESSAGE,
  );
});

test("only an actual signup response can enter the confirmation flow", () => {
  assert.equal(getPendingSignUpState(null), "incomplete");
  assert.equal(getPendingSignUpState({ id: "", identities: [] }), "incomplete");
  assert.equal(
    getPendingSignUpState({ id: "new-account", identities: [{}] }),
    "confirmation-required",
  );
});

test("login and email delivery errors offer the appropriate recovery path", () => {
  assert.match(
    getAuthErrorMessage({ code: "invalid_credentials" }, "failed"),
    /Forgot password/,
  );
  assert.match(
    getAuthErrorMessage({ code: "email_not_confirmed" }, "failed"),
    /Resend confirmation/,
  );
  assert.match(
    getAuthErrorMessage({ code: "email_address_not_authorized" }, "failed"),
    /cannot currently send/,
  );
  assert.match(
    getAuthErrorMessage({ code: "over_email_send_rate_limit" }, "failed"),
    /wait/,
  );
  assert.match(
    getAuthErrorMessage(new Error("Error sending recovery email"), "failed"),
    /could not be sent/,
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

test("an email code landing on the homepage reaches the auth callback instead of the homepage", () => {
  const params = new URLSearchParams({
    code: "example-code",
    next: "/reset-password",
    tracking: "unused",
  });
  const destination = new URL(
    getFallbackAuthCallbackPath("/", params)!,
    "https://myrealhub.ca",
  );
  assert.equal(destination.pathname, "/auth/callback");
  assert.equal(destination.searchParams.get("code"), "example-code");
  assert.equal(destination.searchParams.get("next"), "/reset-password");
  assert.equal(destination.searchParams.has("tracking"), false);
  assert.equal(getFallbackAuthCallbackPath("/auth/callback", params), null);
  assert.equal(getFallbackAuthCallbackPath("/search", params), null);
  assert.equal(
    getFallbackAuthCallbackPath("/", new URLSearchParams({ q: "plumber" })),
    null,
  );
});

test("legacy token-hash links keep their recovery type when forwarded from the site URL", () => {
  const params = new URLSearchParams({
    token_hash: "example-token-hash",
    type: "recovery",
  });
  const path = getFallbackAuthCallbackPath("/login", params)!;
  const forwarded = new URL(path, "https://myrealhub.ca").searchParams;
  assert.equal(forwarded.get("token_hash"), "example-token-hash");
  assert.equal(isPasswordRecoveryCallback(forwarded), true);
});

test("PKCE recovery metadata still selects the password form when the redirect lost next and type", () => {
  const params = new URLSearchParams({ code: "example-code" });
  assert.equal(isPasswordRecoveryCallback(params, "recovery"), true);
  assert.equal(isPasswordRecoveryCallback(params, null), false);
  assert.equal(
    isPasswordRecoveryCallback(
      new URLSearchParams({ next: "/reset-password" }),
    ),
    true,
  );
  assert.equal(
    isPasswordRecoveryCallback(
      new URLSearchParams({ next: "https://other.example/reset-password" }),
    ),
    false,
  );
});

test("the hosted recovery template links to verification with an explicit recovery type", () => {
  const template = readFileSync("supabase/templates/recovery.html", "utf8");
  const href = template.match(/href="([^"]+)"/)?.[1];
  assert.ok(href);
  const url = new URL(
    href
      .replace("{{ .SiteURL }}", "https://myrealhub.ca")
      .replace("{{ .TokenHash }}", "example-hash")
      .replaceAll("&amp;", "&"),
  );
  assert.equal(url.origin, "https://myrealhub.ca");
  assert.equal(url.pathname, "/auth/confirm");
  assert.equal(url.searchParams.get("type"), "recovery");
  assert.equal(url.searchParams.get("token_hash"), "example-hash");
});

test("public signup cannot request admin access and role destinations remain distinct", () => {
  assert.equal(getSignUpRole("admin"), "user");
  assert.equal(getSignUpRole("provider"), "provider");
  assert.equal(hasProfileCapability("user", "administer_platform"), false);
  assert.equal(hasProfileCapability("provider", "administer_platform"), false);
  assert.equal(getDashboardPathForRole("admin"), "/admin/dashboard");
  assert.equal(getDashboardPathForRole("provider"), "/provider/dashboard");
});

test("protected destinations and their query strings survive the trip through login", () => {
  const destination = new URL(
    getLoginRedirectPath("/dashboard/saved?sort=recent"),
    "https://myrealhub.ca",
  );
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("next"), "/dashboard/saved?sort=recent");
  assert.equal(getLoginRedirectPath("//other.example"), "/login");
  assert.equal(getLoginRedirectPath(null), "/login");
});

test("authenticated return destinations respect capabilities and cannot redirect back to login", () => {
  assert.equal(getPostAuthRedirectPath("user", "/admin/dashboard"), "/dashboard");
  assert.equal(getPostAuthRedirectPath("user", "/provider/dashboard"), "/dashboard");
  assert.equal(getPostAuthRedirectPath("provider", "/dashboard/saved"), "/dashboard/saved");
  assert.equal(getPostAuthRedirectPath("admin", "/settings"), "/admin/dashboard");
  assert.equal(getPostAuthRedirectPath("provider", "/login?next=/login"), "/provider/dashboard");
  assert.equal(getPostAuthRedirectPath("provider", "/signup/provider"), "/provider/dashboard");
  assert.equal(getPostAuthRedirectPath("user", "//other.example"), "/dashboard");
  assert.equal(getPostAuthRedirectPath("user", "/providers/jane?contact=1#contact"), "/providers/jane?contact=1#contact");
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
