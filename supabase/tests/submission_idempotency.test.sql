-- Disposable database only: every fixture, moderation decision and write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('95000000-0000-4000-8000-000000000001','pending-a@example.invalid',now(),'{"role":"provider"}'),
 ('95000000-0000-4000-8000-000000000002','pending-b@example.invalid',now(),'{"role":"provider"}'),
 ('95000000-0000-4000-8000-000000000003','pending-admin@example.invalid',now(),'{}'),
 ('95000000-0000-4000-8000-000000000004','pending-customer@example.invalid',now(),'{}');
update public.profiles set role='admin' where id='95000000-0000-4000-8000-000000000003';
insert into public.categories(id,name,slug,is_active) values ('95000000-0000-4000-8200-000000000001','Pending category','pending-category',true);
insert into public.languages(id,name,slug,is_active) values
 ('95000000-0000-4000-8200-000000000011','Pending language','pending-language',true),
 ('95000000-0000-4000-8200-000000000012','Pending language two','pending-language-two',true);
insert into public.specialties(id,category_id,name,slug,is_active) values
 ('95000000-0000-4000-8200-000000000021',null,'Pending specialty','pending-specialty',true),
 ('95000000-0000-4000-8200-000000000022',null,'Pending specialty two','pending-specialty-two',true);
insert into public.service_regions(id,province_code,name,slug,is_active,center_latitude,center_longitude) values
 ('95000000-0000-4000-8200-000000000031','ON','Pending region one','pending-region-one',true,45.4,-75.7),
 ('95000000-0000-4000-8200-000000000032','ON','Pending region two','pending-region-two',true,43.7,-79.4);
insert into storage.objects(bucket_id,name,owner_id) values
 ('provider-profile-images','95000000-0000-4000-8000-000000000001/pending.png','95000000-0000-4000-8000-000000000001');
create function pg_temp.identity(id uuid) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',coalesce(id::text,''),true);
 perform set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true);
end;$$;
create function pg_temp.payload(extra jsonb default '{}') returns jsonb language sql as $$
 select coalesce((select jsonb_build_object('display_name',p.display_name,'business_name',p.business_name,'bio',p.bio,
 'category_id',p.category_id,'email',p.email,'phone',p.phone,'website_url',p.website_url,'city',p.city,
 'province_state',p.province_state,'country',p.country,'profile_image_path',p.profile_image_path,'profile_image_url',p.profile_image_url)
 from public.provider_profiles p where p.user_id=auth.uid()),
 jsonb_build_object('display_name','Pending provider','business_name','Pending business','bio','Draft biography',
 'category_id','95000000-0000-4000-8200-000000000001','email','pending-public@example.invalid','phone','555-0100',
 'city','Ottawa','province_state','ON','country','Canada','profile_image_path','95000000-0000-4000-8000-000000000001/pending.png',
 'profile_image_url','https://fixture.supabase.co/storage/v1/object/public/provider-profile-images/95000000-0000-4000-8000-000000000001/pending.png'))||extra;
$$;
create function pg_temp.listing_id() returns uuid language sql as $$select id from public.provider_profiles where user_id=auth.uid();$$;
create function pg_temp.drev() returns bigint language sql as $$select coalesce((select details_revision from public.provider_profiles where user_id=auth.uid()),0);$$;
create function pg_temp.rev() returns bigint language sql as $$select revision from public.provider_profiles where user_id=auth.uid();$$;
create function pg_temp.dsave(extra jsonb default '{}',expected bigint default null,intent text default 'submit') returns jsonb language sql as $$
 select public.save_provider_listing_details(coalesce(expected,pg_temp.drev()),pg_temp.payload(extra),
 case when pg_temp.listing_id() is null then array['95000000-0000-4000-8200-000000000011','95000000-0000-4000-8200-000000000012']::uuid[]
 else array(select language_id from public.provider_languages where provider_profile_id=pg_temp.listing_id()) end,
 case when pg_temp.listing_id() is null then array['95000000-0000-4000-8200-000000000021','95000000-0000-4000-8200-000000000022']::uuid[]
 else array(select specialty_id from public.provider_specialties where provider_profile_id=pg_temp.listing_id()) end,intent);
$$;
create function pg_temp.snapshot_a() returns jsonb language sql security definer as $$
 select jsonb_build_object('listing',(select to_jsonb(p) from public.provider_profiles p where user_id='95000000-0000-4000-8000-000000000001'),
 'languages',(select jsonb_agg(to_jsonb(a) order by a.language_id) from public.provider_languages a join public.provider_profiles p on p.id=a.provider_profile_id where p.user_id='95000000-0000-4000-8000-000000000001'),
 'specialties',(select jsonb_agg(to_jsonb(a) order by a.specialty_id) from public.provider_specialties a join public.provider_profiles p on p.id=a.provider_profile_id where p.user_id='95000000-0000-4000-8000-000000000001'),
 'regions',(select jsonb_agg(to_jsonb(a) order by a.service_region_id) from public.provider_service_regions a join public.provider_profiles p on p.id=a.provider_profile_id where p.user_id='95000000-0000-4000-8000-000000000001'));
