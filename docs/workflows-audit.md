# Business workflow audit — October 28, 2026

This report covers non-authentication workflows in the current working tree. It
is a source review and local automated verification, not proof that every hosted
database policy, real account, SMTP server, or browser interaction works. The
main readiness report combines this with browser, authentication, and database
audits.

## Implemented fixes and regression coverage

| Area | Verified defect | Change |
| --- | --- | --- |
| Provider listing | Very long business names produced slugs longer than the public route's 160-character limit. | Truncate only the business-name part and preserve the account suffix. |
| Ratings | `parseInt` accepted tampered choices such as `5.9` and `5stars` as five stars. | Parse only exact choices `1`–`5`; retain review length checks. |
| Saved providers | Save/delete database errors were ignored, so the button silently appeared to do nothing. | Return a visible form error, disable repeat submission while pending, and revalidate/redirect only after a successful write. |
| Return paths | Several business actions checked only `/` and `//`, allowing browser-normalized backslashes in a submitted return path. | Reuse the authentication redirect validator for saved providers, contact forms, and ratings. |
| Profile images | The server checked an account prefix without rejecting traversal, backslashes, or control characters. | Validate account ownership and reject malformed object paths in provider and account settings saves. |
| Account email | Settings copied the requested email into the app profile before Supabase confirmed the change. | Store the email returned by Supabase as the current authenticated address. The database audit addresses subsequent confirmed-email synchronization. |
| Feedback | URL and screenshot validation accepted malformed backslash/control-character values and empty object names. | Validate supported URL schemes, account-owned screenshot paths, and payload boundaries. |
| Inbox actions | TypeScript types were trusted at runtime; malformed action arguments could throw on `.mode`, `.trim`, or note fields. | Reject malformed identifiers, modes, bodies, notes, and unsupported status changes before RPC calls. |
| Pagination | Partial numbers and unsafe integer values were accepted from query parameters. | Accept only positive safe integers. |

The production code uses the validators and saved-provider coordinator exercised
by the tests; the tests do not duplicate alternate implementations.

## Automated checks

Commands executed successfully after the workflow changes:

```text
npx tsx --test tests/workflows.test.ts tests/workflows-saved-actions.test.ts
npx tsc --noEmit
npx eslint app/providers/contact-actions.ts app/providers/rating-actions.ts app/providers/save-actions.ts app/feedback/actions.ts app/settings/actions.ts app/provider/dashboard/actions.ts lib/contact-requests.ts lib/feedback.ts lib/providers components/providers/save-provider-button.tsx tests/workflows*.test.ts
npx eslint app/messages/actions.ts lib/messages-validation.ts tests/workflows.test.ts
```

57 workflow tests pass:

- 43 tests cover contact validation, delivery states, pagination, profile draft
  versus approval requirements, form parsing, website schemes, slugs, rating
  boundaries, feedback validation, upload types and ownership, and malformed
  conversation payloads.
- 14 coordinator tests cover saved-provider authentication and authorization,
  submitted identity tampering, malformed identifiers, database failures,
  inactive providers, provider accounts using consumer features, revalidation,
  and safe return paths.

The saved-provider tests use dependency injection to simulate database success
and failure while executing the real production orchestration. They do not
certify the deployed RLS or exercise the Supabase SDK over the network. Other
workflow tests cover real parsing and validation functions, not complete
database mutations.

## Remaining work, ordered by launch impact

### High priority before public launch

1. **Make provider saves transactional.**
   `app/provider/dashboard/actions.ts` writes the listing, deletes both language
   and specialty associations, then reinserts them in separate requests. A
   failed insert or two simultaneous edits can leave partial data. Add one
   authenticated RPC transaction for the complete save; test rollback and
   concurrent edits against staging.

2. **Resolve shared account/listing field ownership.**
   The `profiles_sync_provider_account_fields` trigger copies all shared account
   fields into the provider listing whenever any of those fields changes.
   Provider listing edits update only `provider_profiles`, so the account copy
   can become stale. A later account save can overwrite a newer listing name,
   biography, or image. Choose a single source for shared fields, update both in
   a transaction, or synchronize only fields actually changed; add an integration
   regression that edits the listing and then unrelated account settings.

