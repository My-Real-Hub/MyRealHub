# Authentication investigation — 2026-10-11

Branch: `MYR-45-Login-System`. The live site at `https://myrealhub.ca` is running
older code; it does not yet include this branch or all changes from `develop`.

## Confirmed findings

- The live health endpoint succeeds and points to the same linked Supabase
  project used locally.
- The requested admin email already has a confirmed Supabase Auth account,
  but its application profile is missing. The supplied password was rejected
  by both local and live website login forms.
- The requested provider email has no Auth account yet. It must be registered
  through website signup.
- Supabase signup is enabled and email confirmation is required.
- The signup profile trigger is installed. There is one existing Auth account
  without an application profile.
- The old proxy redirected an authenticated account without a profile from
  `/login` to `/login` repeatedly.
- Password recovery had no callback or page for choosing the new password.

## Changes and checks

| Check | Result |
| --- | --- |
| Profile recovery migration | Applied; no accounts or profiles seeded |
| Recovery function permissions | Anonymous execution denied; authenticated execution allowed |
| Public admin role request | Database maps it to the customer role |
| Public provider role request | Database maps it to the provider role |
| Authentication regression tests | 9 passed |
| ESLint | Passed without warnings |
| TypeScript and production build | Passed on Next.js 16.4.0 |
| Empty login and provider signup forms | Required-field errors visible through browser UI |
| Logged-out dashboard, provider, admin, settings URLs | Redirect to login |
| Missing recovery session | Redirect to request a fresh recovery link |
| Invalid confirmation link | Login page offers a new confirmation email |
| Invalid recovery link | Recovery page offers a fresh reset email |
| External callback return destination | Rejected; redirect stays on the app |
| Callback caching and referrer headers | `private, no-store` and `no-referrer` |
| Local recovery email request | API accepted; delivery and link not yet verified |

Login now requires a valid application role, and recovery preserves existing
admin assignments. Signup and recovery request explicit email callback URLs.
Login and logout reload the application after a session change to discard
pages prefetched under the previous session.

## Remaining end-to-end verification

An updated Vercel deployment is needed before the live site can validate these
fixes. Its Supabase callback allowlist, email templates, and actual mailbox
delivery still need verification; API acceptance alone is not email delivery.

The account owner must complete the password-reset entry and submission. Then
verify the Gmail account's profile recovery, assign its authorized admin role,
and confirm the admin dashboard and session persistence. Register and confirm
the Hotmail provider through the website, then verify its dashboard, logout,
re-login, and rejection of admin access. Complete a password change and check
that the old password fails and the new password succeeds.

No personal account has been seeded, no admin role has been assigned, and no
personal password has been changed during this investigation. These steps are
pending, so the full login/recovery test is not yet complete.

Deployment and email-template instructions are in [authentication.md](authentication.md).

## Follow-up — 2026-10-15

The reported failing signup used the existing Gmail account on the current
live deployment. That Auth record was created and confirmed on 2026-05-28;
repeating signup does not update its password or request another confirmation
email. The application was incorrectly showing confirmation instructions for
Supabase's obfuscated existing-account response.

The signup form now distinguishes that response from a new account, offers
password reset, and rejects incomplete success responses. Confirmation resend
is available directly from login and after a new signup. Login, email rate
limits, and delivery errors now explain the appropriate next action.

A recovery request was submitted through the live website, accepted by the
API, and recorded in the account's `recovery_sent_at` on 2026-10-15. Inbox
delivery was confirmed by the account owner on 2026-10-15. Opening the link,
changing the password, and subsequent login remain unverified. Supabase
dashboard access is required to inspect the hosted SMTP settings; no browser dashboard session
was available. No email configuration or account credentials were changed.

All 12 auth regression tests, lint, TypeScript, and the production build pass.
The local browser also verified the new invalid-login guidance and directly
available confirmation-resend form. The new feedback changes need deployment.

The account owner confirmed receiving the recovery email, but reported that
the link opened the website without a reset form. No new authenticated
session was recorded after that click. This is consistent with an incomplete
PKCE exchange or a template/redirect pointing to the Site URL; the hosted
template has not been inspected, so its exact configuration is unverified.

The app now forwards authentication payloads arriving at the homepage to the
callback, honors the PKCE exchange's recovery metadata even if `next` is lost,
and handles a client `PASSWORD_RECOVERY` event by opening the reset form.
A direct token-hash recovery email template is prepared in
`supabase/templates/recovery.html`; it must be applied to the hosted Supabase
project after the app changes are deployed. Existing PKCE links still need
the browser where the reset was requested. Final password change and login
remain pending.

All 16 auth regression tests pass after the recovery-routing changes. The
production build, TypeScript, and targeted lint checks pass. HTTP probes
verify homepage recovery payloads redirect to the callback with no-store and
no-referrer headers. A browser check verifies an invalid homepage recovery
landing now shows a recovery message, rather than silently rendering home.
The existing live `/auth/confirm` endpoint also supports the prepared email
template; applying that hosted configuration is awaiting dashboard sign-in.

## Readiness audit — 2026-10-28

The earlier October investigation remains historical evidence, not proof that
the current hosted deployment or an account owner's password now works. This
audit did not receive account credentials and did not create hosted accounts,
send authentication mail, reset passwords, or change hosted Auth settings.

