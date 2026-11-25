-- Disposable Supabase only. All fixtures, injected failures, and writes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('98000000-0000-4000-8000-000000000001', 'r4-a@example.invalid', now(), '{"role":"provider"}'),
 ('98000000-0000-4000-8000-000000000002', 'r4-b@example.invalid', now(), '{"role":"provider"}'),
 ('98000000-0000-4000-8000-000000000003', 'r4-admin@example.invalid', now(), '{}'),
 ('98000000-0000-4000-8000-000000000004', 'r4-customer@example.invalid', now(), '{}'),
 ('98000000-0000-4000-8000-000000000005', 'r4-unconfirmed@example.invalid', null, '{"role":"provider"}'),
 ('98000000-0000-4000-8000-000000000006', 'r4-orphan@example.invalid', now(), '{"role":"provider"}'),
 ('98000000-0000-4000-8000-000000000007', 'r4-banned@example.invalid', now(), '{"role":"provider"}'),
 ('98000000-0000-4000-8000-000000000008', 'r4-deleted@example.invalid', now(), '{"role":"provider"}');
delete from public.profiles where id = '98000000-0000-4000-8000-000000000006';
update auth.users set banned_until=now()+interval '1 day' where id='98000000-0000-4000-8000-000000000007';
update auth.users set deleted_at=now() where id='98000000-0000-4000-8000-000000000008';
update public.profiles set role = 'admin' where id = '98000000-0000-4000-8000-000000000003';
insert into public.categories (id, name, slug, is_active) values
 ('98000000-0000-4000-8200-000000000001', 'R4 category', 'r4-category', true),
 ('98000000-0000-4000-8200-000000000002', 'R4 other category', 'r4-other-category', true),
 ('98000000-0000-4000-8200-000000000003', 'R4 inactive category', 'r4-inactive-category', false);
insert into public.languages (id, name, slug, is_active) values
 ('98000000-0000-4000-8200-000000000011', 'R4 language', 'r4-language', true),
 ('98000000-0000-4000-8200-000000000012', 'R4 other language', 'r4-other-language', true),
 ('98000000-0000-4000-8200-000000000013', 'R4 inactive language', 'r4-inactive-language', false);
insert into public.specialties (id, category_id, name, slug, is_active) values
 ('98000000-0000-4000-8200-000000000021', '98000000-0000-4000-8200-000000000001', 'R4 specialty', 'r4-specialty', true),
 ('98000000-0000-4000-8200-000000000022', '98000000-0000-4000-8200-000000000002', 'R4 other specialty', 'r4-other-specialty', true),
 ('98000000-0000-4000-8200-000000000023', null, 'R4 global specialty', 'r4-global-specialty', true);
insert into public.service_regions (id, province_code, name, slug, is_active, center_latitude, center_longitude) values
 ('98000000-0000-4000-8200-000000000031', 'ON', 'R4 region one', 'r4-region-one', true, 45.4, -75.7),
 ('98000000-0000-4000-8200-000000000032', 'ON', 'R4 region two', 'r4-region-two', true, 43.7, -79.4),
 ('98000000-0000-4000-8200-000000000033', 'ON', 'R4 inactive region', 'r4-inactive-region', false, 44.0, -78.0);
insert into storage.objects (bucket_id, name, owner_id) values
 ('provider-profile-images', '98000000-0000-4000-8000-000000000001/public.png', '98000000-0000-4000-8000-000000000001'),
 ('provider-profile-images', '98000000-0000-4000-8000-000000000001/../escape.png', '98000000-0000-4000-8000-000000000001');

