alter table public.saved_providers enable row level security;

drop policy if exists saved_providers_select_own on public.saved_providers;
create policy saved_providers_select_own
on public.saved_providers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists saved_providers_insert_own on public.saved_providers;
create policy saved_providers_insert_own
on public.saved_providers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists saved_providers_delete_own on public.saved_providers;
create policy saved_providers_delete_own
on public.saved_providers
for delete
to authenticated
using ((select auth.uid()) = user_id);
