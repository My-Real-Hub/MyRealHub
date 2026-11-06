import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getDashboardPathForRole,
  getProfileRoleForUser,
  getRequiredCapabilityForPath,
  hasProfileCapability,
} from "@/lib/auth/roles";
import { getSupabaseConfig } from "@/lib/supabase/client";
import {
  getFallbackAuthCallbackPath,
  getLoginRedirectPath,
  getPostAuthRedirectPath,
} from "@/lib/auth/redirects";

const AUTH_ROUTES = ["/login", "/signup"];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  const fallbackCallback =
    request.method === "GET"
      ? getFallbackAuthCallbackPath(
          request.nextUrl.pathname,
          request.nextUrl.searchParams,
        )
      : null;
  if (fallbackCallback) {
    const response = NextResponse.redirect(
      new URL(fallbackCallback, request.url),
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const config = getSupabaseConfig();
  const requiredCapability = getRequiredCapabilityForPath(
    request.nextUrl.pathname,
  );
  const shouldRedirectSignedInUser = isAuthRoute(request.nextUrl.pathname);
  const loginPath = getLoginRedirectPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  if (!config) {
    if (requiredCapability) {
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    return NextResponse.next();
  }

  let pendingCookies: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];
  let pendingHeaders: Record<string, string> = {};

  function applyPendingSession(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    Object.entries(pendingHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  function redirectTo(pathname: string) {
    return applyPendingSession(
      NextResponse.redirect(new URL(pathname, request.url)),
    );
  }

  const supabase = createServerClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          pendingCookies = cookiesToSet;
          pendingHeaders = headers;

          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    if (requiredCapability) {
      return redirectTo(loginPath);
    }

    return applyPendingSession(NextResponse.next({ request }));
  }

  if (!requiredCapability && !shouldRedirectSignedInUser) {
    return applyPendingSession(NextResponse.next({ request }));
  }

  const role = await getProfileRoleForUser(supabase, userId);

  if (!role) {
    if (shouldRedirectSignedInUser) {
      return applyPendingSession(NextResponse.next({ request }));
    }
    return redirectTo("/login?auth=profile-unavailable");
  }

  const dashboardPath = getDashboardPathForRole(role);

  if (shouldRedirectSignedInUser) {
    return redirectTo(
      getPostAuthRedirectPath(role, request.nextUrl.searchParams.get("next")),
    );
  }

  if (requiredCapability && !hasProfileCapability(role, requiredCapability)) {
    return redirectTo(dashboardPath);
  }

  return applyPendingSession(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