create function pg_temp.identity(id uuid) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claim.sub', coalesce(id::text, ''), true);
 perform set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.payload(extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('display_name', 'Public A', 'business_name', 'R4 business',
   'bio', 'Public biography', 'email', 'public-a@example.invalid', 'phone', '555-0100',
   'category_id', '98000000-0000-4000-8200-000000000001', 'city', 'Ottawa', 'province_state', 'ON', 'country', 'Canada') || extra;
$$;
create function pg_temp.rev() returns bigint language sql as $$
 select revision from public.provider_profiles where user_id = auth.uid();
$$;
create function pg_temp.save(extra jsonb default '{}', intent text default 'draft') returns jsonb language sql as $$
 select public.save_provider_listing(coalesce(pg_temp.rev(), 0), pg_temp.payload(extra),
   array['98000000-0000-4000-8200-000000000011']::uuid[],
   array['98000000-0000-4000-8200-000000000021']::uuid[],
   array['98000000-0000-4000-8200-000000000031']::uuid[], intent);
$$;
create function pg_temp.aggregate_a() returns jsonb language sql security definer as $$
 select jsonb_build_object('listing', (select to_jsonb(p) from public.provider_profiles p where user_id = '98000000-0000-4000-8000-000000000001'),
   'languages', (select jsonb_agg(to_jsonb(l) order by language_id) from public.provider_languages l join public.provider_profiles p on p.id = l.provider_profile_id where p.user_id = '98000000-0000-4000-8000-000000000001'),
   'specialties', (select jsonb_agg(to_jsonb(s) order by specialty_id) from public.provider_specialties s join public.provider_profiles p on p.id = s.provider_profile_id where p.user_id = '98000000-0000-4000-8000-000000000001'),
   'regions', (select jsonb_agg(to_jsonb(r) order by service_region_id) from public.provider_service_regions r join public.provider_profiles p on p.id = r.provider_profile_id where p.user_id = '98000000-0000-4000-8000-000000000001'));
$$;

select ok(not has_function_privilege('anon', 'public.save_provider_listing(bigint,jsonb,uuid[],uuid[],uuid[],text)', 'EXECUTE'), 'anonymous cannot execute listing saves');
select ok(not has_function_privilege('authenticated', 'public.require_listing_actor(public.profile_role)', 'EXECUTE'), 'clients cannot call internal authorization helper');
select ok(not has_function_privilege('authenticated', 'public.validate_provider_listing_content(public.provider_profiles,uuid[],uuid[],uuid[],boolean)', 'EXECUTE'), 'clients cannot directly call definer validation helper');
set local role authenticated;
select pg_temp.identity(null);
select throws_ok('select pg_temp.save()', '28000', 'not_authenticated', 'missing identity is denied');
select pg_temp.identity('98000000-0000-4000-8000-000000000004');
select throws_ok('select pg_temp.save()', '42501', 'insufficient_role', 'customer cannot create provider content');
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select throws_ok('select pg_temp.save()', '42501', 'insufficient_role', 'administrator cannot use self-service provider save');
select pg_temp.identity('98000000-0000-4000-8000-000000000005');
select throws_ok('select pg_temp.save()', '42501', 'verified_account_required', 'unconfirmed provider is denied');
select pg_temp.identity('98000000-0000-4000-8000-000000000006');
select throws_ok('select pg_temp.save()', '42501', 'insufficient_role', 'missing profile is denied');
select pg_temp.identity('98000000-0000-4000-8000-000000000007');
select throws_ok('select pg_temp.save()', '42501', 'verified_account_required', 'banned provider is denied');
select pg_temp.identity('98000000-0000-4000-8000-000000000008');
select throws_ok('select pg_temp.save()', '42501', 'verified_account_required', 'deleted provider is denied');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select is((pg_temp.save()->>'status'), 'draft', 'provider creates a draft and all assignments atomically');
select is((select count(*) from public.provider_profiles where user_id = auth.uid()), 1::bigint, 'creation produces one owned listing');
select is((select count(*) from public.provider_languages l join public.provider_profiles p on p.id = l.provider_profile_id where p.user_id = auth.uid()), 1::bigint, 'language assignment exists after save');
select is((select count(*) from public.provider_specialties s join public.provider_profiles p on p.id = s.provider_profile_id where p.user_id = auth.uid()), 1::bigint, 'specialty assignment exists after save');
select is((select count(*) from public.provider_service_regions r join public.provider_profiles p on p.id = r.provider_profile_id where p.user_id = auth.uid()), 1::bigint, 'service-region assignment exists after save');
select throws_ok($q$select public.save_provider_listing(0, pg_temp.payload(), '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], 'draft')$q$, 'PT409', 'listing_conflict', 'repeated creation cannot overwrite an existing listing');
select set_config('r4.old_revision', pg_temp.rev()::text, true);
select set_config('r4.old_slug', (select slug from public.provider_profiles where user_id = auth.uid()), true);
select lives_ok($q$select pg_temp.save('{"business_name":"Renamed business"}')$q$, 'current revision saves successfully');
select is((select slug from public.provider_profiles where user_id = auth.uid()), current_setting('r4.old_slug'), 'updating a listing retains its existing public identifier');
select throws_ok($q$select public.save_provider_listing(current_setting('r4.old_revision')::bigint, pg_temp.payload(), '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], 'draft')$q$, 'PT409', 'listing_conflict', 'stale form cannot overwrite a newer revision');

select throws_ok($q$select pg_temp.save('{"user_id":"98000000-0000-4000-8000-000000000002"}')$q$, '22023', 'invalid_listing_fields', 'payload cannot target another account');
select throws_ok($q$select pg_temp.save('{"status":"active"}')$q$, '22023', 'invalid_listing_fields', 'payload cannot self-approve');
select throws_ok($q$select pg_temp.save('{"approved_at":"2026-01-01"}')$q$, '22023', 'invalid_listing_fields', 'payload cannot forge approval timestamp');
select throws_ok($q$select pg_temp.save('{"category_id":"98000000-0000-4000-8200-000000000003"}')$q$, '22023', 'invalid_category', 'inactive category is rejected');
select throws_ok($q$select pg_temp.save('{"category_id":"98000000-0000-4000-8200-000000000002"}')$q$, '22023', 'invalid_assignments', 'specialty must match the selected category');
select throws_ok($q$select pg_temp.save('{"website_url":"javascript:alert(1)"}')$q$, '22023', 'invalid_listing_website', 'executable website URL is rejected');
select throws_ok($q$select pg_temp.save('{"email":"not-an-email"}')$q$, '22023', 'invalid_listing_email', 'invalid public contact email is rejected');
select throws_ok($q$select pg_temp.save(jsonb_build_object('bio', repeat('x',601)))$q$, '22023', 'invalid_listing_fields', 'oversized biography is rejected');
select throws_ok($q$select pg_temp.save('{"bio":""}', 'submit')$q$, '23514', 'listing_incomplete', 'submission requires complete listing content');
select throws_ok($q$select pg_temp.save('{}', 'reactivate')$q$, '23514', 'invalid_listing_transition', 'reactivation requires an inactive listing');
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload(), array['98000000-0000-4000-8200-000000000013']::uuid[], '{}'::uuid[], '{}'::uuid[], 'draft')$q$, '22023', 'invalid_assignments', 'inactive language is rejected');
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload(), '{}'::uuid[], array['98000000-0000-4000-8200-000000000022']::uuid[], '{}'::uuid[], 'draft')$q$, '22023', 'invalid_assignments', 'unrelated specialty is rejected');
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload(), '{}'::uuid[], '{}'::uuid[], array['98000000-0000-4000-8200-000000000033']::uuid[], 'draft')$q$, '22023', 'invalid_assignments', 'inactive service region is rejected');
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload(), '{}'::uuid[], '{}'::uuid[], array['98000000-0000-4000-8200-000000000031','98000000-0000-4000-8200-000000000031']::uuid[], 'draft')$q$, '22023', 'invalid_assignments', 'duplicate regions are rejected');
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload(), array[null]::uuid[], '{}'::uuid[], '{}'::uuid[], 'draft')$q$, '22023', 'invalid_assignments', 'null assignment IDs are rejected');
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload(), '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], null)$q$, '22023', 'invalid_listing_request', 'missing intent is denied');
select throws_ok($q$select public.save_provider_listing(null, pg_temp.payload(), '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], 'draft')$q$, '22023', 'invalid_listing_request', 'missing revision is denied');
select throws_ok($q$select pg_temp.save('{"profile_image_path":"98000000-0000-4000-8000-000000000002/other.png"}')$q$, '23514', 'invalid_listing_image', 'another account image path is denied');
select throws_ok($q$select pg_temp.save('{"profile_image_path":"98000000-0000-4000-8000-000000000001/../escape.png","profile_image_url":"https://test-project.supabase.co/storage/v1/object/public/provider-profile-images/98000000-0000-4000-8000-000000000001/../escape.png"}')$q$, '23514', 'invalid_listing_image', 'image path traversal is rejected even when an object key exists');
select throws_ok($q$select pg_temp.save('{"profile_image_path":"98000000-0000-4000-8000-000000000001/public.png","profile_image_url":"https://test-project.supabase.co/storage/v1/object/public/provider-profile-images/other.png?98000000-0000-4000-8000-000000000001/public.png"}')$q$, '23514', 'invalid_listing_image', 'image URL must correspond exactly to the owned object');
select throws_ok($q$select pg_temp.save('{"profile_image_url":"https://example.invalid/unowned.png"}')$q$, '23514', 'invalid_listing_image', 'new arbitrary external image cannot be supplied');
select lives_ok($q$select pg_temp.save('{"profile_image_path":"98000000-0000-4000-8000-000000000001/public.png","profile_image_url":"https://test-project.supabase.co/storage/v1/object/public/provider-profile-images/98000000-0000-4000-8000-000000000001/public.png"}')$q$, 'owned uploaded image can be saved');
select throws_ok($q$update public.provider_profiles set bio='Bypass' where user_id = auth.uid()$q$, '42501', 'use_versioned_listing_operation', 'direct provider edit cannot bypass revision checks');
select throws_ok($q$update public.provider_profiles set revision=revision+1 where user_id = auth.uid()$q$, '42501', 'use_versioned_listing_operation', 'client cannot forge a new revision');
select throws_ok($q$insert into public.provider_languages select id, '98000000-0000-4000-8200-000000000012' from public.provider_profiles where user_id = auth.uid()$q$, '42501', 'use_versioned_listing_operation', 'direct language assignment cannot bypass aggregate save');
select throws_ok($q$delete from public.provider_service_regions where provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())$q$, '42501', 'use_versioned_listing_operation', 'direct region deletion cannot bypass aggregate save');
select throws_ok($q$select public.replace_provider_service_regions((select id from public.provider_profiles where user_id = auth.uid()), '{}'::uuid[])$q$, 'PT409', 'listing_revision_required', 'unversioned legacy region RPC fails safely');
reset role;

-- Fail after the parent, deletes, and language insertion have executed.
create function pg_temp.fail_specialty() returns trigger language plpgsql as $$
begin
 if new.specialty_id = '98000000-0000-4000-8200-000000000023' then
   raise exception 'injected_assignment_failure' using errcode = 'ZX004';
 end if;
 return new;
end;
$$;
create trigger r4_injected_failure after insert on public.provider_specialties
for each row execute function pg_temp.fail_specialty();
select set_config('r4.aggregate_before', pg_temp.aggregate_a()::text, true);
set local role authenticated;
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload('{"bio":"Must roll back"}'), array['98000000-0000-4000-8200-000000000012']::uuid[], array['98000000-0000-4000-8200-000000000023']::uuid[], array['98000000-0000-4000-8200-000000000032']::uuid[], 'submit')$q$, 'ZX004', 'injected_assignment_failure', 'late assignment failure propagates');
select is(pg_temp.aggregate_a(), current_setting('r4.aggregate_before')::jsonb, 'late failure restores parent, revisions, all assignments, and timestamps');
reset role;
drop trigger r4_injected_failure on public.provider_specialties;

