# MyRealHub readiness review and release plan

Reviewed October 28, 2026. Target: a reliable private demo, followed by a public release by January 4, 2027 if the acceptance gates below pass.

## Decision and current position

**Keep the application in one repository.** It already has a backend: Next.js server actions/HTTP handlers and Supabase Postgres, Auth, and Storage. That is appropriate for this directory. A separate API repository would add deployments, authentication boundaries, and coordination without fixing the current problems. A background email worker can later live in this repository; consider a separate service when another client, workload isolation, or measured scaling needs justify it.

**The app has substantial MVP functionality, but it is not ready for an unrestricted public launch.** Search, provider listings, saved providers, customer/provider/admin dashboards, approval, conversations, ratings/moderation, settings, service regions, and feedback are implemented. The remaining work is mostly reliability, authorization, account lifecycle, and operational readiness. This is a hardening project, with several unfinished workflows, rather than a rewrite.

This audit reviewed the current working tree, including pre-existing uncommitted authentication and map changes. Those changes were preserved. It did not deploy the application, change hosted users/passwords/roles, apply hosted migrations, or send real emails. Source review and passing tests are not a certification of the live deployment.

## Work completed during this audit

| Area | Change and practical result |
| --- | --- |
| Build/dependencies | Updated Next.js to 16.4.3 and Nodemailer to 10.1.4; refreshed compatible dependency fixes. Vendored the existing Geist fonts with their OFL license and used `next/font/local`, removing Google Fonts availability from the build. |
| Authentication | Preserved intended destinations through login; rejected destinations outside the account's capabilities; tested real callback orchestration and proxy behavior with synthetic sessions; required a verified user/session before entering a dashboard. Existing recovery/signup fixes were retained. |
| Credentials before hydration | Browser tests revealed that a client-only form could submit natively before JavaScript was ready, putting credentials in a GET URL. Auth forms now use POST and disable submission until hydration. No-JavaScript and SSR regressions cover this. |
| Database authorization | Added forward migration `20261028120000_fail_closed_rpc_role_checks.sql`. Five admin RPCs previously let an authenticated identity without an app profile pass a nullable-role check; two rating RPCs had the same nullable-role pattern. The migration fails closed and explicitly revokes anonymous execution. **It still requires database execution and deployment.** |
| Database deployment safety | Removed `--include-seed` from the remote push script, setup script, and recommended setup commands. Fixed-password demo users, including an admin, remain in local seed fixtures only. This does not remove fixture accounts that may already exist remotely. |
| Provider/rating/settings inputs | Bounded provider slugs, strict discrete rating parsing, stronger owned-upload paths, safe return destinations, confirmed-email handling, strict pagination, and runtime conversation payload validation. |
| Saved providers | Save/remove operations now expose database errors and pending state. Tests cover ownership, roles, inactive listings, database failures, revalidation, and redirects. |
| Location API | Enforced the real 2 KiB streamed body limit rather than trusting `Content-Length`; rejected invalid inputs before database/geocoder calls; parallelized independent lookups. Hardened malformed GeoJSON/coordinate parsing, all province/territory matches, accent normalization, whole-word matching and distance ties. Added explicit dependency timeouts to health probes. |
| Recovery/accessibility | Added page/global error recovery and a useful 404 page, a keyboard skip link, and valid accessible roles for provider loading and map controls. |
| Browser headers | Disabled the framework identification header; added framing, MIME sniffing, referrer, permission, and baseline CSP protections. Auth routes and legacy callback query landings use `no-referrer`; public pages retain an origin referrer required by the map provider. The CSP deliberately still needs a script/style/connect policy review with the deployed app. |
| Repeatability | Added `npm test`, Playwright desktop/mobile suites, accessibility checks, credential-gated role scenarios, a rollback-only database authorization suite, and CI configuration for app checks and disposable Supabase tests. |

## Login: what is established and what remains

The repository's October 11/15 investigation records a missing application profile, a previously rejected password, an older live deployment, and an incomplete recovery-link journey. Those are historical evidence, not a fresh inspection of today's live accounts. The app now handles missing profiles, callback errors, repeat signup responses, and lost recovery destinations more deliberately.

