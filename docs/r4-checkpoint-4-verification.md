# R4 checkpoint 4: hosted deployment and manual acceptance

Initial deployment verified November 19, 2026; independent-editor and pending-
resubmission follow-ups verified November 23, 2026; administrator acceptance and
further UI checks recorded November 24, 2026 (America/Toronto).

**Result: R4 and its final checkpoint are complete. Database verification and owner
UI checks passed, including the revised edit/approval flow, immediate gray-button
behavior and provider self-deactivation.** Both local frontend instances have the
update. The local application is running against
hosted Supabase. No hosted frontend deployment was performed.

## Initial deployment — November 19, 2026

Target: linked MyRealHub project `eywzwkfeghbhwtsnjuti`.

All 57 database/application/report inputs matched checkpoint 3's verified source
hashes before deployment. The hosted history contained the expected 34 migrations;
the dry run listed only
`20261119023000_make_provider_listing_saves_atomic.sql`. That migration applied
successfully. All 35 local/remote versions matched at that deployment, and its
final dry run reported that the remote database was up to date. The November 23
follow-ups below add the 36th and 37th migrations.

The ten affected function bodies match the tested migration source exactly. The
expected changes are eight new functions, two replaced functions, seven new
triggers, one positive non-null bigint revision column, and its check constraint.
Existing listing revisions were initialized to one.

The three versioned public RPCs retain the intended controls: `postgres` ownership,
security definer, empty search path, and authenticated-only execution. Anonymous
and service-role execution are denied. Internal helper/trigger client execute
grants are absent. The internal assignment revision trigger is a definer so Auth's
restricted deletion role can cascade assignments; direct client assignment writes
are still denied by the preceding invoker guard. Stale business-version errors use
`PT409`, avoiding the API retry issue documented in checkpoint 3.

Existing table permissions, RLS policies, views, core roles/memberships, unrelated
functions, existing columns, existing constraints, and existing trigger definitions
are unchanged. Before/after fingerprints of personal profiles, listing content
(excluding the newly added revision), and all three assignment sets match. Account
role counts and row counts match: 18 Auth accounts, 18 profiles, 12 listings, 18
contact requests, 20 messages, one rating, and zero feedback records.

## Hosted transaction verification

A transaction exercised the deployed functions with existing synthetic account
fixtures and the existing authorized administrator identity. It set transaction-
local SQL role/JWT context, verified the operations, and rolled back every write.
It did not create accounts, change passwords, send emails, or commit moderation.

- Anonymous listing save/review execution was denied.
- Missing and nonexistent identities could not save.
- A customer could neither save a provider listing nor approve one.
- A provider could save a versioned draft and submit it for approval, but could
  not perform administrator review.
- A stale save and stale administrator review returned `PT409`.
- A direct administrator table status update was denied.
- The authorized administrator could approve the exact submitted revision and
  retain access to the administrator growth-count function.

Post-transaction data fingerprints match the pre-test state, and all initial
revisions remain one. Earlier isolated evidence remains 443 passing SQL
assertions, four concurrent-request cases, six real API scenarios (including three
HTTP 409 conflicts and Auth deletion cleanup), and 162 Node tests, with full lint,
TypeScript, and production build passing. The deployment itself used the unchanged
checkpoint 3 implementation. A subsequent UI-only follow-up is recorded below.

## Local application and manual checks

At deployment, the workspace Next.js development server was listening on port 3000.
Its `/api/supabase/health` check returned HTTP 200 and confirmed connectivity to the
intended hosted project. No automated browser inspection was used; browser checks
remain manual by the owner's preference.

On November 23, 2026, the owner clarified that they changed the personal display
name and biography, added a photo, saved, and reloaded; all those personal changes
persisted. **Personal-profile save/reload: PASS (owner confirmation).** The earlier
interpretation of this as a business-listing draft check was incorrect and is
withdrawn. This clarification does not establish a synchronization bug.
No code changes, database writes, or browser inspection were performed in response
to this manual-test clarification.

The owner subsequently confirmed that the separately saved business listing values
remained after reloading. **Business-listing name/bio save/reload: PASS (owner
confirmation).**

