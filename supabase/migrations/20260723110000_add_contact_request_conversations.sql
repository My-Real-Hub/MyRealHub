alter table public.contact_requests
  add column if not exists last_message_at timestamptz,
  add column if not exists provider_last_read_at timestamptz,
  add column if not exists sender_last_read_at timestamptz;

create index if not exists contact_requests_provider_last_message_idx
  on public.contact_requests (provider_profile_id, last_message_at desc);

create index if not exists contact_requests_sender_last_message_idx
  on public.contact_requests (sender_user_id, last_message_at desc);

create table if not exists public.contact_request_messages (
  id uuid primary key default gen_random_uuid(),
  contact_request_id uuid not null references public.contact_requests(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_name_snapshot text not null,
  sender_email_snapshot text,
  sender_avatar_url_snapshot text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint contact_request_messages_body_length_check
    check (
      char_length(btrim(body)) >= 1
      and char_length(btrim(body)) <= 2000
    ),
  constraint contact_request_messages_sender_name_length_check
    check (
      char_length(btrim(sender_name_snapshot)) >= 1
      and char_length(btrim(sender_name_snapshot)) <= 160
    ),
  constraint contact_request_messages_sender_email_length_check
    check (
      sender_email_snapshot is null
      or char_length(sender_email_snapshot) <= 254
    )
);

create index if not exists contact_request_messages_request_created_idx
  on public.contact_request_messages (contact_request_id, created_at);

create index if not exists contact_request_messages_sender_created_idx
  on public.contact_request_messages (sender_user_id, created_at desc);

alter table public.contact_request_messages enable row level security;

revoke all on table public.contact_request_messages from anon;
revoke all on table public.contact_request_messages from authenticated;

grant select on table public.contact_request_messages to authenticated;

drop policy if exists contact_request_messages_select_participant
on public.contact_request_messages;

create policy contact_request_messages_select_participant
on public.contact_request_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.contact_requests
    join public.provider_profiles
      on provider_profiles.id = contact_requests.provider_profile_id
    where contact_requests.id = contact_request_messages.contact_request_id
      and (
        contact_requests.sender_user_id = (select auth.uid())
        or provider_profiles.user_id = (select auth.uid())
      )
  )
);

create or replace view public.contact_request_latest_messages
with (security_invoker = true)
as
select distinct on (contact_request_messages.contact_request_id)
  contact_request_messages.id,
  contact_request_messages.contact_request_id,
  contact_request_messages.sender_user_id,
  contact_request_messages.sender_name_snapshot,
  contact_request_messages.sender_email_snapshot,
  contact_request_messages.sender_avatar_url_snapshot,
  contact_request_messages.body,
  contact_request_messages.created_at
from public.contact_request_messages
order by
  contact_request_messages.contact_request_id,
  contact_request_messages.created_at desc,
  contact_request_messages.id desc;

grant select on table public.contact_request_latest_messages to authenticated;

create or replace function public.set_contact_request_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contact_requests
  set last_message_at = greatest(
    coalesce(contact_requests.last_message_at, new.created_at),
    new.created_at
  )
  where contact_requests.id = new.contact_request_id;

  return new;
end;
$$;

drop trigger if exists contact_request_messages_set_last_message_at
on public.contact_request_messages;

create trigger contact_request_messages_set_last_message_at
after insert on public.contact_request_messages
for each row execute function public.set_contact_request_last_message_at();

create or replace function public.create_contact_request_initial_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_profile record;
begin
  select
    profiles.full_name,
    profiles.email,
    profiles.avatar_url
  into sender_profile
  from public.profiles
  where profiles.id = new.sender_user_id;

  insert into public.contact_request_messages (
    contact_request_id,
    sender_user_id,
    sender_name_snapshot,
    sender_email_snapshot,
    sender_avatar_url_snapshot,
    body,
    created_at
  )
  values (
    new.id,
    new.sender_user_id,
    coalesce(
      nullif(btrim(new.sender_name), ''),
      nullif(btrim(sender_profile.full_name), ''),
      nullif(btrim(sender_profile.email), ''),
      'Sender'
    ),
    nullif(btrim(new.sender_email), ''),
    nullif(btrim(sender_profile.avatar_url), ''),
    new.message,
    new.created_at
  );

  update public.contact_requests
  set sender_last_read_at = coalesce(
      contact_requests.sender_last_read_at,
      new.created_at
    )
  where contact_requests.id = new.id;

  return new;
end;
$$;

drop trigger if exists contact_requests_create_initial_message
on public.contact_requests;

