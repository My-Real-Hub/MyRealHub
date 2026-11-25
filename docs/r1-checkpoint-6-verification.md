# R1 checkpoint 6: test administrator cleanup

Verified November 11, 2026 (America/Toronto), against the linked MyRealHub
Supabase project `eywzwkfeghbhwtsnjuti`.

**The seeded administrator has been demoted and disabled. The existing non-test
account confirmed by the owner now has the legitimate administrator profile.**

## Finding and authorization

The hosted database contained one administrator: `admin@example.com`, with the
same fixed identity as the administrator in `supabase/seed.sql`. It was not
banned, had no verified MFA factor, and had four existing sessions and four
unrevoked refresh tokens. A controlled Auth request confirmed that the shared
seed password still worked and the account could call the administrator growth
RPC. Passwords, keys, and tokens were not written to the audit evidence.

The only non-test Auth account, `we***@gmail.com`, had a confirmed email address
and no application profile. The owner explicitly selected that existing account
as the legitimate administrator before the transfer. Its Auth password, email,
and existing sessions were not changed.

## Cleanup performed

A guarded, one-time transaction created the missing legitimate administrator
profile using the existing Auth identity, verified its administrator read RPC
access, and changed the seeded account's application role to `user`. The
transaction checked exact identities, expected account state, affected-row
counts, and the final administrator inventory. A complete rollback rehearsal
passed before the committed operation.

The seeded account was then secured through the supported Auth Admin API:

- Replaced its shared password with a cryptographically random value that was
  discarded after the request.
- Banned sign-in for the documented 100-year duration, through October 19, 2126.
- Removed its sessions and refresh tokens as part of the Auth password update,
  with database verification afterward.

The disabled account and its related application records were retained. This
avoids cascading deletion of saved-provider and other historical references.
These account-specific operations were not added to the reusable migration
history, and no application code or security policy was changed.

## Verification

The same access token issued during the controlled baseline login was tested
after demotion. The administrator RPC returned HTTP 403 with database code
`42501` and `insufficient_role`. This proves the role change removed administrator
access even during the remaining lifetime of an already issued JWT.

After the Auth update, the shared-password login was rejected with `user_banned`.
The baseline refresh token was rejected with `refresh_token_not_found`.

Supabase access tokens remain cryptographically valid until expiry after session
revocation; the application profile role check closes administrator access
immediately. See the official [session guidance](https://supabase.com/docs/guides/auth/sessions).
The disablement uses the supported
[Auth Admin update operation](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

Final database checks passed:

| Check | Result |
| --- | --- |
| Legitimate administrators | Exactly 1, the owner-confirmed account |
| Seeded/example-address administrators | 0 |
| Disabled test account sessions / unrevoked refresh tokens | 0 / 0 |
| Legitimate account's existing sessions | 4, preserved |
| Administrator, customer, provider, anonymous, missing-profile, and missing-identity regression checks | PASS |
| Effective application grants and protected function access | PASS |
| Migration history | 33 versions, unchanged |
| Deployed policies, functions, table/column grants, views, and role metadata | Unchanged from checkpoint 5 |
| All 38 previously tested SQL source hashes | Unchanged |

Auth user count remained 16. Profile count increased from 15 to 16 because the
legitimate account's missing profile was created. Provider listings (12), contact
requests (18), messages (20), ratings (1), and feedback (0) retained their prior
counts. No business records were deleted.

R1's database-security checkpoints are complete. The clean-replay evidence remains
320 passing SQL assertions, including the original 32, and 14 passing source
assertions from checkpoint 4. Those suites were not rerun after this account-only
maintenance; their source and deployed security definitions remain unchanged.

Authenticated browser sign-in for the legitimate account remains part of R2; its
database permissions were verified with role and JWT-context checks here, without
requesting or resetting its password.

## Scope and launch follow-up

The local/preview seed file still contains development fixtures. The normal
deployment and setup commands push migrations without seeds, and the project
documentation prohibits seeding the live project. Manually rerunning that seed
file against the hosted database would reset fixture passwords and roles; it
must remain confined to disposable development environments.

Other seeded customer/provider accounts were outside this administrator cleanup.
This checkpoint does not certify those fixture identities as suitable for public
launch or complete R2's real-account authentication journeys. The separately
planned R5 email-delivery acknowledgement restriction remains open, as recorded
in checkpoints 4 and 5.

## Evidence

Evidence is stored locally under `audit-artifacts/r1/checkpoint6/`, excluded from
Git. It includes the read-only initial inventory, guarded transaction and rollback
rehearsal, Auth operation results, final inventory, permission regressions, and a
manifest with file hashes. Credentials and tokens were used only in memory.

The account-maintenance script and committed transaction are one-time operations;
do not rerun them as a general migration or deployment command. The saved
read-only verification queries can be repeated independently. Run linked CLI
queries sequentially: concurrent initial attempts encountered temporary-login
authentication failures; those attempts were stopped and the final queries all
passed when run sequentially.
