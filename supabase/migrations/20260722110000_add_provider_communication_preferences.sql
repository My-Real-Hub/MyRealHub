do $$
begin
  create type public.contact_delivery_method as enum (
    'in_app',
    'email'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.contact_email_delivery_status as enum (
    'not_requested',
    'pending',
    'sent',
    'failed'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.provider_profiles
  add column if not exists accept_new_inquiries boolean not null default true,
  add column if not exists contact_delivery_method public.contact_delivery_method not null default 'in_app',
  add column if not exists new_message_email_enabled boolean not null default false;

alter table public.provider_profiles
  drop constraint if exists provider_profiles_inquiry_delivery_required_check;

alter table public.provider_profiles
  add constraint provider_profiles_inquiry_delivery_required_check
  check (
    accept_new_inquiries = false
    or contact_delivery_method is not null
  );

create index if not exists provider_profiles_inquiries_status_idx
  on public.provider_profiles (status, accept_new_inquiries);

create table if not exists public.provider_notification_preferences (
  provider_profile_id uuid primary key
    references public.provider_profiles(id) on delete cascade,
  notification_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_notification_preferences_email_length_check
    check (
      notification_email is null
      or (
        char_length(btrim(notification_email)) >= 3
        and char_length(btrim(notification_email)) <= 254
      )
    )
);

create trigger provider_notification_preferences_set_updated_at
before update on public.provider_notification_preferences
for each row execute function public.set_updated_at();

insert into public.provider_notification_preferences (
  provider_profile_id,
  notification_email
)
select
  provider_profiles.id,
  lower(
    nullif(
      btrim(coalesce(provider_profiles.email, profiles.email, '')),
      ''
    )
  )
from public.provider_profiles
left join public.profiles
  on profiles.id = provider_profiles.user_id
on conflict (provider_profile_id) do nothing;

alter table public.provider_notification_preferences enable row level security;

revoke all
on table public.provider_notification_preferences
from anon, authenticated;

grant select, insert, update
on table public.provider_notification_preferences
to authenticated;

drop policy if exists provider_notification_preferences_select_own
on public.provider_notification_preferences;
create policy provider_notification_preferences_select_own
on public.provider_notification_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_notification_preferences.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

drop policy if exists provider_notification_preferences_insert_own
on public.provider_notification_preferences;
create policy provider_notification_preferences_insert_own
on public.provider_notification_preferences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_notification_preferences.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

drop policy if exists provider_notification_preferences_update_own
on public.provider_notification_preferences;
create policy provider_notification_preferences_update_own
on public.provider_notification_preferences
for update
to authenticated
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_notification_preferences.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id =
      provider_notification_preferences.provider_profile_id
      and provider_profiles.user_id = (select auth.uid())
  )
);

drop policy if exists provider_notification_preferences_admin_all
on public.provider_notification_preferences;
create policy provider_notification_preferences_admin_all
on public.provider_notification_preferences
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

alter table public.contact_requests
  add column if not exists delivery_method public.contact_delivery_method not null default 'in_app',
  add column if not exists email_delivery_status public.contact_email_delivery_status not null default 'not_requested',
  add column if not exists email_delivery_error text,
  add column if not exists email_delivered_at timestamptz;

alter table public.contact_requests
  drop constraint if exists contact_requests_email_delivery_error_length_check;

alter table public.contact_requests
  add constraint contact_requests_email_delivery_error_length_check
  check (
    email_delivery_error is null
    or char_length(email_delivery_error) <= 500
  );

create index if not exists contact_requests_delivery_status_idx
  on public.contact_requests (delivery_method, email_delivery_status);

drop policy if exists contact_requests_insert_active_provider
on public.contact_requests;

create policy contact_requests_insert_active_provider
on public.contact_requests
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and status = 'new'
  and provider_response is null
  and read_at is null
  and responded_at is null
  and rejected_at is null
  and archived_at is null
  and email_delivery_error is null
  and email_delivered_at is null
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('user', 'provider')
  )
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = contact_requests.provider_profile_id
      and provider_profiles.status = 'active'
      and provider_profiles.accept_new_inquiries = true
      and provider_profiles.user_id <> (select auth.uid())
      and provider_profiles.contact_delivery_method =
        contact_requests.delivery_method
      and (
        (
          contact_requests.delivery_method = 'in_app'
          and contact_requests.email_delivery_status in (
            'not_requested',
            'pending'
          )
        )
        or (
          contact_requests.delivery_method = 'email'
          and contact_requests.email_delivery_status = 'pending'
        )
      )
  )
);

