alter table public.contact_requests enable row level security;

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
  )
);

drop policy if exists contact_requests_select_provider_owner
on public.contact_requests;
create policy contact_requests_select_provider_owner
on public.contact_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = contact_requests.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

drop policy if exists contact_requests_select_admin
on public.contact_requests;
create policy contact_requests_select_admin
on public.contact_requests
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
