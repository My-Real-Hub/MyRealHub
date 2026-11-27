-- Run only against a disposable database after all reviewed migrations.
-- Synthetic identities have no passwords; every fixture and write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(82);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('93000000-0000-4000-8000-000000000001', 'r1-rating-customer-a@example.invalid', '{"role":"user"}'),
  ('93000000-0000-4000-8000-000000000002', 'r1-rating-customer-b@example.invalid', '{"role":"user","full_name":"R1 Customer B"}'),
  ('93000000-0000-4000-8000-000000000003', 'r1-rating-provider-a@example.invalid', '{"role":"provider","full_name":"R1 Provider A"}'),
  ('93000000-0000-4000-8000-000000000004', 'r1-rating-provider-b@example.invalid', '{"role":"provider","full_name":"R1 Provider B"}'),
  ('93000000-0000-4000-8000-000000000005', 'r1-rating-admin@example.invalid', '{}'),
  ('93000000-0000-4000-8000-000000000006', 'r1-rating-orphan@example.invalid', '{}');

update public.profiles
set role = 'admin'
where id = '93000000-0000-4000-8000-000000000005';
delete from public.profiles
where id = '93000000-0000-4000-8000-000000000006';

insert into public.provider_profiles (id, user_id, slug, display_name, status)
values
  ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000003', 'r1-ratings-active-provider', 'R1 Active Provider', 'active'),
  ('93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000004', 'r1-ratings-inactive-provider', 'R1 Inactive Provider', 'inactive');

insert into public.provider_ratings (
  id, provider_profile_id, rater_user_id, rating, review, moderation_status,
  moderated_by, moderated_at
)
values
  ('93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000001', 5, 'R1 visible customer review', 'visible', null, null),
  ('93000000-0000-4000-8000-000000000202', '93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000002', 2, 'R1 hidden customer review', 'hidden', '93000000-0000-4000-8000-000000000005', now()),
  ('93000000-0000-4000-8000-000000000203', '93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000004', 1, 'R1 removed provider review', 'removed', '93000000-0000-4000-8000-000000000005', now()),
  ('93000000-0000-4000-8000-000000000204', '93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000001', 4, 'R1 inactive listing review', 'visible', null, null),
  ('93000000-0000-4000-8000-000000000205', '93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000003', 3, 'R1 hidden inactive review', 'hidden', '93000000-0000-4000-8000-000000000005', now());

insert into public.platform_feedback (
  id, type, title, description, current_page_url, reporter_user_id,
  reporter_email_snapshot, status, internal_notes, reviewed_by, reviewed_at
)
values
  ('93000000-0000-4000-8000-000000000301', 'bug', 'R1 customer A feedback', 'Synthetic feedback from customer A.', '/r1-security-audit', '93000000-0000-4000-8000-000000000001', 'r1-rating-customer-a@example.invalid', 'reviewing', 'R1 private administrator note A', '93000000-0000-4000-8000-000000000005', now()),
  ('93000000-0000-4000-8000-000000000302', 'suggestion', 'R1 customer B feedback', 'Synthetic feedback from customer B.', '/r1-security-audit', '93000000-0000-4000-8000-000000000002', 'r1-rating-customer-b@example.invalid', 'reviewing', 'R1 private administrator note B', '93000000-0000-4000-8000-000000000005', now()),
  ('93000000-0000-4000-8000-000000000303', 'bug', 'R1 provider B feedback', 'Synthetic feedback from provider B.', '/r1-security-audit', '93000000-0000-4000-8000-000000000004', 'r1-rating-provider-b@example.invalid', 'reviewing', 'R1 private administrator provider note', '93000000-0000-4000-8000-000000000005', now());

