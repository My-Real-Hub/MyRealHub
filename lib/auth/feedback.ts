export const EXISTING_ACCOUNT_MESSAGE =
  "An account may already exist for this email. Signing up again does not change its password. Log in with your existing password, or use Reset password below.";

export function getPendingSignUpState(
  user: { id: string; identities?: readonly unknown[] } | null,
) {
  if (!user?.id) return "incomplete";
  // Supabase deliberately returns an obfuscated user with no identities when
  // a confirmed account signs up again. It does not send another email.
  if (user.identities?.length === 0) return "account-may-exist";
  return "confirmation-required";
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;

  switch (code) {
    case "invalid_credentials":
      return "Email or password not recognized. If you already registered, use Forgot password to choose a new password.";
    case "email_not_confirmed":
      return "Confirm your email before logging in. Use Resend confirmation email below if you need another link.";
    case "user_already_exists":
      return EXISTING_ACCOUNT_MESSAGE;
    case "email_address_not_authorized":
      return "This website cannot currently send account emails to this address. Please contact support.";
    case "over_email_send_rate_limit":
      return "Too many email requests. Please wait before requesting another email.";
    case "over_request_rate_limit":
      return "Too many attempts. Please wait before trying again.";
  }

  if (error instanceof Error) {
    if (
      /error sending (?:confirmation|recovery|magic ?link|email)/i.test(
        error.message,
      )
    ) {
      return "Your account email could not be sent. Please try again later or contact support.";
    }
    return error.message;
  }
  return fallback;
}