create trigger contact_requests_create_initial_message
after insert on public.contact_requests
for each row execute function public.create_contact_request_initial_message();

insert into public.contact_request_messages (
  contact_request_id,
  sender_user_id,
  sender_name_snapshot,
  sender_email_snapshot,
  sender_avatar_url_snapshot,
  body,
  created_at
)
select
  contact_requests.id,
  contact_requests.sender_user_id,
  coalesce(
    nullif(btrim(contact_requests.sender_name), ''),
    nullif(btrim(sender_profiles.full_name), ''),
    nullif(btrim(sender_profiles.email), ''),
    'Sender'
  ),
  nullif(btrim(contact_requests.sender_email), ''),
  nullif(btrim(sender_profiles.avatar_url), ''),
  contact_requests.message,
  contact_requests.created_at
from public.contact_requests
left join public.profiles as sender_profiles
  on sender_profiles.id = contact_requests.sender_user_id
where not exists (
  select 1
  from public.contact_request_messages
  where contact_request_messages.contact_request_id = contact_requests.id
);

insert into public.contact_request_messages (
  contact_request_id,
  sender_user_id,
  sender_name_snapshot,
  sender_email_snapshot,
  sender_avatar_url_snapshot,
  body,
  created_at
)
select
  contact_requests.id,
  provider_profiles.user_id,
  coalesce(
    nullif(btrim(provider_profiles.business_name), ''),
    nullif(btrim(provider_profiles.display_name), ''),
    nullif(btrim(provider_owner_profiles.full_name), ''),
    'Provider'
  ),
  null,
  coalesce(
    nullif(btrim(provider_profiles.profile_image_url), ''),
    nullif(btrim(provider_owner_profiles.avatar_url), '')
  ),
  contact_requests.provider_response,
  coalesce(
    contact_requests.responded_at,
    contact_requests.rejected_at,
    contact_requests.updated_at,
    contact_requests.created_at
  )
from public.contact_requests
join public.provider_profiles
  on provider_profiles.id = contact_requests.provider_profile_id
left join public.profiles as provider_owner_profiles
  on provider_owner_profiles.id = provider_profiles.user_id
where contact_requests.provider_response is not null
  and btrim(contact_requests.provider_response) <> ''
  and not exists (
    select 1
    from public.contact_request_messages
    where contact_request_messages.contact_request_id = contact_requests.id
      and contact_request_messages.sender_user_id = provider_profiles.user_id
      and contact_request_messages.body = contact_requests.provider_response
  );

update public.contact_requests
set
  last_message_at = contact_messages.last_message_at,
  provider_last_read_at = case
    when contact_requests.status in ('read', 'responded', 'rejected', 'archived')
      then coalesce(
        contact_requests.provider_last_read_at,
        contact_requests.read_at,
        contact_requests.responded_at,
        contact_requests.rejected_at,
        contact_requests.archived_at,
        contact_messages.last_message_at
      )
    else contact_requests.provider_last_read_at
  end,
  sender_last_read_at = coalesce(
    contact_requests.sender_last_read_at,
    contact_requests.created_at
  )
from (
  select
    contact_request_messages.contact_request_id,
    max(contact_request_messages.created_at) as last_message_at
  from public.contact_request_messages
  group by contact_request_messages.contact_request_id
) as contact_messages
where contact_requests.id = contact_messages.contact_request_id;

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
  and last_message_at is null
  and provider_last_read_at is null
  and sender_last_read_at is null
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

