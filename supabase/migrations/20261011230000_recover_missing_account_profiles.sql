create or replace function public.ensure_current_user_profile()
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
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name, email, role, avatar_url)
  select
    u.id,
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    u.email,
    public.get_new_profile_role(u.raw_user_meta_data),
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')
  from auth.users u
  where u.id = account_id
    and u.email_confirmed_at is not null
  on conflict (id) do nothing;

  select p.role into account_role
  from public.profiles p
  where p.id = account_id;

  if account_role is null then
    raise exception 'Verified account required' using errcode = '42501';
  end if;
  return account_role;
end;
$$;

revoke all on function public.ensure_current_user_profile() from public, anon;
grant execute on function public.ensure_current_user_profile() to authenticated;
