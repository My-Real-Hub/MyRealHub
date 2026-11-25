-- Make database privileges explicit instead of inheriting permissive project defaults.
-- RLS remains responsible for account ownership and application-role checks.
-- This forward migration changes authorization only; it does not modify application data.

revoke all on table
  public.profiles,
  public.provider_profiles,
  public.provider_languages,
  public.provider_specialties,
  public.categories,
  public.languages,
  public.specialties,
  public.saved_providers,
  public.contact_requests,
  public.contact_request_messages,
  public.provider_ratings,
  public.provider_notification_preferences,
  public.canadian_subdivisions,
  public.service_regions,
  public.provider_service_regions,
  public.platform_feedback
from public, anon, authenticated;

-- Storage's base grants belong to supabase_storage_admin and are managed by
-- Supabase. Application bucket access is restricted through the RLS policies below.

-- Explicitly clear column-specific grants before rebuilding the column allowlist.
revoke all (
  id, full_name, email, role, avatar_url, created_at, updated_at,
  phone, bio, avatar_path
)
on table public.profiles
from public, anon, authenticated;

revoke all (
  status, provider_response, read_at, responded_at, rejected_at, archived_at,
  updated_at
)
on table public.contact_requests
from public, anon, authenticated;

revoke all (rating)
on table public.provider_ratings
from public, anon, authenticated;

revoke all (internal_notes, reviewed_by, reviewed_at)
on table public.platform_feedback
from public, anon, authenticated;

-- Account settings cannot change identity, role, or audit timestamps.
grant select on table public.profiles to authenticated;
grant update (full_name, email, phone, bio, avatar_path, avatar_url)
on table public.profiles to authenticated;

-- Public directory data is still filtered by active-listing/lookup RLS policies.
grant select on table
  public.provider_profiles,
  public.provider_languages,
  public.provider_specialties,
  public.categories,
  public.languages,
  public.specialties,
  public.canadian_subdivisions,
  public.service_regions,
  public.provider_service_regions
to anon, authenticated;

grant insert, update, delete on table
  public.provider_profiles,
  public.provider_languages,
  public.provider_specialties,
  public.categories,
  public.languages,
  public.specialties
to authenticated;

grant select, insert, delete on table public.saved_providers to authenticated;
grant select, insert on table public.contact_requests to authenticated;
grant select on table public.contact_request_messages, public.provider_ratings
to authenticated;
grant select, insert, update on table public.provider_notification_preferences
to authenticated;
grant insert, delete on table public.provider_service_regions to authenticated;

-- Reporters can read their submissions, but moderator notes and reviewer identity
-- are returned only by the administrator RPCs that enforce an admin profile.
grant select (
  id, type, title, description, current_page_url, reporter_user_id,
  reporter_name_snapshot, reporter_email_snapshot, screenshot_path, status,
  created_at, updated_at
)
on table public.platform_feedback
to authenticated;

-- Trusted server clients still need table privileges even when bypassing RLS.
grant select, insert, update, delete on table
  public.profiles,
  public.provider_profiles,
  public.provider_languages,
  public.provider_specialties,
  public.categories,
  public.languages,
  public.specialties,
  public.saved_providers,
  public.contact_requests,
  public.contact_request_messages,
  public.provider_ratings,
  public.provider_notification_preferences,
  public.canadian_subdivisions,
  public.service_regions,
  public.provider_service_regions,
  public.platform_feedback
to service_role;

revoke all on table public.contact_request_latest_messages
from public, anon, authenticated;
grant select on table public.contact_request_latest_messages
to authenticated, service_role;

-- Anonymous lookup policies must not reference the private profiles table.
-- The existing authenticated administrator ALL policies retain inactive reads.
alter policy categories_select_lookup on public.categories using (is_active);
alter policy languages_select_lookup on public.languages using (is_active);
alter policy specialties_select_lookup on public.specialties using (is_active);

-- Owning a legacy listing does not substitute for the provider role.
alter policy provider_profiles_insert_own on public.provider_profiles
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'pending_approval')
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
);

alter policy provider_profiles_update_own_pending on public.provider_profiles
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
)
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'pending_approval')
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
);

alter policy provider_languages_insert_own on public.provider_languages
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_languages.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

alter policy provider_languages_delete_own on public.provider_languages
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_languages.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

alter policy provider_specialties_insert_own on public.provider_specialties
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_specialties.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

alter policy provider_specialties_delete_own on public.provider_specialties
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_specialties.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

alter policy provider_service_regions_insert_own on public.provider_service_regions
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_service_regions.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

alter policy provider_service_regions_delete_own on public.provider_service_regions
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_service_regions.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

-- Administrators can inspect and correct assignments on private drafts too.
create policy provider_service_regions_select_admin
on public.provider_service_regions
for select to authenticated
using (exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'::public.profile_role
  ));

