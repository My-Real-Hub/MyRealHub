do $$
begin
  create type public.profile_role as enum ('user', 'provider', 'admin');
exception
  when duplicate_object then null;
end;
$$;

alter table public.profiles
  add column if not exists role public.profile_role not null default 'user';

create or replace function public.get_new_profile_role(user_metadata jsonb)
returns public.profile_role
language sql
stable
as $$
  select case
    when coalesce(user_metadata ->> 'role', '') = 'provider'
      then 'provider'::public.profile_role
    else 'user'::public.profile_role
  end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    public.get_new_profile_role(new.raw_user_meta_data),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();
