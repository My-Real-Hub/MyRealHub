# R1 checkpoint 3: isolated SQL security verification

Verified November 11, 2026 (America/Toronto).

**Result: PASS — 32 SQL assertions executed, 32 passed, 0 failed.**

Source revision tested: `821b78b27a8a80ac31526e0fd919f5f4680ebf39`.

## Environment and migration replay

- Supabase CLI: `2.106.0`.
- PostgreSQL: `17.6`; pgcrypto: `1.3`.
- Isolated local project: `myrealhub-r1-security-20261106`.
- All 32 repository migrations replayed successfully, including
  `20261028120000_fail_closed_rpc_role_checks.sql`.
- The database's recorded migration versions match the isolated manifest.
- SHA-256 comparisons confirmed that the isolated migrations and SQL suite match
  the repository files.
- Demo seeds were disabled, and no hosted project link was copied into the test
  directory. This checkpoint did not connect to or modify the hosted database.

## SQL assertions

The unmodified `supabase/tests/security_authorization.test.sql` suite passed:

| Assertion group | Passed |
| --- | ---: |
| Anonymous administrator-function execution grants denied | 5 |
| Missing authenticated identity denied | 5 |
| Missing profile denied, including rating functions | 7 |
| Customer administrator-function calls denied | 5 |
| Provider administrator-function calls denied | 5 |
| Administrator access checks | 5 |
| **Total** | **32** |

The test runner reported:

```text
All tests successful.
Files=1, Tests=32
Result: PASS
```

Post-run queries confirmed that all four temporary Auth identities and profiles
were rolled back. The isolated database contained **zero Auth users** afterward.

## Execution and evidence

The isolated input snapshot is under
`audit-artifacts/r1/isolated-20261106/`. Its manifest records file hashes and the
verification result. The `audit-artifacts` directory is ignored by Git.

From the repository root, the successful commands were:

```powershell
supabase start --workdir audit-artifacts/r1/isolated-20261106 --exclude studio,edge-runtime,imgproxy,realtime,vector
supabase test db --local --workdir audit-artifacts/r1/isolated-20261106
supabase stop --workdir audit-artifacts/r1/isolated-20261106
```

Local evidence files:

- `audit-artifacts/r1/local-supabase-start-with-gateway.log`
- `audit-artifacts/r1/sql-security-tests.log`
- `audit-artifacts/r1/sql-post-run-verification.json`
- `audit-artifacts/r1/local-supabase-stop.log`

The isolated stack was stopped successfully after verification. Its database
volume was preserved for subsequent local checkpoints.

## Remaining scope

This closes checkpoint 3 only. These 32 assertions do not establish comprehensive
cross-account private-data isolation or successful administrator updates against
existing fixture records. Expanded role/RLS tests belong to checkpoint 4.
Hosted deployment verification and production test-administrator cleanup remain
separate checkpoints. No application or migration source changes were needed to
pass this suite.