This audit verifies login validation/error states in the browser using intercepted Auth responses, and verifies successful callback/proxy decisions with synthetic sessions. **A real successful customer/provider/admin login, email verification, final password reset, and new-password login have not been demonstrated in this run.** No dedicated account credentials or administrative hosted settings were supplied. The optional role browser suite reports explicit skips rather than treating those checks as passed.

The first deployment task is therefore: deploy the reviewed code to staging, verify the Supabase callback allowlist and hosted recovery template, use dedicated confirmed test accounts, and complete signup → email → login → refresh → logout → login and recovery → password change → old-password rejection → new-password success. Verify the actual mailbox and database state, not just an API acceptance response. Keep passwords in local environment/CI secrets, never in this report or committed fixtures for a public environment.

## Remaining backlog and acceptance criteria

Estimates are engineering effort for one developer familiar with this codebase. They are planning ranges, not guarantees; vendor setup, sender-domain verification, and findings from staging can change the dates. Some tasks overlap.

| ID / priority | Work | Acceptance criterion | Estimate |
| --- | --- | --- | --- |
| R1 / public blocker | Replay migrations, execute the new SQL authorization tests, apply reviewed authorization repair to staging, inspect hosted migration history and fixture accounts. | Missing-profile/anonymous/non-admin RPC access is denied; authorized admin access works; no known-password fixture admin exists in public production. | 1–2 days |
| R2 / demo blocker | Finish real login, signup, recovery, confirmation resend, session persistence, and role testing on the staging deployment. | All three dedicated roles pass the browser suite; mailbox confirmation/reset journey works; account owners can recover access. | 1–3 days plus hosted access |
| R3 / demo blocker for provider onboarding | Repair the existing customer's “Join as Provider” path. It currently points to signup, which redirects a signed-in customer back to the customer dashboard. | A supported, authenticated conversion/onboarding path exists, or the unsupported CTA is removed for existing customers with a clear support path. No client can grant itself admin. | 1–2 days |
| R4 / data integrity | Make listing plus language/specialty/service-region changes transactional; resolve shared account/listing ownership and approval behavior. | Failed writes roll back; concurrent edits have defined results; changing unrelated account settings does not overwrite a newer listing bio/name/avatar; approved content follows one moderation rule. | 3–5 days |
| R5 / email workflow blocker | Configure server-only delivery credentials, SMTP/sender domain and deployed base URL; complete verified email-change synchronization; restrict delivery acknowledgements to a trusted server. | Real test inbox receives correct links; private notification addresses stay private; conversation participants cannot claim SMTP success; a confirmed email change reaches the profile/listing correctly. | 2–4 days plus vendor setup |
| R6 / reliable inquiries | Add inquiry idempotency and durable email delivery/retry (outbox or controlled worker). | A retry/disconnect does not create duplicate inquiries; failed delivery is recoverable without resubmitting the inquiry; send failures are observable. | 2–4 days |
| R7 / public blocker | Add durable rate limits/quotas for inquiries, messages, feedback/uploads, geocoding, and email amplification, including direct Supabase writes/RPCs. | Limits hold across two application processes and direct API calls; legitimate retry/error behavior is clear. Hosted Auth abuse protection is separately verified. | 2–4 days |
| R8 / product reliability | Preserve public provider URLs on rename; paginate/search all inbox history; add deliberate incoming-message refresh. | An old shared URL still resolves; conversations older than 100 requests remain reachable; a second browser's reply appears without losing local state. | 2–4 days |
| R9 / public readiness | Publish product privacy/terms/support information; define deletion/export, retention, moderation, screenshot/upload cleanup, and provider verification claims. | Public links work; a documented support process can fulfill account/data requests; example providers are clearly marked or removed. Arrange appropriate review of the published policies. | 2–4 days plus review |
| R10 / operations | Staging/production separation, CI execution, monitoring, redacted logs, backups/restore, rollback runbook, domain/HTTPS and email configuration. | Clean deployment from the lockfile; restore/rollback drill recorded; alerts reach an owner; production URLs/keys are checked; administrator access protection is verified. | 2–4 days |
| R11 / discovery and scale | Directory query pagination/index review, realistic load checks, page metadata/canonicals/social previews, robots/sitemap, accessible manual keyboard/screen-reader pass and actual device/browser checks. | Representative dataset meets agreed response-time targets; crawlable public pages have correct production URLs; private/auth pages stay out of indexing; Safari/Firefox and real mobile checks pass. | 2–4 days |
| R12 / demo map gate | Verify production tile service access, capacity/terms and error fallback independently of address geocoding. | Visible map tiles load on the deployed domain; referrer policy and attribution satisfy the provider; a provider failure leaves a clear usable address-search alternative. | 0.5–1 day plus provider setup if required |

