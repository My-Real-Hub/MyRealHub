update public.specialties
set description = 'Repairs before listing a property.'
where slug = 'pre-listing-repairs'
  and description like 'Repair % before listing a property.';

update public.provider_profiles
set bio = 'Renovations, repairs, and pre-listing improvements for homeowners.'
where id = '10000000-0000-4000-8000-000000000007'
  and bio like 'Renovations, repairs, and pre-listing improvement% for homeowners.';
