# R3 checkpoint 3: provider conversion page and form

Verified November 16, 2026 (America/Toronto).

**Result: application implementation complete. All 155 Node tests, TypeScript,
targeted ESLint, and the production build passed. Hosted deployment and manual
conversion remain pending. A dependency security finding also needs remediation
before deployment.**

## Application behavior

- A signed-in customer's Join as Provider link now opens `/become-provider`.
  Anonymous visitors still use provider signup. Existing providers are sent to
  their dashboard; administrator accounts are excluded from conversion.
- The new page requires account-settings capability and explains that provider
  tools are added to the same account while customer activity is retained.
  It requires an explicit checkbox and form submission; viewing or prefetching
  the page does not convert the account.
- The Server Action uses the caller's ordinary server Supabase client, verifies
  the current user with Auth, requires confirmed non-anonymous identity, and
  checks the caller's profile. It invokes only the zero-argument `become_provider`
  RPC; no user ID, requested role, or administrator credential is accepted.
- Errors leave the form available with safe feedback. Missing deployment,
  rejected RPCs, unexpected return values, and network failures cannot trigger a
  success redirect. The independently tested database function remains the
  authorization boundary.
- On success the action invalidates the root layout and redirects to the provider
  dashboard. The header keys its auth menu by user ID and role so the new server
  role remounts the menu with current provider navigation. The dashboard retains
  its existing link to listing setup in Settings. Listing approval is unchanged.

## Validation

`npm test` passed all 155 tests, including nine new onboarding workflow tests and
one new proxy test. Coverage includes explicit confirmation, missing/revoked
sessions, unconfirmed/anonymous users, administrator/missing/invalid/unreadable
profiles, authenticated caller lookup, zero-argument RPC invocation, provider
retries, RPC failures, and safe network-error feedback. Proxy tests cover the
protected onboarding URL, anonymous login return destinations, customer entry,
administrator rejection, and missing-profile rejection.

TypeScript and targeted ESLint passed. The production build generated
`/become-provider` as a dynamic route. No automated browser inspection or manual
customer conversion was performed in this checkpoint. The owner previously
selected manual browser testing.

The database migration from checkpoint 2 remains local and unapplied to the
hosted project. Submitting conversion against the hosted database will therefore
show safe retry feedback until deployment. No hosted account, role, or listing
was changed during this checkpoint.

## Next.js security finding

The initial production build compiled and generated routes, then stopped with
Next.js's dependency-security upgrade notice. A normal second build succeeded
through the framework's built-in retry mechanism. No guard, package, or security
configuration was edited to suppress the notice.

`npm audit --omit=dev` confirmed one moderate advisory affecting installed
Next.js 16.4.3:
[GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h).
The upstream advisory lists 16.4.5 as patched and describes information disclosure
when a root-param-dependent `use cache` function is also called through
`unstable_cache()`. A search of `app`, `components`, `lib`, and `next.config.ts`
found no `use cache`, `unstable_cache`, or `cacheComponents` usage. That search
does not replace upgrading the affected dependency.

Upgrade Next.js to a patched compatible version and repeat validation before
deployment. No dependency or lockfile was changed here. The successful retry is
not evidence that the advisory has been remediated.

Subsequent checkpoint 4 remediated this finding with Next.js 16.4.6 and deployed
the conversion migration. See [checkpoint 4](r3-checkpoint-4-verification.md) for
the current deployment and validation record.

## Remaining work and evidence

Next: remediate the dependency finding, deploy the reviewed conversion migration,
and manually verify a customer adding provider tools, retained customer activity,
updated navigation, draft setup, and administrator-only approval. R3 is not yet
complete. R2 email checks remain deferred.

Local evidence under `audit-artifacts/r3/checkpoint3/` includes `node-tests.log`,
`typecheck.log`, `build.log`, `build-retry.log`, `npm-audit.json`, and a manifest
recording source/evidence hashes and the successful targeted lint result.
