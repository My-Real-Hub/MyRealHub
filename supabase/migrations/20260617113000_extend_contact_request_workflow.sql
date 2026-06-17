alter type public.contact_request_status add value if not exists 'rejected';

alter table public.contact_requests
  add column if not exists provider_response text,
  add column if not exists read_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists archived_at timestamptz;

create index if not exists contact_requests_provider_status_created_idx
  on public.contact_requests (provider_profile_id, status, created_at desc);

create index if not exists contact_requests_sender_status_created_idx
  on public.contact_requests (sender_user_id, status, created_at desc);

drop policy if exists contact_requests_select_sender_own
on public.contact_requests;
create policy contact_requests_select_sender_own
on public.contact_requests
for select
to authenticated
using ((select auth.uid()) = sender_user_id);

drop policy if exists contact_requests_update_provider_owner
on public.contact_requests;
create policy contact_requests_update_provider_owner
on public.contact_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = contact_requests.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = contact_requests.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);
