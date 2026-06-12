alter table public.provider_profiles enable row level security;
alter table public.provider_languages enable row level security;
alter table public.provider_specialties enable row level security;

drop policy if exists provider_profiles_select_active on public.provider_profiles;
drop policy if exists provider_profiles_select_own on public.provider_profiles;
drop policy if exists provider_profiles_insert_own on public.provider_profiles;
drop policy if exists provider_profiles_update_own_pending on public.provider_profiles;
drop policy if exists provider_profiles_admin_all on public.provider_profiles;

create policy provider_profiles_select_active
on public.provider_profiles
for select
to anon, authenticated
using (status = 'active');

create policy provider_profiles_select_own
on public.provider_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy provider_profiles_insert_own
on public.provider_profiles
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'pending_approval')
);

create policy provider_profiles_update_own_pending
on public.provider_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'pending_approval')
);

create policy provider_profiles_admin_all
on public.provider_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists provider_languages_select_active on public.provider_languages;
drop policy if exists provider_languages_select_own on public.provider_languages;
drop policy if exists provider_languages_insert_own on public.provider_languages;
drop policy if exists provider_languages_delete_own on public.provider_languages;
drop policy if exists provider_languages_admin_all on public.provider_languages;

create policy provider_languages_select_active
on public.provider_languages
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_languages.provider_profile_id
      and provider_profiles.status = 'active'
  )
);

create policy provider_languages_select_own
on public.provider_languages
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_languages.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

create policy provider_languages_insert_own
on public.provider_languages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_languages.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

create policy provider_languages_delete_own
on public.provider_languages
for delete
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_languages.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

create policy provider_languages_admin_all
on public.provider_languages
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists provider_specialties_select_active on public.provider_specialties;
drop policy if exists provider_specialties_select_own on public.provider_specialties;
drop policy if exists provider_specialties_insert_own on public.provider_specialties;
drop policy if exists provider_specialties_delete_own on public.provider_specialties;
drop policy if exists provider_specialties_admin_all on public.provider_specialties;

create policy provider_specialties_select_active
on public.provider_specialties
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_specialties.provider_profile_id
      and provider_profiles.status = 'active'
  )
);

create policy provider_specialties_select_own
on public.provider_specialties
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_specialties.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

create policy provider_specialties_insert_own
on public.provider_specialties
for insert
to authenticated
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_specialties.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

create policy provider_specialties_delete_own
on public.provider_specialties
for delete
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = provider_specialties.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
      and provider_profiles.status in ('draft', 'pending_approval')
  )
);

create policy provider_specialties_admin_all
on public.provider_specialties
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);
