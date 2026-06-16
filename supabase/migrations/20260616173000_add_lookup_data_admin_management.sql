alter table public.categories
  add column if not exists is_active boolean not null default true;

alter table public.languages
  add column if not exists is_active boolean not null default true;

alter table public.specialties
  add column if not exists is_active boolean not null default true;

create index if not exists categories_is_active_name_idx
  on public.categories (is_active, name);

create index if not exists languages_is_active_name_idx
  on public.languages (is_active, name);

create index if not exists specialties_is_active_name_idx
  on public.specialties (is_active, name);

grant insert, update, delete
on table public.categories, public.languages, public.specialties
to authenticated;

drop policy if exists categories_select_lookup on public.categories;
create policy categories_select_lookup
on public.categories
for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists languages_select_lookup on public.languages;
create policy languages_select_lookup
on public.languages
for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists specialties_select_lookup on public.specialties;
create policy specialties_select_lookup
on public.specialties
for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write
on public.categories
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

drop policy if exists languages_admin_write on public.languages;
create policy languages_admin_write
on public.languages
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

drop policy if exists specialties_admin_write on public.specialties;
create policy specialties_admin_write
on public.specialties
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
