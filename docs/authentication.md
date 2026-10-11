# Authentication setup and verification

Supabase Auth stores credentials in `auth.users`. The application reads role,
name, and account details from `public.profiles`. A successful authentication
request alone does not prove that the application profile is available.

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
