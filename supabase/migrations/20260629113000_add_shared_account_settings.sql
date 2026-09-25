alter table public.profiles
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists avatar_path text;

update public.profiles
set
  phone = coalesce(profiles.phone, provider_profiles.phone),
  bio = coalesce(profiles.bio, provider_profiles.bio),
  avatar_path = coalesce(
    profiles.avatar_path,
    provider_profiles.profile_image_path
  ),
  avatar_url = coalesce(
    profiles.avatar_url,
    provider_profiles.profile_image_url
  )
from public.provider_profiles
where provider_profiles.user_id = profiles.id;

alter table public.profiles
  drop constraint if exists profiles_bio_length_check;

alter table public.profiles
  add constraint profiles_bio_length_check
  check (bio is null or char_length(bio) <= 600)
  not valid;

alter table public.provider_profiles
  drop constraint if exists provider_profiles_bio_length_check;

alter table public.provider_profiles
  add constraint provider_profiles_bio_length_check
  check (bio is null or char_length(bio) <= 600)
  not valid;

drop policy if exists profiles_update_own
on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke update on table public.profiles from authenticated;
grant update (
  full_name,
  email,
  phone,
  bio,
  avatar_path,
  avatar_url
)
on table public.profiles
to authenticated;

create or replace function public.sync_provider_profile_account_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.provider_profiles
  set
    display_name = new.full_name,
    email = new.email,
    phone = new.phone,
    bio = new.bio,
    profile_image_path = new.avatar_path,
    profile_image_url = new.avatar_url
  where user_id = new.id;

  return new;
end;
$$;

drop trigger if exists profiles_sync_provider_account_fields
on public.profiles;

create trigger profiles_sync_provider_account_fields
after update of full_name, email, phone, bio, avatar_path, avatar_url
on public.profiles
for each row execute function public.sync_provider_profile_account_fields();
