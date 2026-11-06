import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "../proxy";

async function withTestSupabase(run: () => Promise<void>, configured = true) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = configured ? "https://test-project.supabase.co" : "";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = configured ? "test-anon-key" : "";
  try {
    await run();
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
}

function redirectUrl(response: Response) {
  assert.equal(response.status, 307);
  return new URL(response.headers.get("location")!);
}

test("proxy matches protected and auth routes while excluding API and static assets", () => {
  for (const url of ["/dashboard", "/provider/dashboard", "/admin/dashboard", "/settings", "/auth/callback", "/login"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, url);
  }
  for (const url of ["/api/supabase/health", "/api/location/resolve", "/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/images/landing-hero.png"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false, url);
  }
});

test("all protected namespaces redirect anonymous requests to login with their original destination", async () => {
  await withTestSupabase(async () => {
    for (const path of ["/dashboard/saved?sort=recent", "/provider/dashboard", "/admin/dashboard/providers/123", "/settings?tab=account"]) {
      const destination = redirectUrl(await proxy(new NextRequest(`https://myrealhub.ca${path}`)));
      assert.equal(destination.origin, "https://myrealhub.ca");
      assert.equal(destination.pathname, "/login");
      assert.equal(destination.searchParams.get("next"), path);
    }
  });
});

test("public and similarly named unprotected routes remain available without a session", async () => {
  await withTestSupabase(async () => {
    for (const path of ["/", "/search", "/providers/jane", "/provider-directory", "/dashboard-news", "/login", "/signup"]) {
      const response = await proxy(new NextRequest(`https://myrealhub.ca${path}`));
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-middleware-next"), "1", path);
    }
  });
});

test("missing configuration fails closed for protected routes and permits public pages", async () => {
  await withTestSupabase(async () => {
    const destination = redirectUrl(await proxy(new NextRequest("https://myrealhub.ca/admin/dashboard")));
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("next"), "/admin/dashboard");
    assert.equal((await proxy(new NextRequest("https://myrealhub.ca/"))).status, 200);
  }, false);
});

test("legacy homepage callbacks forward only auth parameters and prevent token caching and referrer leakage", async () => {
  const response = await proxy(new NextRequest("https://myrealhub.ca/?token_hash=test-hash&type=recovery&next=%2Freset-password&unrelated=secret"));
  const destination = redirectUrl(response);
  assert.equal(destination.pathname, "/auth/callback");
  assert.equal(destination.searchParams.get("token_hash"), "test-hash");
  assert.equal(destination.searchParams.get("type"), "recovery");
  assert.equal(destination.searchParams.get("next"), "/reset-password");
  assert.equal(destination.searchParams.has("unrelated"), false);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

function signedInRequest(path: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "test-account", exp: expiresAt, role: "authenticated" })}.test-signature`;
  const session = {
    access_token: token,
    refresh_token: "test-refresh-token",
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "test-account" },
  };
  return new NextRequest(`https://myrealhub.ca${path}`, {
    headers: { cookie: `sb-test-project-auth-token=base64-${encode(session)}` },
  });
}

async function withVerifiedRole(role: string | null, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, "https://test-project.supabase.co");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "test-account", aud: "authenticated", role: "authenticated" });
    if (url.pathname === "/rest/v1/profiles") {
      assert.equal(url.searchParams.get("id"), "eq.test-account");
      return Response.json(role ? [{ role }] : []);
    }
    throw new Error(`Unexpected test request: ${url.pathname}`);
  };
  try {
    await withTestSupabase(run);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("signed-in customers are denied admin and provider pages, while providers retain consumer access", async () => {
  await withVerifiedRole("user", async () => {
    for (const path of ["/admin/dashboard", "/provider/dashboard"]) {
      assert.equal(redirectUrl(await proxy(signedInRequest(path))).pathname, "/dashboard");
    }
  });
  await withVerifiedRole("provider", async () => {
    assert.equal((await proxy(signedInRequest("/dashboard/saved"))).status, 200);
    assert.equal((await proxy(signedInRequest("/provider/dashboard"))).status, 200);
  });
});

test("authenticated login links honor permitted return destinations instead of dropping them", async () => {
  await withVerifiedRole("user", async () => {
    assert.equal(redirectUrl(await proxy(signedInRequest("/login?next=%2Fproviders%2Fjane"))).pathname, "/providers/jane");
    assert.equal(redirectUrl(await proxy(signedInRequest("/login?next=%2Fadmin%2Fdashboard"))).pathname, "/dashboard");
    assert.equal(redirectUrl(await proxy(signedInRequest("/login?next=%2Flogin"))).pathname, "/dashboard");
  });
});

test("a verified session with a missing account profile can finish login without a proxy loop", async () => {
  await withVerifiedRole(null, async () => {
    assert.equal((await proxy(signedInRequest("/login"))).status, 200);
    const destination = redirectUrl(await proxy(signedInRequest("/dashboard")));
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("auth"), "profile-unavailable");
  });
});
