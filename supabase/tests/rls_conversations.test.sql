-- Run against the disposable Supabase database after every migration.
-- No Auth passwords, real addresses, SMTP calls, or persistent fixtures are used.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(91);

-- Auth identities: customers 001/002, providers 011/012/013, admin 091,
-- missing-profile account 099. Listing IDs use 8100, conversations use 8200.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('92000000-0000-4000-8000-000000000001', 'conversations-customer-a@example.invalid', '{"role":"user","full_name":"Customer A"}'),
  ('92000000-0000-4000-8000-000000000002', 'conversations-customer-b@example.invalid', '{"role":"user","full_name":"Customer B"}'),
  ('92000000-0000-4000-8000-000000000011', 'conversations-provider-a@example.invalid', '{"role":"provider","full_name":"Provider A"}'),
  ('92000000-0000-4000-8000-000000000012', 'conversations-provider-b@example.invalid', '{"role":"provider","full_name":"Provider B"}'),
  ('92000000-0000-4000-8000-000000000013', 'conversations-provider-draft@example.invalid', '{"role":"provider","full_name":"Draft Provider"}'),
  ('92000000-0000-4000-8000-000000000091', 'conversations-admin@example.invalid', '{}'),
  ('92000000-0000-4000-8000-000000000099', 'conversations-orphan@example.invalid', '{}');
update public.profiles set role = 'admin'
where id = '92000000-0000-4000-8000-000000000091';
delete from public.profiles
where id = '92000000-0000-4000-8000-000000000099';

insert into public.provider_profiles (id, user_id, display_name, slug, status)
values
  ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8000-000000000011', 'Active Provider A', 'r1-conversations-provider-a-920000000011', 'active'),
  ('92000000-0000-4000-8100-000000000012', '92000000-0000-4000-8000-000000000012', 'Active Provider B', 'r1-conversations-provider-b-920000000012', 'active'),
  ('92000000-0000-4000-8100-000000000013', '92000000-0000-4000-8000-000000000013', 'Private Draft Provider', 'r1-conversations-draft-provider-920000000013', 'draft');
insert into public.provider_notification_preferences (provider_profile_id, notification_email)
values
  ('92000000-0000-4000-8100-000000000011', 'private-provider-a@example.invalid'),
  ('92000000-0000-4000-8100-000000000012', 'private-provider-b@example.invalid');

insert into public.contact_requests (
  id, provider_profile_id, sender_user_id, sender_name, sender_email, message
)
values
  ('92000000-0000-4000-8200-000000000002', '92000000-0000-4000-8100-000000000012', '92000000-0000-4000-8000-000000000002', 'Customer B', 'conversations-customer-b@example.invalid', 'Private conversation B.'),
  -- Represents an existing conversation whose listing later became a draft.
  ('92000000-0000-4000-8200-000000000003', '92000000-0000-4000-8100-000000000013', '92000000-0000-4000-8000-000000000001', 'Customer A', 'conversations-customer-a@example.invalid', 'Keep this existing conversation private.');

