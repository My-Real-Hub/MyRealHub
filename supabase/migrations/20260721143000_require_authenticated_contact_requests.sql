alter table public.contact_requests
  add column if not exists subject text not null default 'Provider inquiry';

alter table public.contact_requests
  drop constraint if exists contact_requests_subject_length_check;

alter table public.contact_requests
  add constraint contact_requests_subject_length_check
  check (
    char_length(btrim(subject)) >= 1
    and char_length(btrim(subject)) <= 160
  );

revoke insert
on table public.contact_requests
from anon;

grant insert
on table public.contact_requests
to authenticated;

drop policy if exists contact_requests_insert_active_provider
on public.contact_requests;

create policy contact_requests_insert_active_provider
on public.contact_requests
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('user', 'provider')
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = contact_requests.provider_profile_id
      and provider_profiles.status = 'active'
      and provider_profiles.user_id <> (select auth.uid())
  )
);
