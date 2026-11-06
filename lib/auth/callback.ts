import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { ensureAccountRole } from "./account";
import { getPostAuthRedirectPath, isPasswordRecoveryCallback } from "./redirects";

const emailTypes: EmailOtpType[] = [
  "email",
  "signup",
  "recovery",
  "invite",
  "email_change",
];

// Keep the callback workflow independent of Next's request context so both
// email verification mechanisms and their failure paths can be exercised.
export async function resolveAuthCallback(
  params: URLSearchParams,
  getClient: () => Promise<SupabaseClient>,
) {
  const failurePath = isPasswordRecoveryCallback(params)
    ? "/forgot-password?auth=recovery-expired"
    : "/login?auth=confirmation-expired";
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType;

  if (
    params.has("error") ||
    (!code && !tokenHash) ||
    (!code && !emailTypes.includes(type))
  ) {
    return failurePath;
  }

  try {
    const supabase = await getClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type });

    if (result.error || !result.data.user || !result.data.session) {
      return failurePath;
    }

    const redirectType =
      "redirectType" in result.data ? result.data.redirectType : null;
    if (isPasswordRecoveryCallback(params, redirectType)) {
      return "/reset-password";
    }

    try {
      const role = await ensureAccountRole(supabase, result.data.user.id);
      return getPostAuthRedirectPath(role, params.get("next"));
    } catch {
      return "/login?auth=profile-unavailable";
    }
  } catch {
    return failurePath;
  }
}