create function pg_temp.fail_region() returns trigger language plpgsql as $$
begin
 if new.service_region_id = '98000000-0000-4000-8200-000000000032' then
   raise exception 'injected_region_failure' using errcode = 'ZX005';
 end if;
 return new;
end;
$$;
create trigger r4_region_failure after insert on public.provider_service_regions
for each row execute function pg_temp.fail_region();
select set_config('r4.aggregate_before', pg_temp.aggregate_a()::text, true);
set local role authenticated;
select throws_ok($q$select public.save_provider_listing(pg_temp.rev(), pg_temp.payload('{"bio":"Last-stage rollback"}'), array['98000000-0000-4000-8200-000000000012']::uuid[], array['98000000-0000-4000-8200-000000000021']::uuid[], array['98000000-0000-4000-8200-000000000031','98000000-0000-4000-8200-000000000032']::uuid[], 'submit')$q$, 'ZX005', 'injected_region_failure', 'failure in the final region insertion propagates');
select is(pg_temp.aggregate_a(), current_setting('r4.aggregate_before')::jsonb, 'last-stage failure rolls back the entire aggregate');
reset role;
drop trigger r4_region_failure on public.provider_service_regions;

select set_config('r4.aggregate_before', pg_temp.aggregate_a()::text, true);
update public.profiles set full_name='Private name', bio='Private biography', avatar_path='private-photo.png', avatar_url='https://example.invalid/private-photo.png'
where id = '98000000-0000-4000-8000-000000000001';
select is(pg_temp.aggregate_a(), current_setting('r4.aggregate_before')::jsonb, 'personal name, biography, and photo do not rewrite public listing');
update public.profiles set phone=phone, email=email where id = '98000000-0000-4000-8000-000000000001';
select is(pg_temp.aggregate_a(), current_setting('r4.aggregate_before')::jsonb, 'unchanged contact form values do not rewrite the listing');

