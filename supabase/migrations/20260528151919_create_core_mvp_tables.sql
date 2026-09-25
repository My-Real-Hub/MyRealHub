create extension if not exists "pgcrypto";

create type public.profile_role as enum (
  'user',
  'provider',
  'admin'
);

create type public.provider_profile_status as enum (
  'draft',
  'pending_approval',
  'active',
  'inactive',
  'rejected'
);

create type public.contact_request_status as enum (
  'new',
  'read',
  'responded',
  'archived'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.profile_role not null default 'user',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  business_name text,
  display_name text,
  bio text,
  phone text,
  email text,
  website_url text,
  city text,
  province_state text,
  country text default 'Canada',
  service_area text,
  years_experience integer,
  license_number text,
  profile_image_url text,
  status public.provider_profile_status not null default 'draft',
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_profiles_user_id_key unique (user_id),
  constraint provider_profiles_years_experience_check
    check (years_experience is null or years_experience >= 0)
);

create table public.provider_languages (
  provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  language_id uuid not null references public.languages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider_profile_id, language_id)
);

create table public.provider_specialties (
  provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider_profile_id, specialty_id)
);

create table public.saved_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_providers_user_provider_profile_key
    unique (user_id, provider_profile_id)
);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  sender_email text not null,
  sender_phone text,
  message text not null,
  status public.contact_request_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger languages_set_updated_at
before update on public.languages
for each row execute function public.set_updated_at();

create trigger specialties_set_updated_at
before update on public.specialties
for each row execute function public.set_updated_at();

create trigger provider_profiles_set_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at();

create trigger contact_requests_set_updated_at
before update on public.contact_requests
for each row execute function public.set_updated_at();

create index profiles_role_idx
  on public.profiles (role);

create index provider_profiles_category_id_idx
  on public.provider_profiles (category_id);

create index provider_profiles_status_idx
  on public.provider_profiles (status);

create index provider_profiles_city_idx
  on public.provider_profiles (city);

create index provider_profiles_province_state_idx
  on public.provider_profiles (province_state);

create index provider_profiles_status_city_idx
  on public.provider_profiles (status, city);

create index provider_profiles_status_category_id_idx
  on public.provider_profiles (status, category_id);

create index specialties_category_id_idx
  on public.specialties (category_id);

create index provider_languages_language_id_idx
  on public.provider_languages (language_id);

create index provider_specialties_specialty_id_idx
  on public.provider_specialties (specialty_id);

create index saved_providers_provider_profile_id_idx
  on public.saved_providers (provider_profile_id);

create index contact_requests_provider_profile_id_idx
  on public.contact_requests (provider_profile_id);

create index contact_requests_sender_user_id_idx
  on public.contact_requests (sender_user_id);

create index contact_requests_status_idx
  on public.contact_requests (status);
