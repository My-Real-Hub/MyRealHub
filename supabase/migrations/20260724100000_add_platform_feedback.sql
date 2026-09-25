do $$
begin
  if not exists (
    select 1
    from pg_type
    join pg_namespace
      on pg_namespace.oid = pg_type.typnamespace
    where pg_namespace.nspname = 'public'
      and pg_type.typname = 'platform_feedback_type'
  ) then
    create type public.platform_feedback_type as enum (
      'bug',
      'suggestion'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    join pg_namespace
      on pg_namespace.oid = pg_type.typnamespace
    where pg_namespace.nspname = 'public'
      and pg_type.typname = 'platform_feedback_status'
  ) then
    create type public.platform_feedback_status as enum (
      'new',
      'reviewing',
      'planned',
      'resolved',
      'closed'
    );
  end if;
end $$;

create table if not exists public.platform_feedback (
  id uuid primary key default gen_random_uuid(),
  type public.platform_feedback_type not null,
  title text not null,
  description text not null,
  current_page_url text not null,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  reporter_name_snapshot text,
  reporter_email_snapshot text,
  screenshot_path text,
  status public.platform_feedback_status not null default 'new',
  internal_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_feedback_title_length_check
    check (
      char_length(btrim(title)) >= 1
      and char_length(btrim(title)) <= 160
    ),
  constraint platform_feedback_description_length_check
    check (
      char_length(btrim(description)) >= 1
      and char_length(btrim(description)) <= 3000
    ),
  constraint platform_feedback_current_page_url_length_check
    check (
      char_length(btrim(current_page_url)) >= 1
      and char_length(btrim(current_page_url)) <= 2048
    ),
  constraint platform_feedback_reporter_name_length_check
    check (
      reporter_name_snapshot is null
      or char_length(btrim(reporter_name_snapshot)) <= 160
    ),
  constraint platform_feedback_reporter_email_length_check
    check (
      reporter_email_snapshot is null
      or char_length(btrim(reporter_email_snapshot)) <= 254
    ),
  constraint platform_feedback_screenshot_path_length_check
    check (
      screenshot_path is null
      or char_length(btrim(screenshot_path)) <= 512
    ),
  constraint platform_feedback_internal_notes_length_check
    check (
      internal_notes is null
      or char_length(btrim(internal_notes)) <= 3000
    )
);

create trigger platform_feedback_set_updated_at
before update on public.platform_feedback
for each row execute function public.set_updated_at();

create index if not exists platform_feedback_status_created_idx
  on public.platform_feedback (status, created_at desc);

create index if not exists platform_feedback_type_created_idx
  on public.platform_feedback (type, created_at desc);

create index if not exists platform_feedback_reporter_created_idx
  on public.platform_feedback (reporter_user_id, created_at desc);

alter table public.platform_feedback enable row level security;

revoke all
on table public.platform_feedback
from anon, authenticated;

grant select
on table public.platform_feedback
to authenticated;

drop policy if exists platform_feedback_select_own
on public.platform_feedback;

create policy platform_feedback_select_own
on public.platform_feedback
for select
to authenticated
using ((select auth.uid()) = reporter_user_id);

drop policy if exists platform_feedback_select_admin
on public.platform_feedback;

create policy platform_feedback_select_admin
on public.platform_feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists feedback_screenshots_select_own_or_admin
on storage.objects;

create policy feedback_screenshots_select_own_or_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
);

drop policy if exists feedback_screenshots_insert_own
on storage.objects;

create policy feedback_screenshots_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists feedback_screenshots_update_own
on storage.objects;

create policy feedback_screenshots_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists feedback_screenshots_delete_own
on storage.objects;