The owner then changed the personal account display name, saved/reloaded, and
confirmed that it did not change the business listing name. **Personal-name change
preserves public listing name: PASS (owner confirmation).** The owner separately
changed the personal biography, saved/reloaded, and confirmed that it did not
change the business listing bio. **Personal-biography change preserves public
listing bio: PASS (owner confirmation).** The owner also confirmed that changing
and saving/reloading the personal photo left the business listing photo unchanged.
**Personal-photo change preserves public listing photo: PASS (owner confirmation).**
The owner then tested the reverse direction for all three fields: business listing
name, bio, and photo changes saved/reloaded without changing the corresponding
personal profile fields. **Business-to-personal name, biography, and photo
preservation: PASS (owner confirmation).** All three editorial fields have now
passed manual separation checks in both directions.

The owner removed the business listing photo, saved the draft, reloaded, and
confirmed that the business photo stayed removed while the personal photo remained.
**Business photo removal and personal photo preservation: PASS (owner confirmation).**

The owner entered `invalid` in the business listing email, added `retention test`
to the bio, and attempted to save the draft. The owner confirmed the email error
and supplied screenshots showing the invalid email still present with its field
error and the otherwise valid bio still containing the unsaved marker. The bio
correctly has no validation error. **Validation feedback and unsaved email/bio
retention after the failed save: PASS (owner report and supplied screenshots).**
This verifies retention before reload, not persistence of invalid content to the
database. The owner then restored the valid business email, removed the temporary
bio marker, and confirmed saving the draft. **Validation-test cleanup: COMPLETE
(owner confirmation).**

In the first two-tab check, the owner reported that tab B showed `Tab A test`
after reloading. In a repeated attempt, the owner supplied a screenshot of the
expected stale-listing warning: the listing changed after the form was opened,
and the editor must copy any desired edits and reload before saving again.
**Newer saved value preserved and stale-save warning displayed: PASS (owner report
and supplied screenshot).** The owner found the warning only after manually
scrolling upward and requested automatic scrolling to it.

### Error-message visibility follow-up — November 23, 2026

`components/providers/provider-profile-form.tsx` now scrolls to and focuses the
listing error summary after a failed save completes. The summary has a programmatic
focus target and a visible focus ring. Scrolling is immediate, without animated
motion. The effect responds to each returned error state, including repeated
attempts producing identical conflict text. It does not move focus during typing,
while a save is pending, or after success. Existing controlled inputs and submitted
revision handling are unchanged, preserving unsaved values and stale-save guards.

All 162 existing Node tests, full ESLint, TypeScript, production build, and diff
whitespace checks passed after this change. The local application is running on
port 3000 and its metadata health check returned HTTP 200 for the intended hosted
project. No SQL, migration, database permissions, or hosted frontend deployment
changed in this follow-up. No automated browser inspection was used.

The owner repeated the two-tab save check after the fix and confirmed that tab B
automatically moved to the warning. **Business-listing automatic error
scrolling/focus: PASS (owner confirmation).** Verification logs, the changed source
hash, and build evidence are under
`audit-artifacts/r4/checkpoint4/error-scroll-fix/`.

The service-area form now uses the same immediate scroll/focus behavior after
failed saves, without changing its selected regions or revision handling. Full
`npm run check` (ESLint, TypeScript, all 162 existing tests, and production build)
and the diff whitespace check passed after this UI-only extension. Its automatic
message reveal and the conflict between the listing and region forms are the next
manual check. Evidence is under
`audit-artifacts/r4/checkpoint4/service-region-error-scroll-fix/`.

### Independent form saves — November 23, 2026

The owner observed a conflict after saving listing details and then changing a
service-area selection on the same page. The first implementation intentionally
used one optimistic version for the entire aggregate, so it rejected the second
save even though the forms edit separate fields. The owner correctly requested
that these independent changes both succeed. The earlier expected-conflict test
between these two forms is superseded by independent-save acceptance.

The forward migration `20261124015000_allow_independent_listing_editor_saves.sql`
adds positive `details_revision` and `regions_revision` bigint columns, initialized
to one. It does not edit the previously deployed migration. Listing details,
languages, and specialties use the details version; the service-region set uses
the regions version. The existing overall `revision` still identifies exactly
what an administrator reviewed.

Two authenticated-only RPCs implement the form-specific checks:

- `save_provider_listing_details(bigint,jsonb,uuid[],uuid[],text)` verifies the
  details version, locks the owned listing, reads its current regions, and saves
  the complete validated aggregate in the existing transaction.
- `save_provider_service_regions(bigint,uuid[])` verifies the regions version,
  locks the owned listing, and preserves its current details/languages/specialties
  while replacing the selected regions.

