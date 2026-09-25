create table if not exists public.provider_ratings (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null
    references public.provider_profiles(id) on delete cascade,
  rater_user_id uuid not null
    references public.profiles(id) on delete cascade,
  rating smallint not null
    constraint provider_ratings_rating_check check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_ratings_rater_provider_key
    unique (rater_user_id, provider_profile_id)
);

create trigger provider_ratings_set_updated_at
before update on public.provider_ratings
for each row execute function public.set_updated_at();

create index if not exists provider_ratings_provider_profile_id_idx
  on public.provider_ratings (provider_profile_id);

create index if not exists provider_ratings_rater_user_id_idx
  on public.provider_ratings (rater_user_id);

alter table public.provider_ratings enable row level security;

revoke all on table public.provider_ratings from anon, authenticated;
grant select, insert, delete
on table public.provider_ratings
to authenticated;

drop policy if exists provider_ratings_select_own
on public.provider_ratings;
create policy provider_ratings_select_own
on public.provider_ratings
for select
to authenticated
using ((select auth.uid()) = rater_user_id);

drop policy if exists provider_ratings_insert_own_non_self
on public.provider_ratings;
create policy provider_ratings_insert_own_non_self
on public.provider_ratings
for insert
to authenticated
with check (
  (select auth.uid()) = rater_user_id
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_ratings.provider_profile_id
      and provider_profiles.status = 'active'
      and provider_profiles.user_id <> (select auth.uid())
  )
);

drop policy if exists provider_ratings_update_own_non_self
on public.provider_ratings;
create policy provider_ratings_update_own_non_self
on public.provider_ratings
for update
to authenticated
using ((select auth.uid()) = rater_user_id)
with check (
  (select auth.uid()) = rater_user_id
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_ratings.provider_profile_id
      and provider_profiles.status = 'active'
      and provider_profiles.user_id <> (select auth.uid())
  )
);

drop policy if exists provider_ratings_delete_own
on public.provider_ratings;
create policy provider_ratings_delete_own
on public.provider_ratings
for delete
to authenticated
using ((select auth.uid()) = rater_user_id);

grant update (rating)
on table public.provider_ratings
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
    count(*)::bigint
  from public.provider_ratings
  join public.provider_profiles
    on provider_profiles.id = provider_ratings.provider_profile_id
  where provider_ratings.provider_profile_id = target_provider_profile_id
    and provider_profiles.status = 'active';
$$;

revoke all
on function public.get_provider_rating_summary(uuid)
from public;

grant execute
on function public.get_provider_rating_summary(uuid)
to anon, authenticated;

drop policy if exists contact_requests_insert_active_provider
on public.contact_requests;
create policy contact_requests_insert_active_provider
on public.contact_requests
for insert
to anon, authenticated
with check (
  (
    sender_user_id is null
    or sender_user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = contact_requests.provider_profile_id
      and provider_profiles.status = 'active'
      and (
        (select auth.uid()) is null
        or provider_profiles.user_id <> (select auth.uid())
      )
  )
);
