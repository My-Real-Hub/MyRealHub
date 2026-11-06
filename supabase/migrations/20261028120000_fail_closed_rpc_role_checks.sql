-- Reject missing profiles explicitly: SQL NULL comparisons otherwise skip an IF guard.
-- Keep the existing RPC signatures and permissions; no data is changed by this migration.

create or replace function public.moderate_provider_rating(
  target_rating_id uuid,
  target_status text
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
  current_profile_role public.profile_role;
  moderated_rating public.provider_ratings%rowtype;
  next_status public.provider_rating_moderation_status;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if target_status not in ('visible', 'hidden', 'removed') then
    raise exception 'unsupported_status' using errcode = '22000';
  end if;

  next_status := target_status::public.provider_rating_moderation_status;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role is distinct from 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  update public.provider_ratings
  set
    moderation_status = next_status,
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
on function public.moderate_provider_rating(uuid, text)
from public, anon;

grant execute
on function public.moderate_provider_rating(uuid, text)
to authenticated;

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
  current_profile_role public.profile_role;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role is distinct from 'admin'::public.profile_role then
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
from public, anon;

grant execute
on function public.get_admin_provider_ratings(uuid)
to authenticated;

create or replace function public.get_admin_platform_growth_counts()
returns table (
  user_count bigint,
  provider_count bigint,
  admin_count bigint,
  provider_profile_count bigint,
  active_provider_profile_count bigint,
  feedback_count bigint,
  new_feedback_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_profile_role public.profile_role;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role is distinct from 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where profiles.role = 'user'::public.profile_role)::bigint,
    count(*) filter (where profiles.role = 'provider'::public.profile_role)::bigint,
    count(*) filter (where profiles.role = 'admin'::public.profile_role)::bigint,
    (select count(*) from public.provider_profiles)::bigint,
    (
      select count(*)
      from public.provider_profiles
      where provider_profiles.status = 'active'::public.provider_profile_status
    )::bigint,
    (select count(*) from public.platform_feedback)::bigint,
    (
      select count(*)
      from public.platform_feedback
      where platform_feedback.status = 'new'::public.platform_feedback_status
    )::bigint
  from public.profiles;
end;
$$;

revoke all
on function public.get_admin_platform_growth_counts()
from public, anon;

grant execute
on function public.get_admin_platform_growth_counts()
to authenticated;

create or replace function public.get_admin_platform_feedback(
  target_status text default null,
  target_type text default null,
  result_limit integer default 50
)
returns table (
  id uuid,
  type public.platform_feedback_type,
  title text,
  description text,
  current_page_url text,
  reporter_user_id uuid,
  reporter_name text,
  reporter_email text,
  screenshot_path text,
  status public.platform_feedback_status,
  internal_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
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
  current_profile_role public.profile_role;
  normalized_status text := nullif(lower(btrim(coalesce(target_status, ''))), '');
  normalized_type text := nullif(lower(btrim(coalesce(target_type, ''))), '');
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role is distinct from 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if normalized_status is not null
    and normalized_status not in ('new', 'reviewing', 'planned', 'resolved', 'closed') then
    raise exception 'unsupported_feedback_status' using errcode = '22000';
  end if;

  if normalized_type is not null
    and normalized_type not in ('bug', 'suggestion') then
    raise exception 'unsupported_feedback_type' using errcode = '22000';
  end if;

  return query
  select
    platform_feedback.id,
    platform_feedback.type,
    platform_feedback.title,
    platform_feedback.description,
    platform_feedback.current_page_url,
    platform_feedback.reporter_user_id,
    coalesce(
      nullif(btrim(platform_feedback.reporter_name_snapshot), ''),
      nullif(btrim(profiles.full_name), ''),
      nullif(btrim(platform_feedback.reporter_email_snapshot), ''),
      nullif(btrim(profiles.email), ''),
      'Deleted account'
    ) as reporter_name,
    coalesce(
      nullif(btrim(platform_feedback.reporter_email_snapshot), ''),
      nullif(btrim(profiles.email), '')
    ) as reporter_email,
    platform_feedback.screenshot_path,
    platform_feedback.status,
    platform_feedback.internal_notes,
    platform_feedback.reviewed_by,
    platform_feedback.reviewed_at,
    platform_feedback.created_at,
    platform_feedback.updated_at
  from public.platform_feedback
  left join public.profiles
    on profiles.id = platform_feedback.reporter_user_id
  where (
      normalized_status is null
      or platform_feedback.status =
        normalized_status::public.platform_feedback_status
    )
    and (
      normalized_type is null
      or platform_feedback.type =
        normalized_type::public.platform_feedback_type
    )
  order by
    platform_feedback.created_at desc,
    platform_feedback.id desc
  limit greatest(1, least(coalesce(result_limit, 50), 100));
end;
$$;

revoke all
on function public.get_admin_platform_feedback(text, text, integer)
from public, anon;

grant execute
on function public.get_admin_platform_feedback(text, text, integer)
to authenticated;

create or replace function public.update_platform_feedback(
  target_feedback_id uuid,
  target_status text,
  target_internal_notes text default null
)
returns table (
  id uuid,
  status public.platform_feedback_status,
  internal_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_profile_role public.profile_role;
  normalized_status text := lower(btrim(coalesce(target_status, '')));
  normalized_internal_notes text := nullif(btrim(target_internal_notes), '');
  updated_feedback public.platform_feedback%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role is distinct from 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if normalized_status not in ('new', 'reviewing', 'planned', 'resolved', 'closed') then
    raise exception 'unsupported_feedback_status' using errcode = '22000';
  end if;

  if normalized_internal_notes is not null
    and char_length(normalized_internal_notes) > 3000 then
    raise exception 'internal_notes_too_long' using errcode = '22001';
  end if;

  update public.platform_feedback
  set
    status = normalized_status::public.platform_feedback_status,
    internal_notes = normalized_internal_notes,
    reviewed_by = current_user_id,
    reviewed_at = now()
  where platform_feedback.id = target_feedback_id
  returning *
  into updated_feedback;

  if not found then
    raise exception 'feedback_not_found' using errcode = '42501';
  end if;

  return query
  select
    updated_feedback.id,
    updated_feedback.status,
    updated_feedback.internal_notes,
    updated_feedback.reviewed_by,
    updated_feedback.reviewed_at,
    updated_feedback.updated_at;
end;
$$;

revoke all
on function public.update_platform_feedback(uuid, text, text)
from public, anon;

grant execute
on function public.update_platform_feedback(uuid, text, text)
to authenticated;

create or replace function public.upsert_provider_rating(
  target_provider_profile_id uuid,
  target_rating integer,
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

  if profile_role is null or profile_role not in (
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
    target_rating::smallint,
    normalized_review,
    'visible'::public.provider_rating_moderation_status,
    null,
    null
  )
  on conflict on constraint provider_ratings_rater_provider_key do update
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
on function public.upsert_provider_rating(uuid, integer, text)
from public, anon;

grant execute
on function public.upsert_provider_rating(uuid, integer, text)
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

  if profile_role is null or profile_role not in (
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
from public, anon;

grant execute
on function public.remove_provider_rating(uuid)
to authenticated;