-- Public APIs expose visible reviews and summaries, rather than private rows.
select ok(has_function_privilege('anon', 'public.get_provider_visible_reviews(uuid,integer)', 'EXECUTE'), 'anonymous callers can execute the public review API');
select ok(has_function_privilege('anon', 'public.get_provider_rating_summary(uuid)', 'EXECUTE'), 'anonymous callers can execute the public rating summary API');
select ok(has_function_privilege('anon', 'public.get_provider_rating_summaries(uuid[])', 'EXECUTE'), 'anonymous callers can execute the public batch summary API');
select ok(not has_function_privilege('anon', 'public.upsert_provider_rating(uuid,integer,text)', 'EXECUTE'), 'anonymous callers cannot create or change ratings');
select ok(not has_function_privilege('anon', 'public.remove_provider_rating(uuid)', 'EXECUTE'), 'anonymous callers cannot remove ratings');
select ok(not has_function_privilege('anon', 'public.submit_platform_feedback(text,text,text,text,text)', 'EXECUTE'), 'anonymous callers cannot submit protected feedback');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($test$select id from public.provider_ratings$test$, '42501', null, 'anonymous callers cannot read raw rating rows');
select throws_ok($test$select id from public.platform_feedback$test$, '42501', null, 'anonymous callers cannot read feedback');
select results_eq(
  $test$select id from public.get_provider_visible_reviews('93000000-0000-4000-8000-000000000101', 50)$test$,
  $test$values ('93000000-0000-4000-8000-000000000201'::uuid)$test$,
  'public reviews exclude hidden and removed reviews'
);
select is((select count(*) from public.get_provider_visible_reviews('93000000-0000-4000-8000-000000000102', 50)), 0::bigint, 'public reviews exclude inactive provider listings');
select is((select reviewer_name from public.get_provider_visible_reviews('93000000-0000-4000-8000-000000000101', 50)), 'MyRealHub member'::text, 'missing display names use a generic label rather than private email');
select ok(
  (select not (to_jsonb(review_row) ?| array['reviewer_email', 'rater_user_id', 'moderated_by'])
     and to_jsonb(review_row)::text not like '%r1-rating-customer-a@example.invalid%'
   from public.get_provider_visible_reviews('93000000-0000-4000-8000-000000000101', 50) review_row),
  'public review results contain no private reviewer email, account ID, or moderation actor'
);
select results_eq(
  $test$select average_rating, rating_count from public.get_provider_rating_summary('93000000-0000-4000-8000-000000000101')$test$,
  $test$values (5.0::numeric, 1::bigint)$test$,
  'public summary counts only visible ratings'
);
select results_eq(
  $test$select average_rating, rating_count from public.get_provider_rating_summary('93000000-0000-4000-8000-000000000102')$test$,
  $test$values (0::numeric, 0::bigint)$test$,
  'public summary discloses no inactive listing ratings'
);
select results_eq(
  $test$select provider_profile_id from public.get_provider_rating_summaries(array['93000000-0000-4000-8000-000000000101'::uuid, '93000000-0000-4000-8000-000000000102'::uuid])$test$,
  $test$values ('93000000-0000-4000-8000-000000000101'::uuid)$test$,
  'batch summaries omit inactive listings'
);
select is((select count(*) from public.get_provider_visible_reviews('93000000-0000-4000-8000-000000000101', 0)), 0::bigint, 'public review API respects a zero result limit');
reset role;

