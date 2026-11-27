-- Isolated disposable database only; fixtures, failures, and every write roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('96000000-0000-4000-8000-000000000001','edit-a@example.invalid',now(),'{"role":"provider"}'),
 ('96000000-0000-4000-8000-000000000002','edit-b@example.invalid',now(),'{"role":"provider"}'),
 ('96000000-0000-4000-8000-000000000003','edit-admin@example.invalid',now(),'{}'),
 ('96000000-0000-4000-8000-000000000004','edit-customer@example.invalid',now(),'{}'),
 ('96000000-0000-4000-8000-000000000005','edit-unconfirmed@example.invalid',null,'{"role":"provider"}'),
 ('96000000-0000-4000-8000-000000000006','edit-orphan@example.invalid',now(),'{"role":"provider"}'),
 ('96000000-0000-4000-8000-000000000007','edit-banned@example.invalid',now(),'{"role":"provider"}');
delete from public.profiles where id='96000000-0000-4000-8000-000000000006';
update public.profiles set role='admin' where id='96000000-0000-4000-8000-000000000003';
update auth.users set banned_until=now()+interval '1 day' where id='96000000-0000-4000-8000-000000000007';
insert into public.categories(id,name,slug,is_active) values ('96000000-0000-4000-8200-000000000001','Editor category','editor-category',true);
insert into public.languages(id,name,slug,is_active) values
 ('96000000-0000-4000-8200-000000000011','Editor language','editor-language',true),
 ('96000000-0000-4000-8200-000000000012','Editor language 2','editor-language-2',true);
insert into public.specialties(id,category_id,name,slug,is_active) values
 ('96000000-0000-4000-8200-000000000021','96000000-0000-4000-8200-000000000001','Editor specialty','editor-specialty',true),
 ('96000000-0000-4000-8200-000000000022',null,'Editor specialty 2','editor-specialty-2',true);
insert into public.service_regions(id,province_code,name,slug,is_active,center_latitude,center_longitude) values
 ('96000000-0000-4000-8200-000000000031','ON','Editor region 1','editor-region-1',true,45.4,-75.7),
 ('96000000-0000-4000-8200-000000000032','ON','Editor region 2','editor-region-2',true,43.7,-79.4),
 ('96000000-0000-4000-8200-000000000033','ON','Editor inactive region','editor-inactive-region',false,44,-78);
create function pg_temp.identity(id uuid) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',coalesce(id::text,''),true);
 perform set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true);