-- Customer A can create and read a legitimate inquiry, including its message.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($sql$
  insert into public.contact_requests (
    id, provider_profile_id, sender_user_id, sender_name, sender_email, message
  ) values (
    '92000000-0000-4000-8200-000000000001',
    '92000000-0000-4000-8100-000000000011',
    '92000000-0000-4000-8000-000000000001',
    'Customer A', 'conversations-customer-a@example.invalid', 'Initial inquiry A.'
  )
$sql$, 'customer can create an inquiry for an active accepting provider');
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 1::bigint, 'sender can read the created inquiry');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001' and body = 'Initial inquiry A.'), 1::bigint, 'initial message trigger creates one readable message');
select is((select count(*) from public.contact_request_latest_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 1::bigint, 'sender can read the latest-message view');
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000002'), 0::bigint, 'customer cannot read an unrelated inquiry');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000002'), 0::bigint, 'customer cannot read unrelated private messages');
select is((select count(*) from public.contact_request_latest_messages where contact_request_id = '92000000-0000-4000-8200-000000000002'), 0::bigint, 'latest-message view does not expose an unrelated conversation');
select is((select count(*) from public.provider_profiles where id = '92000000-0000-4000-8100-000000000013'), 0::bigint, 'customer cannot read a private draft listing');
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000003'), 1::bigint, 'sender retains access to an existing conversation with a draft listing');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000003'), 1::bigint, 'draft listing visibility does not hide the sender own messages');
select is((select count(*) from public.provider_notification_preferences where provider_profile_id in ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8100-000000000012')), 0::bigint, 'customer cannot read provider notification addresses');
select throws_ok($sql$
  insert into public.contact_requests (provider_profile_id, sender_user_id, sender_name, sender_email, message)
  values ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8000-000000000002', 'Forged sender', 'forged@example.invalid', 'Must fail.')
$sql$, '42501', null, 'customer cannot create an inquiry as another account');
select throws_ok($sql$
  insert into public.contact_requests (provider_profile_id, sender_user_id, sender_name, sender_email, message)
  values ('92000000-0000-4000-8100-000000000013', '92000000-0000-4000-8000-000000000001', 'Customer A', 'conversations-customer-a@example.invalid', 'Must fail.')
$sql$, '42501', null, 'customer cannot create a new inquiry for a draft listing');
select throws_ok($sql$
  insert into public.contact_request_messages (contact_request_id, sender_user_id, sender_name_snapshot, body)
  values ('92000000-0000-4000-8200-000000000001', '92000000-0000-4000-8000-000000000001', 'Customer A', 'Bypassing the message RPC.')
$sql$, '42501', null, 'participant cannot insert messages directly');
select throws_ok($sql$
  update public.contact_requests set status = 'archived' where id = '92000000-0000-4000-8200-000000000001'
$sql$, '42501', null, 'sender cannot bypass conversation status rules with a table update');
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000002', 'Intrusion.')
$sql$, '42501', 'contact_request_not_found', 'customer cannot send to another customer conversation');
select throws_ok($sql$
  select * from public.mark_contact_request_conversation_read('92000000-0000-4000-8200-000000000002')
$sql$, '42501', 'contact_request_not_found', 'customer cannot mark an unrelated conversation read');
select throws_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000001', 'archived', null)
$sql$, '42501', 'contact_request_not_found', 'sender cannot perform provider-only status changes');
select throws_ok($sql$
  select public.update_provider_communication_preferences('92000000-0000-4000-8100-000000000011', true, 'in_app', false, 'intruder@example.invalid')
$sql$, '42501', 'insufficient_role', 'customer cannot use the provider preferences RPC');
with changed as (
  update public.provider_notification_preferences set notification_email = 'intruder@example.invalid'
  where provider_profile_id = '92000000-0000-4000-8100-000000000011' returning provider_profile_id
)
select is((select count(*) from changed), 0::bigint, 'customer cannot overwrite a provider private notification address');
reset role;

-- Customer B sees their own records and cannot mutate Customer A's records.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000002'), 1::bigint, 'second customer can read their own inquiry');
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 0::bigint, 'second customer cannot read the first customer inquiry');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 0::bigint, 'second customer cannot read the first customer messages');
select throws_ok($sql$
  update public.contact_requests set status = 'archived' where id = '92000000-0000-4000-8200-000000000001'
$sql$, '42501', null, 'unrelated customer cannot update another inquiry directly');
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000001', 'Intrusion from customer B.')
$sql$, '42501', 'contact_request_not_found', 'second customer cannot reply to the first customer conversation');
reset role;