create or replace function public.update_provider_communication_preferences(
  target_provider_profile_id uuid,
  target_accept_new_inquiries boolean,
  target_contact_delivery_method public.contact_delivery_method,
  target_new_message_email_enabled boolean,
  target_notification_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_notification_email text :=
    lower(nullif(btrim(target_notification_email), ''));
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = current_user_id
      and profiles.role = 'provider'
  ) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = target_provider_profile_id
      and provider_profiles.user_id = current_user_id
  ) then
    raise exception 'provider_profile_not_found' using errcode = '42501';
  end if;

  if normalized_notification_email is not null
    and (
      char_length(normalized_notification_email) > 254
      or normalized_notification_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
  then
    raise exception 'invalid_notification_email' using errcode = '22000';
  end if;

  if coalesce(target_accept_new_inquiries, false)
    and target_contact_delivery_method is null
  then
    raise exception 'delivery_method_required' using errcode = '23514';
  end if;

  if coalesce(target_accept_new_inquiries, false)
    and target_contact_delivery_method = 'email'
    and normalized_notification_email is null
  then
    raise exception 'notification_email_required' using errcode = '23514';
  end if;

  if coalesce(target_new_message_email_enabled, false)
    and normalized_notification_email is null
  then
    raise exception 'notification_email_required' using errcode = '23514';
  end if;

  update public.provider_profiles
  set
    accept_new_inquiries = coalesce(target_accept_new_inquiries, false),
    contact_delivery_method =
      coalesce(target_contact_delivery_method, 'in_app'),
    new_message_email_enabled =
      coalesce(target_new_message_email_enabled, false)
  where provider_profiles.id = target_provider_profile_id
    and provider_profiles.user_id = current_user_id;

  insert into public.provider_notification_preferences (
    provider_profile_id,
    notification_email
  )
  values (
    target_provider_profile_id,
    normalized_notification_email
  )
  on conflict (provider_profile_id) do update
  set notification_email = excluded.notification_email;
end;
$$;

revoke all
on function public.update_provider_communication_preferences(
  uuid,
  boolean,
  public.contact_delivery_method,
  boolean,
  text
)
from public;

grant execute
on function public.update_provider_communication_preferences(
  uuid,
  boolean,
  public.contact_delivery_method,
  boolean,
  text
)
to authenticated;

create or replace function public.record_contact_request_email_delivery(
  target_contact_request_id uuid,
  target_email_delivery_status public.contact_email_delivery_status,
  target_email_delivery_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  sanitized_error text :=
    nullif(left(btrim(coalesce(target_email_delivery_error, '')), 500), '');
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if target_email_delivery_status not in ('not_requested', 'sent', 'failed') then
    raise exception 'invalid_email_delivery_status' using errcode = '22000';
  end if;

  update public.contact_requests
  set
    email_delivery_status = target_email_delivery_status,
    email_delivery_error = case
      when target_email_delivery_status = 'failed'
        then coalesce(sanitized_error, 'Email delivery failed.')
      else null
    end,
    email_delivered_at = case
      when target_email_delivery_status = 'sent' then now()
      else null
    end
  where contact_requests.id = target_contact_request_id
    and (
      contact_requests.sender_user_id = current_user_id
      or exists (
        select 1
        from public.provider_profiles
        where provider_profiles.id = contact_requests.provider_profile_id
          and provider_profiles.user_id = current_user_id
      )
    );

  if not found then
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;
end;
$$;

revoke all
on function public.record_contact_request_email_delivery(
  uuid,
  public.contact_email_delivery_status,
  text
)
from public;

grant execute
on function public.record_contact_request_email_delivery(
  uuid,
  public.contact_email_delivery_status,
  text
)
to authenticated;
