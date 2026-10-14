import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ensureAccountRole } from "@/lib/auth/account";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { getServerSupabaseClient } from "@/lib/supabase/server";

const emailTypes: EmailOtpType[] = [
  "email",
  "signup",
  "recovery",
  "invite",
  "email_change",
];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = getSafeRedirectPath(params.get("next"));
  const isRecovery =
    next === "/reset-password" || params.get("type") === "recovery";

  function redirect(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const failurePath = isRecovery
    ? "/forgot-password?auth=recovery-expired"
    : "/login?auth=confirmation-expired";

  try {
    const supabase = await getServerSupabaseClient();
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as EmailOtpType;
    if (params.has("error") || (!code && !tokenHash))
      return redirect(failurePath);

    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : emailTypes.includes(type)
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash!, type })
        : null;

    if (!result || result.error || !result.data.user)
      return redirect(failurePath);
    if (isRecovery) return redirect("/reset-password");

    try {
      const role = await ensureAccountRole(supabase, result.data.user.id);
      return redirect(next ?? getDashboardPathForRole(role));
    } catch {
      return redirect("/login?auth=profile-unavailable");
    }
  } catch {
    return redirect(failurePath);
  }
}