The core save now changes only assignment rows whose IDs actually changed. It no
longer deletes/reinserts unchanged sets, which would otherwise falsely invalidate
the other editor and change assignment timestamps. Each genuine edit still
advances the overall review revision. Changes in one form leave the unrelated
form's token valid. Overlapping stale edits within the same form still return
`PT409`. Administrator approval/rejection/deactivation/reactivation invalidate both
form tokens so the provider must review a moderation decision before saving again.
Editing published content still removes publication and requires review.

The forms send distinct, specifically named editor revision fields and keep their
original snapshots across other forms' revalidation. Details no longer repost a
hidden service-region set. After a successful save, each form retains its own
returned token rather than substituting the overall review revision. All three
versions are read as exact decimal strings in the same embedded snapshot query.
The scroll/focus improvements remain in both forms. This merges independent forms;
it does not add per-field merging between two copies of the details form. Legacy
aggregate RPCs retain their strict overall-version behavior for older clients.

Verification after this follow-up:

| Check | Result |
| --- | --- |
| Clean seed-free isolated replay of all 36 migrations | PASS |
| Eight SQL suites: original 443 assertions plus 53 new editor-version assertions | 496 PASS |
| Seven overlapping-transaction cases, including both orders of independent saves | PASS |
| Ten real local API scenarios, including eight genuine HTTP 409 conflicts and Auth deletion cleanup | PASS |
| Node suite: 164 tests, including malformed scoped-version responses and exact editor-token handling | PASS |
| Full lint, TypeScript, production build, diff whitespace | PASS |
| Linked preview: exactly the one new forward migration; deployment and final 36-version history | PASS |
| Five deployed function bodies match tested source; expected owners, search paths, grants | PASS |
| Existing application content, overall review versions, roles, RLS, and unrelated metadata preserved by deployment | PASS |
| Hosted rolled-back test: independent saves in both orders, stale same-form denial, stale review denial, current approval, moderation invalidation, anonymous/customer denial | PASS |
| Post-test hosted fingerprints and new editor versions unchanged | PASS |

The hosted follow-up added two functions, replaced the two revision trigger
functions and the aggregate-save body, and added two columns and two positive-value
constraints. Existing trigger definitions and other functions are unchanged. Before
and after the deployment, row counts matched: 18 Auth accounts, 18 profiles, 13
listings, 18 contact requests, 20 messages, one rating, and zero feedback. The extra
listing relative to the initial deployment was created during the owner's manual
draft checks, not by this migration. No hosted smoke-test writes were committed,
and no accounts were created. All isolated fixture rows were cleaned up and the
Docker stack was stopped with its volume preserved.

Evidence, verified source hashes, API/concurrency runners, hosted comparisons, and
build logs are under `audit-artifacts/r4/checkpoint4/independent-editors/`. The local
health route confirmed HTTP 200 connectivity to the intended hosted project. No
automated browser inspection or hosted frontend deployment was performed.

The owner reloaded Settings, saved a business bio change, then saved a service-area
change without reloading between the two saves. They confirmed that both saves
worked and both changes remained after reloading. **Independent listing/service-area
saves in the actual forms: PASS (owner confirmation, November 23, 2026).**

The owner submitted the business listing and confirmed that its status became
**Pending approval**. **Provider submission: PASS (owner confirmation).**

In response to the owner's resubmission question, source review confirmed that
the unique provider `user_id` constraint and current-row admin queue prevent a
second listing/queue entry. Resubmission updates that same listing, resets its
submission timestamp, and advances the overall review revision, so a prior admin
review cannot approve the updated version. The button is disabled while a request
is pending. At the time of that question, unchanged submissions still refreshed
the timestamp/revision. The owner accepted the recommendation to acknowledge
unchanged repeats without resetting the request; the implementation follows below.

### Unchanged pending submissions — November 23, 2026

The forward migration
`20261124025000_make_pending_listing_resubmissions_idempotent.sql` replaces only
the aggregate-save and details-wrapper bodies. It changes no table, column, role,
grant, RLS policy, trigger definition, or other function.

After authenticating the provider, locking the owned listing and validating the
request, the aggregate save compares normalized public fields and the complete
language, specialty, and region sets with the current pending submission. An
identical request returns `already_pending: true` with the existing ID, status,
and versions. No application record is updated, so `submitted_at`, `updated_at`,
the overall review revision, both editor revisions, and assignment timestamps
remain unchanged. Assignment ordering and equivalent normalized strings do not
create a new submission. Omitted image fields retain the current image; actual
image changes remain real edits.

