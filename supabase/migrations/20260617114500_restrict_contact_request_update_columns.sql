revoke update on table public.contact_requests from authenticated;

grant update (
  status,
  provider_response,
  read_at,
  responded_at,
  rejected_at,
  archived_at
)
on table public.contact_requests
to authenticated;
