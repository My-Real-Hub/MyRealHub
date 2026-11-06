import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const authHeaders = [{ key: "Referrer-Policy", value: "no-referrer" }];
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ],
    },
    { source: "/auth/:path*", headers: authHeaders },
    ...["/login", "/signup", "/forgot-password", "/reset-password"].map((source) => ({ source, headers: authHeaders })),
    ...["code", "token_hash", "error", "access_token"].map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key }],
      headers: authHeaders,
    })),
    ];
  },
};

export default nextConfig;