-- Provider A owns the destination listing and can perform the valid workflow.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 1::bigint, 'destination provider can read the inquiry');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 1::bigint, 'destination provider can read its initial message');
select is((select count(*) from public.contact_requests where id = '92000000-0000-4000-8200-000000000002'), 0::bigint, 'provider cannot read another provider inquiry');
select is((select count(*) from public.provider_notification_preferences where provider_profile_id = '92000000-0000-4000-8100-000000000011' and notification_email = 'private-provider-a@example.invalid'), 1::bigint, 'provider can read its private notification address');
select is((select count(*) from public.provider_notification_preferences where provider_profile_id = '92000000-0000-4000-8100-000000000012'), 0::bigint, 'provider cannot read another provider notification address');
select is((select count(*) from public.provider_profiles where id = '92000000-0000-4000-8100-000000000013'), 0::bigint, 'provider cannot read another provider draft');
select lives_ok($sql$
  select public.update_provider_communication_preferences('92000000-0000-4000-8100-000000000011', true, 'in_app', false, ' updated-provider-a@example.invalid ')
$sql$, 'provider can update its own communication preferences through the RPC');
select is((select notification_email from public.provider_notification_preferences where provider_profile_id = '92000000-0000-4000-8100-000000000011'), 'updated-provider-a@example.invalid', 'preferences RPC stores the normalized notification address');
select throws_ok($sql$
  select public.update_provider_communication_preferences('92000000-0000-4000-8100-000000000012', true, 'in_app', false, 'intruder@example.invalid')
$sql$, '42501', 'provider_profile_not_found', 'provider cannot use the preferences RPC on another listing');
with changed as (
  update public.provider_notification_preferences set notification_email = 'intruder@example.invalid'
  where provider_profile_id = '92000000-0000-4000-8100-000000000012' returning provider_profile_id
)
select is((select count(*) from changed), 0::bigint, 'provider cannot overwrite another provider notification address directly');
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000002', 'Intrusion from provider A.')
$sql$, '42501', 'contact_request_not_found', 'provider cannot reply to another provider conversation');
select throws_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000002', 'archived', null)
$sql$, '42501', 'contact_request_not_found', 'provider cannot archive another provider conversation');
select lives_ok($sql$
  select * from public.mark_contact_request_conversation_read('92000000-0000-4000-8200-000000000001')
$sql$, 'destination provider can mark the inquiry read');
select ok((select status = 'read' and read_at is not null and provider_last_read_at is not null from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 'read RPC persists provider receipt and read status');
select lives_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000001', 'Provider A reply.')
$sql$, 'destination provider can reply through the message RPC');
select ok((select status = 'responded' and provider_response = 'Provider A reply.' and responded_at is not null from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 'provider reply persists response and responded status');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001' and sender_user_id = '92000000-0000-4000-8000-000000000011' and body = 'Provider A reply.' and sender_email_snapshot is null), 1::bigint, 'provider reply stores the authenticated author without leaking a private email');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($sql$
  select * from public.mark_contact_request_conversation_read('92000000-0000-4000-8200-000000000001')
$sql$, 'customer can mark its own conversation read');
select ok((select sender_last_read_at is not null and status = 'responded' from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 'sender read receipt preserves provider response status');
select lives_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000001', 'Customer A follow-up.')
$sql$, 'customer can reply to its own conversation');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 3::bigint, 'allowed inquiry and replies persist exactly three messages');
select is((select status::text from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 'new', 'customer follow-up returns the inquiry to provider attention');
reset role;

-- Provider B can read its own conversation but cannot touch Provider A's.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000012', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000002'), 1::bigint, 'second provider can read its own conversation messages');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 0::bigint, 'second provider cannot read the first provider messages');
select is((select count(*) from public.contact_request_latest_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 0::bigint, 'latest-message view preserves provider isolation');
select throws_ok($sql$
  update public.contact_requests set status = 'archived' where id = '92000000-0000-4000-8200-000000000001'
$sql$, '42501', null, 'unrelated provider cannot update an inquiry directly');
select throws_ok($sql$
  select * from public.mark_contact_request_conversation_read('92000000-0000-4000-8200-000000000001')
$sql$, '42501', 'contact_request_not_found', 'unrelated provider cannot forge a read receipt');
reset role;

-- Draft ownership and the private notification table retain their allowed path.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000013', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select is((select count(*) from public.provider_profiles where id = '92000000-0000-4000-8100-000000000013'), 1::bigint, 'provider can read its own draft');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000003'), 1::bigint, 'draft owner retains its existing conversation');
select lives_ok($sql$
  insert into public.provider_notification_preferences (provider_profile_id, notification_email)
  values ('92000000-0000-4000-8100-000000000013', 'private-draft-owner@example.invalid')
$sql$, 'provider can insert its own private notification preferences');
select is((select notification_email from public.provider_notification_preferences where provider_profile_id = '92000000-0000-4000-8100-000000000013'), 'private-draft-owner@example.invalid', 'provider can read its newly created notification preferences');
reset role;

