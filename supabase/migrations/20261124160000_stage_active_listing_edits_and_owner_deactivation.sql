begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Approved rows remain public. Proposed content is never stored on a public row.
create table public.provider_listing_changes (
  provider_profile_id uuid primary key references public.provider_profiles(id) on delete cascade,
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  language_ids uuid[] not null,
  specialty_ids uuid[] not null,
  region_ids uuid[] not null,
  state text not null check (state in ('draft', 'pending_edit', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state <> 'pending_edit' or submitted_at is not null)
);
create index provider_listing_changes_pending_idx on public.provider_listing_changes(submitted_at)
  where state = 'pending_edit';
alter table public.provider_listing_changes enable row level security;
revoke all on table public.provider_listing_changes from public, anon, authenticated, service_role;
grant select on table public.provider_listing_changes to authenticated;
grant select, insert, update, delete on table public.provider_listing_changes to service_role;
create policy provider_listing_changes_read on public.provider_listing_changes for select to authenticated
using (
  exists (select 1 from public.profiles me where me.id=auth.uid() and (
    me.role='admin' or (me.role='provider' and exists (
      select 1 from public.provider_profiles p where p.id=provider_profile_id and p.user_id=me.id
    ))
  ))
);
create function public.guard_provider_listing_change_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'use_versioned_listing_operation' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger provider_listing_changes_guard_write
before insert or update or delete on public.provider_listing_changes
for each row execute function public.guard_provider_listing_change_write();

-- Version-only updates for private proposals must not withdraw approved content.
-- Actual uncoordinated public edits retain the previous fail-safe withdrawal.
create or replace function public.guard_provider_listing_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare content_changed boolean; details_changed boolean; review_changed boolean;
begin
  if tg_op <> 'UPDATE' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'use_versioned_listing_operation' using errcode = '42501';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    new.revision := 1; new.details_revision := 1; new.regions_revision := 1;
    return new;
  end if;
  content_changed := (to_jsonb(new) - array['revision','details_revision','regions_revision','updated_at',
    'accept_new_inquiries','contact_delivery_method','new_message_email_enabled'])
    is distinct from (to_jsonb(old) - array['revision','details_revision','regions_revision','updated_at',
    'accept_new_inquiries','contact_delivery_method','new_message_email_enabled']);
  details_changed := (to_jsonb(new) - array['revision','details_revision','regions_revision','updated_at',
    'accept_new_inquiries','contact_delivery_method','new_message_email_enabled','status','submitted_at','approved_at','rejection_reason'])
    is distinct from (to_jsonb(old) - array['revision','details_revision','regions_revision','updated_at',
    'accept_new_inquiries','contact_delivery_method','new_message_email_enabled','status','submitted_at','approved_at','rejection_reason']);
  review_changed := new.status is distinct from old.status and new.status in ('active','rejected','inactive');
  if content_changed or new.revision is distinct from old.revision
    or new.details_revision is distinct from old.details_revision or new.regions_revision is distinct from old.regions_revision then
    if current_user in ('anon', 'authenticated') then
      raise exception 'use_versioned_listing_operation' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.details_revision := old.details_revision + case when details_changed or review_changed
      or new.details_revision is distinct from old.details_revision then 1 else 0 end;
    new.regions_revision := old.regions_revision + case when review_changed
      or new.regions_revision is distinct from old.regions_revision then 1 else 0 end;
    if details_changed and old.status = 'active' and new.status = 'active' then
      new.status := 'pending_approval'; new.approved_at := null;
      new.submitted_at := pg_catalog.now(); new.rejection_reason := null;
    end if;
  else
    new.revision := old.revision; new.details_revision := old.details_revision; new.regions_revision := old.regions_revision;
  end if;
  return new;
end;
$$;
create or replace function public.touch_provider_listing_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare listing_id uuid;
begin
  listing_id := case when tg_op = 'DELETE' then old.provider_profile_id else new.provider_profile_id end;
  update public.provider_profiles set
    details_revision = details_revision + case when tg_table_name <> 'provider_service_regions' then 1 else 0 end,
    regions_revision = regions_revision + case when tg_table_name = 'provider_service_regions' then 1 else 0 end,
    status = case when status = 'active' then 'pending_approval'::public.provider_profile_status else status end,
    approved_at = case when status = 'active' then null else approved_at end,
    submitted_at = case when status = 'active' then pg_catalog.now() else submitted_at end
  where id = listing_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.provider_listing_public_fields(listing public.provider_profiles)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('category_id',listing.category_id,'business_name',listing.business_name,
    'display_name',listing.display_name,'bio',listing.bio,'phone',listing.phone,'email',listing.email,
    'website_url',listing.website_url,'city',listing.city,'province_state',listing.province_state,
    'country',listing.country,'profile_image_path',listing.profile_image_path,'profile_image_url',listing.profile_image_url);
$$;
create function public.provider_listing_operation_result(listing_id uuid, already_pending boolean default false, no_changes boolean default false)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('id',p.id,'slug',p.slug,'revision',p.revision::text,
    'details_revision',p.details_revision::text,'regions_revision',p.regions_revision::text,
    'status',p.status,'review_status',c.state,'already_pending',already_pending,'no_changes',no_changes)
  from public.provider_profiles p left join public.provider_listing_changes c on c.provider_profile_id=p.id
  where p.id=listing_id;
$$;

-- Preserve the tested first-approval/reactivation implementation as an internal
-- operation. No client can call it directly to bypass staging on an active row.
alter function public.save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text)
  rename to save_unpublished_provider_listing;
