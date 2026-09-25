create table public.canadian_subdivisions (
  code text primary key,
  name text not null unique,
  kind text not null,
  display_order smallint not null,
  constraint canadian_subdivisions_code_check
    check (code ~ '^[A-Z]{2}$'),
  constraint canadian_subdivisions_kind_check
    check (kind in ('province', 'territory'))
);

create table public.service_regions (
  id uuid primary key default gen_random_uuid(),
  province_code text not null
    references public.canadian_subdivisions(code) on delete restrict,
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_regions_province_name_key
    unique (province_code, name)
);

create table public.provider_service_regions (
  provider_profile_id uuid not null
    references public.provider_profiles(id) on delete cascade,
  service_region_id uuid not null
    references public.service_regions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (provider_profile_id, service_region_id)
);

create index service_regions_province_active_name_idx
  on public.service_regions (province_code, is_active, name);

create index provider_service_regions_service_region_id_idx
  on public.provider_service_regions (service_region_id);

create trigger service_regions_set_updated_at
before update on public.service_regions
for each row execute function public.set_updated_at();

insert into public.canadian_subdivisions (code, name, kind, display_order)
values
  ('NL', 'Newfoundland and Labrador', 'province', 1),
  ('PE', 'Prince Edward Island', 'province', 2),
  ('NS', 'Nova Scotia', 'province', 3),
  ('NB', 'New Brunswick', 'province', 4),
  ('QC', 'Quebec', 'province', 5),
  ('ON', 'Ontario', 'province', 6),
  ('MB', 'Manitoba', 'province', 7),
  ('SK', 'Saskatchewan', 'province', 8),
  ('AB', 'Alberta', 'province', 9),
  ('BC', 'British Columbia', 'province', 10),
  ('YT', 'Yukon', 'territory', 11),
  ('NT', 'Northwest Territories', 'territory', 12),
  ('NU', 'Nunavut', 'territory', 13);

insert into public.service_regions (province_code, name, slug)
values
  ('NL', 'St. John''s Metro', 'nl-st-johns-metro'),
  ('NL', 'Avalon Peninsula', 'nl-avalon-peninsula'),
  ('NL', 'Eastern Newfoundland', 'nl-eastern-newfoundland'),
  ('NL', 'Central Newfoundland', 'nl-central-newfoundland'),
  ('NL', 'Western Newfoundland', 'nl-western-newfoundland'),
  ('NL', 'Labrador', 'nl-labrador'),
  ('PE', 'Charlottetown Area', 'pe-charlottetown-area'),
  ('PE', 'Summerside Area', 'pe-summerside-area'),
  ('PE', 'Eastern Prince Edward Island', 'pe-eastern-prince-edward-island'),
  ('PE', 'Western Prince Edward Island', 'pe-western-prince-edward-island'),
  ('NS', 'Halifax Regional Municipality', 'ns-halifax-regional-municipality'),
  ('NS', 'Cape Breton', 'ns-cape-breton'),
  ('NS', 'Annapolis Valley', 'ns-annapolis-valley'),
  ('NS', 'South Shore', 'ns-south-shore'),
  ('NS', 'Northern Nova Scotia', 'ns-northern-nova-scotia'),
  ('NB', 'Greater Moncton', 'nb-greater-moncton'),
  ('NB', 'Greater Saint John', 'nb-greater-saint-john'),
  ('NB', 'Greater Fredericton', 'nb-greater-fredericton'),
  ('NB', 'Northern New Brunswick', 'nb-northern-new-brunswick'),
  ('QC', 'Greater Montreal', 'qc-greater-montreal'),
  ('QC', 'Quebec City Area', 'qc-quebec-city-area'),
  ('QC', 'Outaouais', 'qc-outaouais'),
  ('QC', 'Estrie', 'qc-estrie'),
  ('QC', 'Mauricie', 'qc-mauricie'),
  ('QC', 'Centre-du-Quebec', 'qc-centre-du-quebec'),
  ('QC', 'Saguenay-Lac-Saint-Jean', 'qc-saguenay-lac-saint-jean'),
  ('QC', 'Eastern Quebec', 'qc-eastern-quebec'),
  ('QC', 'Northern Quebec', 'qc-northern-quebec'),
  ('ON', 'Greater Toronto Area', 'on-greater-toronto-area'),
  ('ON', 'Ottawa Region', 'on-ottawa-region'),
  ('ON', 'Hamilton and Halton', 'on-hamilton-and-halton'),
  ('ON', 'Niagara Region', 'on-niagara-region'),
  ('ON', 'Waterloo Region and Guelph', 'on-waterloo-region-and-guelph'),
  ('ON', 'London and Middlesex', 'on-london-and-middlesex'),
  ('ON', 'Windsor-Essex', 'on-windsor-essex'),
  ('ON', 'Simcoe County', 'on-simcoe-county'),
  ('ON', 'Durham Region', 'on-durham-region'),
  ('ON', 'Eastern Ontario', 'on-eastern-ontario'),
  ('ON', 'Southwestern Ontario', 'on-southwestern-ontario'),
  ('ON', 'Northern Ontario', 'on-northern-ontario'),
  ('MB', 'Winnipeg Metro', 'mb-winnipeg-metro'),
  ('MB', 'Westman', 'mb-westman'),
  ('MB', 'Central Manitoba', 'mb-central-manitoba'),
  ('MB', 'Interlake-Eastern Manitoba', 'mb-interlake-eastern-manitoba'),
  ('MB', 'Northern Manitoba', 'mb-northern-manitoba'),
  ('SK', 'Saskatoon Area', 'sk-saskatoon-area'),
  ('SK', 'Regina Area', 'sk-regina-area'),
  ('SK', 'Central Saskatchewan', 'sk-central-saskatchewan'),
  ('SK', 'Southern Saskatchewan', 'sk-southern-saskatchewan'),
  ('SK', 'Northern Saskatchewan', 'sk-northern-saskatchewan'),
  ('AB', 'Calgary Region', 'ab-calgary-region'),
  ('AB', 'Edmonton Region', 'ab-edmonton-region'),
  ('AB', 'Central Alberta', 'ab-central-alberta'),
  ('AB', 'Rocky Mountain Region', 'ab-rocky-mountain-region'),
  ('AB', 'Southern Alberta', 'ab-southern-alberta'),
  ('AB', 'Northern Alberta', 'ab-northern-alberta'),
  ('BC', 'Greater Vancouver', 'bc-greater-vancouver'),
  ('BC', 'Fraser Valley', 'bc-fraser-valley'),
  ('BC', 'Vancouver Island', 'bc-vancouver-island'),
  ('BC', 'Thompson-Okanagan', 'bc-thompson-okanagan'),
  ('BC', 'Kootenay Region', 'bc-kootenay-region'),
  ('BC', 'Cariboo Region', 'bc-cariboo-region'),
  ('BC', 'North Coast and Nechako', 'bc-north-coast-and-nechako'),
  ('BC', 'Northeast British Columbia', 'bc-northeast-british-columbia'),
  ('YT', 'Whitehorse Area', 'yt-whitehorse-area'),
  ('YT', 'Rural Yukon', 'yt-rural-yukon'),
  ('NT', 'Yellowknife Area', 'nt-yellowknife-area'),
  ('NT', 'Beaufort Delta', 'nt-beaufort-delta'),
  ('NT', 'Dehcho', 'nt-dehcho'),
  ('NT', 'North Slave', 'nt-north-slave'),
  ('NT', 'Sahtu', 'nt-sahtu'),
  ('NT', 'South Slave', 'nt-south-slave'),
  ('NU', 'Qikiqtaaluk', 'nu-qikiqtaaluk'),
  ('NU', 'Kivalliq', 'nu-kivalliq'),
  ('NU', 'Kitikmeot', 'nu-kitikmeot');