$$;
set local role authenticated;
select pg_temp.identity('95000000-0000-4000-8000-000000000001');
select is((pg_temp.dsave('{}',0,'draft')->>'already_pending')::boolean,false,'initial draft is a genuine save');
select public.save_provider_service_regions((select regions_revision from public.provider_profiles where user_id=auth.uid()),array['95000000-0000-4000-8200-000000000031','95000000-0000-4000-8200-000000000032']::uuid[]);
select set_config('p.old_d',pg_temp.drev()::text,true);
select set_config('p.old_g',pg_temp.rev()::text,true);
select is((pg_temp.dsave('{"bio":"Submitted biography"}')->>'already_pending')::boolean,false,'first submission with actual edits is not an acknowledgement');
select is((select status::text from public.provider_profiles where id=pg_temp.listing_id()),'pending_approval','first submission enters pending approval');
select set_config('p.id',pg_temp.listing_id()::text,true);
reset role;
-- Make a timestamp reset observable even though now() is constant in a SQL test transaction.
update public.provider_profiles set submitted_at=now()-interval '1 day' where id=current_setting('p.id')::uuid;
set local role authenticated;
select set_config('p.snapshot',pg_temp.snapshot_a()::text,true);
select set_config('p.current_g',pg_temp.rev()::text,true);
select set_config('p.current_d',pg_temp.drev()::text,true);
select is((pg_temp.dsave()->>'already_pending')::boolean,true,'unchanged current-version submission returns already pending');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'repeat preserves all timestamps, content, assignments and three versions');
select is((pg_temp.dsave('{}',current_setting('p.old_d')::bigint)->>'already_pending')::boolean,true,'identical stale-details retry after lost response is acknowledged');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'stale identical acknowledgement is read-only');
select is((public.save_provider_listing(current_setting('p.old_g')::bigint,pg_temp.payload(),
 array['95000000-0000-4000-8200-000000000012','95000000-0000-4000-8200-000000000011']::uuid[],
 array['95000000-0000-4000-8200-000000000022','95000000-0000-4000-8200-000000000021']::uuid[],
 array['95000000-0000-4000-8200-000000000032','95000000-0000-4000-8200-000000000031']::uuid[],'submit')->>'already_pending')::boolean,true,'legacy retry and reordered assignment sets are acknowledged');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'assignment ordering does not reset the request');
select is((pg_temp.dsave('{"display_name":"  Pending provider  ","email":" PENDING-PUBLIC@EXAMPLE.INVALID "}')->>'already_pending')::boolean,true,'normalized equivalent fields are unchanged');
select is((public.save_provider_listing_details(pg_temp.drev(),pg_temp.payload()-'profile_image_path'-'profile_image_url',
 array['95000000-0000-4000-8200-000000000011','95000000-0000-4000-8200-000000000012']::uuid[],
 array['95000000-0000-4000-8200-000000000021','95000000-0000-4000-8200-000000000022']::uuid[],'submit')->>'already_pending')::boolean,true,'omitted image fields retain current image and acknowledge');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'normalization and omitted image acknowledgement preserve the aggregate');
