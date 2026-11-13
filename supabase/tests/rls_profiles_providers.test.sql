-- Run only in an isolated Supabase database after all migrations.
-- Fixtures have no passwords; every fixture and schema helper rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- The Storage API enables deletion in its transaction before issuing object
-- DELETE statements. Model that context so these probes exercise object RLS,
-- rather than being rejected first by storage.protect_delete().
set local storage.allow_delete_query = 'true';
select plan(100);

-- Probe the caller's real privileges. A forbidden operation may raise 42501
-- or affect zero rows under RLS; both deny access. Successful probe mutations
-- also roll back, so a failing assertion cannot change later fixtures.
create function pg_temp.visible_count(query text)
returns bigint language plpgsql security invoker as $$
declare result bigint;
begin
  execute 'select count(*) from (' || query || ') as visible_rows' into result;
  return result;
exception when insufficient_privilege then return 0;
end;
$$;

create function pg_temp.mutation_count(command text)
returns bigint language plpgsql security invoker as $$
declare affected bigint;
begin
  begin
    execute command;
    get diagnostics affected = row_count;
    raise exception using errcode = 'ZX001', message = affected::text;
  exception
    when sqlstate 'ZX001' then return sqlerrm::bigint;
    when insufficient_privilege then return 0;
  end;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('91000000-0000-4000-8000-000000000001', 'rls-customer-one@example.invalid', '{"role":"user"}'),
  ('91000000-0000-4000-8000-000000000002', 'rls-customer-two@example.invalid', '{"role":"user"}'),
  ('91000000-0000-4000-8000-000000000003', 'rls-provider-one@example.invalid', '{"role":"provider"}'),
  ('91000000-0000-4000-8000-000000000004', 'rls-provider-two@example.invalid', '{"role":"provider"}'),
  ('91000000-0000-4000-8000-000000000005', 'rls-admin@example.invalid', '{"role":"admin"}'),
  ('91000000-0000-4000-8000-000000000006', 'rls-missing-profile@example.invalid', '{}'),
  ('91000000-0000-4000-8000-000000000007', 'rls-new-provider@example.invalid', '{"role":"provider"}');

-- Signup metadata must not grant administrator status.
select is((select role::text from public.profiles where id = '91000000-0000-4000-8000-000000000005'),
  'user', 'signup metadata cannot assign the administrator role');
update public.profiles set role = 'admin' where id = '91000000-0000-4000-8000-000000000005';
delete from public.profiles where id = '91000000-0000-4000-8000-000000000006';

insert into public.categories (id, name, slug, is_active) values
  ('91000000-0000-4000-8200-000000000001', 'RLS active category', 'rls-active-category-910', true),
  ('91000000-0000-4000-8200-000000000002', 'RLS inactive category', 'rls-inactive-category-910', false);
insert into public.languages (id, name, slug, is_active) values
  ('91000000-0000-4000-8200-000000000011', 'RLS active language', 'rls-active-language-910', true),
  ('91000000-0000-4000-8200-000000000012', 'RLS second language', 'rls-second-language-910', true),
  ('91000000-0000-4000-8200-000000000013', 'RLS inactive language', 'rls-inactive-language-910', false);
insert into public.specialties (id, category_id, name, slug, is_active) values
  ('91000000-0000-4000-8200-000000000021', '91000000-0000-4000-8200-000000000001', 'RLS active specialty', 'rls-active-specialty-910', true),
  ('91000000-0000-4000-8200-000000000022', '91000000-0000-4000-8200-000000000001', 'RLS second specialty', 'rls-second-specialty-910', true),
  ('91000000-0000-4000-8200-000000000023', '91000000-0000-4000-8200-000000000002', 'RLS inactive specialty', 'rls-inactive-specialty-910', false);
insert into public.service_regions (id, province_code, name, slug, is_active, center_latitude, center_longitude) values
  ('91000000-0000-4000-8200-000000000031', 'ON', 'RLS first region 910', 'rls-first-region-910', true, 43.6532, -79.3832),
  ('91000000-0000-4000-8200-000000000032', 'ON', 'RLS second region 910', 'rls-second-region-910', true, 45.4215, -75.6972),
  ('91000000-0000-4000-8200-000000000033', 'ON', 'RLS inactive region 910', 'rls-inactive-region-910', false, 43.4516, -80.4925);

