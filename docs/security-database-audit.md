# Database, security, and operations audit

Audit date: October 28, 2026. Target: a private demo and then a public release by early January 2027.

This report reviews the repository and local configuration. It does **not** certify the deployed Supabase project: hosted migrations, Auth settings, storage policies, backups, and access logs were not inspected through an administrative connection. No hosted records were changed and no real email was sent.

## Architecture decision

Keep one repository. The app already has a backend: Next.js Server Actions and route handlers, Supabase Auth/Postgres/Storage, and server-only email delivery. Those are suitable boundaries for a directory of this size. A separate API service would add deployment and authentication work without resolving the defects below. Separate a worker or API later when background delivery, another client, or measured load requires it.

## Verified findings and disposition

| Priority | Finding | Evidence and impact | Disposition |
| --- | --- | --- | --- |
| P0 before public access | Administrative database functions allowed an authenticated identity with no `public.profiles` row to pass their role check. | Five latest `SECURITY DEFINER` RPCs compared a nullable role using `<> 'admin'`. A missing row leaves the variable NULL, so PL/pgSQL skips the rejection. Calling REST RPCs directly bypasses the application's page/action checks. The affected operations include feedback data with reporter email/internal notes, rating reviewer emails, moderation, and platform counts. | Repaired in new forward migration `20261028120000_fail_closed_rpc_role_checks.sql` using `IS DISTINCT FROM`. Also repaired the analogous missing-profile checks in rating creation/removal. **Pending database application and runtime SQL verification.** |
| P0 before public access | Development seed data creates a known-password administrator and resets fixture passwords when rerun. | `supabase/seed.sql` creates 15 test identities, including an administrator. At audit start, `db:push`, setup instructions, and the setup script used `--include-seed` against the linked project. | Fixed the deployment command, setup script, and instructions to push migrations without seeds. Existing hosted demo accounts must still be audited and removed or secured; changing scripts does not undo earlier seeding. |
| P1 before testing email features | Provider email relay and notification delivery are not configured locally. | An environment-name-only check found no `SUPABASE_SERVICE_ROLE_KEY`, SMTP host/from/credentials, `APP_BASE_URL`, or `NEXT_PUBLIC_SITE_URL`. `app/providers/contact-actions.ts` needs the server key to load private notification destinations; `lib/email/delivery.ts` rejects missing SMTP configuration. Links otherwise default to localhost. | Configure staging SMTP and a sender domain, set the deployed base URL, then verify deliverability and failure handling using dedicated test inboxes. Supabase Auth email configuration is separate and also needs verification. |
| P1 before public access | Inquiry, messaging, feedback, upload, and geocoding operations lack durable abuse limits. | No application limiter is present in the reviewed actions or `app/api/location/resolve/route.ts`; authenticated direct Supabase calls can also write through RLS/RPCs. Auth rate limits in the local Supabase config cover Auth endpoints, not these business writes. Each accepted inquiry can produce an outbound email. | Enforce account/provider quotas and short-window limits in a shared store or database, including direct RPC/table paths. Add geocoder limits/caching and provider-level email caps. Test with at least two app processes so an in-memory limiter cannot appear sufficient. |
| P1 before relying on delivery records | Conversation participants can forge email delivery state. | `record_contact_request_email_delivery` is a `SECURITY DEFINER` RPC executable by `authenticated`; sender or provider ownership is sufficient to set `sent`, `failed`, or `not_requested`. No SMTP delivery evidence is required. | Move delivery status transitions to a trusted server/worker identity and validate allowed transitions. Keep user-facing retry requests separate from delivery acknowledgements. |
| P1 before public access | Production database protections are not yet proven. | There is no checked execution record for migration replay, database RLS tests, restore drills, or a staging-to-production rollout. `supabase/config.toml` is a local development configuration; it is not evidence of hosted settings. | Replay all migrations in a disposable Supabase instance, run the SQL suite, compare hosted migration history, verify backup/restore, then apply reviewed migrations to staging before production. |
| P1 before public access | Product privacy and data lifecycle workflows need completion. | Accounts, messages, inquiry contact details, feedback, and screenshots hold personal data. No account deletion/export UI or documented retention/erasure procedure was found during this review. | Define retention, support-assisted deletion/export, handling of message/feedback snapshots, and screenshot cleanup. Publish the appropriate product privacy/terms information and obtain suitable review before collecting public user data. |
| P2, partial fix | Confirmed email changes can leave the app profile/listing email stale. | At audit start, `saveAccountSettings` wrote the requested address publicly before Auth confirmation. It now preserves the confirmed Auth address. However, the callback/account recovery logic does not synchronize an existing profile after the email change completes. | Premature publication is fixed. Add a trusted synchronization path when `auth.users.email` actually changes, then test pending, confirmed, rejected, and expired changes. Decide separately whether providers may publish a contact address distinct from login identity. |
| P2 | Shared account settings bypass listing reapproval for some public fields. | The `sync_provider_profile_account_fields` trigger runs as definer and updates name, bio, phone, email, and image even for active listings. This differs from provider editing, which moves the listing to pending approval. | Document which fields require moderation and make both update paths enforce the same product rule. |
| P2 | Database listing creation checks ownership and status but does not require provider role. | `provider_profiles_insert_own` permits an authenticated consumer to create their own draft/pending listing directly through Supabase. The app itself requires the provider role, and communication preferences require it at the database level. | Add a provider-role condition to listing write policies or define a supported consumer-to-provider conversion flow. Add a direct API regression test. |
| P2, fixed locally | The location endpoint's request-size check trusted the client header. | At audit start, missing or understated `Content-Length` bypassed the intended 2 KiB application limit. | The route now reads a bounded body through `readLimitedJson` and validates short queries before database lookups. Retain the HTTP regression tests and verify the deployed gateway limit. |
| P2 | Email delivery is synchronous and has no durable retry queue. | Inquiry creation, SMTP sending, and delivery status updates are separate operations in one request. A disconnect/process failure after insert or send can leave pending records or encourage duplicate submissions. | Add idempotency keys and a database outbox/worker before promising dependable email delivery. An in-app-only private demo can use the current path with that limitation disclosed. |
| P2 | Operational error handling and observability are incomplete. | Errors are largely returned as generic form messages or `console.error`; no centralized error/uptime alerting, structured delivery dashboard, or deployment incident procedure was found. | Add redacted structured logs, error monitoring, database/auth availability checks, email failure alerts, and a short rollback/runbook. Verify no auth tokens or personal message contents enter logs. |
| P2, baseline added | Production browser security headers require deployment verification. | `next.config.ts` was empty at audit start; only the auth callback explicitly applied a referrer policy. Host-provided headers were not measured. | Added framing denial, content-type protection, referrer/permissions policies, and a baseline CSP. Verify HTTPS and the actual deployed headers; evaluate a fuller script/resource CSP with Next.js and map assets before broad public traffic. |

