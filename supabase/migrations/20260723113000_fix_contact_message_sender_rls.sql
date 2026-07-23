drop policy if exists contact_request_messages_select_participant
on public.contact_request_messages;

create policy contact_request_messages_select_participant
on public.contact_request_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.contact_requests
    where contact_requests.id = contact_request_messages.contact_request_id
      and contact_requests.sender_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.contact_requests
    join public.provider_profiles
      on provider_profiles.id = contact_requests.provider_profile_id
    where contact_requests.id = contact_request_messages.contact_request_id
      and provider_profiles.user_id = (select auth.uid())
  )
);
