begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
  if (intent = 'reactivate' and (not existing or previous.status not in ('inactive', 'pending_approval')))
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
  -- A repeat of the current valid pending submission is read-only, even if
  -- its response was lost and the caller retries with an older version. Compare
  -- normalized public content and complete assignment sets under the parent lock.
  -- Every non-identical request still has to pass optimistic concurrency below.
  if existing and previous.status = 'pending_approval' and desired.status = 'pending_approval'
    and row(desired.category_id, desired.business_name, desired.display_name, desired.bio, desired.phone, desired.email, desired.website_url, desired.city, desired.province_state, desired.country, desired.profile_image_path, desired.profile_image_url)
      is not distinct from row(previous.category_id, previous.business_name, previous.display_name, previous.bio, previous.phone, previous.email, previous.website_url, previous.city, previous.province_state, previous.country, previous.profile_image_path, previous.profile_image_url)
    and array(select language_id from public.provider_languages where provider_profile_id = previous.id order by language_id)
      = array(select selected.id from unnest(language_ids) selected(id) order by selected.id)
    and array(select specialty_id from public.provider_specialties where provider_profile_id = previous.id order by specialty_id)
      = array(select selected.id from unnest(specialty_ids) selected(id) order by selected.id)
    and array(select service_region_id from public.provider_service_regions where provider_profile_id = previous.id order by service_region_id)
      = array(select selected.id from unnest(region_ids) selected(id) order by selected.id) then
    return jsonb_build_object('id', previous.id, 'slug', previous.slug, 'revision', previous.revision::text,
      'status', previous.status, 'already_pending', true);
  end if;
  if (existing and previous.revision <> expected_revision) or (not existing and expected_revision <> 0) then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
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
  return jsonb_build_object('id', result.id, 'slug', result.slug, 'revision', result.revision::text, 'status', result.status, 'already_pending', false);
end;
$$;

create or replace function public.save_provider_listing_details(
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
  if not found and expected_details_revision <> 0 then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  -- A stale details token passes zero as the overall version: the core can only
  -- acknowledge identical pending content, and must reject any attempted write.
  -- Read current regions under the parent lock, rather than reposting a stale
  -- hidden region set from the details form. The complete aggregate is validated
  -- and saved inside the same transaction by the existing guarded operation.
  result := public.save_provider_listing(case when listing.details_revision = expected_details_revision then listing.revision else 0 end, fields, language_ids, specialty_ids,
    array(select service_region_id from public.provider_service_regions where provider_profile_id = listing.id), intent);
  select jsonb_build_object('details_revision', p.details_revision::text, 'regions_revision', p.regions_revision::text)
    into versions from public.provider_profiles p where p.id = (result->>'id')::uuid;
  return result || versions;
end;
$$;

commit;
