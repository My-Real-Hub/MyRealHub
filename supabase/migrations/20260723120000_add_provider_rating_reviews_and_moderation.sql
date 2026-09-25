do $$
begin
  if not exists (
    select 1
    from pg_type
    join pg_namespace
      on pg_namespace.oid = pg_type.typnamespace
    where pg_namespace.nspname = 'public'
      and pg_type.typname = 'provider_rating_moderation_status'
  ) then
    create type public.provider_rating_moderation_status as enum (
      'visible',
      'hidden',
      'removed'
    );
  end if;
end $$;

alter table public.provider_ratings
  add column if not exists review text,
  add column if not exists moderation_status public.provider_rating_moderation_status
    not null default 'visible',
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid
    references public.profiles(id) on delete set null;

alter table public.provider_ratings
  drop constraint if exists provider_ratings_review_length_check;

alter table public.provider_ratings
  add constraint provider_ratings_review_length_check
  check (
    review is null
    or char_length(btrim(review)) <= 1000
  );

create index if not exists provider_ratings_provider_status_created_idx
  on public.provider_ratings (
    provider_profile_id,
    moderation_status,
    created_at desc
  );

create index if not exists provider_ratings_moderation_status_updated_idx
  on public.provider_ratings (moderation_status, updated_at desc);

revoke all
on table public.provider_ratings
from anon;

revoke insert, update, delete
on table public.provider_ratings
from authenticated;

revoke update (rating)
on table public.provider_ratings
from authenticated;

grant select
on table public.provider_ratings
to authenticated;

drop policy if exists provider_ratings_insert_own_non_self
on public.provider_ratings;

drop policy if exists provider_ratings_update_own_non_self
on public.provider_ratings;

drop policy if exists provider_ratings_delete_own
on public.provider_ratings;

drop policy if exists provider_ratings_select_own
on public.provider_ratings;

create policy provider_ratings_select_own
on public.provider_ratings
for select
to authenticated
using ((select auth.uid()) = rater_user_id);

drop policy if exists provider_ratings_select_admin
on public.provider_ratings;

create policy provider_ratings_select_admin
on public.provider_ratings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