-- Provider-only transitions work, and an archive cannot be bypassed by SQL.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select lives_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000001', 'rejected', 'Provider decline note.')
$sql$, 'destination provider can reject with a conversation note');
select ok((select status = 'rejected' and rejected_at is not null and provider_response = 'Provider decline note.' from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 'rejection persists the intended status and note');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001' and body = 'Provider decline note.'), 1::bigint, 'rejection creates exactly one authenticated provider note');
select lives_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000001', 'archived', null)
$sql$, 'destination provider can archive through the status RPC');
select ok((select status = 'archived' and archived_at is not null from public.contact_requests where id = '92000000-0000-4000-8200-000000000001'), 'archive RPC persists archived status and timestamp');
select throws_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000001', 'rejected', 'Forbidden archived rejection.')
$sql$, '42501', 'contact_request_archived', 'provider cannot reopen an archived conversation through the status RPC');
select throws_ok($sql$
  update public.contact_requests set status = 'new', archived_at = null where id = '92000000-0000-4000-8200-000000000001'
$sql$, '42501', null, 'provider cannot bypass archive protection with a direct table update');
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000001', 'Forbidden archived provider reply.')
$sql$, '42501', 'contact_request_archived', 'provider cannot send into an archived conversation');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 4::bigint, 'failed archived provider write creates no message');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000001', 'Forbidden archived customer reply.')
$sql$, '42501', 'contact_request_archived', 'customer cannot send into an archived conversation');
select is((select count(*) from public.contact_request_messages where contact_request_id = '92000000-0000-4000-8200-000000000001'), 4::bigint, 'failed archived customer write creates no message');
reset role;

-- No-profile accounts cannot use private data or protected write operations.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000099', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000099","role":"authenticated"}', true);
select is((select count(*) from public.contact_requests where id in ('92000000-0000-4000-8200-000000000001', '92000000-0000-4000-8200-000000000002', '92000000-0000-4000-8200-000000000003')), 0::bigint, 'missing-profile account cannot read fixture inquiries');
select is((select count(*) from public.contact_request_messages where contact_request_id in ('92000000-0000-4000-8200-000000000001', '92000000-0000-4000-8200-000000000002', '92000000-0000-4000-8200-000000000003')), 0::bigint, 'missing-profile account cannot read fixture messages');
select is((select count(*) from public.provider_notification_preferences where provider_profile_id in ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8100-000000000012', '92000000-0000-4000-8100-000000000013')), 0::bigint, 'missing-profile account cannot read provider private addresses');
select throws_ok($sql$
  insert into public.contact_requests (provider_profile_id, sender_user_id, sender_name, sender_email, message)
  values ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8000-000000000099', 'Missing Profile', 'orphan@example.invalid', 'Must fail.')
$sql$, '42501', null, 'missing-profile account cannot create an inquiry');
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000002', 'Must fail.')
$sql$, '42501', 'profile_not_found', 'missing-profile account cannot send a message');
select throws_ok($sql$
  select * from public.mark_contact_request_conversation_read('92000000-0000-4000-8200-000000000002')
$sql$, '42501', 'contact_request_not_found', 'missing-profile account cannot mark a conversation read');
select throws_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000002', 'archived', null)
$sql$, '42501', 'contact_request_not_found', 'missing-profile account cannot change conversation status');
select throws_ok($sql$
  select public.update_provider_communication_preferences('92000000-0000-4000-8100-000000000011', true, 'in_app', false, 'intruder@example.invalid')
$sql$, '42501', 'insufficient_role', 'missing-profile account cannot update communication preferences');
reset role;