-- Exercise successful administrator operations against existing records.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.get_admin_provider_ratings('93000000-0000-4000-8000-000000000101')), 3::bigint, 'administrator can inspect visible, hidden, and removed ratings');
select is((select reviewer_email from public.get_admin_provider_ratings('93000000-0000-4000-8000-000000000101') where id = '93000000-0000-4000-8000-000000000201'), 'r1-rating-customer-a@example.invalid'::text, 'guarded administrator API retains necessary reviewer identity');
select results_eq(
  $test$select id, moderation_status::text from public.moderate_provider_rating('93000000-0000-4000-8000-000000000202', 'visible')$test$,
  $test$values ('93000000-0000-4000-8000-000000000202'::uuid, 'visible'::text)$test$,
  'administrator can make an existing hidden review visible'
);
select ok((select moderation_status = 'visible' and moderated_by = '93000000-0000-4000-8000-000000000005'::uuid and moderated_at is not null from public.provider_ratings where id = '93000000-0000-4000-8000-000000000202'), 'successful moderation persists status and administrator audit fields');
select results_eq(
  $test$select id, moderation_status::text from public.moderate_provider_rating('93000000-0000-4000-8000-000000000201', 'hidden')$test$,
  $test$values ('93000000-0000-4000-8000-000000000201'::uuid, 'hidden'::text)$test$,
  'administrator can hide an existing visible review'
);
select is((select count(*) from public.get_admin_platform_feedback(null, null, 100) where id in ('93000000-0000-4000-8000-000000000301', '93000000-0000-4000-8000-000000000302', '93000000-0000-4000-8000-000000000303')), 3::bigint, 'guarded administrator API can read unrelated feedback records');
select is((select internal_notes from public.get_admin_platform_feedback(null, null, 100) where id = '93000000-0000-4000-8000-000000000301'), 'R1 private administrator note A'::text, 'guarded administrator API can read private feedback notes');
select results_eq(
  $test$select id, status::text, internal_notes, reviewed_by from public.update_platform_feedback('93000000-0000-4000-8000-000000000301', 'resolved', 'R1 updated private administrator note')$test$,
  $test$values ('93000000-0000-4000-8000-000000000301'::uuid, 'resolved'::text, 'R1 updated private administrator note'::text, '93000000-0000-4000-8000-000000000005'::uuid)$test$,
  'administrator can edit existing feedback and receives the saved private fields'
);
select ok((select status = 'resolved' and internal_notes = 'R1 updated private administrator note' and reviewed_by = '93000000-0000-4000-8000-000000000005'::uuid and reviewed_at is not null from public.get_admin_platform_feedback(null, null, 100) where id = '93000000-0000-4000-8000-000000000301'), 'feedback changes and review audit fields persist through the guarded administrator API');
reset role;