select is((select count(*) from public.provider_profiles where user_id=auth.uid()),1::bigint,'all retries retain exactly one listing');
select throws_ok($q$select pg_temp.dsave('{"bio":"Old changed input"}',current_setting('p.old_d')::bigint)$q$,'PT409','listing_conflict','a stale retry with different content cannot write');
select throws_ok($q$select pg_temp.dsave('{"status":"active"}')$q$,'22023','invalid_listing_fields','already-pending acknowledgement cannot bypass protected fields');
select throws_ok($q$select pg_temp.dsave('{"already_pending":true}')$q$,'22023','invalid_listing_fields','callers cannot forge the acknowledgement flag');
select throws_ok($q$select pg_temp.dsave('{"bio":""}')$q$,'23514','listing_incomplete','pending retry still validates required content');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'rejected requests leave pending state intact');
select pg_temp.identity('95000000-0000-4000-8000-000000000004');
select throws_ok('select pg_temp.dsave()','42501','insufficient_role','customer cannot exploit a pending acknowledgement');
select pg_temp.identity(null);
select throws_ok('select pg_temp.dsave()','28000','not_authenticated','missing identity cannot exploit acknowledgement');
select pg_temp.identity('95000000-0000-4000-8000-000000000002');
select throws_ok($q$select pg_temp.dsave('{}',1)$q$,'PT409','listing_conflict','other provider cannot acknowledge or update another listing');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'other identities leave owner submission untouched');
select pg_temp.identity('95000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(current_setting('p.id')::uuid,current_setting('p.current_g')::bigint,'approve')->>'status'),'active','review opened before identical retries can still approve');
select pg_temp.identity('95000000-0000-4000-8000-000000000001');
select throws_ok($q$select pg_temp.dsave('{}',current_setting('p.current_d')::bigint)$q$,'PT409','listing_conflict','old request cannot undo a newer administrator decision');
select is((pg_temp.dsave()->>'no_changes')::boolean,true,'unchanged approved content creates no pending edit');
select set_config('p.snapshot',pg_temp.snapshot_a()::text,true);
select set_config('p.before_g',pg_temp.rev()::text,true);
select is((pg_temp.dsave('{"bio":"Genuine pending edit"}')->>'already_pending')::boolean,false,'changed pending biography is a real resubmission');
select ok(pg_temp.rev()>current_setting('p.before_g')::bigint,'real edit advances overall review version');
select is((public.get_provider_listing_editor('user_id',auth.uid())->>'bio'),'Genuine pending edit','real edit is saved privately');
select is((pg_temp.dsave('{"profile_image_path":null,"profile_image_url":null}')->>'already_pending')::boolean,false,'image removal is a real pending-content change');
select is((public.get_provider_listing_editor('user_id',auth.uid())->>'profile_image_url'),null::text,'new image state is saved privately');
select is((pg_temp.dsave('{"website_url":"https://example.invalid"}')->>'already_pending')::boolean,false,'changing a nullable website is a real resubmission');
select is((public.save_provider_listing(pg_temp.rev(),pg_temp.payload(),
 array['95000000-0000-4000-8200-000000000011']::uuid[],
 array['95000000-0000-4000-8200-000000000021','95000000-0000-4000-8200-000000000022']::uuid[],
 array['95000000-0000-4000-8200-000000000031','95000000-0000-4000-8200-000000000032']::uuid[],'submit')->>'already_pending')::boolean,false,'language-only change is a real resubmission');
select is(jsonb_array_length(public.get_provider_listing_editor('user_id',auth.uid())->'languageIds'),1,'new language set is saved privately');
select is((public.save_provider_listing(pg_temp.rev(),pg_temp.payload(),
 array['95000000-0000-4000-8200-000000000011']::uuid[],
 array['95000000-0000-4000-8200-000000000021']::uuid[],
 array['95000000-0000-4000-8200-000000000031','95000000-0000-4000-8200-000000000032']::uuid[],'submit')->>'already_pending')::boolean,false,'specialty-only change is a real resubmission');
select is(jsonb_array_length(public.get_provider_listing_editor('user_id',auth.uid())->'specialtyIds'),1,'new specialty set is saved privately');
select is((public.save_provider_listing(pg_temp.rev(),pg_temp.payload(),
 array['95000000-0000-4000-8200-000000000011']::uuid[],
 array['95000000-0000-4000-8200-000000000021']::uuid[],
 array['95000000-0000-4000-8200-000000000031']::uuid[],'submit')->>'already_pending')::boolean,false,'region-only change is a real resubmission');
select is(jsonb_array_length(public.get_provider_listing_editor('user_id',auth.uid())->'serviceRegionIds'),1,'new region set is saved privately');
select is((select count(*) from public.provider_profiles where user_id=auth.uid()),1::bigint,'real updates still use the same single listing');
select pg_temp.identity('95000000-0000-4000-8000-000000000003');
select throws_ok($q$select public.review_provider_listing(current_setting('p.id')::uuid,current_setting('p.before_g')::bigint,'approve')$q$,'PT409','listing_conflict','real changes still invalidate an old administrator review');
select public.review_provider_listing(current_setting('p.id')::uuid,(select revision from public.provider_profiles where id=current_setting('p.id')::uuid),'approve');
select public.review_provider_listing(current_setting('p.id')::uuid,(select revision from public.provider_profiles where id=current_setting('p.id')::uuid),'deactivate');
select pg_temp.identity('95000000-0000-4000-8000-000000000001');
select is((pg_temp.dsave('{}',null,'reactivate')->>'already_pending')::boolean,false,'inactive listing gets a genuine reactivation request');
select set_config('p.snapshot',pg_temp.snapshot_a()::text,true);
select is((pg_temp.dsave('{}',null,'reactivate')->>'already_pending')::boolean,true,'unchanged reactivation retry is acknowledged');
select is(pg_temp.snapshot_a(),current_setting('p.snapshot')::jsonb,'reactivation acknowledgement preserves request and versions');
reset role;
select * from finish();
rollback;
