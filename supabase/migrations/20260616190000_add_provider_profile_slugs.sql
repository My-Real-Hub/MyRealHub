alter table public.provider_profiles
  add column if not exists slug text;

update public.provider_profiles
set slug = concat(
  coalesce(
    nullif(
      trim(
        both '-'
        from regexp_replace(
          regexp_replace(
            lower(
              coalesce(
                nullif(business_name, ''),
                nullif(display_name, ''),
                'provider'
              )
            ),
            '&',
            ' and ',
            'g'
          ),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'provider'
  ),
  '-',
  left(replace(user_id::text, '-', ''), 12)
)
where slug is null or slug = '';

alter table public.provider_profiles
  alter column slug set not null;

create unique index if not exists provider_profiles_slug_key
  on public.provider_profiles (slug);