-- Customer A can manage their ratings and see safe fields of their feedback.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select results_eq(
  $test$select id from public.provider_ratings where id::text like '93000000-%' order by id$test$,
  $test$values ('93000000-0000-4000-8000-000000000201'::uuid), ('93000000-0000-4000-8000-000000000204'::uuid)$test$,
  'customer can read only their own raw rating rows, including their hidden review'
);
select is((select count(*) from public.provider_ratings where id = '93000000-0000-4000-8000-000000000202'), 0::bigint, 'customer cannot read another customer raw rating');
select throws_ok($test$insert into public.provider_ratings (provider_profile_id, rater_user_id, rating) values ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000002', 5)$test$, '42501', null, 'customer cannot insert a rating attributed to another account');
select throws_ok($test$update public.provider_ratings set rating = 1 where id = '93000000-0000-4000-8000-000000000202'$test$, '42501', null, 'customer cannot directly change an unrelated rating');
select throws_ok($test$update public.provider_ratings set moderation_status = 'visible' where id = '93000000-0000-4000-8000-000000000201'$test$, '42501', null, 'customer cannot directly undo administrator moderation');
select throws_ok($test$delete from public.provider_ratings where id = '93000000-0000-4000-8000-000000000202'$test$, '42501', null, 'customer cannot directly delete another customer rating');
select throws_ok($test$select * from public.moderate_provider_rating('93000000-0000-4000-8000-000000000202', 'removed')$test$, '42501', 'insufficient_role', 'customer cannot moderate an existing unrelated rating');
select throws_ok($test$select * from public.get_admin_provider_ratings('93000000-0000-4000-8000-000000000101')$test$, '42501', 'insufficient_role', 'customer cannot retrieve private administrator reviewer data');
select results_eq(
  $test$select id, rater_user_id, rating, moderation_status::text from public.upsert_provider_rating('93000000-0000-4000-8000-000000000101', 4, 'R1 customer A updated review')$test$,
  $test$values ('93000000-0000-4000-8000-000000000201'::uuid, '93000000-0000-4000-8000-000000000001'::uuid, 4::smallint, 'hidden'::text)$test$,
  'customer updates only their own rating and cannot republish a hidden review'
);
select ok((select moderated_by = '93000000-0000-4000-8000-000000000005'::uuid and moderated_at is not null from public.provider_ratings where id = '93000000-0000-4000-8000-000000000201'), 'updating a hidden rating retains administrator moderation audit fields');
select throws_ok($test$select * from public.upsert_provider_rating('93000000-0000-4000-8000-000000000102', 5, 'Inactive listing attempt')$test$, '42501', 'provider_not_available', 'customer cannot write a rating for an inactive provider');
select results_eq(
  $test$select id, moderation_status::text, review from public.remove_provider_rating('93000000-0000-4000-8000-000000000101')$test$,
  $test$values ('93000000-0000-4000-8000-000000000201'::uuid, 'removed'::text, null::text)$test$,
  'customer can remove their own review through the protected rating API'
);
select results_eq(
  $test$select id, title, status::text from public.platform_feedback where id::text like '93000000-%' order by id$test$,
  $test$values ('93000000-0000-4000-8000-000000000301'::uuid, 'R1 customer A feedback'::text, 'resolved'::text)$test$,
  'customer sees only safe fields of their own feedback'
);
select is((select count(*) from public.platform_feedback where id = '93000000-0000-4000-8000-000000000302'), 0::bigint, 'customer cannot read unrelated feedback');
select throws_ok($test$select internal_notes from public.platform_feedback where id = '93000000-0000-4000-8000-000000000301'$test$, '42501', null, 'feedback reporter cannot read private administrator notes on their own report');
select throws_ok($test$select reviewed_by from public.platform_feedback where id = '93000000-0000-4000-8000-000000000301'$test$, '42501', null, 'feedback reporter cannot retrieve private administrator review identity');
select throws_ok($test$update public.platform_feedback set status = 'closed' where id = '93000000-0000-4000-8000-000000000301'$test$, '42501', null, 'customer cannot directly change their feedback workflow status');
select throws_ok($test$select * from public.update_platform_feedback('93000000-0000-4000-8000-000000000301', 'closed', 'Customer-injected internal note')$test$, '42501', 'insufficient_role', 'customer cannot use administrator feedback editing on their own report');
select throws_ok($test$select * from public.get_admin_platform_feedback(null, null, 100)$test$, '42501', 'insufficient_role', 'customer cannot retrieve administrator feedback notes through RPC');
select lives_ok($test$select * from public.submit_platform_feedback('bug', 'R1 customer A submitted feedback', 'Synthetic customer submission.', '/r1-security-audit', null)$test$, 'customer can submit feedback using the protected API');
select is((select reporter_user_id from public.platform_feedback where title = 'R1 customer A submitted feedback'), '93000000-0000-4000-8000-000000000001'::uuid, 'feedback submission records the authenticated customer as reporter');
select throws_ok($test$select * from public.submit_platform_feedback('bug', 'R1 invalid screenshot', 'Synthetic invalid screenshot.', '/r1-security-audit', '93000000-0000-4000-8000-000000000002/other-account.png')$test$, '23514', 'invalid_screenshot_path', 'customer cannot associate another account screenshot path with feedback');
reset role;

-- A second customer remains isolated after the first customer makes changes.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select results_eq(
  $test$select id, rating, review, moderation_status::text from public.provider_ratings where id::text like '93000000-%'$test$,
  $test$values ('93000000-0000-4000-8000-000000000202'::uuid, 2::smallint, 'R1 hidden customer review'::text, 'visible'::text)$test$,
  'another customer rating is unchanged by the first customer update and removal'
);
select is((select count(*) from public.provider_ratings where id = '93000000-0000-4000-8000-000000000201'), 0::bigint, 'second customer cannot read the first customer removed rating');
select results_eq(
  $test$select id, rater_user_id, rating from public.upsert_provider_rating('93000000-0000-4000-8000-000000000101', 3, 'R1 customer B updated review')$test$,
  $test$values ('93000000-0000-4000-8000-000000000202'::uuid, '93000000-0000-4000-8000-000000000002'::uuid, 3::smallint)$test$,
  'second customer can update their own rating without choosing another reviewer'
);
select is((select id from public.platform_feedback where id::text like '93000000-%'), '93000000-0000-4000-8000-000000000302'::uuid, 'second customer sees only their own original feedback');
select is((select count(*) from public.platform_feedback where title = 'R1 customer A submitted feedback'), 0::bigint, 'second customer cannot see feedback created by the first customer');
select throws_ok($test$select internal_notes from public.platform_feedback where id = '93000000-0000-4000-8000-000000000302'$test$, '42501', null, 'second customer cannot read internal notes on their own feedback');
select throws_ok($test$select * from public.update_platform_feedback('93000000-0000-4000-8000-000000000301', 'closed', null)$test$, '42501', 'insufficient_role', 'second customer cannot edit an unrelated feedback report through RPC');
reset role;

-- Owning a provider listing does not grant raw access to its reviewers.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select results_eq(
  $test$select id from public.provider_ratings where id::text like '93000000-%'$test$,
  $test$values ('93000000-0000-4000-8000-000000000205'::uuid)$test$,
  'provider owner can read only their own ratings, not raw ratings left on their listing'
);
select is((select count(*) from public.provider_ratings where provider_profile_id = '93000000-0000-4000-8000-000000000101'), 0::bigint, 'provider owner cannot inspect private reviewer rows on their own listing');
select throws_ok($test$select * from public.upsert_provider_rating('93000000-0000-4000-8000-000000000101', 5, 'Self rating')$test$, '42501', 'self_rating_not_allowed', 'provider cannot rate their own active listing');
select throws_ok($test$select * from public.moderate_provider_rating('93000000-0000-4000-8000-000000000202', 'removed')$test$, '42501', 'insufficient_role', 'provider owner cannot moderate a customer review on their listing');
select throws_ok($test$select * from public.get_admin_provider_ratings('93000000-0000-4000-8000-000000000101')$test$, '42501', 'insufficient_role', 'provider owner cannot retrieve administrator reviewer emails');
select is((select count(*) from public.platform_feedback where id::text like '93000000-%'), 0::bigint, 'provider cannot read unrelated customer or provider feedback');
select throws_ok($test$select * from public.update_platform_feedback('93000000-0000-4000-8000-000000000303', 'closed', null)$test$, '42501', 'insufficient_role', 'provider cannot administer another provider feedback');
reset role;

-- A provider account can consume another provider service under the same rules.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select results_eq(
  $test$select id from public.provider_ratings where id::text like '93000000-%'$test$,
  $test$values ('93000000-0000-4000-8000-000000000203'::uuid)$test$,
  'second provider sees only their own raw review'
);
select results_eq(
  $test$select id, rater_user_id, moderation_status::text from public.upsert_provider_rating('93000000-0000-4000-8000-000000000101', 4, 'R1 provider B updated review')$test$,
  $test$values ('93000000-0000-4000-8000-000000000203'::uuid, '93000000-0000-4000-8000-000000000004'::uuid, 'visible'::text)$test$,
  'provider can update their own review of another active provider'
);
select results_eq(
  $test$select id, moderation_status::text from public.remove_provider_rating('93000000-0000-4000-8000-000000000101')$test$,
  $test$values ('93000000-0000-4000-8000-000000000203'::uuid, 'removed'::text)$test$,
  'provider can remove only their own review through the protected API'
);
select is((select id from public.platform_feedback where id::text like '93000000-%'), '93000000-0000-4000-8000-000000000303'::uuid, 'provider can read safe fields of their own feedback');
select throws_ok($test$select internal_notes from public.platform_feedback where id = '93000000-0000-4000-8000-000000000303'$test$, '42501', null, 'provider feedback reporter cannot read private administrator notes');
select throws_ok($test$select * from public.update_platform_feedback('93000000-0000-4000-8000-000000000303', 'closed', null)$test$, '42501', 'insufficient_role', 'provider cannot use administrator feedback editing on their own report');
reset role;

-- Authenticated identities without valid profiles fail protected operations.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select count(*) from public.provider_ratings where id::text like '93000000-%'), 0::bigint, 'missing-profile identity cannot read private rating rows');
select is((select count(*) from public.platform_feedback where id::text like '93000000-%'), 0::bigint, 'missing-profile identity cannot read private feedback rows');
select throws_ok($test$select * from public.upsert_provider_rating('93000000-0000-4000-8000-000000000101', 5, 'Missing profile rating')$test$, '42501', 'insufficient_role', 'missing-profile identity cannot create or update a rating');
select throws_ok($test$select * from public.remove_provider_rating('93000000-0000-4000-8000-000000000101')$test$, '42501', 'insufficient_role', 'missing-profile identity cannot remove a rating');
select throws_ok($test$select * from public.moderate_provider_rating('93000000-0000-4000-8000-000000000202', 'removed')$test$, '42501', 'insufficient_role', 'missing-profile identity cannot moderate an existing rating');
select throws_ok($test$select * from public.get_admin_provider_ratings('93000000-0000-4000-8000-000000000101')$test$, '42501', 'insufficient_role', 'missing-profile identity cannot retrieve private reviewer emails');
select throws_ok($test$select * from public.submit_platform_feedback('bug', 'Missing profile feedback', 'Synthetic missing-profile attempt.', '/r1-security-audit', null)$test$, '42501', 'profile_not_found', 'missing-profile identity cannot submit protected feedback');
select throws_ok($test$select * from public.update_platform_feedback('93000000-0000-4000-8000-000000000301', 'closed', null)$test$, '42501', 'insufficient_role', 'missing-profile identity cannot edit existing feedback');
select throws_ok($test$select * from public.get_admin_platform_feedback(null, null, 100)$test$, '42501', 'insufficient_role', 'missing-profile identity cannot read administrator feedback notes');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($test$select * from public.upsert_provider_rating('93000000-0000-4000-8000-000000000101', 5, 'Missing identity rating')$test$, '28000', 'not_authenticated', 'authenticated database role without identity cannot submit ratings');
select throws_ok($test$select * from public.remove_provider_rating('93000000-0000-4000-8000-000000000101')$test$, '28000', 'not_authenticated', 'authenticated database role without identity cannot remove ratings');
select throws_ok($test$select * from public.submit_platform_feedback('bug', 'Missing identity feedback', 'Synthetic missing-identity attempt.', '/r1-security-audit', null)$test$, '28000', 'not_authenticated', 'authenticated database role without identity cannot submit feedback');
reset role;

-- Confirm denied callers did not change administrator state or other accounts.
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select ok((select status = 'resolved' and internal_notes = 'R1 updated private administrator note' and reviewed_by = '93000000-0000-4000-8000-000000000005'::uuid from public.get_admin_platform_feedback(null, null, 100) where id = '93000000-0000-4000-8000-000000000301'), 'denied callers leave administrator feedback status and private notes unchanged');
select ok((select status = 'reviewing' and internal_notes = 'R1 private administrator provider note' from public.get_admin_platform_feedback(null, null, 100) where id = '93000000-0000-4000-8000-000000000303'), 'denied provider edits leave unrelated administrator notes unchanged');
select results_eq(
  $test$select id, rating, review, moderation_status::text from public.get_admin_provider_ratings('93000000-0000-4000-8000-000000000101') where id = '93000000-0000-4000-8000-000000000202'$test$,
  $test$values ('93000000-0000-4000-8000-000000000202'::uuid, 3::smallint, 'R1 customer B updated review'::text, 'visible'::text)$test$,
  'other callers cannot alter or remove the second customer rating'
);
reset role;

select * from finish();
rollback;
