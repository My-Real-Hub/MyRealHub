-- Disposable database only. Passwordless fixtures and all changes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('95000000-0000-4000-8000-000000000001', 'conversion-a@example.invalid', now(), '{"role":"user","full_name":"Customer A"}'),
  ('95000000-0000-4000-8000-000000000002', 'conversion-b@example.invalid', now(), '{"role":"user"}'),
  ('95000000-0000-4000-8000-000000000003', 'conversion-provider@example.invalid', now(), '{"role":"provider"}'),
  ('95000000-0000-4000-8000-000000000004', 'conversion-admin@example.invalid', now(), '{}'),
  ('95000000-0000-4000-8000-000000000005', 'conversion-orphan@example.invalid', now(), '{}'),
  ('95000000-0000-4000-8000-000000000006', 'conversion-unconfirmed@example.invalid', null, '{}'),
  ('95000000-0000-4000-8000-000000000007', 'conversion-banned@example.invalid', now(), '{}'),
  ('95000000-0000-4000-8000-000000000008', 'conversion-deleted@example.invalid', now(), '{}'),
  ('95000000-0000-4000-8000-000000000009', 'conversion-anonymous@example.invalid', now(), '{}');
update public.profiles set role = 'admin' where id = '95000000-0000-4000-8000-000000000004';
delete from public.profiles where id = '95000000-0000-4000-8000-000000000005';
update auth.users set banned_until = now() + interval '1 day' where id = '95000000-0000-4000-8000-000000000007';
update auth.users set deleted_at = now() where id = '95000000-0000-4000-8000-000000000008';
update auth.users set is_anonymous = true where id = '95000000-0000-4000-8000-000000000009';
update public.profiles set phone = '555-0101', bio = 'Keep customer biography'
where id = '95000000-0000-4000-8000-000000000001';

insert into public.provider_profiles (id, user_id, display_name, slug, status) values
  ('95000000-0000-4000-8100-000000000003', '95000000-0000-4000-8000-000000000003', 'Existing provider', 'conversion-provider-950003', 'active');
insert into public.saved_providers (user_id, provider_profile_id) values
  ('95000000-0000-4000-8000-000000000001', '95000000-0000-4000-8100-000000000003'),
  ('95000000-0000-4000-8000-000000000002', '95000000-0000-4000-8100-000000000003');
insert into public.contact_requests (id, provider_profile_id, sender_user_id, sender_name, sender_email, message) values
  ('95000000-0000-4000-8200-000000000001', '95000000-0000-4000-8100-000000000003', '95000000-0000-4000-8000-000000000001', 'Customer A', 'conversion-a@example.invalid', 'Keep my existing conversation'),
  ('95000000-0000-4000-8200-000000000002', '95000000-0000-4000-8100-000000000003', '95000000-0000-4000-8000-000000000002', 'Customer B', 'conversion-b@example.invalid', 'Other private conversation');

create temporary table conversion_before as select
  (select jsonb_agg(to_jsonb(p) - 'role' - 'updated_at' order by id) from public.profiles p) as profile_details,
  (select jsonb_agg(to_jsonb(u) order by id) from auth.users u) as auth_accounts,
  (select jsonb_agg(to_jsonb(s) order by id) from public.saved_providers s) as saved,
  (select jsonb_agg(to_jsonb(c) order by id) from public.contact_requests c) as conversations,
  (select jsonb_agg(to_jsonb(m) order by id) from public.contact_request_messages m) as messages,
  (select jsonb_agg(to_jsonb(p) order by id) from public.provider_profiles p) as listings;

select ok(not has_function_privilege('anon', 'public.become_provider()', 'EXECUTE'), 'anonymous has no conversion grant');
select ok(has_function_privilege('authenticated', 'public.become_provider()', 'EXECUTE'), 'signed-in clients may request conversion');
select is((select pronargs::integer from pg_proc where oid = 'public.become_provider()'::regprocedure), 0, 'caller cannot supply an account ID or target role');