create policy feedback_screenshots_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.submit_platform_feedback(
  target_type text,
  target_title text,
  target_description text,
  target_current_page_url text,
  target_screenshot_path text default null
)
returns table (
  id uuid,
  status public.platform_feedback_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_type text := lower(btrim(coalesce(target_type, '')));
  normalized_title text := nullif(btrim(target_title), '');
  normalized_description text := nullif(btrim(target_description), '');
  normalized_current_page_url text := nullif(btrim(target_current_page_url), '');
  normalized_screenshot_path text := nullif(btrim(target_screenshot_path), '');
  reporter_profile record;
  inserted_feedback public.platform_feedback%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if normalized_type not in ('bug', 'suggestion') then
    raise exception 'unsupported_feedback_type' using errcode = '22000';
  end if;

  if normalized_title is null or char_length(normalized_title) > 160 then
    raise exception 'invalid_title' using errcode = '23514';
  end if;

  if normalized_description is null or char_length(normalized_description) > 3000 then
    raise exception 'invalid_description' using errcode = '23514';
  end if;

  if normalized_current_page_url is null
    or char_length(normalized_current_page_url) > 2048 then
    raise exception 'invalid_current_page_url' using errcode = '23514';
  end if;

  select
    profiles.full_name,
    profiles.email,
    profiles.role
  into reporter_profile
  from public.profiles
  where profiles.id = current_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = '42501';
  end if;

  if normalized_screenshot_path is not null then
    if char_length(normalized_screenshot_path) > 512
      or split_part(normalized_screenshot_path, '/', 1) <> current_user_id::text then
      raise exception 'invalid_screenshot_path' using errcode = '23514';
    end if;
  end if;

  insert into public.platform_feedback (
    type,
    title,
    description,
    current_page_url,
    reporter_user_id,
    reporter_name_snapshot,
    reporter_email_snapshot,
    screenshot_path
  )
  values (
    normalized_type::public.platform_feedback_type,
    normalized_title,
    normalized_description,
    normalized_current_page_url,
    current_user_id,
    nullif(btrim(reporter_profile.full_name), ''),
    nullif(btrim(reporter_profile.email), ''),
    normalized_screenshot_path
  )
  returning *
  into inserted_feedback;

  return query
  select inserted_feedback.id, inserted_feedback.status;
end;
$$;

revoke all
on function public.submit_platform_feedback(text, text, text, text, text)
from public;

grant execute
on function public.submit_platform_feedback(text, text, text, text, text)
to authenticated;

create or replace function public.get_admin_platform_growth_counts()
returns table (
  user_count bigint,
  provider_count bigint,
  admin_count bigint,
  provider_profile_count bigint,
  active_provider_profile_count bigint,
  feedback_count bigint,
  new_feedback_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_profile_role public.profile_role;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role <> 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where profiles.role = 'user'::public.profile_role)::bigint,
    count(*) filter (where profiles.role = 'provider'::public.profile_role)::bigint,
    count(*) filter (where profiles.role = 'admin'::public.profile_role)::bigint,
    (select count(*) from public.provider_profiles)::bigint,
    (
      select count(*)
      from public.provider_profiles
      where provider_profiles.status = 'active'::public.provider_profile_status
    )::bigint,
    (select count(*) from public.platform_feedback)::bigint,
    (
      select count(*)
      from public.platform_feedback
      where platform_feedback.status = 'new'::public.platform_feedback_status
    )::bigint
  from public.profiles;
end;
$$;

revoke all
on function public.get_admin_platform_growth_counts()
from public;

grant execute
on function public.get_admin_platform_growth_counts()
to authenticated;

create or replace function public.get_admin_platform_feedback(
  target_status text default null,
  target_type text default null,
  result_limit integer default 50
)
returns table (
  id uuid,
  type public.platform_feedback_type,
  title text,
  description text,
  current_page_url text,
  reporter_user_id uuid,
  reporter_name text,
  reporter_email text,
  screenshot_path text,
  status public.platform_feedback_status,
  internal_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_profile_role public.profile_role;
  normalized_status text := nullif(lower(btrim(coalesce(target_status, ''))), '');
  normalized_type text := nullif(lower(btrim(coalesce(target_type, ''))), '');
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role <> 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if normalized_status is not null
    and normalized_status not in ('new', 'reviewing', 'planned', 'resolved', 'closed') then
    raise exception 'unsupported_feedback_status' using errcode = '22000';
  end if;

  if normalized_type is not null
    and normalized_type not in ('bug', 'suggestion') then
    raise exception 'unsupported_feedback_type' using errcode = '22000';
  end if;

  return query
  select
    platform_feedback.id,
    platform_feedback.type,
    platform_feedback.title,
    platform_feedback.description,
    platform_feedback.current_page_url,
    platform_feedback.reporter_user_id,
    coalesce(
      nullif(btrim(platform_feedback.reporter_name_snapshot), ''),
      nullif(btrim(profiles.full_name), ''),
      nullif(btrim(platform_feedback.reporter_email_snapshot), ''),
      nullif(btrim(profiles.email), ''),
      'Deleted account'
    ) as reporter_name,
    coalesce(
      nullif(btrim(platform_feedback.reporter_email_snapshot), ''),
      nullif(btrim(profiles.email), '')
    ) as reporter_email,
    platform_feedback.screenshot_path,
    platform_feedback.status,
    platform_feedback.internal_notes,
    platform_feedback.reviewed_by,
    platform_feedback.reviewed_at,
    platform_feedback.created_at,
    platform_feedback.updated_at
  from public.platform_feedback
  left join public.profiles
    on profiles.id = platform_feedback.reporter_user_id
  where (
      normalized_status is null
      or platform_feedback.status =
        normalized_status::public.platform_feedback_status
    )
    and (
      normalized_type is null
      or platform_feedback.type =
        normalized_type::public.platform_feedback_type
    )
  order by
    platform_feedback.created_at desc,
    platform_feedback.id desc
  limit greatest(1, least(coalesce(result_limit, 50), 100));
end;
$$;

revoke all
on function public.get_admin_platform_feedback(text, text, integer)
from public;

grant execute
on function public.get_admin_platform_feedback(text, text, integer)
to authenticated;

create or replace function public.update_platform_feedback(
  target_feedback_id uuid,
  target_status text,
  target_internal_notes text default null
)
returns table (
  id uuid,
  status public.platform_feedback_status,
  internal_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_profile_role public.profile_role;
  normalized_status text := lower(btrim(coalesce(target_status, '')));
  normalized_internal_notes text := nullif(btrim(target_internal_notes), '');
  updated_feedback public.platform_feedback%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.role
  into current_profile_role
  from public.profiles
  where profiles.id = current_user_id;

  if current_profile_role <> 'admin'::public.profile_role then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if normalized_status not in ('new', 'reviewing', 'planned', 'resolved', 'closed') then
    raise exception 'unsupported_feedback_status' using errcode = '22000';
  end if;

  if normalized_internal_notes is not null
    and char_length(normalized_internal_notes) > 3000 then
    raise exception 'internal_notes_too_long' using errcode = '22001';
  end if;

  update public.platform_feedback
  set
    status = normalized_status::public.platform_feedback_status,
    internal_notes = normalized_internal_notes,
    reviewed_by = current_user_id,
    reviewed_at = now()
  where platform_feedback.id = target_feedback_id
  returning *
  into updated_feedback;

  if not found then
    raise exception 'feedback_not_found' using errcode = '42501';
  end if;

  return query
  select
    updated_feedback.id,
    updated_feedback.status,
    updated_feedback.internal_notes,
    updated_feedback.reviewed_by,
    updated_feedback.reviewed_at,
    updated_feedback.updated_at;
end;
$$;

revoke all
on function public.update_platform_feedback(uuid, text, text)
from public;

grant execute
on function public.update_platform_feedback(uuid, text, text)
to authenticated;
