begin;

alter table public.provider_profiles add column revision bigint not null default 1
  check (revision > 0);

-- Invoker triggers distinguish a direct client write from an authorized definer
-- RPC. No caller-controlled setting or hidden request flag grants a bypass.
create function public.guard_provider_listing_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare content_changed boolean;
begin
  if tg_op <> 'UPDATE' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'use_versioned_listing_operation' using errcode = '42501';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    new.revision := 1;
    return new;
  end if;
  content_changed := (to_jsonb(new) - array['revision', 'updated_at', 'accept_new_inquiries', 'contact_delivery_method', 'new_message_email_enabled'])
    is distinct from (to_jsonb(old) - array['revision', 'updated_at', 'accept_new_inquiries', 'contact_delivery_method', 'new_message_email_enabled']);
  if content_changed or new.revision is distinct from old.revision then
    if current_user in ('anon', 'authenticated') then
      raise exception 'use_versioned_listing_operation' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    if old.status = 'active' and new.status = 'active' then
      new.status := 'pending_approval';
      new.approved_at := null;
      new.submitted_at := pg_catalog.now();
      new.rejection_reason := null;
    end if;
  else
    new.revision := old.revision;
  end if;
  return new;
end;
$$;
create trigger provider_profiles_guard_write before insert or update or delete
on public.provider_profiles for each row execute function public.guard_provider_listing_write();

create function public.guard_provider_assignment_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'use_versioned_listing_operation' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.provider_profile_id <> old.provider_profile_id then
    raise exception 'assignment_owner_immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.touch_provider_listing_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare listing_id uuid;
begin
  -- Auth account deletion cascades through assignments as supabase_auth_admin,
  -- which cannot update public tables. The BEFORE invoker guard has already
  -- rejected direct client writes; this internal definer also permits cascades.
  listing_id := case when tg_op = 'DELETE' then old.provider_profile_id else new.provider_profile_id end;
  update public.provider_profiles set revision = revision + 1 where id = listing_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger provider_languages_guard_write before insert or update or delete
on public.provider_languages for each row execute function public.guard_provider_assignment_write();
create trigger provider_specialties_guard_write before insert or update or delete
on public.provider_specialties for each row execute function public.guard_provider_assignment_write();
create trigger provider_service_regions_guard_write before insert or update or delete
on public.provider_service_regions for each row execute function public.guard_provider_assignment_write();
create trigger provider_languages_touch_revision after insert or update or delete
on public.provider_languages for each row execute function public.touch_provider_listing_revision();
create trigger provider_specialties_touch_revision after insert or update or delete
on public.provider_specialties for each row execute function public.touch_provider_listing_revision();
create trigger provider_service_regions_touch_revision after insert or update or delete
on public.provider_service_regions for each row execute function public.touch_provider_listing_revision();

-- Public editorial identity belongs to the listing. Preserve existing data;
-- synchronize only an actually changed shared contact field. Pending Auth email
-- changes never become public through this trigger.
create or replace function public.sync_provider_profile_account_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
declare sync_phone boolean; sync_email boolean;
begin
  sync_phone := new.phone is distinct from old.phone;
  sync_email := new.email is distinct from old.email and exists (
    select 1 from auth.users u where u.id = new.id and u.email = new.email
      and u.email_confirmed_at is not null
  );
  if sync_phone or sync_email then
    update public.provider_profiles set
      phone = case when sync_phone then new.phone else phone end,
      email = case when sync_email then new.email else email end
    where user_id = new.id;
  end if;
  return new;
end;
$$;

create function public.require_listing_actor(required_role public.profile_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare account_id uuid := auth.uid(); account_role public.profile_role;
begin
  if account_id is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform u.id from auth.users u where u.id = account_id
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= pg_catalog.now())
    for update;
  if not found then raise exception 'verified_account_required' using errcode = '42501'; end if;
  select p.role into account_role from public.profiles p where p.id = account_id for share;
  if account_role is distinct from required_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  return account_id;
end;
$$;

