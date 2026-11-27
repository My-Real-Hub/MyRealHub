# Authentication setup and verification

Supabase Auth stores credentials in `auth.users`. The application reads role,
name, and account details from `public.profiles`. A successful authentication
request alone does not prove that the application profile is available.

## What happens when someone signs up

1. The website sends the name, email, password, and customer/provider choice
   to Supabase Auth over HTTPS. Passwords are hashed by Supabase and are not
   stored in the application profile or readable as plain text.
2. For a new email, Supabase creates the Auth account and the database trigger
   creates `public.profiles` with the same user ID. A provider's public listing
   is separate from its login account and is completed through onboarding.
3. Supabase Auth sends a confirmation link through its configured email
   service. The callback verifies the link and establishes a session; the
   application then loads the profile and selects the correct dashboard.
4. Login checks the original password and email confirmation, then uses the
   profile's role to decide which pages the account can access.

Registering an already confirmed email again does not change that account's
password or send a new confirmation email. Supabase may return an obfuscated
user with an empty `identities` array to avoid disclosing existing accounts.
The signup form treats that response as a possible existing account and
offers login/password reset, rather than saying a confirmation was sent.
Missing or incomplete signup data is an error, not a successful registration.

For an existing account with a forgotten password, use **Forgot password**.
Confirmation resend only applies to accounts that still need confirmation;
it cannot reset the password of an already confirmed account. Both signup
and login expose the appropriate recovery options. An accepted email request
does not prove delivery to the inbox.

## Deployment configuration

1. Set the Vercel build variables `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the intended Supabase project.
2. Apply migrations with `npx supabase db push --dry-run`, review them, then run
   `npx supabase db push`. Do **not** include `--include-seed` on the live project.
3. In Supabase Authentication > URL Configuration, set the production Site URL
   to `https://myrealhub.ca` and allow `https://myrealhub.ca/auth/callback`.
   Allow the exact callback URL for any preview deployment used for testing.
   Local testing needs `http://localhost:3000/auth/callback` (or the port used).
   These cloud settings are separate from `supabase/config.toml`.
4. Keep email confirmation enabled for production. Configure Supabase Auth's
   custom SMTP provider for signup and recovery emails. The application's
   `SMTP_*` environment variables send inquiry notifications and do not
   configure Supabase Auth email delivery.
5. Standard Supabase email templates should use `{{ .ConfirmationURL }}` so
   the requested callback URL is preserved. PKCE confirmation links must be
   opened in the browser where signup or recovery was requested.
6. For confirmation across browsers or devices, use token-hash email templates
   pointing to `/auth/confirm`. Example signup link:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
   Example recovery link:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
   Never put email tokens or passwords in logs, issues, or test reports.

For production password resets, the ready-to-use template is
`supabase/templates/recovery.html`. After deploying the `/auth/confirm` route,
copy this file into Supabase Authentication > Emails > Reset password. Set
the Site URL to `https://myrealhub.ca` without a trailing slash. This template
links directly to the verified recovery callback and works across browsers,
without relying on a PKCE verifier from the browser that requested the email.
Adding the template file to Git does not change the hosted Supabase template.

Email codes or token hashes arriving at the homepage, login, or signup now
forward to `/auth/callback`. The callback recognizes Supabase's recovery
metadata even when the original redirect lost its `next` parameter. A client
`PASSWORD_RECOVERY` event also opens the reset form once a valid session has
been established. No password form is unlocked without a verified session.

See the official [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls),
[server-side authentication guide](https://supabase.com/docs/guides/auth/server-side/nextjs),
and [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Profile recovery and roles

The signup trigger creates the application profile. If an older verified
account has lost its profile, login calls `ensure_current_user_profile()`.
The function accepts no account ID or desired role, uses `auth.uid()`, and
recovers only the caller's verified account. Existing profiles and admin roles
are preserved. A failed profile read or recovery displays an error instead of
reporting successful login or redirecting repeatedly.

Public signup allows customers and providers. Admin access requires a trusted
administrator assignment after the account has been registered through the
website. User-editable metadata cannot request the admin role.

## Verification

Run `npm run test:auth`, `npm run lint`, `npm run typecheck`, and `npm run build`.
Automated checks cover safe return destinations, password validation, public
role restrictions, and profile recovery behavior. They do not prove email
delivery or successful password changes against the live deployment.

For each deployed test account, complete the following through the website:

- Submit invalid and empty forms; verify clear errors without navigation.
- Register a new account, confirm its email, and verify both its Auth record
  and application profile. Check the role-specific dashboard.
- Log out, reload a protected URL, and confirm that login is required.
- Log in again, refresh the dashboard, and verify session persistence.
- Request a password reset, open the email link, and save a new password.
- Confirm that the new password works and the previous password is rejected.
- Open an invalid or reused email link; verify a helpful recovery message.
- Verify that a customer or provider cannot enter the admin dashboard.

Do not mark recovery fully tested until the mailbox link and password change
have been completed. Account creation must use the website, never Auth seeding.