An identical pending retry can be acknowledged even if the original response was
lost and its token is stale. The scoped wrapper passes an intentionally stale
overall token in that case: the core may only return a read-only identical-pending
acknowledgement; every non-identical write must still pass its version check.
An old provider form cannot undo a newer administrator decision. Pending
reactivation retries receive the same acknowledgement, while the first reactivation
request still needs validation and administrator approval.

Real pending-content changes continue to update the same listing, refresh the
submission time, and advance the review version. An administrator reviewing an
older version of real changes is still denied. Conversely, an unchanged repeat
does not invalidate a review already in progress. Anonymous/customer access and
all existing ownership/role controls remain in force.

The application validates the returned acknowledgement flag and displays
**Already awaiting approval. Your existing submission is unchanged.** It scrolls
to and focuses this acknowledgement as a green status message so it is visible
from the submit button. Actual edits retain the normal submission confirmation.
Own settings/dashboard data refresh after an acknowledgement; the no-op path does
not revalidate administrator/public listing paths as though content had changed.

| Check | Result |
| --- | --- |
| Clean isolated replay of all 37 migrations | PASS |
| Nine SQL suites: previous 496 assertions plus 42 new submission assertions | 538 PASS |
| Nine concurrency cases, including identical concurrent submits and a duplicate request overlapping a valid administrator approval | PASS |
| Thirteen real local API scenarios: exact timestamp/version preservation across separate requests, real-edit refresh, old-review denial, and Auth cleanup | PASS |
| Node suite: 166 tests, including truthful acknowledgement parsing and messages | PASS |
| Full lint, TypeScript, production build, diff whitespace | PASS |
| Hosted preview, forward deployment, and final matching 37-version history | PASS |
| Both deployed function bodies match tested source; existing security metadata unchanged | PASS |
| Deployment preserves application data, timestamps, assignments, and all versions | PASS |
| Hosted transaction: identical/stale-identical retries are read-only; existing review still approves; real edits refresh review and reject old approval; unauthorized actors denied | PASS |
| Complete rollback and unchanged hosted fingerprints after verification | PASS |

No hosted test writes were committed and no accounts were created. The isolated
database has no remaining fixture rows and is stopped with its volume preserved.
The local application health route returned HTTP 200 for the intended hosted
project. No automated browser inspection or hosted frontend deployment was used.
Evidence and verified source hashes are under
`audit-artifacts/r4/checkpoint4/pending-resubmission/`.

The owner reloaded the provider's pending listing, changed no fields, clicked
Submit for approval, and confirmed seeing **Already awaiting approval** while
the listing remained **Pending approval**. **Unchanged pending acknowledgement
in the actual form: PASS (owner confirmation, November 23, 2026).** Exact timestamp
and version preservation are established separately by the automated API and
hosted transaction checks above.

On November 24, 2026, during the outdated-review check, the owner reported the
listing-changed error and confirmed that it appeared on the administrator page.
**Stale administrator review warning: PASS (owner confirmation).** The separate
automated API and hosted transaction checks above verify that the denied decision
does not change listing status. The owner then refreshed the administrator review,
approved the current version and confirmed that its status became **Active**.
**Current-version administrator approval: PASS (owner confirmation).**

The owner also reported that the previous warning remained after refreshing,
although the latest version loaded and approval succeeded. The review page was
replaying the old `review=conflict` URL parameter. A small client message component
now removes the consumed review outcome from the current history entry while
keeping its message visible for the current page view. The next full reload no
longer repeats the old result. Other query parameters and the fragment are
preserved. A later action can display the same outcome again. Only recognized
review outcomes are passed into the client message component.

This UI follow-up changes no SQL, permissions, review versions or moderation
actions. All 166 existing Node tests, full lint, TypeScript, production build and
diff whitespace checks passed. Both local health endpoints returned HTTP 200 for
the intended hosted project. The second instance at `127.0.0.1:3001` was restarted
with the updated build; the owner's VS Code server remained running. Evidence and
current source hashes are under
`audit-artifacts/r4/checkpoint4/review-message-refresh-fix/`. After the reload
instructions and the question whether Active appeared without the previous
message, the owner answered yes and confirmed Active. **Post-refresh administrator
page: PASS (owner confirmation, November 24, 2026).** No automated browser inspection
or hosted frontend deployment was performed.

The owner clicked **Set provider inactive** on the administrator review page and
confirmed that the status changed to **Inactive**. **Administrator deactivation:
PASS (owner confirmation, November 24, 2026).**