alter function public.review_provider_listing(uuid,bigint,text,text)
  rename to review_unpublished_provider_listing;
revoke all on function public.save_unpublished_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text),
  public.review_unpublished_provider_listing(uuid,bigint,text,text)
from public, anon, authenticated, service_role;

create function public.stage_provider_listing_edit(
  listing_id uuid, expected_revision bigint, fields jsonb, language_ids uuid[],
  specialty_ids uuid[], region_ids uuid[], intent text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  listing public.provider_profiles; desired public.provider_profiles; change public.provider_listing_changes;
  normalized jsonb; desired_fields jsonb; current_fields jsonb;
  current_languages uuid[]; current_specialties uuid[]; current_regions uuid[];
  desired_languages uuid[]; desired_specialties uuid[]; desired_regions uuid[];
  details_changed boolean; regions_changed boolean; desired_state text; same_content boolean;
begin
  select * into listing from public.provider_profiles where id=listing_id for update;
  if not found or listing.status <> 'active' then
    raise exception 'invalid_listing_transition' using errcode = '23514';
  end if;
  if expected_revision is null or expected_revision < 0 or intent is null or intent not in ('draft','submit') then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  if fields is null or jsonb_typeof(fields) <> 'object' or exists (
    select 1 from jsonb_each(fields) f where f.key <> all(array[
      'category_id','business_name','display_name','bio','phone','email','website_url',
      'city','province_state','country','profile_image_path','profile_image_url'
    ]) or jsonb_typeof(f.value) not in ('string','null')
  ) then raise exception 'invalid_listing_fields' using errcode = '22023'; end if;
  select * into change from public.provider_listing_changes where provider_profile_id=listing.id;
  current_fields := coalesce(change.fields, public.provider_listing_public_fields(listing));
  select coalesce(jsonb_object_agg(f.key,case when nullif(btrim(f.value #>> '{}'),'') is null
    then 'null'::jsonb else to_jsonb(btrim(f.value #>> '{}')) end),'{}'::jsonb)
  into normalized from jsonb_each(fields) f;
  desired := jsonb_populate_record(null::public.provider_profiles,normalized);
  desired.user_id := listing.user_id; desired.email := lower(desired.email);
  if not (fields ? 'profile_image_path') and not (fields ? 'profile_image_url') then
    desired.profile_image_path := current_fields->>'profile_image_path';
    desired.profile_image_url := current_fields->>'profile_image_url';
  elsif desired.profile_image_path is null and desired.profile_image_url is not null then
    if current_fields->>'profile_image_path' is not null
      or desired.profile_image_url is distinct from (current_fields->>'profile_image_url') then
      raise exception 'invalid_listing_image' using errcode = '23514';
    end if;
  end if;
  perform public.validate_provider_listing_content(desired,language_ids,specialty_ids,region_ids,intent='submit');
  desired_fields := public.provider_listing_public_fields(desired);
  current_languages := coalesce(change.language_ids,
    array(select language_id from public.provider_languages where provider_profile_id=listing.id order by language_id));
  current_specialties := coalesce(change.specialty_ids,
    array(select specialty_id from public.provider_specialties where provider_profile_id=listing.id order by specialty_id));
  current_regions := coalesce(change.region_ids,
    array(select service_region_id from public.provider_service_regions where provider_profile_id=listing.id order by service_region_id));
  desired_languages := array(select x from unnest(language_ids) x order by x);
  desired_specialties := array(select x from unnest(specialty_ids) x order by x);
  desired_regions := array(select x from unnest(region_ids) x order by x);
  details_changed := desired_fields is distinct from current_fields
    or desired_languages is distinct from current_languages or desired_specialties is distinct from current_specialties;
  regions_changed := desired_regions is distinct from current_regions;
  same_content := not details_changed and not regions_changed;
  desired_state := case when intent='submit' then 'pending_edit' else 'draft' end;
  -- Lost-response retries may only acknowledge identical pending edits, never write.
  if change.state='pending_edit' and desired_state='pending_edit' and same_content then
    return public.provider_listing_operation_result(listing.id,true,false);
  end if;
  if listing.revision <> expected_revision then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  if desired_fields = public.provider_listing_public_fields(listing)
    and desired_languages = array(select language_id from public.provider_languages where provider_profile_id=listing.id order by language_id)
    and desired_specialties = array(select specialty_id from public.provider_specialties where provider_profile_id=listing.id order by specialty_id)
    and desired_regions = array(select service_region_id from public.provider_service_regions where provider_profile_id=listing.id order by service_region_id) then
    if change.provider_profile_id is not null then
      delete from public.provider_listing_changes where provider_profile_id=listing.id;
      update public.provider_profiles set revision=revision+1,
        details_revision=details_revision+case when details_changed then 1 else 0 end,
        regions_revision=regions_revision+case when regions_changed then 1 else 0 end where id=listing.id;
    end if;
    return public.provider_listing_operation_result(listing.id,false,true);
  end if;
  if same_content and change.state=desired_state then
    return public.provider_listing_operation_result(listing.id,false,false);
  end if;
  insert into public.provider_listing_changes(provider_profile_id,fields,language_ids,specialty_ids,region_ids,state,submitted_at)
  values(listing.id,desired_fields,desired_languages,desired_specialties,desired_regions,desired_state,
    case when desired_state='pending_edit' then pg_catalog.now() else null end)
  on conflict(provider_profile_id) do update set fields=excluded.fields,language_ids=excluded.language_ids,
    specialty_ids=excluded.specialty_ids,region_ids=excluded.region_ids,state=excluded.state,
    submitted_at=excluded.submitted_at,rejection_reason=null,updated_at=pg_catalog.now();
  update public.provider_profiles set revision=revision+1,
    details_revision=details_revision+case when details_changed then 1 else 0 end,
    regions_revision=regions_revision+case when regions_changed then 1 else 0 end where id=listing.id;
  return public.provider_listing_operation_result(listing.id,false,false);
end;
$$;

create function public.save_provider_listing(
  expected_revision bigint, fields jsonb, language_ids uuid[], specialty_ids uuid[], region_ids uuid[], intent text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles; change public.provider_listing_changes; result jsonb;
begin
  actor := public.require_listing_actor('provider');
  select * into listing from public.provider_profiles where user_id=actor for update;
  if found and listing.status='active' then
    return public.stage_provider_listing_edit(listing.id,expected_revision,fields,language_ids,specialty_ids,region_ids,intent);
  end if;
  select * into change from public.provider_listing_changes where provider_profile_id=listing.id;
  if change.provider_profile_id is not null then fields := change.fields || fields; end if;
  result := public.save_unpublished_provider_listing(expected_revision,fields,language_ids,specialty_ids,region_ids,intent);
  delete from public.provider_listing_changes where provider_profile_id=(result->>'id')::uuid;
  return public.provider_listing_operation_result((result->>'id')::uuid,coalesce((result->>'already_pending')::boolean,false),false);
end;
$$;

create or replace function public.save_provider_listing_details(
  expected_details_revision bigint, fields jsonb, language_ids uuid[], specialty_ids uuid[], intent text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles; change public.provider_listing_changes;
begin
  actor := public.require_listing_actor('provider');
  if expected_details_revision is null or expected_details_revision < 0 then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  select * into listing from public.provider_profiles where user_id=actor for update;
  if not found and expected_details_revision <> 0 then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  select * into change from public.provider_listing_changes where provider_profile_id=listing.id;
  return public.save_provider_listing(
    case when listing.details_revision=expected_details_revision then listing.revision else 0 end,
    fields,language_ids,specialty_ids,coalesce(change.region_ids,
      array(select service_region_id from public.provider_service_regions where provider_profile_id=listing.id)),intent);
end;
$$;

create or replace function public.replace_provider_service_regions(
  target_provider_profile_id uuid, selected_service_region_ids uuid[], expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles; change public.provider_listing_changes;
begin
  actor := public.require_listing_actor('provider');
  select * into listing from public.provider_profiles where id=target_provider_profile_id and user_id=actor for update;
  if not found then raise exception 'listing_not_owned' using errcode = '42501'; end if;
  select * into change from public.provider_listing_changes where provider_profile_id=listing.id;
  return public.save_provider_listing(expected_revision,coalesce(change.fields,public.provider_listing_public_fields(listing)),
    coalesce(change.language_ids,array(select language_id from public.provider_languages where provider_profile_id=listing.id)),
    coalesce(change.specialty_ids,array(select specialty_id from public.provider_specialties where provider_profile_id=listing.id)),
    selected_service_region_ids,'draft');
end;
$$;

create or replace function public.save_provider_service_regions(expected_regions_revision bigint, selected_service_region_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles;
begin
  actor := public.require_listing_actor('provider');
  if expected_regions_revision is null or expected_regions_revision <= 0 then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  select * into listing from public.provider_profiles where user_id=actor for update;
  if not found then raise exception 'listing_not_owned' using errcode = '42501'; end if;
  if listing.regions_revision <> expected_regions_revision then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  return public.replace_provider_service_regions(listing.id,selected_service_region_ids,listing.revision);
end;
$$;

create function public.review_provider_listing(
  target_listing_id uuid, expected_revision bigint, decision text, reason text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles; desired public.provider_profiles; change public.provider_listing_changes;
begin
  actor := public.require_listing_actor('admin');
  select * into listing from public.provider_profiles where id=target_listing_id for update;
  if not found then raise exception 'listing_not_found' using errcode = '42501'; end if;
  if expected_revision is null or expected_revision <> listing.revision then
    raise exception 'listing_conflict' using errcode = 'PT409';
  end if;
  select * into change from public.provider_listing_changes where provider_profile_id=listing.id;
  if listing.status='active' and change.state='pending_edit' and decision in ('approve','reject') then
    if decision='reject' then
      if nullif(btrim(reason),'') is null or char_length(reason)>1000 then
        raise exception 'rejection_reason_required' using errcode = '22023';
      end if;
      update public.provider_listing_changes set state='rejected',rejection_reason=btrim(reason),updated_at=pg_catalog.now()
        where provider_profile_id=listing.id;
      update public.provider_profiles set details_revision=details_revision+1,regions_revision=regions_revision+1 where id=listing.id;
    else
      desired := jsonb_populate_record(listing,change.fields);
      perform public.validate_provider_listing_content(desired,change.language_ids,change.specialty_ids,change.region_ids,true);
      -- These intermediate states are inside this transaction; public readers see
      -- the former approved aggregate until the complete replacement commits.
      update public.provider_profiles set status='pending_approval',
        category_id=desired.category_id,business_name=desired.business_name,display_name=desired.display_name,
        bio=desired.bio,phone=desired.phone,email=desired.email,website_url=desired.website_url,
        city=desired.city,province_state=desired.province_state,country=desired.country,
        profile_image_path=desired.profile_image_path,profile_image_url=desired.profile_image_url where id=listing.id;
      delete from public.provider_languages where provider_profile_id=listing.id and not(language_id=any(change.language_ids));
      insert into public.provider_languages(provider_profile_id,language_id)
        select listing.id,x from unnest(change.language_ids) x
        where not exists(select 1 from public.provider_languages a where a.provider_profile_id=listing.id and a.language_id=x);
      delete from public.provider_specialties where provider_profile_id=listing.id and not(specialty_id=any(change.specialty_ids));
      insert into public.provider_specialties(provider_profile_id,specialty_id)
        select listing.id,x from unnest(change.specialty_ids) x
        where not exists(select 1 from public.provider_specialties a where a.provider_profile_id=listing.id and a.specialty_id=x);
      delete from public.provider_service_regions where provider_profile_id=listing.id and not(service_region_id=any(change.region_ids));
      insert into public.provider_service_regions(provider_profile_id,service_region_id)
        select listing.id,x from unnest(change.region_ids) x
        where not exists(select 1 from public.provider_service_regions a where a.provider_profile_id=listing.id and a.service_region_id=x);
      update public.provider_profiles set status='active',approved_at=pg_catalog.now(),rejection_reason=null where id=listing.id;
      delete from public.provider_listing_changes where provider_profile_id=listing.id;
    end if;
    return public.provider_listing_operation_result(listing.id,false,false) || jsonb_build_object('reviewed_edit',true);
  end if;
  perform public.review_unpublished_provider_listing(listing.id,expected_revision,decision,reason);
  if decision='deactivate' then
    update public.provider_listing_changes set state='draft',submitted_at=null,rejection_reason=null,updated_at=pg_catalog.now()
      where provider_profile_id=listing.id;
  end if;
  return public.provider_listing_operation_result(listing.id,false,false) || jsonb_build_object('reviewed_edit',false);
end;
$$;

create function public.deactivate_provider_listing(expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; listing public.provider_profiles;
begin
  actor := public.require_listing_actor('provider');
  if expected_revision is null or expected_revision <= 0 then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  select * into listing from public.provider_profiles where user_id=actor for update;
  if not found then raise exception 'listing_not_owned' using errcode = '42501'; end if;
  if listing.status='inactive' then
    return public.provider_listing_operation_result(listing.id,false,false) || jsonb_build_object('already_inactive',true);
  end if;
  if listing.revision <> expected_revision then raise exception 'listing_conflict' using errcode = 'PT409'; end if;
  if listing.status <> 'active' then raise exception 'invalid_listing_transition' using errcode = '23514'; end if;
  update public.provider_listing_changes set state='draft',submitted_at=null,rejection_reason=null,updated_at=pg_catalog.now()
    where provider_profile_id=listing.id;
  update public.provider_profiles set status='inactive' where id=listing.id;
  return public.provider_listing_operation_result(listing.id,false,false) || jsonb_build_object('already_inactive',false);
end;
$$;

create function public.get_provider_listing_editor(lookup_field text, lookup_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; actor_role public.profile_role; result jsonb;
begin
  select role into actor_role from public.profiles where id=auth.uid();
  actor := public.require_listing_actor(case when actor_role='admin' then 'admin'::public.profile_role else 'provider'::public.profile_role end);
  if lookup_field is null or lookup_field not in ('id','user_id') or lookup_id is null then
    raise exception 'invalid_listing_request' using errcode = '22023';
  end if;
  if actor_role='provider' and lookup_field='user_id' and lookup_id <> actor then
    raise exception 'listing_not_owned' using errcode = '42501';
  end if;
  -- One statement reads parent, candidate, complete assignment sets and names.
  select to_jsonb(p) || candidate.fields || jsonb_build_object(
    'revision',p.revision::text,'details_revision',p.details_revision::text,'regions_revision',p.regions_revision::text,
    'review_status',c.state,'review_submitted_at',c.submitted_at,
    'rejection_reason',case when c.state='rejected' then c.rejection_reason else p.rejection_reason end,
    'submitted_at',case when c.state='pending_edit' then c.submitted_at else p.submitted_at end,
    'languageIds',candidate.language_ids,'specialtyIds',candidate.specialty_ids,'serviceRegionIds',candidate.region_ids,
    'categoryName',(select name from public.categories where id=(candidate.fields->>'category_id')::uuid),
    'languageNames',(select coalesce(jsonb_agg(coalesce(l.name,x.id::text) order by coalesce(l.name,x.id::text)),'[]'::jsonb)
      from unnest(candidate.language_ids) x(id) left join public.languages l on l.id=x.id),
    'specialtyNames',(select coalesce(jsonb_agg(coalesce(s.name,x.id::text) order by coalesce(s.name,x.id::text)),'[]'::jsonb)
      from unnest(candidate.specialty_ids) x(id) left join public.specialties s on s.id=x.id),
    'serviceRegionNames',(select coalesce(jsonb_agg(coalesce(r.name,x.id::text) order by coalesce(r.name,x.id::text)),'[]'::jsonb)
      from unnest(candidate.region_ids) x(id) left join public.service_regions r on r.id=x.id),
    'published',public.provider_listing_public_fields(p)
  ) into result
  from public.provider_profiles p
  left join public.provider_listing_changes c on c.provider_profile_id=p.id
  cross join lateral(select
    case when c.provider_profile_id is not null and (actor_role='provider' or c.state='pending_edit')
      then c.fields else public.provider_listing_public_fields(p) end as fields,
    case when c.provider_profile_id is not null and (actor_role='provider' or c.state='pending_edit')
      then c.language_ids else array(select language_id from public.provider_languages where provider_profile_id=p.id order by language_id) end as language_ids,
    case when c.provider_profile_id is not null and (actor_role='provider' or c.state='pending_edit')
      then c.specialty_ids else array(select specialty_id from public.provider_specialties where provider_profile_id=p.id order by specialty_id) end as specialty_ids,
    case when c.provider_profile_id is not null and (actor_role='provider' or c.state='pending_edit')
      then c.region_ids else array(select service_region_id from public.provider_service_regions where provider_profile_id=p.id order by service_region_id) end as region_ids
  ) candidate
  where (actor_role='admin' or p.user_id=actor)
    and ((lookup_field='id' and p.id=lookup_id) or (lookup_field='user_id' and p.user_id=lookup_id));
  if result is null and actor_role='provider' and lookup_field='id' then
    raise exception 'listing_not_owned' using errcode = '42501';
  end if;
  return result;
end;
$$;

-- Shared contact changes also become a private draft for an approved listing.
-- A personal-profile save must not publish other unsent listing edits.
create or replace function public.sync_provider_profile_account_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
declare sync_phone boolean; sync_email boolean; listing public.provider_profiles; change public.provider_listing_changes; next_fields jsonb; prior_fields jsonb;
begin
  sync_phone := new.phone is distinct from old.phone;
  sync_email := new.email is distinct from old.email and exists (
    select 1 from auth.users u where u.id=new.id and u.email=new.email and u.email_confirmed_at is not null
  );
  if not sync_phone and not sync_email then return new; end if;
  select * into listing from public.provider_profiles where user_id=new.id for update;
  if not found then return new; end if;
  if listing.status <> 'active' then
    update public.provider_profiles set phone=case when sync_phone then new.phone else phone end,
      email=case when sync_email then new.email else email end where id=listing.id;
    return new;
  end if;
  select * into change from public.provider_listing_changes where provider_profile_id=listing.id;
  prior_fields := coalesce(change.fields,public.provider_listing_public_fields(listing));
  next_fields := prior_fields
    || case when sync_phone then jsonb_build_object('phone',new.phone) else '{}'::jsonb end
    || case when sync_email then jsonb_build_object('email',new.email) else '{}'::jsonb end;
  if next_fields=prior_fields then return new; end if;
  insert into public.provider_listing_changes(provider_profile_id,fields,language_ids,specialty_ids,region_ids,state)
  values(listing.id,next_fields,
    coalesce(change.language_ids,array(select language_id from public.provider_languages where provider_profile_id=listing.id order by language_id)),
    coalesce(change.specialty_ids,array(select specialty_id from public.provider_specialties where provider_profile_id=listing.id order by specialty_id)),
    coalesce(change.region_ids,array(select service_region_id from public.provider_service_regions where provider_profile_id=listing.id order by service_region_id)),
    'draft')
  on conflict(provider_profile_id) do update set fields=excluded.fields,state='draft',submitted_at=null,
    rejection_reason=null,updated_at=pg_catalog.now();
  update public.provider_profiles set details_revision=details_revision+1 where id=listing.id;
  return new;
end;
$$;

create view public.provider_listing_review_queue with (security_invoker=true) as
select p.*,
  case when p.status='pending_approval' then 'pending_approval'
    when p.status='active' and c.state='pending_edit' then 'pending_edit' else null end as review_type,
  case when p.status='active' and c.state='pending_edit' then c.submitted_at else p.submitted_at end as review_submitted_at
from public.provider_profiles p left join public.provider_listing_changes c on c.provider_profile_id=p.id;
revoke all on table public.provider_listing_review_queue from public, anon, authenticated, service_role;
grant select on table public.provider_listing_review_queue to authenticated;

revoke all on function public.guard_provider_listing_change_write(),
  public.provider_listing_public_fields(public.provider_profiles),
  public.provider_listing_operation_result(uuid,boolean,boolean),
  public.stage_provider_listing_edit(uuid,bigint,jsonb,uuid[],uuid[],uuid[],text)
from public, anon, authenticated, service_role;
revoke all on function public.save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text),
  public.review_provider_listing(uuid,bigint,text,text),
  public.deactivate_provider_listing(bigint),public.get_provider_listing_editor(text,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text),
  public.review_provider_listing(uuid,bigint,text,text),
  public.deactivate_provider_listing(bigint),public.get_provider_listing_editor(text,uuid)
to authenticated;
notify pgrst, 'reload schema';
commit;