insert into public.provider_profiles (id, user_id, category_id, display_name, email, slug, status) values
  ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8200-000000000001', 'Private draft provider', 'private-draft@example.invalid', 'rls-private-draft-910', 'draft'),
  ('91000000-0000-4000-8100-000000000002', '91000000-0000-4000-8000-000000000004', '91000000-0000-4000-8200-000000000001', 'Public active provider', 'public-listing@example.invalid', 'rls-public-active-910', 'active'),
  -- A historical listing must not give a customer the provider role's writes.
  ('91000000-0000-4000-8100-000000000003', '91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8200-000000000001', 'Legacy customer listing', 'legacy@example.invalid', 'rls-legacy-customer-910', 'draft');
insert into public.provider_languages (provider_profile_id, language_id) values
  ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000011'),
  ('91000000-0000-4000-8100-000000000002', '91000000-0000-4000-8200-000000000011');
insert into public.provider_specialties (provider_profile_id, specialty_id) values
  ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000021'),
  ('91000000-0000-4000-8100-000000000002', '91000000-0000-4000-8200-000000000021');
insert into public.provider_service_regions (provider_profile_id, service_region_id) values
  ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000031'),
  ('91000000-0000-4000-8100-000000000002', '91000000-0000-4000-8200-000000000031');
insert into public.saved_providers (id, user_id, provider_profile_id) values
  ('91000000-0000-4000-8400-000000000001', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8100-000000000002'),
  ('91000000-0000-4000-8400-000000000002', '91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8100-000000000002');

insert into storage.objects (id, bucket_id, name) values
  ('91000000-0000-4000-8300-000000000001', 'feedback-screenshots', '91000000-0000-4000-8000-000000000001/rls-private.png'),
  ('91000000-0000-4000-8300-000000000002', 'feedback-screenshots', '91000000-0000-4000-8000-000000000002/rls-private.png'),
  ('91000000-0000-4000-8300-000000000003', 'provider-profile-images', '91000000-0000-4000-8000-000000000001/rls-avatar.png'),
  ('91000000-0000-4000-8300-000000000004', 'provider-profile-images', '91000000-0000-4000-8000-000000000003/rls-avatar.png'),
  ('91000000-0000-4000-8300-000000000005', 'feedback-screenshots', '91000000-0000-4000-8000-000000000006/rls-orphan.png'),
  ('91000000-0000-4000-8300-000000000006', 'provider-profile-images', '91000000-0000-4000-8000-000000000006/rls-orphan-avatar.png');

select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any(array['profiles', 'provider_profiles', 'provider_languages',
    'provider_specialties', 'provider_service_regions', 'saved_providers', 'categories', 'languages', 'specialties', 'service_regions'])),
  'RLS is enabled on account, provider, join, saved-provider, and lookup tables');
select is((select public from storage.buckets where id = 'feedback-screenshots'), false, 'feedback screenshots use a private bucket');
select is((select public from storage.buckets where id = 'provider-profile-images'), true, 'published profile images retain a public bucket');
select ok(not exists (
  select 1 from unnest(array['public.profiles', 'public.provider_profiles', 'public.provider_languages',
    'public.provider_specialties', 'public.provider_service_regions', 'public.saved_providers']) as protected_table(name)
  where has_table_privilege('anon', protected_table.name, 'TRUNCATE')
    or has_table_privilege('authenticated', protected_table.name, 'TRUNCATE')),
  'application roles cannot bypass row policies with TRUNCATE');
select ok(not exists (
  select 1 from unnest(array['public.profiles', 'public.provider_profiles', 'public.provider_languages',
    'public.provider_specialties', 'public.provider_service_regions', 'public.saved_providers']) as protected_table(name)
  where has_table_privilege('anon', protected_table.name, 'TRIGGER')
    or has_table_privilege('authenticated', protected_table.name, 'TRIGGER')
    or has_table_privilege('anon', protected_table.name, 'REFERENCES')
    or has_table_privilege('authenticated', protected_table.name, 'REFERENCES')),
  'application roles cannot create triggers or foreign-key references on protected tables');

