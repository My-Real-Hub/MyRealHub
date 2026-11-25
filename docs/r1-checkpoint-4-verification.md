# R1 checkpoint 4: role permissions and private-data isolation

Verified November 11, 2026 (America/Toronto).

**Result: 320 SQL assertions passed after a clean replay of all 33 migrations.**
The 14 source-security assertions also passed. Testing used a disposable local
Supabase project on PostgreSQL 17.6, with demo seeds disabled and no hosted link.

## Changes

The forward migration
`supabase/migrations/20261111120000_harden_role_permissions_and_private_data.sql`
makes these corrections:

- Replaces inherited privileges with explicit permissions on all 16 application
  tables. Client roles lose bulk-deletion, trigger, reference, and maintenance
  permissions. Legitimate reads/writes and trusted server CRUD are explicitly
  granted instead of depending on project defaults.
- Requires the provider role for owned listing and assignment writes, including
  legacy listings owned by customers and the service-region replacement RPC.
  Administrators retain listing moderation and draft-region assignment access.
- Prevents reporters from selecting feedback internal notes and reviewer
  identities. Safe own-feedback fields remain readable; administrators use the
  existing guarded RPCs for private fields and updates.
- Requires a valid profile for protected avatar/screenshot operations. Adds the
  missing own-avatar metadata SELECT policy needed for legitimate updates.
  Public profile-image URLs remain public; screenshots remain private.
- Removes direct contact-request UPDATE permissions so mutations use the guarded
  RPCs. Provider-only status changes require a provider profile, and rejecting an
  archived conversation cannot reopen it.
- Removes direct client execution of seven internal helpers, applies empty
  search paths, and retains the three intentionally public review RPCs.

No existing migration or application TypeScript/React source was changed.

## Runtime coverage

The tests switch PostgreSQL roles and Supabase JWT claim context using synthetic,
passwordless identities. They verify real database behavior, including successful
operations and persisted results, as well as denied operations.

| SQL suite | Assertions |
| --- | ---: |
| Existing security authorization suite | 32 |
| Profiles, providers, assignments, saved providers, and storage | 100 |
| Conversations and private notification preferences | 91 |
| Ratings, feedback, public redaction, and successful administrator operations | 82 |
| Effective grants, RLS, function access, and server-role permissions | 15 |
| **Total** | **320** |

Roles include anonymous, missing identity, missing profile, two customers, multiple
providers, and administrator. Cross-account reads/writes are checked for private
profiles, draft listings, assignments, saved providers, inquiries/messages,
notification addresses, ratings, feedback, and storage metadata.

The Storage tests set `storage.allow_delete_query` only inside their rolled-back
test transaction to model the Storage API's deletion context. This ensures DELETE
assertions reach object RLS instead of being rejected by Storage's blanket direct
SQL deletion guard. No production Storage guard is disabled by the migration.

Final runner summary:

```text
All tests successful.
Files=5, Tests=320
Result: PASS
```

Post-run verification found zero Auth users, profiles, provider listings, feedback
rows, or storage fixture rows. All 33 migration versions were recorded. The local
stack was stopped successfully and its volume preserved.

## Supabase-managed Storage grants

The local Storage owner is `supabase_storage_admin`. Its 16 existing extra client
grant entries on `storage.objects` and `storage.buckets` remain unchanged; the
project's `postgres` role cannot revoke grants made by that owner. Supabase
documents this exact case and the supported containment controls in its
[managed-object privilege guidance](https://supabase.com/kb/troubleshooting/revoking-privileges-on-storage-pg_cron-vault-and-extension-objects-has-no-effect-916576).

Accordingly, the no-maintenance-grants assertion covers application-owned public
tables. Storage is verified through object RLS and permitted/denied row operations.
Both client roles have NOLOGIN, the local Data API exposes only `public` and
`graphql_public`, and reviewed application RPCs provide no arbitrary-SQL or
Storage-truncation path. This report does not claim the managed grants were removed.

## Remaining work

- Checkpoint 5 must review the deployment preview, apply reviewed migrations to
  the intended environments, and verify deployed behavior. No hosted database was
  contacted or modified in checkpoint 4.
- Checkpoint 6 must audit and disable known-password fixture administrators in
  production. The local test fixtures are not production accounts.
- The existing `record_contact_request_email_delivery` RPC still permits
  participants to acknowledge delivery. Restricting acknowledgements to a trusted
  server remains the separately planned R5 email-workflow task; this checkpoint
  does not certify that acknowledgement path as server-only.

## Evidence and reproduction

Base Git revision: `821b78b27a8a80ac31526e0fd919f5f4680ebf39`, plus the new
checkpoint-4 migration and test files. Their exact SHA-256 hashes are recorded in
`audit-artifacts/r1/checkpoint4-manifest.json` (ignored by Git).

```powershell
supabase start --workdir audit-artifacts/r1/isolated-20261106 --exclude studio,edge-runtime,imgproxy,realtime,vector
supabase db reset --local --no-seed --workdir audit-artifacts/r1/isolated-20261106
supabase test db --local --workdir audit-artifacts/r1/isolated-20261106
supabase stop --workdir audit-artifacts/r1/isolated-20261106
```

Run reset only against the disposable, unlinked directory prepared for this test.
The manifest confirms all isolated SQL files match the repository.

Local execution artifacts:

- `audit-artifacts/r1/checkpoint4-verified-reset.log`
- `audit-artifacts/r1/checkpoint4-verified-tests.log`
- `audit-artifacts/r1/checkpoint4-source-security-tests.log`
- `audit-artifacts/r1/checkpoint4-post-run-verification.json`
- `audit-artifacts/r1/checkpoint4-stop.log`