create function public.validate_provider_listing_content(
  listing public.provider_profiles, language_ids uuid[], specialty_ids uuid[],
  region_ids uuid[], complete boolean
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if language_ids is null or specialty_ids is null or region_ids is null
    or cardinality(language_ids) <> (select count(distinct x) from unnest(language_ids) x)
    or cardinality(specialty_ids) <> (select count(distinct x) from unnest(specialty_ids) x)
    or cardinality(region_ids) <> (select count(distinct x) from unnest(region_ids) x)
    or cardinality(region_ids) > 2 then
    raise exception 'invalid_assignments' using errcode = '22023';
  end if;
  if char_length(coalesce(listing.display_name, '')) > 120
    or char_length(coalesce(listing.business_name, '')) > 160
    or char_length(coalesce(listing.bio, '')) > 600
    or char_length(coalesce(listing.phone, '')) > 40
    or char_length(coalesce(listing.email, '')) > 254
    or char_length(coalesce(listing.website_url, '')) > 2048
    or char_length(coalesce(listing.city, '')) > 120
    or char_length(coalesce(listing.province_state, '')) > 120
    or char_length(coalesce(listing.country, '')) > 120 then
    raise exception 'invalid_listing_fields' using errcode = '22023';
  end if;
  if listing.email is not null and listing.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_listing_email' using errcode = '22023';
  end if;
  if listing.website_url is not null and listing.website_url !~* '^https?://[^[:space:]/]+[^[:space:]]*$' then
    raise exception 'invalid_listing_website' using errcode = '22023';
  end if;
  if complete and (nullif(btrim(listing.display_name), '') is null
    or nullif(btrim(listing.business_name), '') is null or listing.category_id is null
    or nullif(btrim(listing.bio), '') is null or nullif(btrim(listing.email), '') is null
    or nullif(btrim(listing.phone), '') is null or nullif(btrim(listing.city), '') is null
    or nullif(btrim(listing.province_state), '') is null or nullif(btrim(listing.country), '') is null
    or cardinality(language_ids) = 0 or cardinality(specialty_ids) = 0) then
    raise exception 'listing_incomplete' using errcode = '23514';
  end if;
  if listing.category_id is not null then
    perform id from public.categories where id = listing.category_id and is_active for share;
    if not found then raise exception 'invalid_category' using errcode = '22023'; end if;
  end if;
  perform id from public.languages where id = any(language_ids) for share;
  perform id from public.specialties where id = any(specialty_ids) for share;
  perform id from public.service_regions where id = any(region_ids) for share;
  if (select count(*) from public.languages where id = any(language_ids) and is_active) <> cardinality(language_ids)
    or (select count(*) from public.specialties where id = any(specialty_ids) and is_active
      and (category_id is null or category_id = listing.category_id)) <> cardinality(specialty_ids)
    or (select count(*) from public.service_regions where id = any(region_ids) and is_active) <> cardinality(region_ids) then
    raise exception 'invalid_assignments' using errcode = '22023';
  end if;
  if listing.profile_image_path is not null then
    if split_part(listing.profile_image_path, '/', 1) <> listing.user_id::text
      or regexp_split_to_array(listing.profile_image_path, '/') && array['', '.', '..']
      or not exists (select 1 from storage.objects where bucket_id = 'provider-profile-images' and name = listing.profile_image_path)
      or listing.profile_image_url is null
      or listing.profile_image_url !~ '^https://[a-zA-Z0-9-]+\.supabase\.co/storage/v1/object/public/provider-profile-images/'
      or regexp_replace(listing.profile_image_url, '^https://[a-zA-Z0-9-]+\.supabase\.co/storage/v1/object/public/provider-profile-images/', '') <> listing.profile_image_path then
      raise exception 'invalid_listing_image' using errcode = '23514';
    end if;
  end if;
end;
$$;

-- A complete desired aggregate, not a patch. Zero is the expected revision only
-- when creating the caller's first listing. Revisions are opaque counters.
-- PT409 returns a deterministic conflict directly to API clients. Do not raise
-- serialization_failure (40001) for stale edits: PostgREST 14 retries it forever.
create function public.save_provider_listing(
  expected_revision bigint, fields jsonb, language_ids uuid[], specialty_ids uuid[],
  region_ids uuid[], intent text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid; previous public.provider_profiles; desired public.provider_profiles;
  normalized jsonb; result public.provider_profiles; existing boolean; slug_base text;
begin
  account_id := public.require_listing_actor('provider');
  if expected_revision is null or expected_revision < 0 or intent is null
    or intent not in ('draft', 'submit', 'reactivate') then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  if fields is null or jsonb_typeof(fields) <> 'object' or exists (
    select 1 from jsonb_each(fields) f where f.key <> all(array[
      'category_id', 'business_name', 'display_name', 'bio', 'phone', 'email',
      'website_url', 'city', 'province_state', 'country', 'profile_image_path', 'profile_image_url'
    ]) or jsonb_typeof(f.value) not in ('string', 'null')
  ) then raise exception 'invalid_listing_fields' using errcode = '22023'; end if;
  select p.* into previous from public.provider_profiles p where p.user_id = account_id for update;
  existing := found;
  if (existing and previous.revision <> expected_revision) or (not existing and expected_revision <> 0) then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  if (intent = 'reactivate' and (not existing or previous.status <> 'inactive'))
    or (intent = 'submit' and existing and previous.status = 'inactive') then
    raise exception 'invalid_listing_transition' using errcode = '23514';
  end if;
  select coalesce(jsonb_object_agg(f.key, case when nullif(btrim(f.value #>> '{}'), '') is null
    then 'null'::jsonb else to_jsonb(btrim(f.value #>> '{}')) end), '{}'::jsonb)
  into normalized from jsonb_each(fields) f;
  desired := jsonb_populate_record(null::public.provider_profiles, normalized);
  desired.user_id := account_id;
  desired.email := lower(desired.email);
  -- Omitting both image fields leaves the image alone. Explicit nulls remove it.
  -- A legacy external image can be retained, but not replaced by an arbitrary URL.
  if existing and not (fields ? 'profile_image_path') and not (fields ? 'profile_image_url') then
    desired.profile_image_path := previous.profile_image_path;
    desired.profile_image_url := previous.profile_image_url;
  elsif desired.profile_image_path is null and desired.profile_image_url is not null then
    if not existing or previous.profile_image_path is not null
      or desired.profile_image_url is distinct from previous.profile_image_url then
      raise exception 'invalid_listing_image' using errcode = '23514';
    end if;
  end if;
  perform public.validate_provider_listing_content(desired, language_ids, specialty_ids, region_ids, intent <> 'draft');
  desired.status := case when intent <> 'draft' then 'pending_approval'::public.provider_profile_status
    when existing and previous.status = 'inactive' then 'inactive'::public.provider_profile_status
    else 'draft'::public.provider_profile_status end;
  if existing then desired.slug := previous.slug;
  else
    slug_base := trim(both '-' from regexp_replace(lower(coalesce(desired.business_name, desired.display_name, 'provider')), '[^a-z0-9]+', '-', 'g'));
    desired.slug := rtrim(left(coalesce(nullif(slug_base, ''), 'provider'), 147), '-') || '-' || right(replace(account_id::text, '-', ''), 12);
  end if;
  if not existing then
    insert into public.provider_profiles (user_id, slug, status)
    values (account_id, desired.slug, 'draft') returning * into previous;
  end if;
  update public.provider_profiles set
    category_id = desired.category_id, business_name = desired.business_name,
    display_name = desired.display_name, bio = desired.bio, phone = desired.phone,
    email = desired.email, website_url = desired.website_url, city = desired.city,
    province_state = desired.province_state, country = desired.country,
    profile_image_path = desired.profile_image_path, profile_image_url = desired.profile_image_url,
    status = desired.status, rejection_reason = null, approved_at = null,
    submitted_at = case when desired.status = 'pending_approval' then pg_catalog.now() else null end,
    revision = revision + 1
  where id = previous.id;
  delete from public.provider_languages where provider_profile_id = previous.id;
  delete from public.provider_specialties where provider_profile_id = previous.id;
  delete from public.provider_service_regions where provider_profile_id = previous.id;
  insert into public.provider_languages (provider_profile_id, language_id) select previous.id, unnest(language_ids);
  insert into public.provider_specialties (provider_profile_id, specialty_id) select previous.id, unnest(specialty_ids);
  insert into public.provider_service_regions (provider_profile_id, service_region_id) select previous.id, unnest(region_ids);
  select * into result from public.provider_profiles where id = previous.id;
  return jsonb_build_object('id', result.id, 'slug', result.slug, 'revision', result.revision::text, 'status', result.status);
end;
$$;

create function public.replace_provider_service_regions(
  target_provider_profile_id uuid, selected_service_region_ids uuid[], expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid; listing public.provider_profiles; fields jsonb;
begin
  account_id := public.require_listing_actor('provider');
  select * into listing from public.provider_profiles
  where id = target_provider_profile_id and user_id = account_id for update;
  if not found then raise exception 'listing_not_owned' using errcode = '42501'; end if;
  fields := jsonb_build_object('category_id', listing.category_id, 'business_name', listing.business_name,
    'display_name', listing.display_name, 'bio', listing.bio, 'phone', listing.phone, 'email', listing.email,
    'website_url', listing.website_url, 'city', listing.city, 'province_state', listing.province_state,
    'country', listing.country, 'profile_image_path', listing.profile_image_path, 'profile_image_url', listing.profile_image_url);
  return public.save_provider_listing(expected_revision, fields,
    array(select language_id from public.provider_languages where provider_profile_id = listing.id),
    array(select specialty_id from public.provider_specialties where provider_profile_id = listing.id),
    selected_service_region_ids, 'draft');
end;
$$;

-- Retain the old signature to fail safely until application callers are upgraded.
create or replace function public.replace_provider_service_regions(target_provider_profile_id uuid, selected_service_region_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'provider')
    or not exists (select 1 from public.provider_profiles where id = target_provider_profile_id and user_id = auth.uid()) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  raise exception 'listing_revision_required' using errcode = 'PT409';
end;
$$;

create function public.review_provider_listing(
  target_listing_id uuid, expected_revision bigint, decision text, reason text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles; next_status public.provider_profile_status;
begin
  actor := public.require_listing_actor('admin');
  select * into listing from public.provider_profiles where id = target_listing_id for update;
  if not found then raise exception 'listing_not_found' using errcode = '42501'; end if;
  if expected_revision is null or listing.revision <> expected_revision then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  if decision = 'approve' and listing.status = 'pending_approval' then next_status := 'active';
  elsif decision = 'reject' and listing.status = 'pending_approval' then
    if nullif(btrim(reason), '') is null or char_length(reason) > 1000 then
      raise exception 'rejection_reason_required' using errcode = '22023';
    end if;
    next_status := 'rejected';
  elsif decision = 'deactivate' and listing.status = 'active' then next_status := 'inactive';
  elsif decision = 'reactivate' and listing.status = 'inactive' then next_status := 'active';
  else raise exception 'invalid_listing_transition' using errcode = '23514'; end if;
  if next_status = 'active' then
    perform public.validate_provider_listing_content(listing,
      array(select language_id from public.provider_languages where provider_profile_id = listing.id),
      array(select specialty_id from public.provider_specialties where provider_profile_id = listing.id),
      array(select service_region_id from public.provider_service_regions where provider_profile_id = listing.id), true);
  end if;
  update public.provider_profiles set status = next_status,
    approved_at = case when next_status = 'active' then pg_catalog.now() else null end,
    rejection_reason = case when next_status = 'rejected' then btrim(reason) else null end
  where id = listing.id returning * into listing;
  return jsonb_build_object('id', listing.id, 'slug', listing.slug, 'revision', listing.revision::text, 'status', listing.status);
end;
$$;

revoke all on function public.guard_provider_listing_write(), public.guard_provider_assignment_write(),
  public.touch_provider_listing_revision(), public.require_listing_actor(public.profile_role),
  public.validate_provider_listing_content(public.provider_profiles,uuid[],uuid[],uuid[],boolean)
from public, anon, authenticated, service_role;
revoke all on function public.save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text),
  public.replace_provider_service_regions(uuid,uuid[],bigint), public.review_provider_listing(uuid,bigint,text,text)
from public, anon, authenticated, service_role;
grant execute on function public.save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text),
  public.replace_provider_service_regions(uuid,uuid[],bigint), public.review_provider_listing(uuid,bigint,text,text)
to authenticated;

commit;