set local role authenticated;
select pg_temp.identity('98000000-0000-4000-8000-000000000002');
select is((select count(*) from public.provider_profiles where user_id='98000000-0000-4000-8000-000000000001'), 0::bigint, 'other provider cannot read a private listing');
select throws_ok($q$select public.replace_provider_service_regions((current_setting('r4.aggregate_before')::jsonb->'listing'->>'id')::uuid, '{}'::uuid[], 1)$q$, '42501', 'listing_not_owned', 'other provider cannot replace private assignments');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select set_config('r4.listing_id', (select id::text from public.provider_profiles where user_id = auth.uid()), true);
select is((pg_temp.save('{}', 'submit')->>'status'), 'pending_approval', 'complete listing enters review rather than publication');
select set_config('r4.review_revision', pg_temp.rev()::text, true);
select throws_ok($q$select public.review_provider_listing(current_setting('r4.listing_id')::uuid, pg_temp.rev(), 'approve')$q$, '42501', 'insufficient_role', 'provider cannot approve itself through moderation RPC');
select lives_ok($q$select public.replace_provider_service_regions(current_setting('r4.listing_id')::uuid, array['98000000-0000-4000-8200-000000000032']::uuid[], pg_temp.rev())$q$, 'versioned region save succeeds under the shared coordinator');
select is((select status::text from public.provider_profiles where user_id = auth.uid()), 'draft', 'editing assignments requires resubmission');
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select throws_ok($q$select public.review_provider_listing(current_setting('r4.listing_id')::uuid, current_setting('r4.review_revision')::bigint, 'approve')$q$, 'PT409', 'listing_conflict', 'administrator cannot approve an unseen revision');
select throws_ok($q$update public.provider_profiles set status='active' where id=current_setting('r4.listing_id')::uuid$q$, '42501', 'use_versioned_listing_operation', 'direct administrator update cannot bypass reviewed revision');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select is((pg_temp.save('{}', 'submit')->>'status'), 'pending_approval', 'provider resubmits its current revision');
select set_config('r4.review_revision', pg_temp.rev()::text, true);
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(current_setting('r4.listing_id')::uuid, current_setting('r4.review_revision')::bigint, 'approve')->>'status'), 'active', 'administrator can approve the exact current revision');
select throws_ok($q$select public.review_provider_listing(current_setting('r4.listing_id')::uuid, current_setting('r4.review_revision')::bigint, 'approve')$q$, 'PT409', 'listing_conflict', 'repeat stale approval cannot act on a new revision');
reset role;

