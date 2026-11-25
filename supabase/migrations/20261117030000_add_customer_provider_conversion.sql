begin;

-- Add provider tools to the caller's existing account. Listing creation and
-- administrator approval remain separate operations.
create function public.become_provider()
returns public.profile_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  account_role public.profile_role;
begin
  if account_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Read the Auth record rather than trusting user-editable metadata or a
  -- confirmation claim from an older token. Lock parent before child, matching
  -- Auth deletion's cascade order and serializing conversions for this account.
  perform u.id from auth.users u
  where u.id = account_id
    and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous, false)
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= pg_catalog.now())
  for update;

  if not found then
    raise exception 'verified_account_required' using errcode = '42501';
  end if;

  select p.role into account_role
  from public.profiles p where p.id = account_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = '42501';
  end if;

  if account_role = 'provider'::public.profile_role then
    return account_role;
  end if;

  if account_role is distinct from 'user'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  update public.profiles set role = 'provider'::public.profile_role
  where id = account_id;

  return 'provider'::public.profile_role;
end;
$$;

alter function public.become_provider() owner to postgres;
revoke all on function public.become_provider() from public, anon, authenticated, service_role;
grant execute on function public.become_provider() to authenticated;

commit;