The business/security reports linked below contain exact code evidence, existing controls, and expanded acceptance checks. These tasks should become tracked issues with an owner; a green unit test run alone does not close them.

## Schedule to the beginning of 2027

| Window | Outcome | Gate |
| --- | --- | --- |
| October 29–November 6 | Staging, reviewed security migration, fixture-account cleanup, real account access, and reliable demo accounts. | R1 and R2 pass. Resolve or hide the broken existing-customer provider CTA. |
| November 9–20 | Complete onboarding and transactional settings/listing behavior; prove customer → provider → admin approval → inquiry → reply → rating → moderation with two unrelated accounts. | R3/R4 and role/RLS workflow checks pass. Configure email if included in the demo. |
| November 23–27 | Small invitation-only demo with synthetic/consented data and a fixed, rehearsed scenario. | No known data-isolation/authorization failure. Every feature shown has passed its acceptance path, including the deployed map (R12). Unfinished email features are disabled or explicitly outside the demo. |
| November 30–December 11 | Email reliability, abuse controls, privacy/support, complete history/URL behavior, monitoring and restore/rollback. | R5–R10 pass for public workflows. |
| December 14–18 | Limited beta, device/browser/accessibility checks, realistic load tests, operational rehearsal, final fixes. | R11 and all release gates below pass. A public release can happen here if evidence is complete. |
| December 21–January 3 | Buffer for beta findings, vendor dependencies, and holiday availability. | No date-driven waiver of unresolved authorization/data-loss failures. |
| January 4, 2027 | Target public release decision. | Release gate evidence is complete; otherwise continue the private beta with a specific remaining issue list. |

A private demo can happen earlier than November 23 if the relevant gates pass. The calendar reserves time to learn from actual users; it is not a reason to delay a demonstrably ready demo. Allow roughly 4–6 focused engineering weeks plus review/beta time, subject to staging findings and feature choices.

## Repeatable verification

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

The default browser command starts a fresh **production server from the existing build** on port 3100. Run `npm run build` after source changes first. It intentionally refuses to reuse an existing server, because an old production process can serve stale HTML and missing JavaScript chunks after a rebuild. Close a previous audit server or use an explicit `E2E_BASE_URL` pointing to a fresh staging/local deployment. Run one browser suite at a time so reports and server ownership remain clear.

For optional read-only integration checks, set `E2E_CHECK_BACKEND=1` and point `E2E_BASE_URL` at the intended environment. Those checks require actual provider/service-region data and the configured geocoder. Routine browser tests stub OpenStreetMap image tiles to avoid repeated traffic to community-funded servers; they do not prove live map availability. Set `E2E_CHECK_TILES=1` for one explicit desktop viewport check of the default OpenStreetMap provider. Alternative tile providers need an equivalent check. OpenStreetMap requires a valid web referrer and cache-respecting use; see its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

For real role scenarios set `E2E_USER_EMAIL/PASSWORD`, `E2E_PROVIDER_EMAIL/PASSWORD`, and `E2E_ADMIN_EMAIL/PASSWORD` using dedicated confirmed staging accounts. Role tests perform login, read-only navigation and logout; they do not provision accounts or verify mailbox delivery. Traces/video are disabled for credential-bearing role checks.

With Docker and Supabase CLI available, replay migrations and run SQL tests against a **disposable local** instance:

```bash
npx supabase start
npx supabase db reset
npm run test:db
```

Never reset or load the demo seed into production. `npm run db:push` now applies migrations only; review `npm run db:dry-run` before a controlled deployment.

## Public release gate