select is((select count(*) from public.provider_profiles where id=current_setting('r4.listing_id')::uuid and approved_at is not null), 1::bigint, 'successful review records approval');
update public.profiles set phone='555-0199' where id = '98000000-0000-4000-8000-000000000001';
select is((select status::text from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'active', 'shared phone change keeps the approved listing public');
select ok((select approved_at is not null from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'private contact draft preserves public approval timestamp');
select is((select display_name from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'Public A', 'contact synchronization preserves separate public name');
select is((select bio from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'Public biography', 'contact synchronization preserves separate public biography');
update public.profiles set email='unconfirmed-change@example.invalid' where id = '98000000-0000-4000-8000-000000000001';
select is((select email from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'public-a@example.invalid', 'unconfirmed account email cannot flow into listing contact');

set local role authenticated;
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select pg_temp.save('{"phone":"555-0199"}', 'submit');
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select throws_ok($q$select public.review_provider_listing(current_setting('r4.listing_id')::uuid, (select revision from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'reject', '')$q$, '22023', 'rejection_reason_required', 'rejection needs an explanation');
select is((public.review_provider_listing(current_setting('r4.listing_id')::uuid, (select revision from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'reject', 'Please revise')->>'review_status'), 'rejected', 'administrator can reject an edit while retaining the active listing');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select is((pg_temp.save('{"bio":"Corrected approved edit"}', 'submit')->>'review_status'), 'pending_edit', 'owner can resubmit corrected rejected edits');
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(current_setting('r4.listing_id')::uuid, (select revision from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'approve')->>'status'), 'active', 'administrator can approve resubmission');
select is((public.review_provider_listing(current_setting('r4.listing_id')::uuid, (select revision from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'deactivate')->>'status'), 'inactive', 'administrator can deactivate an active listing');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select is((pg_temp.save('{}', 'draft')->>'status'), 'inactive', 'saving an inactive draft does not reactivate it');
select throws_ok($q$select pg_temp.save('{}', 'submit')$q$, '23514', 'invalid_listing_transition', 'inactive listing requires the explicit reactivation intent');
select is((pg_temp.save('{}', 'reactivate')->>'status'), 'pending_approval', 'reactivation request returns to administrator review');
select pg_temp.identity('98000000-0000-4000-8000-000000000003');
select is((public.review_provider_listing(current_setting('r4.listing_id')::uuid, (select revision from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 'approve')->>'status'), 'active', 'administrator can approve a reactivation request');
select pg_temp.identity('98000000-0000-4000-8000-000000000001');
select is((pg_temp.save('{"profile_image_path":null,"profile_image_url":null}', 'draft')->>'status'), 'active', 'image removal is staged while the approved listing remains active');
select is((select fields->>'profile_image_url' from public.provider_listing_changes where provider_profile_id=current_setting('r4.listing_id')::uuid), null::text, 'explicit image removal clears the proposed URL');
select is((select full_name from public.profiles where id=auth.uid()), 'Private name', 'listing edits never overwrite the personal profile');
reset role;

set local role anon;
select is((select count(*) from public.provider_profiles where id=current_setting('r4.listing_id')::uuid), 1::bigint, 'approved listing stays public while draft edits remain private');
reset role;
select * from finish();
rollback;