P0 means block public access until resolved. P1 items block the corresponding public workflow or production acceptance. P2 items should have an explicit owner and acceptance decision; several can be implemented during staging hardening.

## Controls already present in source

- New-account role selection accepts only consumer/provider; signup metadata cannot assign administrator. Profile update column grants exclude `role` and `id`.
- Admin Server Actions perform their own role checks. Provider updates verify provider identity/ownership rather than relying solely on navigation hiding.
- Profiles, providers and join tables, lookups, saved providers, inquiries, messages, ratings, service regions, notification preferences, and feedback have RLS enabled in migrations.
- Public provider selection is limited to active rows. Draft/pending listings are visible to their owner and administrators.
- Saved-provider policies isolate account ownership and require an active provider at insertion.
- Inquiries require an authenticated sender, an eligible consumer/provider role, an active accepting provider, and prohibit contacting one's own listing. Conversation RPCs check participation and reject writes to archived conversations.
- Message preview views use `security_invoker = true`; private message selection checks sender/provider participation.
- Notification destinations are stored separately from public provider data. Feedback screenshots use a private bucket; uploads are limited to account-owned folders with a 5 MiB image MIME allowlist.
- Public review RPCs expose display names rather than reviewer email addresses, filter active listings and visible reviews, and bound result limits.
- Privileged database clients and email modules import `server-only`; local environment files are ignored by Git.

