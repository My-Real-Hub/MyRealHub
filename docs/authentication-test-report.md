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