end;$$;
create function pg_temp.payload(extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('display_name','Editor A','business_name','Editor business','bio','Original bio',
 'email','editor-public@example.invalid','phone','555-0100','city','Ottawa','province_state','ON','country','Canada',
 'category_id','96000000-0000-4000-8200-000000000001')||extra;
$$;
create function pg_temp.drev() returns bigint language sql as $$select coalesce((select details_revision from public.provider_profiles where user_id=auth.uid()),0);$$;
create function pg_temp.rrev() returns bigint language sql as $$select regions_revision from public.provider_profiles where user_id=auth.uid();$$;
create function pg_temp.rev() returns bigint language sql as $$select revision from public.provider_profiles where user_id=auth.uid();$$;
create function pg_temp.details(extra jsonb default '{}',expected bigint default null,intent text default 'draft') returns jsonb language sql as $$
 select public.save_provider_listing_details(coalesce(expected,pg_temp.drev()),pg_temp.payload(extra),
 array['96000000-0000-4000-8200-000000000011']::uuid[],array['96000000-0000-4000-8200-000000000021']::uuid[],intent);
$$;
create function pg_temp.regions(ids uuid[],expected bigint default null) returns jsonb language sql as $$
 select public.save_provider_service_regions(coalesce(expected,pg_temp.rrev()),ids);
$$;
create function pg_temp.snapshot_a() returns jsonb language sql security definer as $$
 select jsonb_build_object('listing',(select to_jsonb(p) from public.provider_profiles p where user_id='96000000-0000-4000-8000-000000000001'),
 'languages',(select jsonb_agg(to_jsonb(a) order by a.language_id) from public.provider_languages a join public.provider_profiles p on p.id=a.provider_profile_id where p.user_id='96000000-0000-4000-8000-000000000001'),
 'specialties',(select jsonb_agg(to_jsonb(a) order by a.specialty_id) from public.provider_specialties a join public.provider_profiles p on p.id=a.provider_profile_id where p.user_id='96000000-0000-4000-8000-000000000001'),
 'regions',(select jsonb_agg(to_jsonb(a) order by a.service_region_id) from public.provider_service_regions a join public.provider_profiles p on p.id=a.provider_profile_id where p.user_id='96000000-0000-4000-8000-000000000001'));
$$;

select ok(not has_function_privilege('anon','public.save_provider_listing_details(bigint,jsonb,uuid[],uuid[],text)','EXECUTE'),'anonymous details execution denied');
select ok(not has_function_privilege('anon','public.save_provider_service_regions(bigint,uuid[])','EXECUTE'),'anonymous regions execution denied');
select ok(not has_function_privilege('service_role','public.save_provider_listing_details(bigint,jsonb,uuid[],uuid[],text)','EXECUTE'),'service-role details execution denied');
select ok(not has_function_privilege('service_role','public.save_provider_service_regions(bigint,uuid[])','EXECUTE'),'service-role regions execution denied');
set local role authenticated;
select pg_temp.identity(null);
select throws_ok('select pg_temp.details()','28000','not_authenticated','details require identity');
select throws_ok($q$select pg_temp.regions('{}',1)$q$,'28000','not_authenticated','regions require identity');
select pg_temp.identity('96000000-0000-4000-8000-000000000004');
select throws_ok('select pg_temp.details()','42501','insufficient_role','customer details save denied');
select throws_ok($q$select pg_temp.regions('{}',1)$q$,'42501','insufficient_role','customer regions save denied');
select pg_temp.identity('96000000-0000-4000-8000-000000000003');
select throws_ok('select pg_temp.details()','42501','insufficient_role','admin self-service details save denied');
select pg_temp.identity('96000000-0000-4000-8000-000000000005');
select throws_ok('select pg_temp.details()','42501','verified_account_required','unconfirmed details save denied');
select pg_temp.identity('96000000-0000-4000-8000-000000000006');
select throws_ok('select pg_temp.details()','42501','insufficient_role','missing-profile details save denied');
select pg_temp.identity('96000000-0000-4000-8000-000000000007');
select throws_ok($q$select pg_temp.regions('{}',1)$q$,'42501','verified_account_required','banned regions save denied');
select pg_temp.identity('96000000-0000-4000-8000-000000000001');
select is((pg_temp.details()->>'status'),'draft','details editor creates a draft');
select is((select count(*) from public.provider_service_regions),0::bigint,'details creation does not invent regions');
select throws_ok($q$select pg_temp.details('{}',0)$q$,'PT409','listing_conflict','repeated creation cannot overwrite');
select set_config('e.d',pg_temp.drev()::text,true);
select set_config('e.r',pg_temp.rrev()::text,true);
select set_config('e.all',pg_temp.rev()::text,true);
select lives_ok($q$select pg_temp.details('{"bio":"Bio one"}',current_setting('e.d')::bigint)$q$,'current details save succeeds');
select ok(pg_temp.drev()>current_setting('e.d')::bigint,'details content advances details revision');
select ok(pg_temp.rev()>current_setting('e.all')::bigint,'details content advances review revision');
select is(pg_temp.rrev(),current_setting('e.r')::bigint,'details edit leaves region revision valid');
select set_config('e.d2',pg_temp.drev()::text,true);
select lives_ok($q$select pg_temp.regions(array['96000000-0000-4000-8200-000000000031']::uuid[],current_setting('e.r')::bigint)$q$,'older region form succeeds after unrelated bio save');
select is((select bio from public.provider_profiles where user_id=auth.uid()),'Bio one','region save preserves newest bio');
select is(pg_temp.drev(),current_setting('e.d2')::bigint,'region save leaves details revision valid');
select throws_ok($q$select pg_temp.regions(array['96000000-0000-4000-8200-000000000032']::uuid[],current_setting('e.r')::bigint)$q$,'PT409','listing_conflict','older overlapping region edit is denied');
select throws_ok($q$select pg_temp.details('{"bio":"Stale bio"}',current_setting('e.d')::bigint)$q$,'PT409','listing_conflict','older overlapping details edit is denied');
select set_config('e.d',pg_temp.drev()::text,true);
select lives_ok($q$select pg_temp.regions(array['96000000-0000-4000-8200-000000000032']::uuid[])$q$,'fresh region replacement succeeds');
select lives_ok($q$select pg_temp.details('{"bio":"After regions"}',current_setting('e.d')::bigint)$q$,'older details form succeeds after unrelated region save');
select is((select service_region_id from public.provider_service_regions where provider_profile_id=(select id from public.provider_profiles where user_id=auth.uid())),'96000000-0000-4000-8200-000000000032'::uuid,'details save preserves latest region set');
select set_config('e.r',pg_temp.rrev()::text,true);
select set_config('e.d',pg_temp.drev()::text,true);
select lives_ok($q$select pg_temp.details('{"bio":"After regions"}')$q$,'unchanged draft can be saved');
select is(pg_temp.rrev(),current_setting('e.r')::bigint,'unchanged assignments are retained without region-version churn');
select is(pg_temp.drev(),current_setting('e.d')::bigint,'unchanged details do not create a false same-editor conflict');
select throws_ok($q$update public.provider_profiles set details_revision=details_revision+1 where user_id=auth.uid()$q$,'42501','use_versioned_listing_operation','clients cannot forge details revisions');
select throws_ok($q$update public.provider_profiles set regions_revision=regions_revision+1 where user_id=auth.uid()$q$,'42501','use_versioned_listing_operation','clients cannot forge region revisions');
select throws_ok($q$select pg_temp.details('{"user_id":"96000000-0000-4000-8000-000000000002"}')$q$,'22023','invalid_listing_fields','new details path cannot choose another owner');
select throws_ok($q$select pg_temp.details('{"regions_revision":"1"}')$q$,'22023','invalid_listing_fields','new details path cannot choose version counters');
select set_config('e.snapshot',pg_temp.snapshot_a()::text,true);
select throws_ok($q$select pg_temp.regions(array['96000000-0000-4000-8200-000000000033']::uuid[])$q$,'22023','invalid_assignments','new regions path rejects inactive selection');
select is(pg_temp.snapshot_a(),current_setting('e.snapshot')::jsonb,'invalid region edit leaves all data and versions unchanged');
select pg_temp.identity('96000000-0000-4000-8000-000000000002');
select throws_ok($q$select pg_temp.regions('{}',1)$q$,'42501','listing_not_owned','another provider without a listing cannot target fixture A');
select is((select count(*) from public.provider_profiles where user_id='96000000-0000-4000-8000-000000000001'),0::bigint,'other provider cannot read private content');
select is(pg_temp.snapshot_a(),current_setting('e.snapshot')::jsonb,'other provider operations do not change fixture A');
select pg_temp.identity('96000000-0000-4000-8000-000000000001');

-- An actual late assignment failure must roll back content and all three versions.
reset role;
create function pg_temp.fail_editor_specialty() returns trigger language plpgsql as $$begin
 if new.specialty_id='96000000-0000-4000-8200-000000000022' then raise exception 'editor_assignment_failure' using errcode='ZX006'; end if;
 return new;
end;$$;
create trigger editor_specialty_failure after insert on public.provider_specialties for each row execute function pg_temp.fail_editor_specialty();
set local role authenticated;
select throws_ok($q$select public.save_provider_listing_details(pg_temp.drev(),pg_temp.payload('{"bio":"Must roll back"}'),array['96000000-0000-4000-8200-000000000012']::uuid[],array['96000000-0000-4000-8200-000000000022']::uuid[],'draft')$q$,'ZX006','editor_assignment_failure','new details wrapper propagates late assignment failure');
select is(pg_temp.snapshot_a(),current_setting('e.snapshot')::jsonb,'late details failure rolls back the complete aggregate and versions');
reset role;
drop trigger editor_specialty_failure on public.provider_specialties;
set local role authenticated;
select is((pg_temp.details('{"bio":"After regions"}',null,'submit')->>'status'),'pending_approval','scoped details submit enters review');
select set_config('e.review',pg_temp.rev()::text,true);
select set_config('e.d',pg_temp.drev()::text,true);
select lives_ok($q$select pg_temp.regions(array['96000000-0000-4000-8200-000000000031']::uuid[])$q$,'region change after submission remains allowed and invalidates publication');
select is((select status::text from public.provider_profiles where user_id=auth.uid()),'draft','region change returns pending listing to draft');
select pg_temp.identity('96000000-0000-4000-8000-000000000003');
select throws_ok($q$select public.review_provider_listing((select id from public.provider_profiles where user_id='96000000-0000-4000-8000-000000000001'),current_setting('e.review')::bigint,'approve')$q$,'PT409','listing_conflict','overall review version still rejects approval after a region change');
select pg_temp.identity('96000000-0000-4000-8000-000000000001');
select is((pg_temp.details('{"bio":"After regions"}',current_setting('e.d')::bigint,'submit')->>'status'),'pending_approval','details submission preserves fresh regions without a false conflict');
select set_config('e.review',pg_temp.rev()::text,true);
select set_config('e.d',pg_temp.drev()::text,true);
select set_config('e.r',pg_temp.rrev()::text,true);
select pg_temp.identity('96000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing((select id from public.provider_profiles where user_id='96000000-0000-4000-8000-000000000001'),current_setting('e.review')::bigint,'approve')->>'status'),'active','administrator can approve the exact current aggregate');
select pg_temp.identity('96000000-0000-4000-8000-000000000001');
select throws_ok($q$select pg_temp.details('{"bio":"After regions"}',current_setting('e.d')::bigint)$q$,'PT409','listing_conflict','administrator decision invalidates older details form');
select throws_ok($q$select pg_temp.regions('{}',current_setting('e.r')::bigint)$q$,'PT409','listing_conflict','administrator decision invalidates older region form');
select set_config('e.r',pg_temp.rrev()::text,true);
select is((pg_temp.details('{"bio":"Changed approved bio"}')->>'status'),'active','editing approved details preserves publication');
select lives_ok($q$select pg_temp.regions('{}',current_setting('e.r')::bigint)$q$,'region form remains valid after approved bio is edited');
select is((select fields->>'bio' from public.provider_listing_changes where provider_profile_id=(select id from public.provider_profiles where user_id=auth.uid())),'Changed approved bio','independent region edit preserves proposed biography');
select is((select cardinality(region_ids)::bigint from public.provider_listing_changes where provider_profile_id=(select id from public.provider_profiles where user_id=auth.uid())),0::bigint,'explicit proposed region clear is retained');
reset role;
select * from finish();
rollback;
