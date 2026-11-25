# R3 checkpoint 2: guarded customer-to-provider conversion

Verified November 16, 2026 (America/Toronto).

**Result: backend implementation and isolated verification complete. All 361 SQL
assertions passed, including 41 new conversion assertions.** The 14 existing
source-security assertions and a two-session concurrency check also passed.

## Implementation

The new forward migration
`supabase/migrations/20261117030000_add_customer_provider_conversion.sql` adds
`public.become_provider()`, returning the resulting application role.

- The function accepts no account ID or target role. It obtains the caller from
  `auth.uid()` and requires an existing confirmed, non-anonymous, non-deleted,
  non-banned Auth record and an application profile.
- It changes only a customer's own application role to `provider`. An existing
  provider can retry without another update. Administrators cannot be converted
  or demoted through this operation.
- Auth and profile rows are locked in parent/child order so overlapping requests
  serialize. The second successful request observes the existing provider role.
- It creates no listing and changes no listing approval state. Auth identity,
  credentials, profile details, saved providers, inquiries, and messages remain
  intact. Providers retain their existing customer permissions.
- The definer function is owned by `postgres`, has an empty search path, uses
  qualified object names, and grants execution only to `authenticated`. Creating
  the function and restricting its ACL happen in one transaction. Direct role
  column updates and administrator assignment remain unavailable to clients.

These controls follow PostgreSQL's guidance for
[security-definer functions](https://www.postgresql.org/docs/17/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).

## Verification

Testing used the existing disposable, unlinked local Supabase workspace,
PostgreSQL 17.6, with seeds disabled. All 34 migrations replayed successfully from
scratch. Test fixtures are synthetic and passwordless; test transactions roll
back. The linked hosted database was neither contacted nor changed.

| SQL suite | Assertions passed |
| --- | ---: |
| New provider conversion | 41 |
| Existing profiles/providers/Storage | 100 |
| Existing conversations | 91 |
| Existing ratings/feedback | 82 |
| Original security authorization | 32 |
| Existing security catalog | 15 |
| **Total** | **361** |

The conversion checks cover anonymous and missing identities, missing Auth or
profile rows, unconfirmed records despite claimed confirmation, bans, deletion,
anonymous Auth identities, administrator rejection, direct role-write denial,
successful conversion, repeated calls, unrelated-account isolation, preserved
customer records, draft creation, and denial of self-approval.

A separate test started a second conversion while the first held its locks.
Both returned `provider`, exactly one profile remained, the retry preserved the
first conversion's update timestamp, and no listing was created. Its exact local
fixture was removed afterward.

Final verification found 34 recorded migration versions, correct function
ownership/settings/grants, and zero remaining Auth users, profiles, listings,
saved providers, inquiries, messages, feedback, or Storage fixture rows. The local
stack was stopped with its volume preserved.

## Remaining R3 work

The migration is not deployed and the website CTA is not yet connected to it.
The next checkpoint adds the authenticated conversion page and guarded Server
Action, refreshes role navigation, and routes successful customers into the
existing provider listing workflow. Deployment and manual website acceptance
remain required before R3 is complete.

R2's email resend and remaining email checks are still explicitly deferred.

## Evidence and reproduction

`audit-artifacts/r3/checkpoint2/manifest.json` records the source hashes, isolated
copy parity, results, and evidence hashes. Local artifacts include
`local-reset.log`, `sql-tests.log`, `concurrency-result.json`,
`post-run-verification.json`, and `local-stop.log`.

Run these commands only against the guarded, disposable workspace:

```powershell
supabase start --workdir audit-artifacts/r1/isolated-20261106 --exclude studio,edge-runtime,imgproxy,realtime,vector
supabase db reset --local --no-seed --workdir audit-artifacts/r1/isolated-20261106
supabase test db --local --workdir audit-artifacts/r1/isolated-20261106
node audit-artifacts/r3/checkpoint2/concurrent-conversion.cjs
node audit-artifacts/r3/checkpoint2/verify-local-state.cjs
supabase stop --workdir audit-artifacts/r1/isolated-20261106
```

The 14 source-security assertions were executed with
`npx tsx --test tests/database-security.test.ts`. The new SQL suite is
`supabase/tests/provider_conversion.test.sql`.