These are source-level observations. They require live authorization testing after migration replay, especially two-account attempts to access another user's records and storage objects.

## Tests added

`tests/database-security.test.ts` contains 14 passing source/schema invariants. It resolves the **latest** function definition in migration order, checks NULL-safe guards and grants, prevents signup administrator assignment, checks protected update columns, private screenshot storage, caller-RLS message previews, minimal public reviews, and server-only privileged modules.

`supabase/tests/security_authorization.test.sql` contains 32 pgTAP assertions. It creates isolated consumer/provider/admin/orphan fixtures in a transaction, then checks anonymous grants, missing identities, orphan profiles, non-admin callers, and administrator access. The fixtures and changes roll back. No passwords or real mailboxes are needed.

Verification performed:

```text
npx tsx --test tests/database-security.test.ts
14 passed, 0 failed
```

The SQL tests were **not run** in this workspace because neither Docker nor `psql` is available. Passing TypeScript/static tests cannot validate PostgreSQL syntax, RLS behavior, actual deployed grants, or hosted configuration. Run these commands only against a disposable local database with Supabase CLI/Docker installed:

```text
npx supabase start
npx supabase db reset
npx supabase test db
```

Do not reset or seed a production database. The new authorization migration must be deployed through the reviewed migration process; this audit did not apply it remotely.

## Location correctness follow-up

The location audit added 30 passing tests in `tests/location.test.ts`. Pure response parsing and matching helpers are separated from network/database access, while the existing server entry points retain their exports. TypeScript and ESLint passed after extraction.

Verified corrections:

- GeoJSON positions require finite numeric longitude/latitude within valid world ranges. Null, empty strings, booleans, numeric strings, NaN, infinity, and out-of-range responses cannot silently become locations.
- Null/malformed response payloads and non-object feature entries are safely ignored.
- Matching rejects coordinates outside the supported Canada bounding box and ignores invalid region centers.
- Province matching handles all thirteen subdivision names/codes, prefixed ISO codes with whitespace, and accented/decomposed Québec names.
- Text matching respects word boundaries, preventing terms such as `Hope` from matching `Hopewell`. Equal textual scores use proximity instead of database row order.

The nearest-center fallback remains a deliberate approximation. It is not a postal boundary or municipal polygon lookup. Review known border/rural addresses in each supported province before representing the result as an exact service-area determination.

## Required staging acceptance evidence

1. Record the schema/migration version and prove the new authorization guards reject a missing-profile authenticated principal through actual RPC calls.
2. Use two consumers, two providers, an administrator, and an anonymous browser. Prove cross-account reads/writes fail for profiles, drafts, saved providers, inquiries/messages, ratings, notification addresses, feedback, and storage objects.
3. Verify direct Supabase calls cannot approve one's own listing or assign administrator role. Verify inactive/rejected providers disappear publicly while their existing conversation rules remain correct.
4. Exercise a successful inquiry, reply, read receipt, archive, rating update/removal, admin moderation, feedback screenshot access, and provider image upload. Check rows and UI outcomes rather than HTTP status alone.
5. Prove missing SMTP credentials, SMTP rejection, geocoder timeout, expired sessions, denied database requests, and process restarts produce recoverable outcomes without duplicate writes or leaked errors.
6. Confirm production Auth redirect URLs, confirmation/reset templates, sender-domain setup, email rate limits, session settings, and administrator access protection in the hosted dashboard. The checked-in local config intentionally uses development defaults.
7. Perform a backup restore and rollback rehearsal, enable monitoring, and record who responds to failures. Check fixture administrators and example providers are absent from the public production dataset.

Completion of these gates is the evidence needed for a release decision; the repository review alone is not a production sign-off.