### Confirmed defects corrected in this audit

- An auth form submitted before React hydration could fall back to native
  `GET` submission. A local browser trace reproduced the synthetic test email
  and password appearing in the login URL. Every auth form now uses `POST`,
  disables submission until its client handler is ready, and explains the
  JavaScript requirement when scripting is disabled. This prevents ordinary
  pre-hydration submission from putting credentials in browser history and
  server query-string logs.
- Anonymous protected-page redirects discarded the original destination.
  Login now retains the protected path and query string.
- An already authenticated visitor opening a login link with a safe `next`
  destination was always sent to the dashboard. Allowed destinations are now
  honored, while auth loops and dashboards outside the account's capabilities
  fall back to that account's dashboard.
- The callback accepted an auth response containing a user without explicitly
  checking for a session. It now requires both. The real callback workflow is
  independently testable and keeps recovery independent of profile recovery,
  so a missing application profile cannot prevent password recovery.

### Coverage and verification boundary

The auth-focused Node tests passed: **36 tests** across `auth.test.ts`,
`auth-callback.test.ts`, `auth-forms.test.ts`, and `proxy.test.ts`. They cover
validation, duplicate signup, error guidance, safe redirects, profile recovery,
PKCE and token-hash verification, expiry/network errors, three role destinations,
the actual proxy with intercepted Supabase requests, and server-rendered form
submission safety. Targeted ESLint and the full TypeScript check passed.

`tests/e2e/auth-mocked.spec.ts` adds eight browser scenarios on desktop and
mobile, intercepting all browser Auth calls. It exercises invalid credentials,
unconfirmed login/resend, network failure, new and repeated signup, accepted
recovery, rate limiting, and disabled-JavaScript safety. These tests do not
establish a real Supabase session or prove mailbox delivery. The final browser
run and production-build results are recorded in the overall readiness report.

`tests/e2e/roles.spec.ts` provides optional, read-only staging checks for real
customer, provider, and administrator accounts. Each verifies successful login,
reload/session persistence, forbidden-role redirects, settings access, and
logout. Credentials are read from `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`,
`E2E_PROVIDER_EMAIL`/`E2E_PROVIDER_PASSWORD`, and
`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`. Set `E2E_BASE_URL` to the staging app.
Each role skips with an explicit reason if its credentials are missing. Traces
and video are disabled for these tests to avoid saving supplied credentials.
No messages, uploads, ratings, or profile changes are made by this suite.

### Remaining hosted and product work

1. Deploy the reviewed source and verify the hosted Supabase migrations,
   Site URL, and exact callback allowlist against that deployment. A local
   code fix or template file does not change the live application or dashboard.
2. Inspect hosted Auth SMTP and apply the prepared recovery template, then
   complete signup/confirmation and password-reset mailbox journeys on test
   accounts, including a reused/expired link, a link opened in another browser,
   a successful new-password login, and rejection of the previous password.
   The application's inquiry `SMTP_*` configuration is separate from Auth SMTP.
3. Run the optional real-account role suite for all three roles, then verify
   session refresh/expiry and revoked-session handling on the deployed app.
   Missing test credentials mean these integrations remain unverified.
4. Review hosted abuse controls before public signup. The application currently
   has no CAPTCHA widget or token integration. The local Supabase config has
   Auth rate limits, but its CAPTCHA block is commented out, email confirmation
   is disabled locally, and its password minimum is six versus the UI's eight.
   These local values do not describe the hosted settings. Configure appropriate
   hosted limits and a matching server-enforced password policy; if CAPTCHA is
   enabled, implement the matching signup/recovery/resend token flow first.
   Test that rate limits produce the intended UI guidance.
5. Review administrator MFA and password-change reauthentication for public
   launch. This app has no MFA/nonce UI, and the reset page permits any verified
   signed-in session to choose a password. Stronger hosted policies require
   their corresponding client flows and staging tests.
6. Implement or remove the customer-facing **Join as Provider** action. Its
   current `/signup?role=provider` link redirects an already signed-in customer
   back to their dashboard. No trusted customer-to-provider transition exists;
   changing user metadata or weakening profile role grants is not a safe fix.
7. Complete verified email-change synchronization. Saving settings must not
   copy a pending email into the account profile. After hosted confirmation
   actually changes `auth.users.email`, the app still needs a reliable trusted
   sync to `profiles.email` and an integration test of both confirmation steps.

Accepted recovery and resend responses use conditional messages rather than
confirming whether an email has an account. Login groups unknown-email and
incorrect-password failures. Duplicate signup is described as an account that
*may* exist; no email delivery is claimed for the obfuscated response. These
messages do not replace server-side rate limits and abuse controls.

### Final coordinated browser verification — October 28

All 16 mocked-auth/no-JavaScript browser cases passed across desktop and mobile
Chromium against the final production build. Authentication callback and legacy
homepage landing headers also passed the final HTTP checks. Six real-account
role cases were explicitly skipped because no dedicated credentials were set.
No hosted account or mailbox outcome is inferred from the mocked responses.
The complete run and remaining release gates are recorded in
[the production readiness plan](production-readiness-plan.md).