create or replace function public.enforce_provider_service_region_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_region_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.provider_profile_id::text, 0)
  );

  if tg_op = 'UPDATE' then
    select count(*)
    into existing_region_count
    from public.provider_service_regions
    where provider_profile_id = new.provider_profile_id
      and (provider_profile_id, service_region_id) <>
        (old.provider_profile_id, old.service_region_id);
  else
    select count(*)
    into existing_region_count
    from public.provider_service_regions
    where provider_profile_id = new.provider_profile_id;
  end if;

  if existing_region_count >= 2 then
    raise exception 'A provider can select at most two service regions.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger provider_service_regions_limit
before insert or update on public.provider_service_regions
for each row execute function public.enforce_provider_service_region_limit();

alter table public.canadian_subdivisions enable row level security;
alter table public.service_regions enable row level security;
alter table public.provider_service_regions enable row level security;

revoke all on table public.canadian_subdivisions from anon, authenticated;
revoke all on table public.service_regions from anon, authenticated;
revoke all on table public.provider_service_regions from anon, authenticated;

grant select on table public.canadian_subdivisions to anon, authenticated;
grant select on table public.service_regions to anon, authenticated;
grant select, insert, delete
on table public.provider_service_regions
to authenticated;
grant select on table public.provider_service_regions to anon;

create policy canadian_subdivisions_select_all
on public.canadian_subdivisions
for select
to anon, authenticated
using (true);

create policy service_regions_select_active
on public.service_regions
for select
to anon, authenticated
using (is_active);

create policy provider_service_regions_select_active
on public.provider_service_regions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_service_regions.provider_profile_id
      and provider_profiles.status = 'active'
  )
);

create policy provider_service_regions_select_own
on public.provider_service_regions
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_service_regions.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

create policy provider_service_regions_insert_own
on public.provider_service_regions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_service_regions.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

create policy provider_service_regions_delete_own
on public.provider_service_regions
for delete
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_service_regions.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

create or replace function public.replace_provider_service_regions(
  target_provider_profile_id uuid,
  selected_service_region_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_count integer;
  distinct_count integer;
  valid_count integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.provider_profiles
    where id = target_provider_profile_id
      and user_id = (select auth.uid())
  ) then
    raise exception 'Provider profile not found or not owned by this account.'
      using errcode = '42501';
  end if;

  requested_count := coalesce(
    pg_catalog.cardinality(selected_service_region_ids),
    0
  );

  select count(distinct region_id)
  into distinct_count
  from pg_catalog.unnest(
    coalesce(selected_service_region_ids, array[]::uuid[])
  ) as selected(region_id);

  if requested_count > 2 then
    raise exception 'A provider can select at most two service regions.'
      using errcode = '23514';
  end if;

  if requested_count <> distinct_count then
    raise exception 'Service regions must be unique.'
      using errcode = '23505';
  end if;

  select count(*)
  into valid_count
  from public.service_regions
  where id = any(
    coalesce(selected_service_region_ids, array[]::uuid[])
  )
    and is_active;

  if requested_count <> valid_count then
    raise exception 'Choose valid active Canadian service regions.'
      using errcode = '22023';
  end if;

  delete from public.provider_service_regions
  where provider_profile_id = target_provider_profile_id;

  insert into public.provider_service_regions (
    provider_profile_id,
    service_region_id
  )
  select target_provider_profile_id, selected.region_id
  from pg_catalog.unnest(
    coalesce(selected_service_region_ids, array[]::uuid[])
  ) as selected(region_id);
end;
$$;

revoke all on function public.replace_provider_service_regions(uuid, uuid[])
from public;
grant execute
on function public.replace_provider_service_regions(uuid, uuid[])
to authenticated;