set local role anon;
select throws_ok('select public.become_provider()', '42501', null, 'anonymous execution is denied at the grant boundary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok('select public.become_provider()', '28000', 'not_authenticated', 'missing identity is denied');

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000005', true);
select throws_ok('select public.become_provider()', '42501', 'profile_not_found', 'missing profile is denied rather than silently created');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claims', '{"role":"authenticated","email_verified":true}', true);
select throws_ok('select public.become_provider()', '42501', 'verified_account_required', 'unconfirmed Auth record is denied despite a claimed confirmation');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000007', true);
select throws_ok('select public.become_provider()', '42501', 'verified_account_required', 'banned account is denied');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000008', true);
select throws_ok('select public.become_provider()', '42501', 'verified_account_required', 'deleted account is denied');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000009', true);
select throws_ok('select public.become_provider()', '42501', 'verified_account_required', 'anonymous Auth identity is denied');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000099', true);
select throws_ok('select public.become_provider()', '42501', 'verified_account_required', 'identity without an Auth record is denied');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000004', true);
select throws_ok('select public.become_provider()', '42501', 'insufficient_role', 'administrator cannot be converted or demoted');
reset role;
select is((select role::text from public.profiles where id = '95000000-0000-4000-8000-000000000004'), 'admin', 'denied administrator conversion preserves its role');
select is((select role::text from public.profiles where id = '95000000-0000-4000-8000-000000000006'), 'user', 'denied unconfirmed conversion leaves customer role unchanged');

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"95000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($sql$update public.profiles set role = 'admin' where id = auth.uid()$sql$, '42501', null, 'direct administrator assignment remains forbidden');
select throws_ok($sql$update public.profiles set role = 'provider' where id = auth.uid()$sql$, '42501', null, 'direct role writes cannot bypass the guarded conversion');
select throws_ok($sql$select public.become_provider('95000000-0000-4000-8000-000000000002'::uuid)$sql$, '42883', null, 'another user cannot be supplied as conversion target');
select throws_ok($sql$select public.become_provider('admin'::text)$sql$, '42883', null, 'administrator cannot be supplied as target role');
select is(public.become_provider()::text, 'provider', 'confirmed customer successfully adds provider access');
select is((select role::text from public.profiles where id = auth.uid()), 'provider', 'converted role persists on the same profile');
select is(public.become_provider()::text, 'provider', 'repeat conversion safely returns the existing provider role');
select is((select count(*) from public.provider_profiles where user_id = auth.uid()), 0::bigint, 'conversion neither creates nor publishes a listing');
select is((select count(*) from public.saved_providers), 1::bigint, 'converted provider retains only its own saved providers');
select is((select count(*) from public.contact_requests), 1::bigint, 'converted provider retains only its own customer conversations');
select is((select count(*) from public.contact_request_messages), 1::bigint, 'converted provider retains only its own customer messages');
select is((select count(*) from public.profiles where id <> auth.uid()), 0::bigint, 'conversion does not expose unrelated private profiles');
select throws_ok('select * from public.get_admin_platform_growth_counts()', '42501', 'insufficient_role', 'conversion cannot grant administrator RPC access');
select throws_ok($sql$update public.profiles set role = 'admin' where id = auth.uid()$sql$, '42501', null, 'converted provider still cannot directly assign administrator');
reset role;

select is((select role::text from public.profiles where id = '95000000-0000-4000-8000-000000000002'), 'user', 'unrelated customer role is unchanged');
select is((select count(*) from public.profiles where role = 'admin'), 1::bigint, 'no new administrator exists');
select is((select jsonb_agg(to_jsonb(p) - 'role' - 'updated_at' order by id) from public.profiles p), (select profile_details from conversion_before), 'profile identity and personal fields are preserved');
select is((select jsonb_agg(to_jsonb(u) order by id) from auth.users u), (select auth_accounts from conversion_before), 'Auth identities and credentials are unchanged');
select is((select jsonb_agg(to_jsonb(s) order by id) from public.saved_providers s), (select saved from conversion_before), 'saved providers are preserved without rewriting rows');
select is((select jsonb_agg(to_jsonb(c) order by id) from public.contact_requests c), (select conversations from conversion_before), 'conversation content and identities are preserved');
select is((select jsonb_agg(to_jsonb(m) order by id) from public.contact_request_messages m), (select messages from conversion_before), 'message content and identities are preserved');
select is((select jsonb_agg(to_jsonb(p) order by id) from public.provider_profiles p), (select listings from conversion_before), 'existing listings and moderation states are unchanged');

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
select lives_ok($sql$select public.save_provider_listing(0, '{"display_name":"New draft"}', '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], 'draft')$sql$, 'converted customer can start its own draft through the atomic listing RPC');
select throws_ok($sql$insert into public.provider_profiles (user_id, display_name, slug, status) values ('95000000-0000-4000-8000-000000000002', 'Other account', 'conversion-other-account-950002', 'draft')$sql$, '42501', null, 'converted provider cannot create a listing for another account');
select throws_ok($sql$update public.provider_profiles set status = 'active' where user_id = auth.uid()$sql$, '42501', null, 'converted provider cannot bypass administrator listing approval');
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000003', true);
select is(public.become_provider()::text, 'provider', 'an existing provider can retry without changing its listing');
reset role;
select is((select status::text from public.provider_profiles where user_id = '95000000-0000-4000-8000-000000000003'), 'active', 'existing provider retry leaves approval state unchanged');

select * from finish();
rollback;