create or replace function public.mark_contact_request_conversation_read(
  target_contact_request_id uuid
)
returns table (
  id uuid,
  status public.contact_request_status,
  read_at timestamptz,
  last_message_at timestamptz,
  provider_last_read_at timestamptz,
  sender_last_read_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record record;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select
    contact_requests.*,
    provider_profiles.user_id as provider_user_id
  into request_record
  from public.contact_requests
  join public.provider_profiles
    on provider_profiles.id = contact_requests.provider_profile_id
  where contact_requests.id = target_contact_request_id
  for update of contact_requests;

  if not found then
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;

  if request_record.provider_user_id = current_user_id then
    update public.contact_requests
    set
      status = case
        when contact_requests.status = 'new' then 'read'::public.contact_request_status
        else contact_requests.status
      end,
      read_at = coalesce(contact_requests.read_at, now()),
      provider_last_read_at = now()
    where contact_requests.id = target_contact_request_id;
  elsif request_record.sender_user_id = current_user_id then
    update public.contact_requests
    set sender_last_read_at = now()
    where contact_requests.id = target_contact_request_id;
  else
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;

  return query
  select
    contact_requests.id,
    contact_requests.status,
    contact_requests.read_at,
    contact_requests.last_message_at,
    contact_requests.provider_last_read_at,
    contact_requests.sender_last_read_at,
    contact_requests.updated_at
  from public.contact_requests
  where contact_requests.id = target_contact_request_id;
end;
$$;

revoke all
on function public.mark_contact_request_conversation_read(uuid)
from public;

grant execute
on function public.mark_contact_request_conversation_read(uuid)
to authenticated;

create or replace function public.send_contact_request_message(
  target_contact_request_id uuid,
  message_body text
)
returns table (
  id uuid,
  contact_request_id uuid,
  sender_user_id uuid,
  sender_name_snapshot text,
  sender_email_snapshot text,
  sender_avatar_url_snapshot text,
  body text,
  created_at timestamptz,
  contact_status public.contact_request_status,
  contact_read_at timestamptz,
  contact_responded_at timestamptz,
  contact_rejected_at timestamptz,
  contact_archived_at timestamptz,
  contact_last_message_at timestamptz,
  contact_provider_last_read_at timestamptz,
  contact_sender_last_read_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_body text := nullif(btrim(message_body), '');
  profile_record record;
  request_record record;
  inserted_message public.contact_request_messages%rowtype;
  updated_request public.contact_requests%rowtype;
  message_sender_name text;
  message_sender_email text;
  message_sender_avatar_url text;
  is_provider_sender boolean := false;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if normalized_body is null then
    raise exception 'message_required' using errcode = '23514';
  end if;

  if char_length(normalized_body) > 2000 then
    raise exception 'message_too_long' using errcode = '22001';
  end if;

  select
    profiles.full_name,
    profiles.email,
    profiles.avatar_url
  into profile_record
  from public.profiles
  where profiles.id = current_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = '42501';
  end if;

  select
    contact_requests.*,
    provider_profiles.user_id as provider_user_id,
    provider_profiles.business_name as provider_business_name,
    provider_profiles.display_name as provider_display_name,
    provider_profiles.profile_image_url as provider_profile_image_url
  into request_record
  from public.contact_requests
  join public.provider_profiles
    on provider_profiles.id = contact_requests.provider_profile_id
  where contact_requests.id = target_contact_request_id
  for update of contact_requests;

  if not found then
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;

  if request_record.status = 'archived' then
    raise exception 'contact_request_archived' using errcode = '42501';
  end if;

  if request_record.provider_user_id = current_user_id then
    is_provider_sender := true;
    message_sender_name := coalesce(
      nullif(btrim(request_record.provider_business_name), ''),
      nullif(btrim(request_record.provider_display_name), ''),
      nullif(btrim(profile_record.full_name), ''),
      'Provider'
    );
    message_sender_email := null;
    message_sender_avatar_url := coalesce(
      nullif(btrim(request_record.provider_profile_image_url), ''),
      nullif(btrim(profile_record.avatar_url), '')
    );
  elsif request_record.sender_user_id = current_user_id then
    message_sender_name := coalesce(
      nullif(btrim(profile_record.full_name), ''),
      nullif(btrim(request_record.sender_name), ''),
      nullif(btrim(profile_record.email), ''),
      'Sender'
    );
    message_sender_email := coalesce(
      nullif(btrim(profile_record.email), ''),
      nullif(btrim(request_record.sender_email), '')
    );
    message_sender_avatar_url := nullif(btrim(profile_record.avatar_url), '');
  else
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;

  insert into public.contact_request_messages (
    contact_request_id,
    sender_user_id,
    sender_name_snapshot,
    sender_email_snapshot,
    sender_avatar_url_snapshot,
    body
  )
  values (
    target_contact_request_id,
    current_user_id,
    message_sender_name,
    message_sender_email,
    message_sender_avatar_url,
    normalized_body
  )
  returning * into inserted_message;

  update public.contact_requests
  set
    status = case
      when is_provider_sender then 'responded'::public.contact_request_status
      else 'new'::public.contact_request_status
    end,
    provider_response = case
      when is_provider_sender then normalized_body
      else contact_requests.provider_response
    end,
    read_at = case
      when is_provider_sender then now()
      else contact_requests.read_at
    end,
    responded_at = case
      when is_provider_sender then now()
      else contact_requests.responded_at
    end,
    rejected_at = null,
    archived_at = null,
    provider_last_read_at = case
      when is_provider_sender then now()
      else contact_requests.provider_last_read_at
    end,
    sender_last_read_at = case
      when is_provider_sender then contact_requests.sender_last_read_at
      else now()
    end
  where contact_requests.id = target_contact_request_id
  returning * into updated_request;

  return query
  select
    inserted_message.id,
    inserted_message.contact_request_id,
    inserted_message.sender_user_id,
    inserted_message.sender_name_snapshot,
    inserted_message.sender_email_snapshot,
    inserted_message.sender_avatar_url_snapshot,
    inserted_message.body,
    inserted_message.created_at,
    updated_request.status,
    updated_request.read_at,
    updated_request.responded_at,
    updated_request.rejected_at,
    updated_request.archived_at,
    updated_request.last_message_at,
    updated_request.provider_last_read_at,
    updated_request.sender_last_read_at;
end;
$$;

revoke all
on function public.send_contact_request_message(uuid, text)
from public;

grant execute
on function public.send_contact_request_message(uuid, text)
to authenticated;

create or replace function public.update_contact_request_conversation_status(
  target_contact_request_id uuid,
  target_status public.contact_request_status,
  target_provider_note text default null
)
returns table (
  id uuid,
  status public.contact_request_status,
  read_at timestamptz,
  responded_at timestamptz,
  rejected_at timestamptz,
  archived_at timestamptz,
  last_message_at timestamptz,
  provider_last_read_at timestamptz,
  sender_last_read_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_note text := nullif(btrim(target_provider_note), '');
  profile_record record;
  request_record record;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if target_status not in ('rejected', 'archived') then
    raise exception 'unsupported_status' using errcode = '22000';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'message_too_long' using errcode = '22001';
  end if;

  select
    contact_requests.*,
    provider_profiles.user_id as provider_user_id,
    provider_profiles.business_name as provider_business_name,
    provider_profiles.display_name as provider_display_name,
    provider_profiles.profile_image_url as provider_profile_image_url
  into request_record
  from public.contact_requests
  join public.provider_profiles
    on provider_profiles.id = contact_requests.provider_profile_id
  where contact_requests.id = target_contact_request_id
  for update of contact_requests;

  if not found or request_record.provider_user_id <> current_user_id then
    raise exception 'contact_request_not_found' using errcode = '42501';
  end if;

  select
    profiles.full_name,
    profiles.avatar_url
  into profile_record
  from public.profiles
  where profiles.id = current_user_id;

  if target_status = 'rejected' and normalized_note is not null then
    insert into public.contact_request_messages (
      contact_request_id,
      sender_user_id,
      sender_name_snapshot,
      sender_email_snapshot,
      sender_avatar_url_snapshot,
      body
    )
    values (
      target_contact_request_id,
      current_user_id,
      coalesce(
        nullif(btrim(request_record.provider_business_name), ''),
        nullif(btrim(request_record.provider_display_name), ''),
        nullif(btrim(profile_record.full_name), ''),
        'Provider'
      ),
      null,
      coalesce(
        nullif(btrim(request_record.provider_profile_image_url), ''),
        nullif(btrim(profile_record.avatar_url), '')
      ),
      normalized_note
    );
  end if;

  update public.contact_requests
  set
    status = target_status,
    provider_response = case
      when target_status = 'rejected' then normalized_note
      else contact_requests.provider_response
    end,
    read_at = coalesce(contact_requests.read_at, now()),
    responded_at = case
      when target_status = 'rejected' then null
      else contact_requests.responded_at
    end,
    rejected_at = case
      when target_status = 'rejected' then now()
      else contact_requests.rejected_at
    end,
    archived_at = case
      when target_status = 'archived' then now()
      else null
    end,
    provider_last_read_at = now()
  where contact_requests.id = target_contact_request_id;

  return query
  select
    contact_requests.id,
    contact_requests.status,
    contact_requests.read_at,
    contact_requests.responded_at,
    contact_requests.rejected_at,
    contact_requests.archived_at,
    contact_requests.last_message_at,
    contact_requests.provider_last_read_at,
    contact_requests.sender_last_read_at,
    contact_requests.updated_at
  from public.contact_requests
  where contact_requests.id = target_contact_request_id;
end;
$$;

revoke all
on function public.update_contact_request_conversation_status(
  uuid,
  public.contact_request_status,
  text
)
from public;

grant execute
on function public.update_contact_request_conversation_status(
  uuid,
  public.contact_request_status,
  text
)
to authenticated;
