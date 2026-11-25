begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The overall revision still identifies exactly what an administrator reviewed.
-- Each independent provider form gets its own optimistic edit revision.
alter table public.provider_profiles
  add column details_revision bigint not null default 1 check (details_revision > 0),
  add column regions_revision bigint not null default 1 check (regions_revision > 0);

create or replace function public.guard_provider_listing_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare content_changed boolean; details_changed boolean; review_changed boolean;
begin
  if tg_op <> 'UPDATE' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'use_versioned_listing_operation' using errcode = '42501';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    new.revision := 1;
    new.details_revision := 1;
    new.regions_revision := 1;
    return new;
  end if;
  content_changed := (to_jsonb(new) - array['revision', 'details_revision', 'regions_revision', 'updated_at',
    'accept_new_inquiries', 'contact_delivery_method', 'new_message_email_enabled'])
    is distinct from (to_jsonb(old) - array['revision', 'details_revision', 'regions_revision', 'updated_at',
    'accept_new_inquiries', 'contact_delivery_method', 'new_message_email_enabled']);
  details_changed := (to_jsonb(new) - array['revision', 'details_revision', 'regions_revision', 'updated_at',
    'accept_new_inquiries', 'contact_delivery_method', 'new_message_email_enabled',
    'status', 'submitted_at', 'approved_at', 'rejection_reason'])
    is distinct from (to_jsonb(old) - array['revision', 'details_revision', 'regions_revision', 'updated_at',
    'accept_new_inquiries', 'contact_delivery_method', 'new_message_email_enabled',
    'status', 'submitted_at', 'approved_at', 'rejection_reason']);
  -- A moderation decision requires both editors to reload, even without a text
  -- change. Provider draft/submission saves do not invalidate an unrelated form.
  review_changed := new.status is distinct from old.status and new.status in ('active', 'rejected', 'inactive');
  if content_changed or new.revision is distinct from old.revision
    or new.details_revision is distinct from old.details_revision
    or new.regions_revision is distinct from old.regions_revision then
    if current_user in ('anon', 'authenticated') then
      raise exception 'use_versioned_listing_operation' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.details_revision := old.details_revision + case when details_changed or review_changed
      or new.details_revision is distinct from old.details_revision then 1 else 0 end;
    new.regions_revision := old.regions_revision + case when review_changed
      or new.regions_revision is distinct from old.regions_revision then 1 else 0 end;
    if old.status = 'active' and new.status = 'active' then
      new.status := 'pending_approval';
      new.approved_at := null;
      new.submitted_at := pg_catalog.now();
      new.rejection_reason := null;
    end if;
  else
    new.revision := old.revision;
    new.details_revision := old.details_revision;
    new.regions_revision := old.regions_revision;
  end if;
  return new;
end;
$$;

create or replace function public.touch_provider_listing_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare listing_id uuid;
begin
  listing_id := case when tg_op = 'DELETE' then old.provider_profile_id else new.provider_profile_id end;
  if tg_table_name = 'provider_service_regions' then
    update public.provider_profiles set regions_revision = regions_revision + 1 where id = listing_id;
  else
    update public.provider_profiles set details_revision = details_revision + 1 where id = listing_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Keep legacy whole-listing CAS callers safe. Retain unchanged assignments so
-- another editor does not receive a false conflict from delete/reinsert churn.
create or replace function public.save_provider_listing(
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
  delete from public.provider_languages where provider_profile_id = previous.id and not (language_id = any(language_ids));
  insert into public.provider_languages (provider_profile_id, language_id)
    select previous.id, selected.id from unnest(language_ids) selected(id)
    where not exists (select 1 from public.provider_languages existing where existing.provider_profile_id = previous.id and existing.language_id = selected.id);
  delete from public.provider_specialties where provider_profile_id = previous.id and not (specialty_id = any(specialty_ids));
  insert into public.provider_specialties (provider_profile_id, specialty_id)
    select previous.id, selected.id from unnest(specialty_ids) selected(id)
    where not exists (select 1 from public.provider_specialties existing where existing.provider_profile_id = previous.id and existing.specialty_id = selected.id);
  delete from public.provider_service_regions where provider_profile_id = previous.id and not (service_region_id = any(region_ids));
  insert into public.provider_service_regions (provider_profile_id, service_region_id)
    select previous.id, selected.id from unnest(region_ids) selected(id)
    where not exists (select 1 from public.provider_service_regions existing where existing.provider_profile_id = previous.id and existing.service_region_id = selected.id);
  select * into result from public.provider_profiles where id = previous.id;
  return jsonb_build_object('id', result.id, 'slug', result.slug, 'revision', result.revision::text, 'status', result.status);
end;
$$;

create function public.save_provider_listing_details(
  expected_details_revision bigint, fields jsonb, language_ids uuid[], specialty_ids uuid[], intent text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid; listing public.provider_profiles; result jsonb; versions jsonb;
begin
  account_id := public.require_listing_actor('provider');
  if expected_details_revision is null or expected_details_revision < 0 then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  select * into listing from public.provider_profiles where user_id = account_id for update;
  if (found and listing.details_revision <> expected_details_revision)
    or (not found and expected_details_revision <> 0) then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  -- Read current regions under the parent lock, rather than reposting a stale
  -- hidden region set from the details form. The complete aggregate is validated
  -- and saved inside the same transaction by the existing guarded operation.
  result := public.save_provider_listing(coalesce(listing.revision, 0), fields, language_ids, specialty_ids,
    array(select service_region_id from public.provider_service_regions where provider_profile_id = listing.id), intent);
  select jsonb_build_object('details_revision', p.details_revision::text, 'regions_revision', p.regions_revision::text)
    into versions from public.provider_profiles p where p.id = (result->>'id')::uuid;
  return result || versions;
end;
$$;

create function public.save_provider_service_regions(expected_regions_revision bigint, selected_service_region_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid; listing public.provider_profiles; result jsonb; versions jsonb;
begin
  account_id := public.require_listing_actor('provider');
  if expected_regions_revision is null or expected_regions_revision <= 0 then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  select * into listing from public.provider_profiles where user_id = account_id for update;
  if not found then raise exception 'listing_not_owned' using errcode = '42501'; end if;
  if listing.regions_revision <> expected_regions_revision then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  -- The existing operation reads current details/assignments under this same lock.
  result := public.replace_provider_service_regions(listing.id, selected_service_region_ids, listing.revision);
  select jsonb_build_object('details_revision', p.details_revision::text, 'regions_revision', p.regions_revision::text)
    into versions from public.provider_profiles p where p.id = listing.id;
  return result || versions;
end;
$$;

revoke all on function public.save_provider_listing_details(bigint,jsonb,uuid[],uuid[],text),
  public.save_provider_service_regions(bigint,uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.save_provider_listing_details(bigint,jsonb,uuid[],uuid[],text),
  public.save_provider_service_regions(bigint,uuid[]) to authenticated;

commit;
