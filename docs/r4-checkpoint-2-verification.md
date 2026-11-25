# R4 checkpoint 2: atomic listing saves and revision checks

Verified November 18, 2026 (America/Toronto).

Follow-up: [checkpoint 3](r4-checkpoint-3-verification.md) supersedes the original
conflict SQLSTATE and assignment revision-trigger security mode described/tested
here. The pending migration now uses `PT409`/HTTP 409 for deterministic conflicts
and an internal definer for revision updates during Auth deletion cascades. The
checkpoint 2 results below remain the historical SQL-only verification record.

**Result: backend implementation and isolated verification complete.** The forward
migration has not been applied to the hosted database. Application forms/actions
still need the next checkpoint's integration before this migration is deployed.

## Implemented behavior

`20261119023000_make_provider_listing_saves_atomic.sql` adds a positive, opaque
listing revision and these authenticated RPC contracts:

- `save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text)` saves the listing,
  languages, specialties, and service regions in one transaction. Expected revision
  zero creates the caller's first listing; subsequent requests must match the
  displayed revision. The caller cannot choose an owner, status, slug, or revision.
- `replace_provider_service_regions(uuid,uuid[],bigint)` joins the same locking,
  version, validation, and moderation rules. The old two-argument signature fails
  safely with a revision-required conflict for the owner.
- `review_provider_listing(uuid,bigint,text,text)` requires an administrator and the
  exact reviewed revision for approval, rejection, deactivation, or reactivation.

Account and listing locks serialize competing requests, including first creation.
Stale requests fail with SQLSTATE `40001` and `listing_conflict`; clients must reload
and review newer content. Revisions can increase by more than one per logical save
because assignment changes also version their parent. Existing slugs are retained.

Database validation covers verified, non-anonymous, non-banned accounts with the
required profile role; ownership; allowed JSON fields/types and lengths; active
lookups and category/specialty compatibility; the two-region limit; required
submission fields; owned storage image paths; and supported moderation transitions.
Images can be preserved when omitted or removed with explicit nulls. Existing
external images can be retained, but arbitrary replacement external URLs are denied.

Direct authenticated listing content and assignment mutations are blocked,
including direct administrator status updates. Authorized administrators use the
review RPC. Operational inquiry/delivery preferences keep their existing path.
Trusted content or assignment changes also increment the revision and move an
active listing to pending approval when its status would otherwise stay active.
Provider draft saves remove the listing from active publication; submissions require
review. Inactive listings stay inactive on draft saves and require explicit
reactivation. An administrator cannot approve newer unseen content using an older
revision.

Personal account name, biography, and photo no longer synchronize into the listing.
Existing public values are preserved. Actually changed shared phone values and
email values matching the confirmed Auth email still synchronize; changes to active
public content invalidate approval. Unchanged contact values do not alter the
listing. An unconfirmed profile email is not copied into the public listing.

The three public RPCs are security definers owned by `postgres`, with an empty
search path and authenticated-only execution. Internal helpers/trigger functions
are not executable by `anon`, `authenticated`, or `service_role`. Table RLS remains
in place; these triggers and RPC checks add write-path protections.

## Verification

| Check | Result |
| --- | --- |
| Clean, seed-free isolated replay of all 35 migrations | PASS |
| Seven SQL suites: 443 assertions, including 82 new listing assertions | PASS |
| Two overlapping first-creation requests: one listing, stale request denied | PASS |
| Two overlapping aggregate edits: no mixed content or assignments | PASS |
| Two region replacements starting from an empty set: no merged results | PASS |
| Provider edit overlapping an old administrator approval: no unseen publication | PASS |
| Node suite, including existing database source checks: 155 tests | PASS |
| Function ownership, search paths, grants, and seven enabled write/version triggers | PASS |
| Post-run fixture cleanup: Auth, profiles, listings, saved providers, requests, messages, feedback, storage | Zero rows |
| Tracked diff whitespace check | PASS |

SQL cases cover anonymous/customer/missing-profile/unconfirmed/banned/deleted
accounts, other-provider isolation, direct-write bypasses, malformed inputs,
image ownership/traversal, stale versions, and moderation transitions. Injected
failures during specialty insertion and the final region insertion restore the
entire previous aggregate, including revision and timestamps. Personal editorial
field changes, actual versus unchanged shared contacts, and explicit image removal
are checked independently.

Existing positive provider-conversion and RLS mutation tests now exercise the
versioned RPCs. Cross-account denial checks remain. Administrator approval is tested
through the review RPC; raw assignment writes are now denied. The original 32
security assertions remain unchanged. The prior 361 assertions plus 82 new cases
produce the 443 total.

Ignored local evidence is under `audit-artifacts/r4/checkpoint2/`: final SQL and
Node logs, `concurrency.cjs`, `concurrency-result.json`, catalog/cleanup verification,
and a manifest of source/evidence hashes. The isolated stack is stopped after
verification with its volume preserved. No hosted database command or hosted data
change was needed for this checkpoint.

## Remaining scope

The next checkpoint connects listing, region, and administrator forms/actions to
these revision contracts, separates public editors from personal settings, and
provides conflict/failure feedback. Deployment and manual application verification
follow that integration. Deploying this migration alone would make legacy content
save and moderation paths fail safely until those callers are upgraded.

This checkpoint does not add personal-profile optimistic concurrency or make Auth
metadata/email requests and profile writes one distributed transaction. R5 email
workflow work and R2's deferred email checks remain open.