create or replace function public.upsert_provider_rating(
  target_provider_profile_id uuid,
  target_rating smallint,
  target_review text default null
)
returns table (
  id uuid,
  provider_profile_id uuid,
  rater_user_id uuid,
  rating smallint,
  review text,
  moderation_status public.provider_rating_moderation_status,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_review text := nullif(btrim(target_review), '');
  profile_role public.profile_role;
  provider_record record;
  saved_rating public.provider_ratings%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if target_rating is null or target_rating < 1 or target_rating > 5 then
    raise exception 'rating_out_of_range' using errcode = '23514';
  end if;

  if normalized_review is not null and char_length(normalized_review) > 1000 then
    raise exception 'review_too_long' using errcode = '22001';
  end if;

  select profiles.role
  into profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if profile_role not in (
    'user'::public.profile_role,
    'provider'::public.profile_role
  ) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  select
    provider_profiles.id,
    provider_profiles.user_id,
    provider_profiles.status
  into provider_record
  from public.provider_profiles
  where provider_profiles.id = target_provider_profile_id;

  if not found or provider_record.status <> 'active'::public.provider_profile_status then
    raise exception 'provider_not_available' using errcode = '42501';
  end if;

  if provider_record.user_id = current_user_id then
    raise exception 'self_rating_not_allowed' using errcode = '42501';
  end if;

  insert into public.provider_ratings as provider_rating (
    provider_profile_id,
    rater_user_id,
    rating,
    review,
    moderation_status,
    moderated_at,
    moderated_by
  )
  values (
    target_provider_profile_id,
    current_user_id,
    target_rating,
    normalized_review,
    'visible'::public.provider_rating_moderation_status,
    null,
    null
  )
  on conflict (rater_user_id, provider_profile_id) do update
  set
    rating = excluded.rating,
    review = excluded.review,
    moderation_status = case
      when provider_rating.moderation_status =
        'hidden'::public.provider_rating_moderation_status
        then provider_rating.moderation_status
      else 'visible'::public.provider_rating_moderation_status
    end,
    moderated_at = case
      when provider_rating.moderation_status =
        'hidden'::public.provider_rating_moderation_status
        then provider_rating.moderated_at
      else null
    end,
    moderated_by = case
      when provider_rating.moderation_status =
        'hidden'::public.provider_rating_moderation_status
        then provider_rating.moderated_by
      else null
    end
  returning *
  into saved_rating;

  return query
  select
    saved_rating.id,
    saved_rating.provider_profile_id,
    saved_rating.rater_user_id,
    saved_rating.rating,
    saved_rating.review,
    saved_rating.moderation_status,
    saved_rating.created_at,
    saved_rating.updated_at;
end;
$$;

revoke all
on function public.upsert_provider_rating(uuid, smallint, text)
from public;

grant execute
on function public.upsert_provider_rating(uuid, smallint, text)
to authenticated;

create or replace function public.remove_provider_rating(
  target_provider_profile_id uuid
)
returns table (
  id uuid,
  provider_profile_id uuid,
  rater_user_id uuid,
  rating smallint,
  review text,
  moderation_status public.provider_rating_moderation_status,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_role public.profile_role;
  removed_rating public.provider_ratings%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if profile_role not in (
    'user'::public.profile_role,
    'provider'::public.profile_role
  ) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  update public.provider_ratings
  set
    review = null,
    moderation_status = 'removed'::public.provider_rating_moderation_status,
    moderated_at = null,
    moderated_by = null
  where provider_ratings.provider_profile_id = target_provider_profile_id
    and provider_ratings.rater_user_id = current_user_id
  returning *
  into removed_rating;

  if not found then
    raise exception 'rating_not_found' using errcode = '42501';
  end if;

  return query
  select
    removed_rating.id,
    removed_rating.provider_profile_id,
    removed_rating.rater_user_id,
    removed_rating.rating,
    removed_rating.review,
    removed_rating.moderation_status,
    removed_rating.created_at,
    removed_rating.updated_at;
end;
$$;

revoke all
on function public.remove_provider_rating(uuid)
from public;

grant execute
on function public.remove_provider_rating(uuid)
to authenticated;

create or replace function public.moderate_provider_rating(
  target_rating_id uuid,
  target_status public.provider_rating_moderation_status
)
returns table (
  id uuid,
  provider_profile_id uuid,
  moderation_status public.provider_rating_moderation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role public.profile_role;
  moderated_rating public.provider_ratings%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_role <> 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  update public.provider_ratings
  set
    moderation_status = target_status,
    moderated_at = now(),
    moderated_by = current_user_id
  where provider_ratings.id = target_rating_id
  returning *
  into moderated_rating;

  if not found then
    raise exception 'rating_not_found' using errcode = '42501';
  end if;

  return query
  select
    moderated_rating.id,
    moderated_rating.provider_profile_id,
    moderated_rating.moderation_status;
end;
$$;

revoke all
on function public.moderate_provider_rating(
  uuid,
  public.provider_rating_moderation_status
)
from public;

grant execute
on function public.moderate_provider_rating(
  uuid,
  public.provider_rating_moderation_status
)
to authenticated;

create or replace function public.get_provider_rating_summary(
  target_provider_profile_id uuid
)
returns table (
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(round(avg(provider_ratings.rating)::numeric, 1), 0::numeric),
    count(provider_ratings.id)::bigint
  from public.provider_profiles
  left join public.provider_ratings
    on provider_ratings.provider_profile_id = provider_profiles.id
    and provider_ratings.moderation_status =
      'visible'::public.provider_rating_moderation_status
  where provider_profiles.id = target_provider_profile_id
    and provider_profiles.status = 'active'::public.provider_profile_status;
$$;

revoke all
on function public.get_provider_rating_summary(uuid)
from public;

grant execute
on function public.get_provider_rating_summary(uuid)
to anon, authenticated;

create or replace function public.get_provider_rating_summaries(
  target_provider_profile_ids uuid[]
)
returns table (
  provider_profile_id uuid,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    provider_profiles.id,
    coalesce(round(avg(provider_ratings.rating)::numeric, 1), 0::numeric),
    count(provider_ratings.id)::bigint
  from public.provider_profiles
  left join public.provider_ratings
    on provider_ratings.provider_profile_id = provider_profiles.id
    and provider_ratings.moderation_status =
      'visible'::public.provider_rating_moderation_status
  where provider_profiles.status = 'active'::public.provider_profile_status
    and provider_profiles.id = any(target_provider_profile_ids)
  group by provider_profiles.id;
$$;

revoke all
on function public.get_provider_rating_summaries(uuid[])
from public;

grant execute
on function public.get_provider_rating_summaries(uuid[])
to anon, authenticated;

create or replace function public.get_provider_visible_reviews(
  target_provider_profile_id uuid,
  result_limit integer default 10
)
returns table (
  id uuid,
  rating smallint,
  review text,
  reviewer_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    provider_ratings.id,
    provider_ratings.rating,
    provider_ratings.review,
    coalesce(
      nullif(btrim(profiles.full_name), ''),
      'MyRealHub member'
    ) as reviewer_name,
    provider_ratings.created_at,
    provider_ratings.updated_at
  from public.provider_ratings
  join public.provider_profiles
    on provider_profiles.id = provider_ratings.provider_profile_id
  left join public.profiles
    on profiles.id = provider_ratings.rater_user_id
  where provider_ratings.provider_profile_id = target_provider_profile_id
    and provider_ratings.moderation_status =
      'visible'::public.provider_rating_moderation_status
    and provider_ratings.review is not null
    and btrim(provider_ratings.review) <> ''
    and provider_profiles.status = 'active'::public.provider_profile_status
  order by
    provider_ratings.updated_at desc,
    provider_ratings.created_at desc
  limit greatest(0, least(coalesce(result_limit, 10), 50));
$$;

revoke all
on function public.get_provider_visible_reviews(uuid, integer)
from public;

grant execute
on function public.get_provider_visible_reviews(uuid, integer)
to anon, authenticated;

create or replace function public.get_admin_provider_ratings(
  target_provider_profile_id uuid
)
returns table (
  id uuid,
  provider_profile_id uuid,
  rater_user_id uuid,
  reviewer_name text,
  reviewer_email text,
  rating smallint,
  review text,
  moderation_status public.provider_rating_moderation_status,
  moderated_at timestamptz,
  moderated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role public.profile_role;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_role <> 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  return query
  select
    provider_ratings.id,
    provider_ratings.provider_profile_id,
    provider_ratings.rater_user_id,
    coalesce(
      nullif(btrim(profiles.full_name), ''),
      nullif(btrim(profiles.email), ''),
      'MyRealHub member'
    ) as reviewer_name,
    profiles.email as reviewer_email,
    provider_ratings.rating,
    provider_ratings.review,
    provider_ratings.moderation_status,
    provider_ratings.moderated_at,
    provider_ratings.moderated_by,
    provider_ratings.created_at,
    provider_ratings.updated_at
  from public.provider_ratings
  left join public.profiles
    on profiles.id = provider_ratings.rater_user_id
  where provider_ratings.provider_profile_id = target_provider_profile_id
  order by
    provider_ratings.updated_at desc,
    provider_ratings.created_at desc;
end;
$$;

revoke all
on function public.get_admin_provider_ratings(uuid)
from public;

grant execute
on function public.get_admin_provider_ratings(uuid)
to authenticated;
