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

  if current_profile_role <> 'admin'::public.profile_role then
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
from public;

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

  if current_profile_role <> 'admin'::public.profile_role then
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
