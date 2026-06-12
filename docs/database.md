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

## Lookup Tables

`public.categories` stores the controlled list of service professions, such as
real estate agent, mortgage broker, home inspector, and property manager. This
supports category search and prevents duplicate free-text category names.

`public.languages` stores a controlled list of languages providers can speak.
Providers do not store language names directly.

`public.specialties` stores narrower areas of focus. A specialty can optionally
belong to a category, and the category link is nullable so specialties can
survive category deletion.

## Join Tables

`public.provider_languages` connects provider listings to languages. It is a
many-to-many table because one provider can speak many languages and one
language can apply to many providers. The composite primary key prevents the
same provider-language pair from being inserted twice.

`public.provider_specialties` connects provider listings to specialties. It is
also many-to-many and uses a composite primary key to prevent duplicate
provider-specialty pairs.

These join tables make it possible to filter provider search results by
language and specialty without storing arrays or comma-separated strings on
provider profiles.

## Saved Providers

`public.saved_providers` tracks providers saved or starred by users. Each row
links one user profile to one provider profile. The unique constraint on
`user_id` and `provider_profile_id` prevents a user from saving the same
provider more than once.

This table only has `created_at` because saves are created and deleted rather
than edited.

## Contact Requests

`public.contact_requests` stores basic contact form submissions sent to
providers. Each request belongs to a provider profile and may optionally belong
to a sender profile through `sender_user_id`.

`sender_user_id` is nullable so the schema can support guest contact forms in
the future. Sender name, email, optional phone, message, status, and timestamps
are stored with each request.

Contact request status values:

- `new`
- `read`
- `responded`
- `archived`

This table stores contact records only. It does not send email and it is not a
full messaging system.

## Search Support

The MVP schema supports searching providers by:

- Category or profession through `provider_profiles.category_id`.
- City and province or state through `provider_profiles.city` and
  `provider_profiles.province_state`.
- Language through `provider_languages.language_id`.
- Specialty through `provider_specialties.specialty_id`.
- Profile status through `provider_profiles.status`.

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