-- Anonymous visitors can browse public directory information only.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(pg_temp.visible_count($q$select * from public.profiles where id::text like '91000000-%'$q$), 0::bigint, 'anonymous cannot read account profiles');
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000002'$q$), 1::bigint, 'anonymous can read active directory listings');
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'anonymous cannot read draft listings');
select is(pg_temp.visible_count($q$select provider_profile_id from public.provider_languages where provider_profile_id = '91000000-0000-4000-8100-000000000002'
  union all select provider_profile_id from public.provider_specialties where provider_profile_id = '91000000-0000-4000-8100-000000000002'
  union all select provider_profile_id from public.provider_service_regions where provider_profile_id = '91000000-0000-4000-8100-000000000002'$q$), 3::bigint, 'anonymous can read active listing language, specialty, and region assignments');
select is(pg_temp.visible_count($q$select provider_profile_id from public.provider_languages where provider_profile_id = '91000000-0000-4000-8100-000000000001'
  union all select provider_profile_id from public.provider_specialties where provider_profile_id = '91000000-0000-4000-8100-000000000001'
  union all select provider_profile_id from public.provider_service_regions where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'anonymous cannot read draft listing assignments');
select is(pg_temp.visible_count($q$select * from public.saved_providers where user_id::text like '91000000-%'$q$), 0::bigint, 'anonymous cannot read saved providers');
select is(pg_temp.visible_count($q$select * from storage.objects where bucket_id = 'feedback-screenshots' and id::text like '91000000-%'$q$), 0::bigint, 'anonymous cannot read private screenshot metadata');
select is(pg_temp.visible_count($q$select id from public.categories where id = '91000000-0000-4000-8200-000000000002'
  union all select id from public.languages where id = '91000000-0000-4000-8200-000000000013'
  union all select id from public.specialties where id = '91000000-0000-4000-8200-000000000023'
  union all select id from public.service_regions where id = '91000000-0000-4000-8200-000000000033'$q$), 0::bigint, 'anonymous cannot read inactive lookup entries');
select is(pg_temp.visible_count($q$select id from public.categories where id = '91000000-0000-4000-8200-000000000001'
  union all select id from public.languages where id = '91000000-0000-4000-8200-000000000011'
  union all select id from public.specialties where id = '91000000-0000-4000-8200-000000000021'
  union all select id from public.service_regions where id = '91000000-0000-4000-8200-000000000031'$q$), 4::bigint, 'anonymous can read active categories, languages, specialties, and service regions');
select is(pg_temp.mutation_count($q$insert into public.categories(name, slug) values ('Unauthorized category', 'rls-anon-category-910')$q$), 0::bigint, 'anonymous cannot create lookup entries');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('feedback-screenshots', '91000000-0000-4000-8000-000000000001/anonymous.png')$q$), 0::bigint, 'anonymous cannot upload private screenshots');
reset role;

