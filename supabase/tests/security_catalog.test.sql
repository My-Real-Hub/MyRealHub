-- Runtime permission invariants; execute only in a disposable Supabase database.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

select is((
  select count(*)::integer from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where ((n.nspname = 'public' and c.relkind = 'r')
    or (n.nspname = 'storage' and c.relname = 'objects'))
    and not c.relrowsecurity
), 0, 'application tables and Storage objects enforce row level security');

select is((
  select count(*)::integer from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce(c.reloptions @> array['security_invoker=true'], false)
), 0, 'application views apply the caller row permissions');

select ok(not has_schema_privilege('anon', 'public', 'CREATE')
  and not has_schema_privilege('authenticated', 'public', 'CREATE')
  and not exists (select 1 from pg_roles
    where rolname in ('anon', 'authenticated') and rolcanlogin),
  'client roles cannot log in directly or create application objects');

select is((
  select count(*)::integer from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) as client(role_name)
  cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) as operation(privilege_name)
  -- Supabase owns Storage's base grants; application-owned public tables are
  -- the grantor boundary for this invariant. Storage row access is tested in
  -- rls_profiles_providers.test.sql, including the Storage API delete context.
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege(client.role_name, c.oid, operation.privilege_name)
), 0, 'client roles have no bulk deletion or maintenance privileges on application tables');

select ok(not has_any_column_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous callers have no private profile column grants');

select is((
  select count(*)::integer from (values
    ('public.contact_requests'), ('public.contact_request_messages'),
    ('public.saved_providers'), ('public.provider_notification_preferences'),
    ('public.provider_ratings'), ('public.platform_feedback')
  ) as private_table(table_name)
  where has_any_column_privilege('anon', private_table.table_name, 'SELECT')
), 0, 'anonymous callers have no private application table read grants');

select is((
  select count(*)::integer from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and p.oid not in (
      'public.get_provider_rating_summary(uuid)'::regprocedure,
      'public.get_provider_rating_summaries(uuid[])'::regprocedure,
      'public.get_provider_visible_reviews(uuid,integer)'::regprocedure
    )
    and has_function_privilege('anon', p.oid, 'EXECUTE')
), 0, 'only the approved public review functions allow anonymous definer execution');

select is((
  select count(*)::integer from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join (values ('anon'), ('authenticated')) as client(role_name)
  where n.nspname = 'public'
    and (p.prorettype = 'trigger'::regtype or p.proname = 'get_new_profile_role')
    and has_function_privilege(client.role_name, p.oid, 'EXECUTE')
), 0, 'internal trigger and signup helpers cannot be called directly by clients');

select is((
  select count(*)::integer from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and not coalesce(p.proconfig @> array['search_path=""'], false)
), 0, 'all application definer functions use an empty search path');

select is((
  select count(*)::integer from (values ('id'), ('role'), ('created_at'), ('updated_at')) as protected(column_name)
  where has_column_privilege('authenticated', 'public.profiles', protected.column_name, 'UPDATE')
), 0, 'account identity and administrator role cannot be edited through column grants');

select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT')
  and has_table_privilege('anon', 'public.provider_profiles', 'SELECT')
  and has_table_privilege('authenticated', 'public.contact_requests', 'SELECT'),
  'legitimate profile, public directory and conversation reads have explicit grants');

select is((
  select count(*)::integer from (values
    ('public.get_provider_rating_summary(uuid)'),
    ('public.get_provider_rating_summaries(uuid[])'),
    ('public.get_provider_visible_reviews(uuid,integer)')
  ) as public_rpc(signature)
  cross join (values ('anon'), ('authenticated')) as client(role_name)
  where not has_function_privilege(client.role_name, public_rpc.signature, 'EXECUTE')
), 0, 'public review functions remain available to anonymous and signed-in callers');

select ok(not has_column_privilege('authenticated', 'public.platform_feedback', 'internal_notes', 'SELECT')
  and not has_column_privilege('authenticated', 'public.platform_feedback', 'reviewed_by', 'SELECT')
  and has_column_privilege('authenticated', 'public.platform_feedback', 'status', 'SELECT'),
  'reporters can read feedback status without administrator notes or reviewer identities');

select ok(not has_any_column_privilege('authenticated', 'public.contact_requests', 'UPDATE'),
  'conversation mutations must pass through the guarded functions');

select is((
  select count(*)::integer from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as operation(privilege_name)
  where n.nspname = 'public' and c.relkind = 'r'
    and not has_table_privilege('service_role', c.oid, operation.privilege_name)
), 0, 'the trusted server role retains application CRUD permissions');

select * from finish();
rollback;