create policy provider_service_regions_insert_admin
on public.provider_service_regions
for insert to authenticated
with check (exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'::public.profile_role
  ));

create policy provider_service_regions_delete_admin
on public.provider_service_regions
for delete to authenticated
using (exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'::public.profile_role
  ));

-- Apply the same provider-role requirement to the transactional region RPC.
create or replace function public.replace_provider_service_regions(
  target_provider_profile_id uuid,
  selected_service_region_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_count integer;
  distinct_count integer;
  valid_count integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'provider'::public.profile_role
  ) or not exists (
    select 1
    from public.provider_profiles
    where id = target_provider_profile_id
      and user_id = (select auth.uid())
  ) then
    raise exception 'Provider profile not found or not owned by this account.'
      using errcode = '42501';
  end if;

  requested_count := coalesce(
    pg_catalog.cardinality(selected_service_region_ids),
    0
  );

  select count(distinct region_id)
  into distinct_count
  from pg_catalog.unnest(
    coalesce(selected_service_region_ids, array[]::uuid[])
  ) as selected(region_id);

  if requested_count > 2 then
    raise exception 'A provider can select at most two service regions.'
      using errcode = '23514';
  end if;

  if requested_count <> distinct_count then
    raise exception 'Service regions must be unique.'
      using errcode = '23505';
  end if;

  select count(*)
  into valid_count
  from public.service_regions
  where id = any(
    coalesce(selected_service_region_ids, array[]::uuid[])
  )
    and is_active;

  if requested_count <> valid_count then
    raise exception 'Choose valid active Canadian service regions.'
      using errcode = '22023';
  end if;

  delete from public.provider_service_regions
  where provider_profile_id = target_provider_profile_id;

  insert into public.provider_service_regions (
    provider_profile_id,
    service_region_id
  )
  select target_provider_profile_id, selected.region_id
  from pg_catalog.unnest(
    coalesce(selected_service_region_ids, array[]::uuid[])
  ) as selected(region_id);
end;
$$;

-- Keep provider-only status changes and reject reopening archived threads.
create or replace function public.update_contact_request_conversation_status(
  target_contact_request_id uuid,
  target_status public.contact_request_status,
  target_provider_note text default null
)
returns table (
  id uuid,
  status public.contact_request_status,
  read_at timestamptz,
  responded_at timestamptz,
  rejected_at timestamptz,
  archived_at timestamptz,
  last_message_at timestamptz,
  provider_last_read_at timestamptz,
  sender_last_read_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_note text := nullif(btrim(target_provider_note), '');
  profile_record record;
  request_record record;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if target_status not in ('rejected', 'archived') then
    raise exception 'unsupported_status' using errcode = '22000';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'message_too_long' using errcode = '22001';
  end if;

  select
    contact_requests.*,
    provider_profiles.user_id as provider_user_id,
    provider_profiles.business_name as provider_business_name,
    provider_profiles.display_name as provider_display_name,
    provider_profiles.profile_image_url as provider_profile_image_url
  into request_record
  from public.contact_requests
  join public.provider_profiles
    on provider_profiles.id = contact_requests.provider_profile_id
  where contact_requests.id = target_contact_request_id
  for update of contact_requests;

  if not found or request_record.provider_user_id <> current_user_id then
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = current_user_id
      and profiles.role = 'provider'::public.profile_role
  ) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  -- Archiving is terminal; rejecting cannot reopen a closed conversation.
  if request_record.status = 'archived'::public.contact_request_status
    and target_status is distinct from 'archived'::public.contact_request_status then
    raise exception 'contact_request_archived' using errcode = '42501';
  end if;

  select
    profiles.full_name,
    profiles.avatar_url
  into profile_record
  from public.profiles
  where profiles.id = current_user_id;

  if target_status = 'rejected' and normalized_note is not null then
    insert into public.contact_request_messages (
      contact_request_id,
      sender_user_id,
      sender_name_snapshot,
      sender_email_snapshot,
      sender_avatar_url_snapshot,
      body
    )
    values (
      target_contact_request_id,
      current_user_id,
      coalesce(
        nullif(btrim(request_record.provider_business_name), ''),
        nullif(btrim(request_record.provider_display_name), ''),
        nullif(btrim(profile_record.full_name), ''),
        'Provider'
      ),
      null,
      coalesce(
        nullif(btrim(request_record.provider_profile_image_url), ''),
        nullif(btrim(profile_record.avatar_url), '')
      ),
      normalized_note
    );
  end if;

  update public.contact_requests
  set
    status = target_status,
    provider_response = case
      when target_status = 'rejected' then normalized_note
      else contact_requests.provider_response
    end,
    read_at = coalesce(contact_requests.read_at, now()),
    responded_at = case
      when target_status = 'rejected' then null
      else contact_requests.responded_at
    end,
    rejected_at = case
      when target_status = 'rejected' then now()
      else contact_requests.rejected_at
    end,
    archived_at = case
      when target_status = 'archived' then now()
      else null
    end,
    provider_last_read_at = now()
  where contact_requests.id = target_contact_request_id;

  return query
  select
    contact_requests.id,
    contact_requests.status,
    contact_requests.read_at,
    contact_requests.responded_at,
    contact_requests.rejected_at,
    contact_requests.archived_at,
    contact_requests.last_message_at,
    contact_requests.provider_last_read_at,
    contact_requests.sender_last_read_at,
    contact_requests.updated_at
  from public.contact_requests
  where contact_requests.id = target_contact_request_id;