-- Customers retain private account settings and their own saved providers.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(pg_temp.visible_count($q$select * from public.profiles where id = '91000000-0000-4000-8000-000000000001'$q$), 1::bigint, 'customer can read their own private profile');
select is(pg_temp.visible_count($q$select * from public.profiles where id in ('91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000004')$q$), 0::bigint, 'customer cannot read another customer or provider private profile');
select is(pg_temp.mutation_count($q$update public.profiles set full_name = 'Allowed own name' where id = '91000000-0000-4000-8000-000000000001'$q$), 1::bigint, 'customer can update allowed own account fields');
select is(pg_temp.mutation_count($q$update public.profiles set full_name = 'Hijacked name' where id = '91000000-0000-4000-8000-000000000002'$q$), 0::bigint, 'customer cannot update another private profile');
select is(pg_temp.mutation_count($q$update public.profiles set role = 'admin' where id = '91000000-0000-4000-8000-000000000001'$q$), 0::bigint, 'customer cannot promote their own role to administrator');
select is(pg_temp.mutation_count($q$update public.profiles set id = '91000000-0000-4000-8000-000000000002' where id = '91000000-0000-4000-8000-000000000001'$q$), 0::bigint, 'customer cannot change the account identity column');
select is(pg_temp.mutation_count($q$insert into public.profiles(id, role) values ('91000000-0000-4000-8000-000000000006', 'admin')$q$), 0::bigint, 'customer cannot create an administrator profile for another identity');
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'customer cannot read an unrelated provider draft');
select is(pg_temp.mutation_count($q$insert into public.provider_profiles(user_id, slug, status) values ('91000000-0000-4000-8000-000000000001', 'rls-customer-listing-910', 'draft')$q$), 0::bigint, 'customer role cannot create a provider listing directly');
select is(pg_temp.visible_count($q$select * from public.saved_providers where user_id = '91000000-0000-4000-8000-000000000001'$q$), 1::bigint, 'customer can read their own saved providers');
select is(pg_temp.visible_count($q$select * from public.saved_providers where user_id = '91000000-0000-4000-8000-000000000002'$q$), 0::bigint, 'customer cannot read another customer saved providers');
select is(pg_temp.mutation_count($q$delete from public.saved_providers where id = '91000000-0000-4000-8400-000000000001'$q$), 1::bigint, 'customer can remove their own saved provider');
select is(pg_temp.mutation_count($q$delete from public.saved_providers where id = '91000000-0000-4000-8400-000000000002'$q$), 0::bigint, 'customer cannot remove another customer saved provider');
select is(pg_temp.mutation_count($q$insert into public.saved_providers(user_id, provider_profile_id) values ('91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8100-000000000001')$q$), 0::bigint, 'customer cannot write another customer saved-provider list');
select is(pg_temp.mutation_count($q$insert into public.saved_providers(user_id, provider_profile_id) values ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8100-000000000001')$q$), 0::bigint, 'customer cannot save an unavailable draft provider');
select is(pg_temp.mutation_count($q$insert into public.languages(name, slug) values ('Unauthorized language', 'rls-customer-language-910')$q$), 0::bigint, 'customer cannot create lookup entries');
select is(pg_temp.mutation_count($q$update public.categories set name = 'Unauthorized rename' where id = '91000000-0000-4000-8200-000000000001'$q$), 0::bigint, 'customer cannot change lookup entries');
select is(pg_temp.visible_count($q$select * from storage.objects where id = '91000000-0000-4000-8300-000000000001'$q$), 1::bigint, 'customer can read their own feedback screenshot');
select is(pg_temp.visible_count($q$select * from storage.objects where id = '91000000-0000-4000-8300-000000000002'$q$), 0::bigint, 'customer cannot read another customer feedback screenshot');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('feedback-screenshots', '91000000-0000-4000-8000-000000000001/new-screenshot.png')$q$), 1::bigint, 'customer can upload a screenshot to their own folder');
select is(pg_temp.mutation_count($q$update storage.objects set metadata = '{"mimetype":"image/png"}'::jsonb where id = '91000000-0000-4000-8300-000000000001'$q$), 1::bigint, 'customer can update their own feedback screenshot');
select is(pg_temp.mutation_count($q$delete from storage.objects where id = '91000000-0000-4000-8300-000000000001'$q$), 1::bigint, 'customer can delete their own feedback screenshot');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('feedback-screenshots', '91000000-0000-4000-8000-000000000002/forged-screenshot.png')$q$), 0::bigint, 'customer cannot upload into another screenshot folder');
select is(pg_temp.mutation_count($q$update storage.objects set name = '91000000-0000-4000-8000-000000000002/stolen.png' where id = '91000000-0000-4000-8300-000000000001'$q$), 0::bigint, 'customer cannot move their screenshot into another account folder');
select is(pg_temp.mutation_count($q$delete from storage.objects where id = '91000000-0000-4000-8300-000000000002'$q$), 0::bigint, 'customer cannot delete another account screenshot');
select is(pg_temp.visible_count($q$select * from storage.objects where id = '91000000-0000-4000-8300-000000000003'$q$), 1::bigint, 'customer can select their own avatar metadata for storage updates');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('provider-profile-images', '91000000-0000-4000-8000-000000000001/new-avatar.png')$q$), 1::bigint, 'customer retains own-folder avatar upload');
select is(pg_temp.mutation_count($q$update storage.objects set metadata = '{"mimetype":"image/png"}'::jsonb where id = '91000000-0000-4000-8300-000000000003'$q$), 1::bigint, 'customer can update their own avatar object');
select is(pg_temp.mutation_count($q$delete from storage.objects where id = '91000000-0000-4000-8300-000000000003'$q$), 1::bigint, 'customer can delete their own avatar object');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('provider-profile-images', '91000000-0000-4000-8000-000000000003/forged-avatar.png')$q$), 0::bigint, 'customer cannot upload an avatar into another account folder');
select is(pg_temp.mutation_count($q$delete from storage.objects where id = '91000000-0000-4000-8300-000000000004'$q$), 0::bigint, 'customer cannot delete a provider image owned by another account');
reset role;