- All automated application checks pass on the exact release revision; SQL tests execute successfully after a clean migration replay.
- Real customer/provider/admin sessions and email verification/recovery pass on the deployed staging site; role and two-account data isolation are proven against actual RLS/storage policies.
- Provider save failures cannot partially overwrite data; inquiries/retries do not duplicate; real email failure/recovery is verified for enabled email features.
- Public write paths have durable abuse controls; fixture accounts/data are absent or intentionally isolated; private notification addresses/screenshots/messages remain inaccessible to unrelated users.
- Privacy/support/data lifecycle, tested backups/restore, monitoring, rollback, and an incident owner are in place.
- Browser/device/accessibility and representative-load checks pass. Any accepted lower-priority limitation is explicitly recorded and reflected in the product/demo.

## Supporting evidence

- [Authentication investigation and verification](authentication-test-report.md)
- [Authentication deployment/settings guide](authentication.md)
- [Database/security findings and SQL gates](security-database-audit.md)
- [Business workflows, test coverage and remaining acceptance matrix](workflows-audit.md)

Local test execution results are recorded in the final verification appendix below. Browser automation is Chromium desktop plus Chromium mobile emulation; it does not establish Safari/WebKit, Firefox, real-device, email-provider or production-load behavior.

## Final verification — October 28, 2026

| Check | Result | Boundary |
| --- | --- | --- |
| `npm run check` | Passed: ESLint, TypeScript, 145 tests, optimized Next.js 16.4.3 build. | Current local working tree; no deployment. |
| Auth tests | 36 passed. | Validation, callback orchestration, proxy with synthetic sessions, server-rendered form safety. |
| Business workflow tests | 57 passed. | Real validators and saved-provider orchestration with simulated database outcomes. |
| Location tests | 30 passed. | GeoJSON, coordinate bounds, all 13 provinces/territories, locality normalization/matching and distance ties. |
| Bounded HTTP body tests | 8 passed. | Missing/false headers, exact limits, UTF-8 split chunks, cancellation and invalid JSON. |
| Database source invariants | 14 passed. | Source/grant/role invariants; these do not execute Postgres/RLS. |
| Final production browser run | **69 passed, 7 skipped, 0 failed**, 76 cases across desktop/mobile Chromium. | Real local production server; backend and explicit live tile checks enabled. |
| Skip breakdown | Six real-role login/persistence/logout cases require dedicated credentials; one mobile live-tile case is intentionally redundant with the desktop live check. | Skips are unverified or intentionally omitted checks, not passes. |
| Read-only backend checks | Passed: Supabase Auth health, directory results → provider detail, Canadian geocoding/region resolution. | Configured Supabase public key and provider data. No hosted writes or email. |
| Map network/visual check | Passed: default OpenStreetMap tile response 200 with referrer; Toronto viewport visually renders correctly. | One desktop viewport. Routine browser tests use stubbed tile images. The public/auth referrer distinction has a regression check. |
| Accessibility/layout checks | Passed serious/critical automated WCAG checks and overflow checks for seven public page variants on both viewports. Desktop landing/directory and live map screenshots were inspected. | Not a manual screen-reader review or complete accessibility conformance audit. |
| Dependency audit | `npm audit --json`: 0 known vulnerabilities across the installed dependency tree. | Advisory state at review time; not proof of absence of vulnerabilities. |
| Database execution suite | **32 SQL assertions written, not executed locally.** | Docker/PostgreSQL runtime unavailable here. Migration syntax/replay, real grants and RLS remain release gates. |
| CI | Application and disposable-Supabase jobs configured. | Not pushed or executed on GitHub during this audit. |
| Production deployment, real mailbox/reset and role workflows | **Not performed/verified.** | Requires the staging/deployment settings and dedicated real accounts described above. |

The final browser command used `E2E_BASE_URL=http://127.0.0.1:3210`, `E2E_CHECK_BACKEND=1` and `E2E_CHECK_TILES=1` against a freshly started production server. Generated browser reports/screenshots remain in ignored `playwright-report/` and `test-results/`; `npx playwright show-report` opens the report. The temporary audit server was stopped after verification.

The local map initially showed access-blocked tiles during the header-hardening pass. Visual inspection caught the problem despite passing layout checks. The final fix scopes `no-referrer` to auth/callback paths and preserves the public origin referrer. Both the live network/visual check and auth-header assertions passed afterward. This is why the release plan requires functional third-party checks as well as layout tests.
