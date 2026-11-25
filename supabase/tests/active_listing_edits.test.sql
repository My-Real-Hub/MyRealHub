-- Isolated database only. Every fixture, grant check and write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('94000000-0000-4000-8000-000000000001','active-owner@example.invalid',now(),'{"role":"provider"}'),
 ('94000000-0000-4000-8000-000000000002','active-other@example.invalid',now(),'{"role":"provider"}'),
 ('94000000-0000-4000-8000-000000000003','active-admin@example.invalid',now(),'{}'),
 ('94000000-0000-4000-8000-000000000004','active-customer@example.invalid',now(),'{}'),
 ('94000000-0000-4000-8000-000000000005','active-orphan@example.invalid',now(),'{"role":"provider"}'),
 ('94000000-0000-4000-8000-000000000006','active-unconfirmed@example.invalid',null,'{"role":"provider"}'),
 ('94000000-0000-4000-8000-000000000007','active-banned@example.invalid',now(),'{"role":"provider"}');
delete from public.profiles where id='94000000-0000-4000-8000-000000000005';
update public.profiles set role='admin' where id='94000000-0000-4000-8000-000000000003';
update auth.users set banned_until=now()+interval '1 day' where id='94000000-0000-4000-8000-000000000007';
insert into public.categories(id,name,slug,is_active) values('94000000-0000-4000-8200-000000000001','Active category','active-category',true);
insert into public.languages(id,name,slug,is_active) values
 ('94000000-0000-4000-8200-000000000011','Active English','active-en',true),
 ('94000000-0000-4000-8200-000000000012','Active French','active-fr',true);
insert into public.specialties(id,category_id,name,slug,is_active) values
 ('94000000-0000-4000-8200-000000000021','94000000-0000-4000-8200-000000000001','Active specialty','active-specialty',true),
 ('94000000-0000-4000-8200-000000000022',null,'Active global','active-global',true);
insert into public.service_regions(id,province_code,name,slug,is_active,center_latitude,center_longitude) values
 ('94000000-0000-4000-8200-000000000031','ON','Active region one','active-region-one',true,45,-75),
 ('94000000-0000-4000-8200-000000000032','ON','Active region two','active-region-two',true,44,-76);
create function pg_temp.identity(id uuid) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',coalesce(id::text,''),true);
 perform set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true);
