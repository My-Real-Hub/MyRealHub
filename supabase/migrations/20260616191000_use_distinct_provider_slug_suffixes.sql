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
  right(replace(user_id::text, '-', ''), 12)
);
