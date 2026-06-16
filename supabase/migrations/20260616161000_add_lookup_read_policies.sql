alter table public.categories enable row level security;
alter table public.languages enable row level security;
alter table public.specialties enable row level security;

revoke insert, update, delete, truncate, references, trigger
on table public.categories, public.languages, public.specialties
from anon, authenticated;

grant select
on table public.categories, public.languages, public.specialties
to anon, authenticated;

drop policy if exists categories_select_lookup on public.categories;
create policy categories_select_lookup
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists languages_select_lookup on public.languages;
create policy languages_select_lookup
on public.languages
for select
to anon, authenticated
using (true);

drop policy if exists specialties_select_lookup on public.specialties;
create policy specialties_select_lookup
on public.specialties
for select
to anon, authenticated
using (true);
