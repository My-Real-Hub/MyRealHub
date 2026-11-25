# R4 checkpoint 3: versioned forms and independent listing editors

Verified November 18, 2026 (America/Toronto).

**Result: application integration and automated verification complete.** The
forward migration remains pending on the hosted database. Deployment and manual
application checks are the next checkpoint; R4 is not yet complete.

## Application changes

Provider listing saves now invoke `save_provider_listing` once for the listing and
its language, specialty, and service-region assignments. The action no longer
upserts the listing or deletes/inserts assignments in separate requests. The form
sends the revision displayed to the editor, and a successful response supplies the
revision for the next save. It retains that revision on validation/error responses.
The separate region editor now calls the three-argument versioned replacement RPC.
Both actions still verify the provider's account access before processing the save;
the database independently verifies the actor and ownership.

All four administrator status actions use `review_provider_listing` with the
revision displayed on the review page. They no longer update table status fields
directly. A stale review redirects to the latest details with a conflict message;
it does not approve a revision the administrator had not seen. Review now displays
the service-region assignments and country along with the existing listing fields.

Public listing name, bio, and photo are editable independently in business settings.
The account-derived hidden editorial fields and `manageSharedFieldsExternally`
mode are removed. Existing listing values, including explicit blanks, take
precedence over personal account values. Personal defaults apply only to a new
listing. Personal settings no longer fall back to public listing name/bio/photo.
The listing has an explicit photo-removal action. Upload failure retains the
previous image selection. Shared phone/confirmed-email behavior remains as recorded
in checkpoint 2 and is explained beside the public contact fields.

The shared snapshot loader reads the listing, text-cast bigint revision, and all
three assignment sets through one embedded PostgREST request. Editors preserve
their initial content/revision pair across another form's server revalidation;
they do not silently adopt a newer revision for older unsaved fields. Listing text
fields are controlled, preserving typed values when an action returns an error.
Explicit reload controls warn that unsaved edits will be discarded. After first
creating a listing, reloading enables the separate region editor. A region save
makes an editable listing a draft, which must be submitted for approval again;
inactive listings remain inactive. An unreadable/incomplete snapshot raises a load
error instead of becoming an empty new-listing form.

User-facing errors distinguish stale edits, access failures, invalid content, and
unknown network outcomes. Unknown outcomes ask the editor to reload before retrying
and do not claim that an unconfirmed save was rolled back. No automatic mutation
retry or replacement of the submitted revision with a newly queried revision is
implemented by the application.

## Corrections found through the real local API

The initial SQL-only contract used `40001` for deterministic stale-version errors.
The real local API test reproduced indefinite retries with PostgREST 14.13. The
pending migration and SQL/concurrency expectations now use `PT409`, which returns
HTTP 409 directly. The application handles that code as a reload/review conflict.
This follows [Supabase's documented PostgREST 14 retry issue and HTTP 409 fix](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
The snapshot's text revision projection uses the documented
[PostgREST column cast](https://docs.postgrest.org/en/stable/references/api/tables_views.html#casting-columns).

Auth's account-deletion API also exposed a restricted-role cascade failure: the
assignment revision trigger tried to update the listing as `supabase_auth_admin`.
That internal trigger is now a definer owned by the migration owner, with an empty
search path and no client execute grants. The preceding invoker guard continues to
deny direct authenticated assignment mutations. The real Auth admin API successfully
deleted both synthetic accounts and cascaded their listings/assignments after this
change; no platform role grants or ownership were altered.

These corrections modify the existing undeployed R4 migration. They do not rewrite
hosted migration history. A transient local gateway 502 after database resets was
resolved by restarting only the isolated gateway container before the final API
run. It required no application or hosted configuration change.

## Verification

| Check | Result |
| --- | --- |
| Clean seed-free replay of all 35 migrations in the isolated database | PASS |
| Seven SQL suites, including the updated conflict code: 443 assertions | PASS |
| Four overlapping-request cases, including empty-region replacement and stale approval | PASS |
| Real local API: save plus embedded snapshot with text revision | PASS |
| Real local API: complete administrator review and matching-version approval | PASS |
| Real local API: three stale operations return HTTP 409 / `PT409` | PASS |
| Real local API: personal editorial values remain separate from approved listing | PASS |
| Real local API: region replacement preserves listing details; anonymous draft/save denial | PASS |
| Real local Auth admin API: account/listing cascade cleanup | PASS |
| Node suite: 162 tests, including seven new snapshot/revision/error-handling tests | PASS |
| Full ESLint, TypeScript check, and production Next.js build | PASS |
| Catalog ownership, search paths, RPC/helper grants, and seven enabled write/version triggers | PASS |
| Post-run fixture tables checked by the catalog/cleanup verifier | Zero rows |
| Diff whitespace check | PASS |

Ignored evidence is in `audit-artifacts/r4/checkpoint3/`: final logs, API and
concurrency runners/results, catalog verification, and source/evidence hashes in
`manifest.json`. Passwords, API keys, and session tokens are generated/read only in
process memory and are not saved in these records. The isolated stack is stopped
after verification with its volume preserved.

## Next checkpoint and limits

Review the hosted migration history and forward-migration dry run, then apply the
R4 migration alongside these upgraded callers. The hosted database was not queried
or modified during this checkpoint. The new application readers require the
revision column, so this local branch must not be treated as usable with the older
hosted schema until that coordinated step is complete.

Browser interaction remains manual by the owner's preference. The automated API
checks do not substitute for manually checking typed-value retention, two-tab
conflict feedback, independent personal/public editors, photo removal, and the
submit/review/reactivation flow in the actual forms. No automated browser access to
the app was used. R2's deferred email checks and the separate R5 workflow remain
open.