The owner reloaded the provider's Settings, clicked **Request reactivation** under
Business listing and confirmed **Pending approval**. **Provider reactivation
request: PASS (owner confirmation, November 24, 2026).**

The owner refreshed the administrator review, clicked **Approve provider** and
confirmed that the reactivation request returned to **Active**. **Administrator
approval of reactivation: PASS (owner confirmation, November 24, 2026).** The
manual deactivation/reactivation cycle is complete.

### Disable unchanged pending submissions — November 24, 2026

At the owner's request, **Submit for approval** is disabled and uses its existing
gray disabled style while the listing is pending and its details are unchanged.
An edit to a public text field, profession, language/specialty selection, or photo
enables it. Reverting all edits disables it again. Trimming-only changes, equivalent
email capitalization and selection reordering do not count as content changes.
The helper text explains that the existing listing is already awaiting approval.

The form remembers the last successful request's submitted values, captured before
awaiting the server. Failed saves do not advance that baseline; edits typed during
a request remain changes relative to what was actually submitted. A successful
pending submission disables the button again. The server action returns the exact
overall listing revision alongside the existing details-editor token so newer
status metadata from a separate service-area save can enable submission of its
draft without replacing the pinned business inputs or weakening stale-edit checks.
Older refreshed metadata cannot overwrite a newer successful submission's status.

No SQL, RPC payload, ownership check, RLS policy or database permission changed.
The existing database acknowledgement remains the safeguard for identical retries.
All 173 Node tests (including seven new comparison/status regressions), full lint,
TypeScript, production build and diff whitespace checks passed. Both local health
endpoints returned HTTP 200 for the intended hosted project, and the second local
instance was restarted with the updated build. Evidence and source hashes are
under `audit-artifacts/r4/checkpoint4/pending-submit-button/`. Owner confirmation
of the actual button states remains pending. No automated browser inspection or
hosted frontend deployment was performed.

The owner subsequently reported that the button sometimes remained green after a
successful submission until a reload. That manual report supersedes the earlier
implementation-only result above. The owner also requested continued public
visibility during edit review, separate Pending approval/Pending edit labels and
provider-controlled deactivation. The following follow-up addresses those changes.

### Keep approved listings public during edit review — November 24, 2026

Migration `20261124160000_stage_active_listing_edits_and_owner_deactivation.sql`
adds a private `provider_listing_changes` table. The approved parent row and its
public language, specialty and service-region assignments remain unchanged and
Active while proposed changes are saved or submitted. RLS limits proposed content
to its provider and administrators; authenticated clients have no direct write
grants. The trusted server retains its existing application CRUD role. New
internal coordinators and archived unpublished-save/review implementations have
no client execute grants. Seven public listing RPCs require authenticated access,
and their actor checks still reject unauthorized, anonymous, missing-profile,
unconfirmed, banned and deleted identities as applicable.

Providers and administrators read the correct editable/reviewable aggregate
through an authorized editor RPC. It reads content, assignment sets, names and
exact text versions in one SQL statement. Administrators see submitted proposed
edits for review. Unsubmitted drafts cannot be approved. Public reads continue to
use the approved parent and assignments, so search, saved providers, ratings and
new inquiries keep their Active-listing behavior during edit review.

The overall review version and independent details/regions versions also cover
private edits. Duplicate pending requests are read-only. Genuine changes invalidate
an old administrator review; independent form saves preserve the other group's
current proposal. Approval validates and publishes the entire reviewed aggregate
atomically and removes its proposal. A late assignment failure rolls back both
publication and proposal changes. Rejecting a proposed edit retains the approved
public listing and gives its provider a correction note. An unchanged approved
listing creates no new review request.