-- The second customer cannot read the first customer's private data.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(pg_temp.visible_count($q$select * from public.saved_providers where user_id = '91000000-0000-4000-8000-000000000001'$q$), 0::bigint, 'second customer cannot read the first customer saved providers');
select is(pg_temp.visible_count($q$select * from storage.objects where id = '91000000-0000-4000-8300-000000000001'$q$), 0::bigint, 'second customer cannot read the first customer screenshot');
select is(pg_temp.mutation_count($q$update public.provider_profiles set bio = 'Customer edited listing', status = 'pending_approval' where id = '91000000-0000-4000-8100-000000000003'$q$), 0::bigint, 'customer cannot edit a legacy listing without the provider role');
select is(pg_temp.mutation_count($q$insert into public.provider_languages(provider_profile_id, language_id) values ('91000000-0000-4000-8100-000000000003', '91000000-0000-4000-8200-000000000012')$q$), 0::bigint, 'customer cannot assign languages to a legacy listing');
select is(pg_temp.mutation_count($q$insert into public.provider_specialties(provider_profile_id, specialty_id) values ('91000000-0000-4000-8100-000000000003', '91000000-0000-4000-8200-000000000022')$q$), 0::bigint, 'customer cannot assign specialties to a legacy listing');
select is(pg_temp.mutation_count($q$insert into public.provider_service_regions(provider_profile_id, service_region_id) values ('91000000-0000-4000-8100-000000000003', '91000000-0000-4000-8200-000000000032')$q$), 0::bigint, 'customer cannot assign service regions to a legacy listing');
select throws_ok($q$select public.replace_provider_service_regions('91000000-0000-4000-8100-000000000003', array['91000000-0000-4000-8200-000000000032'::uuid])$q$,
  '42501', null, 'customer cannot use the region replacement RPC for a legacy listing');
reset role;

