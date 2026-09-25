drop policy if exists saved_providers_insert_own on public.saved_providers;
create policy saved_providers_insert_own
on public.saved_providers
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = saved_providers.provider_profile_id
      and provider_profiles.status = 'active'
  )
);