end;$$;
create function pg_temp.payload(extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('display_name','Approved name','business_name','Approved business','bio','Approved biography',
 'phone','555-0100','email','approved@example.invalid','city','Ottawa','province_state','ON','country','Canada',
 'category_id','94000000-0000-4000-8200-000000000001') || extra;
$$;
create function pg_temp.listing_id() returns uuid language sql security definer as $$
 select id from public.provider_profiles where user_id='94000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.version(kind text default 'revision') returns bigint language sql security definer as $$
 select (to_jsonb(p)->>kind)::bigint from public.provider_profiles p where id=pg_temp.listing_id();
$$;
create function pg_temp.details(extra jsonb default '{}',intent text default 'submit',token bigint default null) returns jsonb language sql as $$
 select public.save_provider_listing_details(coalesce(token,pg_temp.version('details_revision'),0),pg_temp.payload(extra),
 array['94000000-0000-4000-8200-000000000011']::uuid[],array['94000000-0000-4000-8200-000000000021']::uuid[],intent);
$$;
create function pg_temp.regions(ids uuid[],token bigint default null) returns jsonb language sql as $$
 select public.save_provider_service_regions(coalesce(token,pg_temp.version('regions_revision')),ids);
$$;
create function pg_temp.published() returns jsonb language sql security definer as $$
 select jsonb_build_object('fields',public.provider_listing_public_fields(p),'status',p.status,'approved_at',p.approved_at,
 'languages',array(select language_id from public.provider_languages where provider_profile_id=p.id order by language_id),
 'specialties',array(select specialty_id from public.provider_specialties where provider_profile_id=p.id order by specialty_id),
 'regions',array(select service_region_id from public.provider_service_regions where provider_profile_id=p.id order by service_region_id))
 from public.provider_profiles p where p.id=pg_temp.listing_id();
$$;
create function pg_temp.everything() returns jsonb language sql security definer as $$
 select jsonb_build_object('parent',to_jsonb(p),'proposal',(select to_jsonb(c) from public.provider_listing_changes c where c.provider_profile_id=p.id),
 'published',pg_temp.published()) from public.provider_profiles p where p.id=pg_temp.listing_id();
$$;
select ok((select relrowsecurity from pg_class where oid='public.provider_listing_changes'::regclass),'proposed content has RLS enabled');
select ok(not has_table_privilege('anon','public.provider_listing_changes','SELECT'),'anonymous has no proposal table grant');
select ok(not has_table_privilege('authenticated','public.provider_listing_changes','INSERT,UPDATE,DELETE'),'authenticated users have no direct proposal writes');
select ok(not has_function_privilege('authenticated','public.stage_provider_listing_edit(uuid,bigint,jsonb,uuid[],uuid[],uuid[],text)','EXECUTE'),'staging coordinator is internal');
select ok(not has_function_privilege('authenticated','public.save_unpublished_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text)','EXECUTE'),'old save cannot bypass staging');
select ok(not has_function_privilege('authenticated','public.review_unpublished_provider_listing(uuid,bigint,text,text)','EXECUTE'),'old review cannot bypass proposal checks');
select ok(not has_function_privilege('anon','public.deactivate_provider_listing(bigint)','EXECUTE'),'anonymous cannot invoke owner deactivation');
select ok(not has_function_privilege('service_role','public.get_provider_listing_editor(text,uuid)','EXECUTE'),'trusted server cannot impersonate an editor through the public RPC');
set local role authenticated;
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select is((pg_temp.details()->>'status'),'pending_approval','first submission still requires approval');
select is((select review_type from public.provider_listing_review_queue where id=pg_temp.listing_id()),'pending_approval','new listing is categorized as pending approval');
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')->>'status'),'active','administrator initially approves');
select set_config('a.published',pg_temp.published()::text,true);
select set_config('a.review',pg_temp.version()::text,true);
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select is((pg_temp.details('{"bio":"Proposed biography","business_name":"Proposed business"}')->>'status'),'active','submitting edits keeps publication active');
select is((select state from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),'pending_edit','edit is queued privately');
select is(pg_temp.published(),current_setting('a.published')::jsonb,'all approved public fields and assignments remain unchanged');
select is((public.get_provider_listing_editor('user_id',auth.uid())->>'bio'),'Proposed biography','owner edits the private proposal');
select is((select review_type from public.provider_listing_review_queue where id=pg_temp.listing_id()),'pending_edit','queue categorizes an edit separately');
select is((select count(*) from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),1::bigint,'one proposal exists per listing');
select set_config('a.whole',pg_temp.everything()::text,true);
select is((pg_temp.details('{"bio":"Proposed biography","business_name":"Proposed business"}')->>'already_pending')::boolean,true,'identical pending edit is acknowledged');
select is(pg_temp.everything(),current_setting('a.whole')::jsonb,'identical edit retry changes no timestamp, content or version');
select is((pg_temp.details('{"bio":"Proposed biography","business_name":"Proposed business"}','submit',1)->>'already_pending')::boolean,true,'stale identical retry is read-only');
select is(pg_temp.everything(),current_setting('a.whole')::jsonb,'stale identical retry leaves the aggregate unchanged');
select throws_ok($q$select pg_temp.details('{"bio":"Stale different content"}','submit',1)$q$,'PT409','listing_conflict','stale different proposal cannot write');
select throws_ok($q$update public.provider_listing_changes set state='draft' where provider_profile_id=pg_temp.listing_id()$q$,'42501',null,'direct owner mutation is denied');
select pg_temp.identity('94000000-0000-4000-8000-000000000004');
select is((select count(*) from public.provider_listing_changes),0::bigint,'customer cannot read proposals');
select is((select bio from public.provider_profiles where id=pg_temp.listing_id()),'Approved biography','customer sees approved content only');
select is((select review_type from public.provider_listing_review_queue where id=pg_temp.listing_id()),null::text,'customer cannot infer private pending metadata through the view');
select throws_ok($q$select public.get_provider_listing_editor('id',pg_temp.listing_id())$q$,'42501','insufficient_role','customer cannot use private editor RPC');
select throws_ok($q$select public.deactivate_provider_listing(pg_temp.version())$q$,'42501','insufficient_role','customer cannot deactivate providers');
select throws_ok($q$select public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')$q$,'42501','insufficient_role','customer cannot approve an edit');
select pg_temp.identity('94000000-0000-4000-8000-000000000002');
select is((select count(*) from public.provider_listing_changes),0::bigint,'other provider cannot read proposals');
select throws_ok($q$select public.get_provider_listing_editor('user_id','94000000-0000-4000-8000-000000000001')$q$,'42501','listing_not_owned','other provider cannot load this editor');
select throws_ok($q$select public.deactivate_provider_listing(pg_temp.version())$q$,'42501','listing_not_owned','owner-only deactivation has no target-selector bypass');
select pg_temp.identity('94000000-0000-4000-8000-000000000005');
select throws_ok($q$select public.deactivate_provider_listing(1)$q$,'42501','insufficient_role','missing profile cannot deactivate');
select throws_ok($q$select public.get_provider_listing_editor('id',pg_temp.listing_id())$q$,'42501','insufficient_role','missing profile cannot load proposals');
select pg_temp.identity('94000000-0000-4000-8000-000000000006');
select throws_ok($q$select public.deactivate_provider_listing(1)$q$,'42501','verified_account_required','unconfirmed provider cannot deactivate');
select pg_temp.identity('94000000-0000-4000-8000-000000000007');
select throws_ok($q$select public.get_provider_listing_editor('id',pg_temp.listing_id())$q$,'42501','verified_account_required','banned provider cannot use editor');
select pg_temp.identity(null);
select throws_ok($q$select public.deactivate_provider_listing(1)$q$,'28000','not_authenticated','missing identity is denied');
reset role;
set local role anon;
select is((select bio from public.provider_profiles where id=pg_temp.listing_id()),'Approved biography','anonymous public listing remains approved and visible');
select throws_ok($q$select * from public.provider_listing_changes$q$,'42501',null,'anonymous proposal reads are denied');
reset role;
set local role authenticated;
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select is((public.get_provider_listing_editor('id',pg_temp.listing_id())->>'bio'),'Proposed biography','administrator sees proposed details for review');
select throws_ok($q$select public.review_provider_listing(pg_temp.listing_id(),current_setting('a.review')::bigint,'approve')$q$,'PT409','listing_conflict','old admin review is rejected');
select throws_ok($q$select public.deactivate_provider_listing(pg_temp.version())$q$,'42501','insufficient_role','administrator cannot impersonate the owner deactivation operation');
select throws_ok($q$select public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'reject','')$q$,'22023','rejection_reason_required','edit rejection requires a reason');
select is((public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'reject','Revise the biography')->>'status'),'active','rejecting an edit keeps publication active');
select is(pg_temp.published(),current_setting('a.published')::jsonb,'rejecting edits preserves the approved aggregate');
select is((select state from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),'rejected','rejected proposal is retained for owner correction');
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select is((public.get_provider_listing_editor('user_id',auth.uid())->>'rejection_reason'),'Revise the biography','owner sees edit rejection feedback');
select set_config('a.d',pg_temp.version('details_revision')::text,true);
select lives_ok($q$select pg_temp.regions(array['94000000-0000-4000-8200-000000000032']::uuid[])$q$,'owner stages regions separately');
select is(pg_temp.version('details_revision'),current_setting('a.d')::bigint,'private region edit keeps details token valid');
select lives_ok($q$select pg_temp.details('{"bio":"Final proposed biography"}','submit',current_setting('a.d')::bigint)$q$,'details save uses its still-valid token');
select is((select region_ids from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),array['94000000-0000-4000-8200-000000000032']::uuid[],'details save preserves staged regions');
select is(pg_temp.published(),current_setting('a.published')::jsonb,'independent private saves do not change public assignments');
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')->>'reviewed_edit')::boolean,true,'administrator publishes a pending edit');
select is((select status::text from public.provider_profiles where id=pg_temp.listing_id()),'active','publication remains active after approval');
select is((select bio from public.provider_profiles where id=pg_temp.listing_id()),'Final proposed biography','approved biography is now public');
select is((select service_region_id from public.provider_service_regions where provider_profile_id=pg_temp.listing_id()),'94000000-0000-4000-8200-000000000032'::uuid,'approved staged region is now public');
select is((select count(*) from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),0::bigint,'approval removes the proposal queue entry');
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select is((pg_temp.details('{"bio":"Draft only"}','draft')->>'status'),'active','draft edits also keep the public listing active');
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select throws_ok($q$select public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')$q$,'23514','invalid_listing_transition','administrator cannot publish an unsubmitted draft');
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select pg_temp.details('{"bio":"Pending before owner deactivation"}');
select set_config('a.old',pg_temp.version()::text,true);
select pg_temp.details('{"bio":"Changed pending before owner deactivation"}');
select throws_ok($q$select public.deactivate_provider_listing(current_setting('a.old')::bigint)$q$,'PT409','listing_conflict','stale deactivation cannot withdraw a newer edit');
select is((public.deactivate_provider_listing(pg_temp.version())->>'status'),'inactive','owner can deactivate an active listing');
select is((select state from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),'draft','deactivation withdraws pending review and preserves draft');
select is((select role::text from public.profiles where id=auth.uid()),'provider','deactivation preserves account role and login profile');
select set_config('a.whole',pg_temp.everything()::text,true);
select is((public.deactivate_provider_listing(1)->>'already_inactive')::boolean,true,'lost-response deactivation retry is acknowledged');
select is(pg_temp.everything(),current_setting('a.whole')::jsonb,'inactive retry is read-only');
reset role;
set local role anon;
select is((select count(*) from public.provider_profiles where id=pg_temp.listing_id()),0::bigint,'owner deactivation hides the public listing');
reset role;
set local role authenticated;
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select is((pg_temp.details('{"bio":"Reactivation content"}','reactivate')->>'status'),'pending_approval','owner reactivation still requires administrator review');
select is((select count(*) from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),0::bigint,'reactivation consolidates private draft into the hidden review aggregate');
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')->>'status'),'active','administrator can approve reactivation');
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select set_config('a.whole',pg_temp.everything()::text,true);
select is((pg_temp.details('{"bio":"Reactivation content"}')->>'no_changes')::boolean,true,'submitting an unchanged approved listing creates no request');
select is(pg_temp.everything(),current_setting('a.whole')::jsonb,'unchanged approved submission is read-only');
select pg_temp.regions(array['94000000-0000-4000-8200-000000000031']::uuid[]);
select pg_temp.details('{"bio":"Atomic candidate"}');
select set_config('a.whole',pg_temp.everything()::text,true);
reset role;
create function pg_temp.fail_active_publish() returns trigger language plpgsql as $$begin
 if new.service_region_id='94000000-0000-4000-8200-000000000031' then
   raise exception 'active_publish_failure' using errcode='ZX007';
 end if;
 return new;
end;$$;
create trigger active_publish_failure after insert on public.provider_service_regions
 for each row execute function pg_temp.fail_active_publish();
set local role authenticated;
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select throws_ok($q$select public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')$q$,'ZX007','active_publish_failure','late publication failure propagates');
select is(pg_temp.everything(),current_setting('a.whole')::jsonb,'failed publication rolls back public content, assignments, versions and proposal');
reset role;
drop trigger active_publish_failure on public.provider_service_regions;
set local role authenticated;
select pg_temp.identity('94000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(pg_temp.listing_id(),pg_temp.version(),'approve')->>'status'),'active','same valid review publishes after transient failure is removed');
select pg_temp.identity('94000000-0000-4000-8000-000000000001');
select set_config('a.published',pg_temp.published()::text,true);
update public.profiles set phone='555-0170' where id=auth.uid();
select is(pg_temp.published(),current_setting('a.published')::jsonb,'personal contact change leaves approved public content unchanged');
select is((select fields->>'phone' from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),'555-0170','shared contact change is staged privately');
select is((select state from public.provider_listing_changes where provider_profile_id=pg_temp.listing_id()),'draft','personal save does not submit other draft edits implicitly');
select is((select status::text from public.provider_profiles where id=pg_temp.listing_id()),'active','personal contact change never deactivates the listing');
reset role;
delete from auth.users where id='94000000-0000-4000-8000-000000000001';
select is((select count(*) from public.provider_listing_changes),0::bigint,'Auth deletion cascades to private proposals without leaving orphaned rows');
select * from finish();
rollback;