-- Providers manage their own draft, but cannot approve it or touch others.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'provider can read their own draft');
select is(pg_temp.mutation_count($q$update public.provider_profiles set bio = 'Allowed own draft edit', status = 'pending_approval' where id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'provider can edit and submit their own draft for approval');
select is(pg_temp.mutation_count($q$update public.provider_profiles set status = 'active', approved_at = now() where id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'provider cannot approve their own listing');
select is(pg_temp.mutation_count($q$update public.provider_profiles set bio = 'Hijacked listing', status = 'pending_approval' where id = '91000000-0000-4000-8100-000000000002'$q$), 0::bigint, 'provider cannot edit another provider listing');
select is(pg_temp.visible_count($q$select * from public.profiles where id = '91000000-0000-4000-8000-000000000004'$q$), 0::bigint, 'provider cannot read another provider private account profile');
select is(pg_temp.visible_count($q$select * from public.provider_languages where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'provider can read their own draft languages');
select is(pg_temp.mutation_count($q$insert into public.provider_languages(provider_profile_id, language_id) values ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000012')$q$), 1::bigint, 'provider can add languages to their own draft');
select is(pg_temp.mutation_count($q$insert into public.provider_specialties(provider_profile_id, specialty_id) values ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000022')$q$), 1::bigint, 'provider can add specialties to their own draft');
select is(pg_temp.mutation_count($q$insert into public.provider_languages(provider_profile_id, language_id) values ('91000000-0000-4000-8100-000000000002', '91000000-0000-4000-8200-000000000012')$q$), 0::bigint, 'provider cannot add languages to another provider listing');
select is(pg_temp.mutation_count($q$delete from public.provider_specialties where provider_profile_id = '91000000-0000-4000-8100-000000000002'$q$), 0::bigint, 'provider cannot remove another provider specialties');
select is(pg_temp.visible_count($q$select * from public.provider_service_regions where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'provider can read their own draft regions');
select is(pg_temp.mutation_count($q$insert into public.provider_service_regions(provider_profile_id, service_region_id) values ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000032')$q$), 1::bigint, 'provider can assign their own valid service region');
select is(pg_temp.mutation_count($q$insert into public.provider_service_regions(provider_profile_id, service_region_id) values ('91000000-0000-4000-8100-000000000002', '91000000-0000-4000-8200-000000000032')$q$), 0::bigint, 'provider cannot assign another provider service region');
select throws_ok($q$select public.replace_provider_service_regions('91000000-0000-4000-8100-000000000002', array['91000000-0000-4000-8200-000000000032'::uuid])$q$,
  '42501', null, 'region replacement RPC rejects another provider listing');
select lives_ok($q$select public.replace_provider_service_regions('91000000-0000-4000-8100-000000000001', array['91000000-0000-4000-8200-000000000031'::uuid])$q$,
  'region replacement RPC permits the legitimate provider owner');
select is(pg_temp.visible_count($q$select * from public.saved_providers where user_id = '91000000-0000-4000-8000-000000000001'$q$), 0::bigint, 'provider cannot read an unrelated customer saved providers');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'second provider cannot read the first provider draft');
select is(pg_temp.visible_count($q$select provider_profile_id from public.provider_languages where provider_profile_id = '91000000-0000-4000-8100-000000000001'
  union all select provider_profile_id from public.provider_specialties where provider_profile_id = '91000000-0000-4000-8100-000000000001'
  union all select provider_profile_id from public.provider_service_regions where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'second provider cannot read the first provider draft assignments');
select is(pg_temp.mutation_count($q$update public.profiles set role = 'admin' where id = '91000000-0000-4000-8000-000000000004'$q$), 0::bigint, 'provider cannot promote their own role to administrator');
reset role;

-- A new provider may create a draft, but not an already-approved listing.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select is(pg_temp.mutation_count($q$insert into public.provider_profiles(user_id, slug, status) values ('91000000-0000-4000-8000-000000000007', 'rls-new-provider-910', 'draft')$q$), 1::bigint, 'valid provider can create their own draft listing');
select is(pg_temp.mutation_count($q$insert into public.provider_profiles(user_id, slug, status) values ('91000000-0000-4000-8000-000000000007', 'rls-self-approved-910', 'active')$q$), 0::bigint, 'new provider cannot create an already-approved listing');
reset role;

-- Authenticated identities without a profile have no protected storage access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is(pg_temp.visible_count($q$select * from public.profiles where id::text like '91000000-%'$q$), 0::bigint, 'missing-profile identity cannot read private account profiles');
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'$q$), 0::bigint, 'missing-profile identity cannot read private draft listings');
select is(pg_temp.visible_count($q$select * from storage.objects where id = '91000000-0000-4000-8300-000000000005'$q$), 0::bigint, 'missing-profile identity cannot read private screenshots even in its old folder');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('feedback-screenshots', '91000000-0000-4000-8000-000000000006/new.png')$q$), 0::bigint, 'missing-profile identity cannot upload a private screenshot');
select is(pg_temp.mutation_count($q$insert into storage.objects(bucket_id, name) values ('provider-profile-images', '91000000-0000-4000-8000-000000000006/new.png')$q$), 0::bigint, 'missing-profile identity cannot upload an image');
select is(pg_temp.mutation_count($q$update storage.objects set metadata = '{"mimetype":"image/png"}'::jsonb where id = '91000000-0000-4000-8300-000000000005'$q$), 0::bigint, 'missing-profile identity cannot update an old private screenshot');
select is(pg_temp.mutation_count($q$delete from storage.objects where id = '91000000-0000-4000-8300-000000000005'$q$), 0::bigint, 'missing-profile identity cannot delete an old private screenshot');
select is(pg_temp.mutation_count($q$update storage.objects set metadata = '{"mimetype":"image/png"}'::jsonb where id = '91000000-0000-4000-8300-000000000006'$q$), 0::bigint, 'missing-profile identity cannot update an old image');
select is(pg_temp.mutation_count($q$delete from storage.objects where id = '91000000-0000-4000-8300-000000000006'$q$), 0::bigint, 'missing-profile identity cannot delete an old image');
select is(pg_temp.mutation_count($q$insert into public.categories(name, slug) values ('Orphan category', 'rls-orphan-category-910')$q$), 0::bigint, 'missing-profile identity cannot create lookup entries');
select throws_ok($q$select public.replace_provider_service_regions('91000000-0000-4000-8100-000000000001', array[]::uuid[])$q$,
  '42501', null, 'missing-profile identity cannot replace provider service regions');
reset role;

-- Administrators can inspect and moderate provider content and private feedback.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id in ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8100-000000000002')$q$), 2::bigint, 'administrator can review draft and active listings');
select is(pg_temp.visible_count($q$select provider_profile_id from public.provider_languages where provider_profile_id = '91000000-0000-4000-8100-000000000001'
  union all select provider_profile_id from public.provider_specialties where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 2::bigint, 'administrator can inspect private draft language and specialty assignments');
select is(pg_temp.visible_count($q$select * from public.provider_service_regions where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'administrator can inspect private draft service-region assignments');
select is(pg_temp.mutation_count($q$insert into public.provider_service_regions(provider_profile_id, service_region_id) values ('91000000-0000-4000-8100-000000000001', '91000000-0000-4000-8200-000000000032')$q$), 1::bigint, 'administrator can correct service-region assignments');
select is(pg_temp.mutation_count($q$delete from public.provider_service_regions where provider_profile_id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'administrator can remove inappropriate service-region assignments');
select is(pg_temp.visible_count($q$select id from public.categories where id = '91000000-0000-4000-8200-000000000002'
  union all select id from public.languages where id = '91000000-0000-4000-8200-000000000013'
  union all select id from public.specialties where id = '91000000-0000-4000-8200-000000000023'$q$), 3::bigint, 'administrator can inspect inactive managed lookup entries');
select is(pg_temp.mutation_count($q$update public.categories set name = 'Allowed admin rename' where id = '91000000-0000-4000-8200-000000000001'$q$), 1::bigint, 'administrator can update managed lookup entries');
select is(pg_temp.mutation_count($q$insert into public.specialties(name, slug) values ('Allowed admin specialty', 'rls-admin-specialty-910')$q$), 1::bigint, 'administrator can create managed lookup entries');
select is(pg_temp.visible_count($q$select * from storage.objects where bucket_id = 'feedback-screenshots' and id::text like '91000000-%'$q$), 3::bigint, 'administrator can inspect private feedback screenshots including orphaned evidence');
select lives_ok($q$update public.provider_profiles set status = 'active', approved_at = now() where id = '91000000-0000-4000-8100-000000000001'$q$,
  'administrator can approve an actual draft listing');
select is((select status::text from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'), 'active', 'administrator approval persists on the intended listing');
reset role;

-- Approved content becomes public and can be saved by a legitimate customer.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(pg_temp.visible_count($q$select * from public.provider_profiles where id = '91000000-0000-4000-8100-000000000001'$q$), 1::bigint, 'approved listing becomes publicly visible');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(pg_temp.mutation_count($q$insert into public.saved_providers(user_id, provider_profile_id) values ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8100-000000000001')$q$), 1::bigint, 'customer can save an approved active provider');
reset role;

select * from finish();
rollback;
