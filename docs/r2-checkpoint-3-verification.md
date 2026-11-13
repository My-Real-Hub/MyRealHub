# R2 checkpoint 3: signup, confirmation, and resend

Status: in progress; fresh owner-controlled test email selected, awaiting signup
through the application.

## Preflight

On November 11, 2026 (America/Toronto), the linked MyRealHub project's public
Auth settings endpoint returned HTTP 200 and confirmed email signup is enabled,
signup is not disabled, and email confirmation is required. Evidence is stored
in `audit-artifacts/r2/checkpoint3/public-auth-preflight-result.json`.

The source signup and resend forms use the current browser origin's
`/auth/callback` URL. Signup sends the customer/provider choice as metadata; the
reviewed database trigger limits that choice to non-administrator roles. The
callback requires both a verified user and an established session before loading
the application profile and selecting a permitted destination.

This public-settings read does not verify the hosted redirect allowlist, Site
URL, SMTP configuration, or mailbox delivery. No hosted Auth setting was changed,
no account was created, and no email was sent by this preflight.

The owner supplied a Hotmail test address (`ja***@hotmail.com` in this report).
A read-only hosted check found zero matching Auth accounts and zero matching
application profiles before signup. Evidence is stored in
`audit-artifacts/r2/checkpoint3/test-address-preflight-result.json`.

## Required mailbox checks

Using the website and a fresh email address controlled by the owner:

1. Register and verify that the Auth account and correct application profile
   exist, with email confirmation still pending.
2. Verify login is denied before confirmation.
3. Request confirmation resend after the service allows another request, and
   confirm the second message actually reaches the mailbox.
4. Open the newest verification link in the originating browser context, verify
   confirmation and the appropriate dashboard, and confirm stored account state.
5. Check a reused confirmation link produces safe, understandable behavior.

Browser checks will continue manually, as selected by the owner. Passwords and
confirmation links must stay out of reports. An accepted API request alone does
not prove mailbox delivery or successful confirmation.

References: [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls),
[PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), and
[Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
