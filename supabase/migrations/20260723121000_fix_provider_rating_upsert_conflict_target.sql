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
from public;

grant execute
on function public.upsert_provider_rating(uuid, integer, text)
to authenticated;
