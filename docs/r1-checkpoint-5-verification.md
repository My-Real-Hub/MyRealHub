# R1 checkpoint 5: hosted security deployment

Verified November 11, 2026 (America/Toronto).

**Result: both reviewed security migrations were applied to the linked MyRealHub
Supabase project, and hosted verification passed.** All 33 local and remote
migration versions match. The final deployment preview reports that the remote
database is up to date.

## Deployment scope

Target: MyRealHub, project reference `eywzwkfeghbhwtsnjuti`, PostgreSQL 17.6.
Only one hosted project was available, with no Supabase branches. This was a
deployment to that linked project, following isolated local verification; it was
not a rollout through a separate hosted staging environment.

The deployment preview contained exactly these two migrations:

- `20261028120000_fail_closed_rpc_role_checks.sql`
- `20261111120000_harden_role_permissions_and_private_data.sql`

Before applying them, all 38 migration/test source hashes still matched the
checkpoint-4 manifest. That checkpoint verified a clean replay of 33 migrations,
320 SQL assertions, and 14 source-security assertions. See
[checkpoint 4](r1-checkpoint-4-verification.md) for behavior and test coverage.

A schema-only snapshot of `public` and `storage` was saved before deployment.
It is not a user-data backup or evidence of a restore rehearsal. Deployment used
the normal linked migration push, without resetting the hosted database, loading
demo seeds, or repairing migration history.

## Hosted verification

The deployed definitions were compared with the tested local reference:

- All 57 application policies match, including the custom Storage policies.
- All 25 application function definitions, signatures, owners, and configurations
  match. Client execution grants match the tested reference.
- Application table/column grants and the message-preview view's invoker behavior
  match. All 16 application tables retain RLS.
- Neither client role can create objects in `public`, execute the seven internal
  helpers, directly update contact requests, or read private feedback notes and
  reviewer identities. Neither has application-table maintenance privileges.
- The only anonymously executable ordinary security-definer functions are the
  three intentionally public review RPCs.

Read-only SQL checks passed for administrator, customer, provider, anonymous,
missing-profile, and missing-identity contexts. They used database roles and JWT
claim context, with existing identities where applicable. Administrator read RPCs
remained accessible. Other contexts were denied those RPCs, and unrelated private
records remained hidden in the checks. No fixture accounts or passwords were
created. These checks did not exercise authenticated browser sign-in or hosted
write workflows; successful writes and administrator mutations were verified in
the isolated SQL suite.

An additional anonymous check exercised the real HTTPS Data API with the public
project key and no user session:

| Request | Observed result |
| --- | --- |
| `POST /rest/v1/rpc/get_admin_platform_growth_counts` | HTTP 401, database code `42501`; denied |
| `GET /rest/v1/provider_profiles?select=id,status&limit=1` | HTTP 200; returned rows, if any, must be active |
| `GET /rest/v1/provider_profiles?select=id&status=neq.active&limit=1` | HTTP 200; zero private listings returned |

The saved API evidence contains method, path, status, and pass results, without
keys, tokens, record identifiers, or record content.

## Reviewed environment differences

The hosted project retains its preexisting trusted `service_role` execution
grants and message-preview view grants. These differ from fresh local defaults
but were unchanged by deployment. Client permissions match the tested reference.

The hosted-only `rls_auto_enable()` event-trigger helper was reviewed and retained
unchanged. It enables RLS on newly created public tables and is not an ordinary
client RPC. Both client roles have NOLOGIN, neither SUPERUSER nor BYPASSRLS, and
no role memberships.

Hosted Storage object RLS is enabled and the table remains owned by
`supabase_storage_admin`. Screenshots are private; provider profile images are
public. Both application buckets retain a 5 MiB limit and JPEG, PNG, and WebP
allowlists. The hosted catalog reports zero extra client maintenance grants on
the managed Storage tables. This is stronger than the local managed-grant
baseline described in checkpoint 4; no unsupported ownership or catalog changes
were made. A hosted upload/download workflow was not performed in this checkpoint.

## Data and remaining work

Before-and-after counts were unchanged:

| Records | Before | After |
| --- | ---: | ---: |
| Auth users | 16 | 16 |
| Profiles | 15 | 15 |
| Provider listings | 12 | 12 |
| Contact requests | 18 | 18 |
| Messages | 20 | 20 |
| Ratings | 1 | 1 |
| Feedback | 0 | 0 |

The migrations change permissions, functions, and policies. Hosted verification
used read-only operations. Matching counts do not establish complete row-content
identity. The temporary local reference stack was stopped with its volume
preserved.

Checkpoint 6 still needs to audit and remove or disable known-password test
administrator accounts. No accounts were disabled or deleted here, so R1 is not
yet complete. The existing participant-writable email-delivery acknowledgement
RPC remains the separately planned R5 email-workflow task, as recorded in
checkpoint 4.

## Evidence

Local evidence is saved under `audit-artifacts/r1/checkpoint5/` and excluded from
Git. `manifest.json` records verification results, source hashes, and evidence
hashes. The principal records are:

- `deployment-preview.log`, `deployment.log`, `migrations-after.log`, and
  `dry-run-after.log`.
- `predeployment-schema.sql`, pre/post metadata snapshots, tested-reference
  metadata, and `postdeployment-comparison.json`.
- `read-only-role-checks.sql` and its result, `effective-permissions.sql` and its
  result, and `storage-posture.sql` and its result.
- `anonymous-api-check.cjs`, `anonymous-api-verification.json`, and
  `local-reference-stop.log`.

The API check can be repeated from the repository root with
`node audit-artifacts/r1/checkpoint5/anonymous-api-check.cjs`; it reads only the
public Supabase configuration from `.env.local` and performs no writes. The SQL
verification files can be executed with `supabase db query --linked --file ...
--output json`. The role-check file explicitly uses a read-only transaction.
