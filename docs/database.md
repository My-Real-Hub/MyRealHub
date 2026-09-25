# Database Schema

MyRealHub uses Supabase for authentication, database, and storage. Supabase
already provides `auth.users`, so the application stores only app-specific user
details in `public.profiles`.

## Supabase Auth And Profiles

`auth.users` is owned by Supabase Auth and stores authentication records. The
app should not duplicate passwords or auth internals in public tables.

`public.profiles` extends `auth.users` with app-level information:

- The `id` column matches `auth.users.id`.
- `role` identifies whether the profile is a regular user, provider, or admin.
- New profiles default to `role = 'user'`; provider signups can request
  `role = 'provider'`; admin roles should be assigned directly in the database.
- Basic display information such as `full_name`, `email`, and `avatar_url`
  lives here.

Admin users are regular profile rows with `role = 'admin'`.

## Provider Listings

`public.provider_profiles` is separate from `public.profiles` because provider
business details are listing-specific, not auth-specific. A user may have a
profile without having a provider listing.

For the MVP, `provider_profiles.user_id` is unique, so one profile can own only
one provider listing. Provider listings connect to `public.categories` for the
provider's main profession and use normalized join tables for languages and
specialties.

Provider profile status values:

- `draft`: provider started the profile but has not submitted it.
- `pending_approval`: provider submitted the profile and is waiting for admin approval.
- `active`: admin approved the profile and it can be publicly listed.
- `inactive`: profile exists but is hidden or disabled.
- `rejected`: admin rejected the profile.

Only `active` provider profiles should be publicly listed by future search UI.

Provider profile images are stored in Supabase Storage in the
`provider-profile-images` bucket. The database keeps both `profile_image_url`
for display and `profile_image_path` for the storage object path. Uploads are
restricted to authenticated users writing inside their own user-id folder.

Provider inquiry preferences are stored on `public.provider_profiles` using
non-sensitive public listing fields: `accept_new_inquiries`,
`contact_delivery_method`, and `new_message_email_enabled`. The provider's
private notification address is stored separately in
`public.provider_notification_preferences`, which is protected by RLS and is not
available to anonymous public listing reads.

## Lookup Tables

`public.categories` stores the controlled list of service professions, such as
real estate agent, mortgage broker, home inspector, and property manager. This
supports category search and prevents duplicate free-text category names.

`public.languages` stores a controlled list of languages providers can speak.
Providers do not store language names directly.

`public.specialties` stores narrower areas of focus. A specialty can optionally
belong to a category, and the category link is nullable so specialties can
survive category deletion.

`public.canadian_subdivisions` contains the fixed list of Canada's ten
provinces and three territories. `public.service_regions` contains the
provider-selectable service areas grouped by those subdivisions. Service
regions cannot point outside the Canadian preset. Each service region also
stores a representative latitude and longitude plus Canadian locality aliases
used to match geocoded project locations to the preset region list.

## Join Tables

`public.provider_languages` connects provider listings to languages. It is a
many-to-many table because one provider can speak many languages and one
language can apply to many providers. The composite primary key prevents the
same provider-language pair from being inserted twice.

`public.provider_specialties` connects provider listings to specialties. It is
also many-to-many and uses a composite primary key to prevent duplicate
provider-specialty pairs.

`public.provider_service_regions` connects provider listings to Canadian
service regions. Its composite primary key prevents duplicates, and a database
trigger enforces a maximum of two regions for each provider. Providers replace
their selections through an authenticated, atomic database function so a
failed update cannot leave a partially saved selection.

`public.provider_notification_preferences` stores private provider notification
addresses for inquiry relay and message-alert emails. Providers can select and
update their own row, admins can manage all rows, and anonymous users have no
access.

These join tables make it possible to filter provider search results by
language, specialty, and service region without storing arrays or
comma-separated strings on provider profiles.

## Saved Providers

`public.saved_providers` tracks providers saved or starred by users. Each row
links one user profile to one provider profile. The unique constraint on
`user_id` and `provider_profile_id` prevents a user from saving the same
provider more than once.

This table only has `created_at` because saves are created and deleted rather
than edited.

## Contact Requests

`public.contact_requests` stores contact requests sent to providers.
Each new request belongs to a provider profile and to the authenticated sender
profile through `sender_user_id`.

New contact requests can only be inserted by authenticated `user` or `provider`
accounts. RLS requires `sender_user_id` to match `auth.uid()`, requires the
recipient provider profile to be active and accepting new inquiries, requires
the inserted delivery method to match the provider's current preference, and
prevents providers from contacting their own provider profile. Sender name,
email, optional phone, subject, message, delivery method, email delivery status,
request status, latest-message timestamp, participant read timestamps, and
audit timestamps are stored with each request.

Contact request status values:

- `new`
- `read`
- `responded`
- `rejected`
- `archived`

Contact delivery methods:

- `in_app`: creates the default website conversation in the provider inbox.
- `email`: creates the inquiry record and securely relays the message to the
  provider's private notification address without exposing that address to the
  sender or public profile surfaces.

Email delivery status values:

- `not_requested`
- `pending`
- `sent`
- `failed`

The application records email relay or alert delivery outcomes on the contact
request. Failed direct-email relays are surfaced to the sender, while failed
in-app alert emails do not disable the in-app conversation.

`public.contact_request_messages` stores the message thread for each contact
request. It keeps a sender profile reference when one is available plus
name/avatar/email snapshots needed to render the conversation history if a
profile later changes. Provider message snapshots intentionally do not expose
the provider notification email address.

Message RLS is participant-only: authenticated users can select messages only
when they are the request sender or they own the recipient provider profile.
Message writes, read-state updates, rejection, and deletion flow through
security-definer RPCs that re-check participant authorization server-side:

- `send_contact_request_message`
- `mark_contact_request_conversation_read`
- `update_contact_request_conversation_status`

The `contact_request_latest_messages` security-invoker view exposes only the
latest message that the current participant is already allowed to read.

Provider inbox screens group multiple contact requests from the same sender to
the same provider profile into one message board. The individual
`contact_requests` rows remain intact for status, delivery, and audit history;
the UI merges their `contact_request_messages` in chronological order.

## Search Support

The MVP schema supports searching providers by:

- Category or profession through `provider_profiles.category_id`.
- City and province or state through `provider_profiles.city` and
  `provider_profiles.province_state`.
- Language through `provider_languages.language_id`.
- Specialty through `provider_specialties.specialty_id`.
- Canadian service region through
  `provider_service_regions.service_region_id`.
- Profile status through `provider_profiles.status`.

Address and map-pin searches resolve to a Canadian province and one of these
service regions before the provider query runs. The entered address and exact
coordinates are transient search inputs: they are not stored in the database,
placed in the results URL, or exposed to providers. Only the matched province
code and service-region ID are submitted as search filters.

Indexes are included for common filters and relationship lookups.

## Applying Locally

With the Supabase CLI configured for this project, run one of:

```bash
supabase db reset
```

or:

```bash
supabase migration up
```

`supabase db reset` also runs `supabase/seed.sql`, which inserts initial
categories, languages, and a small set of category-linked specialties.
