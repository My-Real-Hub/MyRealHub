# R4 checkpoint 1: listing consistency and field ownership

Reviewed November 18, 2026 (America/Toronto).

**Result: review complete; implementation pending.** The owner explicitly chose
to separate public listing name, biography, and photo from the personal profile.
No application or hosted database behavior was changed during this review.

## Confirmed defects and existing protections

1. `saveProviderProfile` in `app/provider/dashboard/actions.ts` upserts the listing,
   deletes language/specialty assignments in separate requests, then inserts their
   replacements in further requests. A later failure can leave a saved listing
   with missing or partially replaced assignments. Some current error messages
   explicitly acknowledge the partial save.
2. Service regions are edited in a separate form/action. The existing
   `replace_provider_service_regions` RPC atomically replaces its own assignments,
   but does not lock the parent listing before the delete or coordinate with the
   other listing writes. The two-region enforcement trigger already takes an
   advisory lock and preserves its count limit. That protection does not make
   the whole replacement sequence serialize: concurrent replacements starting
   from an empty set can each delete nothing, then insert different assignments.
3. Listing, account, and region forms submit no expected revision/version.
   Concurrent form submissions can overwrite newer values. Administrator approval
   filters on `pending_approval`, but does not identify the exact content revision
   the administrator reviewed.
4. `sync_provider_profile_account_fields` updates all mapped listing fields from
   the complete new account profile whenever any of those account columns is
   targeted. Saving a phone/email or unchanged form values can therefore replace
   newer listing name/bio/image values. The trigger does not change listing
   approval status, so account edits can alter an active public listing directly.
5. Settings currently passes `manageSharedFieldsExternally` to the listing form,
   which hides shared editors and submits account-derived values. That UI must
   change along with the database ownership rule; removing only the trigger would
   leave the stale hidden-field overwrite path.

Existing guards remain relevant: listing creation/update requires the provider
role and ownership, clients cannot self-approve listings, private table RLS is
enabled, and public reads expose active listings only. R4 must retain those
protections while changing how related writes are coordinated.

## Accepted product decision

The owner selected: **Separate public listing fields from personal profile.**

- Personal name/bio/photo belong to the account profile.
- Public listing display name/bio/photo belong to listing editing and moderation.
- Account settings must not silently rewrite or publish those listing fields.
- Existing listing content must be preserved when introducing the new ownership
  rule. Account data may supply initial defaults for a new listing, not repeatedly
  overwrite an existing listing.

This decision does not automatically redefine login-email or private notification
address behavior. Confirmed Auth-email synchronization and delivery acknowledgements
remain R5 work. R4 must not publish an unconfirmed login-email change.

## Backend direction for the next checkpoint

Provide a guarded database transaction for a logical listing save, covering the
listing and its language, specialty, and service-region assignments together.
Validate ownership, role, active lookups, category/specialty compatibility, image
ownership, required submission fields, and allowed moderation transitions inside
the database operation. An error must roll back the complete logical save.

Serialize on the parent listing and use an expected revision from the displayed
form. Reject stale saves with reload/review guidance. Repeated creation and
concurrent creation must not produce duplicate listings. Any remaining separate
region editor must participate in the same revision/locking and moderation rules.

Remove automatic account-to-listing synchronization for the separated fields.
Apply one documented moderation rule to changes of public listing content,
including related assignments; an older administrator review must not approve a
newer, unseen revision. Preserve administrator-only approval and unrelated-account
isolation through direct database paths as well as application actions.

Account Auth metadata/email requests and profile writes currently cross service
boundaries and are not one PostgreSQL transaction. The listing transaction must
not be described as solving that separate distributed/email workflow.

## Remaining checkpoints

1. Implement backend consistency/version/ownership controls and verify rollback,
   concurrency, moderation, and role/RLS behavior in the isolated database.
2. Connect versioned forms/actions, separate the public editors from personal
   settings, and provide stale-edit and failure feedback.
3. Validate the application, review/apply the forward migration, and manually
   exercise save failures, two-editor conflicts, independent account/listing
   fields, and review/submission behavior.

This review used repository source. It did not create or modify hosted accounts,
listings, permissions, or migrations. Browser testing remains manual by the
owner's preference. R2's remaining email tests are still deferred.
