# R3 checkpoint 4: security patch and conversion deployment

Deployment verified November 16, 2026; manual conversion accepted November 18,
2026 (America/Toronto).

**Result: R3 is complete for the local application with hosted Supabase. The
dependency patch, hosted migration, and manually confirmed customer-to-provider
conversion passed. No hosted frontend deployment was performed.**

## Dependency validation

Next.js and `eslint-config-next` were updated from 16.4.3 to 16.4.6, using the
compatible `~16.4.6` range in the manifest and lockfile. This remediates the
[previous advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h),
first patched in 16.4.5. See the upstream
[16.4.6 release](https://github.com/vercel/next.js/releases/tag/v16.4.6).

All 155 Node tests, full-project ESLint, TypeScript, and the production build
passed. The build passed on its first post-patch attempt without the prior
security stop. The November 16 production dependency audit reported zero vulnerabilities.
The full audit reported seven moderate development-tool findings, tracing
through TypeScript ESLint packages to a minimatch denial-of-service advisory.
Those findings were recorded; no broad automatic dependency fix was applied.

The local app responds on port 3000 with healthy Supabase connectivity. Its
running Next server started after the patched installation completed. No hosted
frontend deployment was performed: manual testing uses the local application
with hosted Supabase.

## Database deployment and verification

Target: linked MyRealHub project `eywzwkfeghbhwtsnjuti`.
All 40 SQL source hashes still matched checkpoint 2's isolated test manifest.
The preview contained exactly one pending migration,
`20261117030000_add_customer_provider_conversion.sql`, which applied successfully.
All 34 local/remote migration versions now match; the final preview reports the
remote database is up to date.

The sole added function is `public.become_provider()`. Its body matches tested
source. Ownership, definer status, empty search path, zero-argument signature,
and grants match the intended controls: authenticated execution only, with
anonymous/service-role execution revoked and direct role-column writes denied.
Existing functions, tables/column grants, policies, views, and core role metadata
remain unchanged. Record counts and application-role counts are unchanged.

A hosted transaction tested existing identities and rolled back afterward:

- Anonymous, missing-identity, and nonexistent-identity calls were denied.
- Administrator conversion was denied; administrator read access remained.
- A synthetic customer converted within the transaction, could retry, received
  no listing, and remained denied administrator access.
- An existing provider retry returned its current role.

No identity was created and no account conversion or listing change was committed.
Earlier isolated evidence remains 361 passing SQL assertions and a passing
two-session concurrency test; the database source is unchanged.

## Manual acceptance — November 18, 2026

The owner confirmed that both the provider dashboard and Consumer tools are
accessible after the requested conversion sequence. A subsequent read-only
hosted check confirmed the owner-controlled account (`ja***@hotmail.com` in this
report) changed from `user` to `provider` while retaining exactly one confirmed
Auth identity. Identity and profile-detail fingerprints match the baseline;
saved-provider, customer-conversation, and message counts are unchanged. No
listing was created or published.

This manual account's saved-provider and conversation counts were zero, so
preservation of nonempty data remains proven by the isolated SQL fixtures rather
than this empty account. Browser results are owner-confirmed, not automated.
The validated application inputs still match their deployment hashes. Listing
creation/approval boundaries passed the isolated tests; creating a real listing
was not part of this manual conversion. R2's remaining email checks remain
explicitly deferred. The seven recorded development-tool findings remain separate
maintenance work.

## Evidence

Evidence under `audit-artifacts/r3/checkpoint4/` includes install/build/test/lint/
typecheck logs, production/full npm audits, deployment preview/application logs,
pre/post metadata, `deployment-comparison.json`, hosted smoke query/results,
final migration history/dry run, the manual customer's baseline and final state,
and `manual-conversion-comparison.json`. The manifest
records hashes and verification results without credentials or tokens.