-- Administrators retain their explicitly authorized operational visibility.
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000091', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000091","role":"authenticated"}', true);
select is((select count(*) from public.contact_requests where id in ('92000000-0000-4000-8200-000000000001', '92000000-0000-4000-8200-000000000002', '92000000-0000-4000-8200-000000000003')), 3::bigint, 'administrator retains authorized inquiry metadata visibility');
select is((select count(*) from public.provider_profiles where id = '92000000-0000-4000-8100-000000000013'), 1::bigint, 'administrator can inspect draft listings');
select is((select count(*) from public.provider_notification_preferences where provider_profile_id in ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8100-000000000012', '92000000-0000-4000-8100-000000000013')), 3::bigint, 'administrator retains authorized notification preference visibility');
select lives_ok($sql$
  update public.provider_notification_preferences set notification_email = 'admin-corrected-provider-b@example.invalid'
  where provider_profile_id = '92000000-0000-4000-8100-000000000012'
$sql$, 'administrator can maintain provider notification preferences');
select is((select notification_email from public.provider_notification_preferences where provider_profile_id = '92000000-0000-4000-8100-000000000012'), 'admin-corrected-provider-b@example.invalid', 'administrator notification preference update persists');
reset role;

-- Anonymous browsing retains public active listings but no protected actions.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.provider_profiles where id in ('92000000-0000-4000-8100-000000000011', '92000000-0000-4000-8100-000000000012')), 2::bigint, 'anonymous visitor can browse active listings');
select is((select count(*) from public.provider_profiles where id = '92000000-0000-4000-8100-000000000013'), 0::bigint, 'anonymous visitor cannot read a draft listing');
select throws_ok($sql$select * from public.contact_requests$sql$, '42501', null, 'anonymous visitor cannot select private inquiries');
select throws_ok($sql$select * from public.contact_request_messages$sql$, '42501', null, 'anonymous visitor cannot select private message contents');
select throws_ok($sql$select * from public.provider_notification_preferences$sql$, '42501', null, 'anonymous visitor cannot select provider notification addresses');
select throws_ok($sql$
  insert into public.contact_requests (provider_profile_id, sender_name, sender_email, message)
  values ('92000000-0000-4000-8100-000000000011', 'Anonymous', 'anonymous@example.invalid', 'Must fail.')
$sql$, '42501', null, 'anonymous visitor cannot create an inquiry');
select throws_ok($sql$
  select * from public.send_contact_request_message('92000000-0000-4000-8200-000000000002', 'Must fail.')
$sql$, '42501', null, 'anonymous visitor cannot execute the send-message RPC');
select throws_ok($sql$
  select * from public.mark_contact_request_conversation_read('92000000-0000-4000-8200-000000000002')
$sql$, '42501', null, 'anonymous visitor cannot execute the read-receipt RPC');
select throws_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000002', 'archived', null)
$sql$, '42501', null, 'anonymous visitor cannot execute the conversation-status RPC');
select throws_ok($sql$
  select public.update_provider_communication_preferences('92000000-0000-4000-8100-000000000011', true, 'in_app', false, 'intruder@example.invalid')
$sql$, '42501', null, 'anonymous visitor cannot execute the communication-preferences RPC');
reset role;

-- A historical listing relationship does not preserve provider-only powers
-- after the account has been changed to a customer role.
update public.profiles set role = 'user'
where id = '92000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok($sql$
  select * from public.update_contact_request_conversation_status('92000000-0000-4000-8200-000000000001', 'archived', null)
$sql$, '42501', 'insufficient_role', 'customer role cannot retain provider-only status changes through a legacy owned listing');
reset role;

select * from finish();
rollback;
