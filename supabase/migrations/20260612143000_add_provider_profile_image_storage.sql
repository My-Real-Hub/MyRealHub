alter table public.provider_profiles
  add column if not exists profile_image_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'provider-profile-images',
  'provider-profile-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists provider_profile_images_insert_own
on storage.objects;

create policy provider_profile_images_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists provider_profile_images_update_own
on storage.objects;

create policy provider_profile_images_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists provider_profile_images_delete_own
on storage.objects;

create policy provider_profile_images_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'provider-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
