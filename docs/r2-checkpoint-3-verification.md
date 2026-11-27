# R2 checkpoint 3: signup, confirmation, and resend

Status: partially complete; customer signup, confirmed database state, mailbox
delivery, and confirmation-link dashboard access passed. Unconfirmed-login denial,
resend, and reused-link behavior remain unverified. The owner explicitly deferred
resend testing until provider signup and requested proceeding to password recovery.

After provider signup passed and another fresh-address attempt hit an email rate
limit, the owner explicitly requested moving on and returning later. The pending
email checks remain open; R2 is not marked fully complete. Work proceeds to R3.

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

## Signup result — November 16, 2026

The owner reported that signup as a customer works. A subsequent read-only
hosted query verified exactly one matching Auth account, a matching application
profile with role `user`, and a confirmed email address. The account is neither
deleted nor banned. No password, token, or confirmation link was retrieved.
Evidence: `audit-artifacts/r2/checkpoint3/signup-state-verification-result.json`.

After being asked whether the confirmation email arrived and its link opened the
customer dashboard, the owner replied, "Yes everything worked." Mailbox delivery
and the confirmation callback/dashboard journey are therefore recorded as
manually passed. These are owner-confirmed browser results, not automated tests.

This account is already confirmed, so it cannot now demonstrate login denial
before confirmation or resend delivery to an unconfirmed account. Those checks
and reused-link behavior remain pending explicit confirmation or further testing.

## Provider signup result — November 16, 2026

The owner selected a separate unused Hotmail address (`ja***24@hotmail.com` in
this report). The initial hosted query found zero matching Auth accounts. The
owner subsequently reported creating the provider account and successfully
logging in. A read-only query verified exactly one Auth account, confirmed email,
and a matching application profile with role `provider`. Evidence:
`audit-artifacts/r2/checkpoint3/provider-signup-after-registration.json`.

The owner explicitly confirmed using the confirmation email before successfully
logging in. The normal provider signup/confirmation/login journey is therefore
manually passed, alongside the database verification of the provider role.
Successful login with an already-confirmed account does not prove
unconfirmed-login denial or confirmation-resend delivery; those checks remain
unverified. Reused confirmation-link behavior also remains unverified.

## Remaining mailbox checks

### Email rate-limit interruption — November 16, 2026

The owner attempted another fresh test address (`we***@hotmail.com` in this
report) and received a too-many-email-requests notice. A read-only hosted check
found zero matching Auth accounts afterward. Evidence:
`audit-artifacts/r2/checkpoint3/resend-test-rate-limit-state.json`.

No automatic retry or additional email request was made by the assistant. The
hosted SMTP configuration and exact project email quota have not been inspected,
so a project-wide quota versus recipient cooldown is not yet established. The
resend acceptance check remains incomplete, not failed as an application defect.

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
