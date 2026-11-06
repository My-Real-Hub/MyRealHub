-- Run only against a disposable local/staging database after all migrations.
-- supabase test db; all fixtures and changes are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(32);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('90000000-0000-4000-8000-000000000001', 'audit-consumer@example.invalid', '{"role":"user"}'),
  ('90000000-0000-4000-8000-000000000002', 'audit-provider@example.invalid', '{"role":"provider"}'),
  ('90000000-0000-4000-8000-000000000003', 'audit-admin@example.invalid', '{}'),
  ('90000000-0000-4000-8000-000000000004', 'audit-orphan@example.invalid', '{}');
update public.profiles set role = 'admin' where id = '90000000-0000-4000-8000-000000000003';
delete from public.profiles where id = '90000000-0000-4000-8000-000000000004';

select ok(not has_function_privilege('anon', 'public.moderate_provider_rating(uuid,text)', 'EXECUTE'), 'moderate_provider_rating: anonymous execution denied');
select ok(not has_function_privilege('anon', 'public.get_admin_provider_ratings(uuid)', 'EXECUTE'), 'get_admin_provider_ratings: anonymous execution denied');
select ok(not has_function_privilege('anon', 'public.get_admin_platform_growth_counts()', 'EXECUTE'), 'get_admin_platform_growth_counts: anonymous execution denied');
select ok(not has_function_privilege('anon', 'public.get_admin_platform_feedback(text,text,integer)', 'EXECUTE'), 'get_admin_platform_feedback: anonymous execution denied');
select ok(not has_function_privilege('anon', 'public.update_platform_feedback(uuid,text,text)', 'EXECUTE'), 'update_platform_feedback: anonymous execution denied');

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($test$select * from public.moderate_provider_rating('90000000-0000-4000-8000-000000000099', 'hidden')$test$, '28000', 'not_authenticated', 'moderate_provider_rating: missing identity denied');
select throws_ok($test$select * from public.get_admin_provider_ratings('90000000-0000-4000-8000-000000000099')$test$, '28000', 'not_authenticated', 'get_admin_provider_ratings: missing identity denied');
select throws_ok($test$select * from public.get_admin_platform_growth_counts()$test$, '28000', 'not_authenticated', 'get_admin_platform_growth_counts: missing identity denied');
select throws_ok($test$select * from public.get_admin_platform_feedback(null, null, 1)$test$, '28000', 'not_authenticated', 'get_admin_platform_feedback: missing identity denied');
select throws_ok($test$select * from public.update_platform_feedback('90000000-0000-4000-8000-000000000099', 'reviewing', null)$test$, '28000', 'not_authenticated', 'update_platform_feedback: missing identity denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($test$select * from public.moderate_provider_rating('90000000-0000-4000-8000-000000000099', 'hidden')$test$, '42501', 'insufficient_role', 'moderate_provider_rating: missing profile denied');
select throws_ok($test$select * from public.get_admin_provider_ratings('90000000-0000-4000-8000-000000000099')$test$, '42501', 'insufficient_role', 'get_admin_provider_ratings: missing profile denied');
select throws_ok($test$select * from public.get_admin_platform_growth_counts()$test$, '42501', 'insufficient_role', 'get_admin_platform_growth_counts: missing profile denied');
select throws_ok($test$select * from public.get_admin_platform_feedback(null, null, 1)$test$, '42501', 'insufficient_role', 'get_admin_platform_feedback: missing profile denied');
select throws_ok($test$select * from public.update_platform_feedback('90000000-0000-4000-8000-000000000099', 'reviewing', null)$test$, '42501', 'insufficient_role', 'update_platform_feedback: missing profile denied');
select throws_ok($test$select * from public.upsert_provider_rating('90000000-0000-4000-8000-000000000099', 5, null)$test$, '42501', 'insufficient_role', 'upsert_provider_rating: missing profile denied');
select throws_ok($test$select * from public.remove_provider_rating('90000000-0000-4000-8000-000000000099')$test$, '42501', 'insufficient_role', 'remove_provider_rating: missing profile denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($test$select * from public.moderate_provider_rating('90000000-0000-4000-8000-000000000099', 'hidden')$test$, '42501', 'insufficient_role', 'moderate_provider_rating: consumer denied');
select throws_ok($test$select * from public.get_admin_provider_ratings('90000000-0000-4000-8000-000000000099')$test$, '42501', 'insufficient_role', 'get_admin_provider_ratings: consumer denied');
select throws_ok($test$select * from public.get_admin_platform_growth_counts()$test$, '42501', 'insufficient_role', 'get_admin_platform_growth_counts: consumer denied');
select throws_ok($test$select * from public.get_admin_platform_feedback(null, null, 1)$test$, '42501', 'insufficient_role', 'get_admin_platform_feedback: consumer denied');
select throws_ok($test$select * from public.update_platform_feedback('90000000-0000-4000-8000-000000000099', 'reviewing', null)$test$, '42501', 'insufficient_role', 'update_platform_feedback: consumer denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($test$select * from public.moderate_provider_rating('90000000-0000-4000-8000-000000000099', 'hidden')$test$, '42501', 'insufficient_role', 'moderate_provider_rating: provider denied');
select throws_ok($test$select * from public.get_admin_provider_ratings('90000000-0000-4000-8000-000000000099')$test$, '42501', 'insufficient_role', 'get_admin_provider_ratings: provider denied');
select throws_ok($test$select * from public.get_admin_platform_growth_counts()$test$, '42501', 'insufficient_role', 'get_admin_platform_growth_counts: provider denied');
select throws_ok($test$select * from public.get_admin_platform_feedback(null, null, 1)$test$, '42501', 'insufficient_role', 'get_admin_platform_feedback: provider denied');
select throws_ok($test$select * from public.update_platform_feedback('90000000-0000-4000-8000-000000000099', 'reviewing', null)$test$, '42501', 'insufficient_role', 'update_platform_feedback: provider denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($test$select * from public.moderate_provider_rating('90000000-0000-4000-8000-000000000099', 'hidden')$test$, '42501', 'rating_not_found', 'moderate_provider_rating: administrator passes role check and reaches record validation');
select lives_ok($test$select * from public.get_admin_provider_ratings('90000000-0000-4000-8000-000000000099')$test$, 'get_admin_provider_ratings: administrator allowed');
select lives_ok($test$select * from public.get_admin_platform_growth_counts()$test$, 'get_admin_platform_growth_counts: administrator allowed');
select lives_ok($test$select * from public.get_admin_platform_feedback(null, null, 1)$test$, 'get_admin_platform_feedback: administrator allowed');
select throws_ok($test$select * from public.update_platform_feedback('90000000-0000-4000-8000-000000000099', 'reviewing', null)$test$, '42501', 'feedback_not_found', 'update_platform_feedback: administrator passes role check and reaches record validation');
reset role;

select * from finish();
rollback;