3. **Prove role-specific writes in staging.**
   Use dedicated user, provider, and admin accounts to run: create draft → submit
   → approve → public visibility → contact → reply/read → save/remove → rate/edit/
   remove → moderate → deactivate/reactivate → feedback triage. Include a second
   unrelated user/provider to prove they cannot read or change private data.
   These flows require an isolated database and real authentication sessions;
   validator tests cannot substitute for them.

4. **Exercise email relay failure and retry.**
   The contact action persists an inquiry before sending email. A relay failure
   returns an error and invites another attempt even though the inquiry exists,
   so retries can duplicate it. Add an idempotency key or explicit saved-with-
   delivery-failure state plus a controlled retry mechanism. Verify email
   configuration, sender domain, provider notification email lookup, and saved
   delivery status using a test mailbox.

### Complete for a reliable growing beta

5. **Preserve public provider URLs on renames.**
   The slug is regenerated each profile save. Renaming a business breaks links
   shared under the previous slug. Preserve the initial slug or store slug
   history and redirect old URLs.

6. **Provide inbox history beyond the latest 100 requests.**
   `lib/messages.ts` limits the main query to 100 requests. Search and unread
   filtering in `conversation-center.tsx` operate on the loaded subset, so they
   cannot recover older history. Provider grouping also changes the displayed
   total to the number of loaded groups, masking the request limit. Add server
   pagination/search and report totals with consistent units.

7. **Refresh incoming messages deliberately.**
   Inbox contents update through initial data, opening a conversation, or local
   actions. There is no subscription or periodic refresh for another person's
   newly sent message. Add realtime updates, bounded polling, or a clear refresh
   affordance; test two independent browser sessions.

8. **Keep lookup/dependency failures visible.**
   Several settings, viewer, and secondary lookup queries discard their error
   result and fall back to empty data. A database outage can look like missing
   languages, regions, avatars, or message history. Add explicit unavailable
   states and structured server logging where the fallback changes decisions.

9. **Clean up unused uploads.**
   Images upload before the form is saved; replacing an image or abandoning the
   form can leave orphaned files. Define retention/cleanup rules and check
   storage usage. Keep feedback screenshots private.

10. **Define and test provider approval rules for shared settings.**
    Account changes can propagate into an active listing without resubmission,
    while listing edits become a draft or pending approval. Decide whether this
    is the intended moderation policy and enforce it consistently.

## Workflow acceptance matrix for staging

| Workflow | Existing implementation | Essential acceptance checks still requiring real sessions |
| --- | --- | --- |
| Directory/search | Category/language/specialty/location filters, rating summaries, profile links, saved state | Real lookup data, combined filters, empty/error cases, Unicode and malformed queries, scale/pagination. |
| Provider public page | Public active listing, rating/review, contact and save controls | Inactive/draft privacy, image failures, external links, own-profile restrictions. |
| Consumer workspace | Saved listings and conversation inbox | Reload persistence, unavailable listings, unrelated-user isolation. |
| Provider onboarding | Draft and approval submission, lookup validation | Required fields, active/inactive lookup transitions, duplicate submits, atomic rollback. |
| Provider communications | Accept-inquiry switch, in-app/email mode, private notification address | Closed inquiries, email outcomes, notification privacy, preferences persisting across reload. |
| Conversations | Open/read, reply, reject/archive, grouped provider inbox | Two-user exchange, read/unread, status permissions, archived behavior, history limits. |
| Ratings | One rating per account/provider, review, removal, moderation RPCs | Self-rating rejection, upsert and remove, hidden/removed totals, unrelated-user restrictions. |
| Account settings | Display name, email, phone, bio, avatar | Email confirmation lifecycle, avatar ownership, cross-form synchronization, partial failure. |
| Service regions | Maximum two distinct active regions | Invalid/deactivated region rejection, role ownership, filtering after a change. |
| Feedback | Bug/suggestion report, private screenshot, admin status/notes | Private screenshot access, upload errors, admin-only triage and notes. |
| Admin | Approve/reject, activate/deactivate, ratings, lookup management | Unauthorized deep links/actions, competing status updates, lookup dependencies and visibility. |

No hosted users, listings, inquiries, ratings, feedback, or email recipients were
mutated by these unit/coordinator checks.