end;
$$;

-- Metadata access is private even though published profile image URLs are public.
-- A SELECT policy is also required for legitimate own-object UPDATE operations.
create policy provider_profile_images_select_own
on storage.objects
for select to authenticated
using (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

alter policy provider_profile_images_insert_own on storage.objects
with check (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

alter policy provider_profile_images_delete_own on storage.objects
using (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

alter policy provider_profile_images_update_own on storage.objects
using (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
)
with check (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

-- A stale authenticated identity without a profile cannot use protected buckets.
alter policy feedback_screenshots_select_own_or_admin on storage.objects
using (
  bucket_id = 'feedback-screenshots'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'::public.profile_role
  )
  )
);

alter policy feedback_screenshots_insert_own on storage.objects
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

alter policy feedback_screenshots_delete_own on storage.objects
using (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

alter policy feedback_screenshots_update_own on storage.objects
using (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
)
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

-- Trigger helpers are implementation details, not externally callable RPCs.
-- Empty search paths prevent caller-controlled objects from shadowing dependencies.
alter function public.set_updated_at() set search_path = '';
alter function public.get_new_profile_role(jsonb) set search_path = '';
alter function public.handle_new_user_profile() set search_path = '';

revoke all on function
  public.set_updated_at(),
  public.get_new_profile_role(jsonb),
  public.handle_new_user_profile(),
  public.sync_provider_profile_account_fields(),
  public.enforce_provider_service_region_limit(),
  public.set_contact_request_last_message_at(),
  public.create_contact_request_initial_message()
from public, anon, authenticated;

-- All protected RPCs reject anonymous calls at the function privilege boundary.
-- Their bodies remain responsible for identity, role, ownership and state checks.
revoke all on function
  public.ensure_current_user_profile(),
  public.replace_provider_service_regions(uuid, uuid[]),
  public.update_provider_communication_preferences(uuid, boolean, public.contact_delivery_method, boolean, text),
  public.record_contact_request_email_delivery(uuid, public.contact_email_delivery_status, text),
  public.mark_contact_request_conversation_read(uuid),
  public.send_contact_request_message(uuid, text),
  public.update_contact_request_conversation_status(uuid, public.contact_request_status, text),
  public.submit_platform_feedback(text, text, text, text, text),
  public.moderate_provider_rating(uuid, text),
  public.get_admin_provider_ratings(uuid),
  public.get_admin_platform_growth_counts(),
  public.get_admin_platform_feedback(text, text, integer),
  public.update_platform_feedback(uuid, text, text),
  public.upsert_provider_rating(uuid, integer, text),
  public.remove_provider_rating(uuid)
from public, anon;

grant execute on function
  public.ensure_current_user_profile(),
  public.replace_provider_service_regions(uuid, uuid[]),
  public.update_provider_communication_preferences(uuid, boolean, public.contact_delivery_method, boolean, text),
  public.record_contact_request_email_delivery(uuid, public.contact_email_delivery_status, text),
  public.mark_contact_request_conversation_read(uuid),
  public.send_contact_request_message(uuid, text),
  public.update_contact_request_conversation_status(uuid, public.contact_request_status, text),
  public.submit_platform_feedback(text, text, text, text, text),
  public.moderate_provider_rating(uuid, text),
  public.get_admin_provider_ratings(uuid),
  public.get_admin_platform_growth_counts(),
  public.get_admin_platform_feedback(text, text, integer),
  public.update_platform_feedback(uuid, text, text),
  public.upsert_provider_rating(uuid, integer, text),
  public.remove_provider_rating(uuid)
to authenticated;

revoke all on function
  public.get_provider_rating_summary(uuid),
  public.get_provider_rating_summaries(uuid[]),
  public.get_provider_visible_reviews(uuid, integer)
from public;

grant execute on function
  public.get_provider_rating_summary(uuid),
  public.get_provider_rating_summaries(uuid[]),
  public.get_provider_visible_reviews(uuid, integer)
to anon, authenticated;