The admin dashboard total and combined queue are **Pending**, with separate
**Pending approval** and **Pending edit** filters and labels. Active providers with
submitted edits retain Active publication and show Pending edit. The review page
uses **Approve edit**/**Reject edit** for a proposed edit and explains that the
approved version remains public.

Providers now have **Settings → Listing visibility → Deactivate listing**. Its RPC
derives the owner from the verified caller, checks the displayed overall version,
sets only that listing Inactive, and withdraws any queued edit to a private draft.
It leaves the login, profile, role and conversations available. Repeated inactive
requests are read-only. Existing reviewed reactivation remains available; old
administrator approvals cannot undo a newer deactivation.

Shared personal phone/confirmed-email changes become private listing drafts for
an Active provider, preserving the approved public contact information until review.
They do not implicitly submit other unsent draft changes. Existing pending rows
were preserved by migration; no former approved version was fabricated and no
pending content was automatically republished. An existing Pending approval request
therefore still needs its ordinary approval before testing future active edits.

The gray-button failure was reproduced in an isolated real React form: a saved
specialty missing from the visible checkbox list was omitted from FormData, leaving
the form comparison dirty after an otherwise successful save. Selected specialties
are now submitted consistently from controlled state, and unavailable saved choices
have visible removal controls. The same regression now passes. The saved baseline
and pending status also commit in one action result, and textarea line endings are
normalized. A pending request disables immediately without a reload; later typing
remains unsaved, undoing an edit disables again, and failed saves preserve edits.
An unchanged approved listing is also disabled; an existing draft remains submit-able.
Newer status metadata is accepted without overwriting pinned business inputs. A
fresh details token is adopted only when the incoming saved content matches the
confirmed baseline, preserving stale-edit protection.

| Verification | Result |
| --- | --- |
| Seed-free isolated replay | All 38 migrations PASS |
| SQL suites | 617 assertions PASS; original 32 security assertions unchanged |
| Node unit tests | 178 PASS |
| Actual React component interactions in an isolated browser fixture | 9 PASS, including the reproduced green-button failure and response/revalidation ordering |
| Real isolated Supabase API scenarios | 14 PASS, including three genuine PT409/HTTP 409 conflicts |
| Two-session transaction races | 10 PASS, including public visibility during an uncommitted approval |
| Full lint, TypeScript, production build and diff whitespace | PASS |
| Source verification | 181 input hashes match the checked candidate |
| Hosted preview/history | Exactly one new migration; final matching 38-version history and no pending migration |
| Hosted function and permission comparison | 14 bodies match tested source; two archived bodies preserved; existing function grants/settings preserved |
| Hosted data comparison | Existing application content, versions, timestamps, profile roles and unrelated policies unchanged by deployment |
| Hosted rolled-back behavior check | PASS; zero accounts created and zero test writes committed |
| Both local metadata health endpoints | HTTP 200 to the intended hosted project |

The migration adds one table, one RLS read policy, one guard trigger and one
security-invoker queue view. Existing parent columns, constraints, policies, roles,
memberships, table grants and trigger definitions remain unchanged. The hosted
counts remained 18 Auth accounts, 18 profiles, 13 listings, 18 contact requests,
20 messages, one rating and zero feedback. The new proposal table was empty after
deployment and after the rolled-back check. Existing trusted-server grants on six
legacy hosted trigger functions were preserved; anonymous/authenticated trigger
execution and client execution of the new internal coordinators remain denied.

The component fixture mounts the actual form with fake actions on a blank page,
blocks network requests, and uses no account or application server. It is included
in CI. The running user app was not accessed with browser automation. The second
instance at `127.0.0.1:3001` was restarted from the fresh build; the VS Code instance
at `localhost:3000` remained running. No hosted frontend deployment was performed.
The isolated database has zero remaining Auth/profile/listing/proposal/storage
fixtures and was stopped with its volume preserved.

Evidence is under `audit-artifacts/r4/checkpoint4/active-edits/`, including the
failing pre-fix component regression, passing results, source hashes, before/after
metadata, permissions, fingerprints, migration logs and rolled-back SQL check.

The owner confirmed: **“I tested the edit and the approve and all that. Everything
is working fine.”** This followed the check for an Active listing remaining Active
with Pending edit and an immediately disabled submit button, and additionally
confirms that administrator approval of the edit works. **Revised edit submission,
button behavior and approval: PASS (owner confirmation, November 24, 2026).** The
exact dashboard heading/filter wording was not separately quoted by the owner;
the labels are verified in the implementation and the queue types in the SQL/API
checks above.

The owner also confirmed testing **Deactivate listing from the provider account**
and that it works. **Provider self-deactivation: PASS (owner confirmation).** Login
preservation is established separately by the real Auth API check above. The last
reported listing state is Inactive; no automatic reactivation was performed.

All R4 checkpoints and requested follow-up checks are complete. Hosted frontend
deployment remains part of the later launch work.
R2's deferred email checks and the separate R5 workflow remain open.

Ignored evidence is under `audit-artifacts/r4/checkpoint4/`: migration previews and
deployment logs, read-only metadata/fingerprint snapshots, comparison results,
permissions, rolled-back smoke SQL/results, local service health, and a manifest
with source/evidence hashes. The isolated Docker stack remains stopped. API keys,
passwords, and session tokens were not saved in these records.
