-- Temporary test data for local and preview development.
-- All test users share this password: TestPassword123!

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed_users.id::uuid,
  'authenticated',
  'authenticated',
  seed_users.email,
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', seed_users.full_name),
  now(),
  now(),
  false,
  false
from (
  values
    ('00000000-0000-4000-8000-000000000001', 'Ava Chen', 'ava.chen@example.com'),
    ('00000000-0000-4000-8000-000000000002', 'Marcus Bennett', 'marcus.bennett@example.com'),
    ('00000000-0000-4000-8000-000000000003', 'Priya Shah', 'priya.shah@example.com'),
    ('00000000-0000-4000-8000-000000000004', 'Daniel Moreau', 'daniel.moreau@example.com'),
    ('00000000-0000-4000-8000-000000000005', 'Sofia Rivera', 'sofia.rivera@example.com'),
    ('00000000-0000-4000-8000-000000000006', 'Noah Thompson', 'noah.thompson@example.com'),
    ('00000000-0000-4000-8000-000000000007', 'Leila Haddad', 'leila.haddad@example.com'),
    ('00000000-0000-4000-8000-000000000008', 'Ethan Brooks', 'ethan.brooks@example.com'),
    ('00000000-0000-4000-8000-000000000009', 'Grace Kim', 'grace.kim@example.com'),
    ('00000000-0000-4000-8000-000000000010', 'Omar Malik', 'omar.malik@example.com'),
    ('00000000-0000-4000-8000-000000000011', 'Maya Singh', 'maya.singh@example.com'),
    ('00000000-0000-4000-8000-000000000012', 'Liam Walker', 'liam.walker@example.com'),
    ('00000000-0000-4000-8000-000000000013', 'Hannah Lee', 'hannah.lee@example.com'),
    ('00000000-0000-4000-8000-000000000014', 'Jacob Wilson', 'jacob.wilson@example.com'),
    ('00000000-0000-4000-8000-000000000015', 'Admin User', 'admin@example.com')
) as seed_users(id, full_name, email)
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change = excluded.email_change,
  email_change_token_new = excluded.email_change_token_new,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  seed_identities.identity_id::uuid,
  seed_identities.user_id,
  seed_identities.user_id::uuid,
  jsonb_build_object(
    'sub', seed_identities.user_id,
    'email', seed_identities.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (
  values
    ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'ava.chen@example.com'),
    ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'marcus.bennett@example.com'),
    ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'priya.shah@example.com'),
    ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'daniel.moreau@example.com'),
    ('50000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'sofia.rivera@example.com'),
    ('50000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 'noah.thompson@example.com'),
    ('50000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', 'leila.haddad@example.com'),
    ('50000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', 'ethan.brooks@example.com'),
    ('50000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000009', 'grace.kim@example.com'),
    ('50000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000010', 'omar.malik@example.com'),
    ('50000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', 'maya.singh@example.com'),
    ('50000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000012', 'liam.walker@example.com'),
    ('50000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000013', 'hannah.lee@example.com'),
    ('50000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000014', 'jacob.wilson@example.com'),
    ('50000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000015', 'admin@example.com')
) as seed_identities(identity_id, user_id, email)
on conflict (provider_id, provider) do update
set
  identity_data = excluded.identity_data,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

insert into public.profiles (id, full_name, email, role, avatar_url)
values
  ('00000000-0000-4000-8000-000000000001', 'Ava Chen', 'ava.chen@example.com', 'provider', 'https://example.com/avatars/ava-chen.jpg'),
  ('00000000-0000-4000-8000-000000000002', 'Marcus Bennett', 'marcus.bennett@example.com', 'provider', 'https://example.com/avatars/marcus-bennett.jpg'),
  ('00000000-0000-4000-8000-000000000003', 'Priya Shah', 'priya.shah@example.com', 'provider', 'https://example.com/avatars/priya-shah.jpg'),
  ('00000000-0000-4000-8000-000000000004', 'Daniel Moreau', 'daniel.moreau@example.com', 'provider', 'https://example.com/avatars/daniel-moreau.jpg'),
  ('00000000-0000-4000-8000-000000000005', 'Sofia Rivera', 'sofia.rivera@example.com', 'provider', 'https://example.com/avatars/sofia-rivera.jpg'),
  ('00000000-0000-4000-8000-000000000006', 'Noah Thompson', 'noah.thompson@example.com', 'provider', 'https://example.com/avatars/noah-thompson.jpg'),
  ('00000000-0000-4000-8000-000000000007', 'Leila Haddad', 'leila.haddad@example.com', 'provider', 'https://example.com/avatars/leila-haddad.jpg'),
  ('00000000-0000-4000-8000-000000000008', 'Ethan Brooks', 'ethan.brooks@example.com', 'provider', 'https://example.com/avatars/ethan-brooks.jpg'),
  ('00000000-0000-4000-8000-000000000009', 'Grace Kim', 'grace.kim@example.com', 'provider', 'https://example.com/avatars/grace-kim.jpg'),
  ('00000000-0000-4000-8000-000000000010', 'Omar Malik', 'omar.malik@example.com', 'provider', 'https://example.com/avatars/omar-malik.jpg'),
  ('00000000-0000-4000-8000-000000000011', 'Maya Singh', 'maya.singh@example.com', 'provider', 'https://example.com/avatars/maya-singh.jpg'),
  ('00000000-0000-4000-8000-000000000012', 'Liam Walker', 'liam.walker@example.com', 'provider', 'https://example.com/avatars/liam-walker.jpg'),
  ('00000000-0000-4000-8000-000000000013', 'Hannah Lee', 'hannah.lee@example.com', 'user', 'https://example.com/avatars/hannah-lee.jpg'),
  ('00000000-0000-4000-8000-000000000014', 'Jacob Wilson', 'jacob.wilson@example.com', 'user', 'https://example.com/avatars/jacob-wilson.jpg'),
  ('00000000-0000-4000-8000-000000000015', 'Admin User', 'admin@example.com', 'admin', 'https://example.com/avatars/admin-user.jpg')
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  avatar_url = excluded.avatar_url;

insert into public.categories (name, slug, description)
values
  ('Real Estate Agent', 'real-estate-agent', 'Residential, commercial, and investment real estate representation.'),
  ('Mortgage Broker', 'mortgage-broker', 'Mortgage advice, rate comparison, and financing support.'),
  ('Home Inspector', 'home-inspector', 'Property inspection services for buyers, sellers, and owners.'),
  ('Real Estate Lawyer', 'real-estate-lawyer', 'Legal support for real estate purchases, sales, and financing.'),
  ('Appraiser', 'appraiser', 'Real estate valuation and appraisal services.'),
  ('Insurance Broker', 'insurance-broker', 'Home, property, and real estate insurance advice.'),
  ('Contractor', 'contractor', 'Renovation, repair, and construction services.'),
  ('Real Estate Photographer', 'real-estate-photographer', 'Listing photography, video, and media services.'),
  ('Home Stager', 'home-stager', 'Home staging and presentation services for listings.'),
  ('Property Manager', 'property-manager', 'Rental, tenant, and property operations management.'),
  ('Mover', 'mover', 'Moving and relocation services.'),
  ('Cleaner', 'cleaner', 'Residential and move-in or move-out cleaning services.')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description;

insert into public.languages (name, slug)
values
  ('English', 'english'),
  ('French', 'french'),
  ('Arabic', 'arabic'),
  ('Spanish', 'spanish'),
  ('Mandarin', 'mandarin'),
  ('Cantonese', 'cantonese'),
  ('Hindi', 'hindi'),
  ('Punjabi', 'punjabi'),
  ('Urdu', 'urdu'),
  ('Portuguese', 'portuguese'),
  ('Italian', 'italian')
on conflict (slug) do update
set name = excluded.name;

insert into public.specialties (category_id, name, slug, description)
select
  categories.id,
  seed_specialties.name,
  seed_specialties.slug,
  seed_specialties.description
from (
  values
    ('real-estate-agent', 'First-time buyers', 'first-time-buyers', 'Guidance for buyers purchasing their first home.'),
    ('real-estate-agent', 'Condos', 'condos', 'Condo buying, selling, and market advice.'),
    ('real-estate-agent', 'Luxury homes', 'luxury-homes', 'High-end residential real estate services.'),
    ('real-estate-agent', 'Investment properties', 'investment-properties', 'Support for rental and income property transactions.'),
    ('real-estate-agent', 'Commercial real estate', 'commercial-real-estate', 'Commercial purchase, sale, and lease support.'),
    ('mortgage-broker', 'First-time buyer mortgages', 'first-time-buyer-mortgages', 'Mortgage guidance for first-time home buyers.'),
    ('mortgage-broker', 'Refinancing', 'refinancing', 'Mortgage refinancing and renewal support.'),
    ('mortgage-broker', 'Self-employed mortgages', 'self-employed-mortgages', 'Financing support for self-employed borrowers.'),
    ('mortgage-broker', 'Investment property financing', 'investment-property-financing', 'Financing for rental and investment properties.'),
    ('home-inspector', 'Pre-purchase inspection', 'pre-purchase-inspection', 'Inspection before a property purchase closes.'),
    ('home-inspector', 'New construction inspection', 'new-construction-inspection', 'Inspection for newly built homes.'),
    ('home-inspector', 'Condo inspection', 'condo-inspection', 'Inspection services focused on condo units.'),
    ('appraiser', 'Residential appraisals', 'residential-appraisals', 'Valuations for houses, condos, and small residential properties.'),
    ('insurance-broker', 'Home insurance', 'home-insurance', 'Insurance guidance for homeowners and buyers.'),
    ('contractor', 'Renovations', 'renovations', 'Renovation planning, repair, and improvement services.')
) as seed_specialties(category_slug, name, slug, description)
join public.categories
  on categories.slug = seed_specialties.category_slug
on conflict (slug) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description;

insert into public.provider_profiles (
  id,
  user_id,
  category_id,
  business_name,
  display_name,
  bio,
  phone,
  email,
  website_url,
  city,
  province_state,
  country,
  service_area,
  years_experience,
  license_number,
  profile_image_url,
  status,
  rejection_reason,
  submitted_at,
  approved_at
)
select
  seed_providers.id::uuid,
  seed_providers.user_id::uuid,
  categories.id,
  seed_providers.business_name,
  seed_providers.display_name,
  seed_providers.bio,
  seed_providers.phone,
  seed_providers.email,
  seed_providers.website_url,
  seed_providers.city,
  seed_providers.province_state,
  seed_providers.country,
  seed_providers.service_area,
  seed_providers.years_experience,
  seed_providers.license_number,
  seed_providers.profile_image_url,
  seed_providers.status::public.provider_profile_status,
  seed_providers.rejection_reason,
  seed_providers.submitted_at::timestamptz,
  seed_providers.approved_at::timestamptz
from (
  values
    ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'real-estate-agent', 'Northline Realty Group', 'Ava Chen', 'Buyer and seller representation with a focus on practical guidance for Toronto families.', '416-555-0101', 'ava@northlinerealty.example.com', 'https://northlinerealty.example.com', 'Toronto', 'Ontario', 'Canada', 'Toronto, North York, Scarborough', 9, 'REA-1001', 'https://example.com/providers/northline-realty.jpg', 'active', null, '2026-04-01 10:00:00+00', '2026-04-03 15:00:00+00'),
    ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'mortgage-broker', 'ClearPath Mortgage', 'Marcus Bennett', 'Mortgage pre-approval, refinancing, and financing strategy for buyers across the GTA.', '905-555-0102', 'marcus@clearpathmortgage.example.com', 'https://clearpathmortgage.example.com', 'Mississauga', 'Ontario', 'Canada', 'Mississauga, Brampton, Oakville', 12, 'MB-2048', 'https://example.com/providers/clearpath-mortgage.jpg', 'active', null, '2026-04-02 09:30:00+00', '2026-04-04 14:00:00+00'),
    ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'home-inspector', 'Keystone Home Inspections', 'Priya Shah', 'Detailed home and condo inspections with clear reports for buyers and sellers.', '289-555-0103', 'priya@keystoneinspections.example.com', 'https://keystoneinspections.example.com', 'Hamilton', 'Ontario', 'Canada', 'Hamilton, Burlington, Stoney Creek', 7, 'HI-3188', 'https://example.com/providers/keystone-inspections.jpg', 'active', null, '2026-04-05 11:00:00+00', '2026-04-06 16:15:00+00'),
    ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'real-estate-lawyer', 'Moreau Legal', 'Daniel Moreau', 'Real estate closing support for purchases, sales, and mortgage refinancing.', '613-555-0104', 'daniel@moreaulegal.example.com', 'https://moreaulegal.example.com', 'Ottawa', 'Ontario', 'Canada', 'Ottawa, Kanata, Orleans', 15, 'LSO-77891', 'https://example.com/providers/moreau-legal.jpg', 'active', null, '2026-04-07 13:00:00+00', '2026-04-08 17:00:00+00'),
    ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'appraiser', 'Rivera Valuations', 'Sofia Rivera', 'Residential appraisals for buyers, lenders, estate planning, and private sales.', '416-555-0105', 'sofia@riveravaluations.example.com', 'https://riveravaluations.example.com', 'Vaughan', 'Ontario', 'Canada', 'Vaughan, Richmond Hill, Markham', 10, 'AACI-4521', 'https://example.com/providers/rivera-valuations.jpg', 'pending_approval', null, '2026-05-10 12:00:00+00', null),
    ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 'insurance-broker', 'Harbour Shield Insurance', 'Noah Thompson', 'Home, condo, landlord, and rental property insurance advice.', '647-555-0106', 'noah@harbourshield.example.com', 'https://harbourshield.example.com', 'Toronto', 'Ontario', 'Canada', 'Ontario-wide remote service', 6, 'IB-6602', 'https://example.com/providers/harbour-shield.jpg', 'draft', null, null, null),
    ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', 'contractor', 'Haddad Home Works', 'Leila Haddad', 'Renovations, repairs, and pre-listing improvement projects for homeowners.', '416-555-0107', 'leila@haddadhomeworks.example.com', 'https://haddadhomeworks.example.com', 'Scarborough', 'Ontario', 'Canada', 'Toronto East, Pickering, Ajax', 11, 'GC-1940', 'https://example.com/providers/haddad-home-works.jpg', 'active', null, '2026-04-12 10:20:00+00', '2026-04-13 18:00:00+00'),
    ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', 'real-estate-photographer', 'Brooks Listing Media', 'Ethan Brooks', 'Listing photography, walkthrough video, floor plans, and social media clips.', '905-555-0108', 'ethan@brooksmedia.example.com', 'https://brooksmedia.example.com', 'Burlington', 'Ontario', 'Canada', 'Burlington, Oakville, Hamilton', 5, null, 'https://example.com/providers/brooks-listing-media.jpg', 'inactive', null, '2026-04-09 14:00:00+00', '2026-04-11 13:45:00+00'),
    ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000009', 'home-stager', 'Graceful Spaces Staging', 'Grace Kim', 'Occupied and vacant staging packages for sellers and listing agents.', '437-555-0109', 'grace@gracefulspaces.example.com', 'https://gracefulspaces.example.com', 'Markham', 'Ontario', 'Canada', 'Markham, Richmond Hill, Stouffville', 8, null, 'https://example.com/providers/graceful-spaces.jpg', 'rejected', 'Business insurance document was missing from the submission.', '2026-05-08 09:00:00+00', null),
    ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000010', 'property-manager', 'Malik Property Care', 'Omar Malik', 'Residential rental management for small landlords and investor portfolios.', '647-555-0110', 'omar@malikpropertycare.example.com', 'https://malikpropertycare.example.com', 'Brampton', 'Ontario', 'Canada', 'Brampton, Mississauga, Caledon', 13, 'PM-4207', 'https://example.com/providers/malik-property-care.jpg', 'active', null, '2026-04-15 15:00:00+00', '2026-04-16 12:00:00+00'),
    ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', 'mover', 'Singh Smooth Moves', 'Maya Singh', 'Local and regional moving services with packing support for home buyers.', '905-555-0111', 'maya@singhmoves.example.com', 'https://singhmoves.example.com', 'Brampton', 'Ontario', 'Canada', 'GTA and nearby Ontario moves', 4, null, 'https://example.com/providers/singh-smooth-moves.jpg', 'pending_approval', null, '2026-05-14 10:45:00+00', null),
    ('10000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000012', 'cleaner', 'Walker Fresh Start Cleaning', 'Liam Walker', 'Move-in, move-out, and pre-listing cleaning for homes and condos.', '416-555-0112', 'liam@walkerfreshstart.example.com', 'https://walkerfreshstart.example.com', 'Etobicoke', 'Ontario', 'Canada', 'Toronto West, Etobicoke, Mississauga', 6, null, 'https://example.com/providers/walker-fresh-start.jpg', 'active', null, '2026-04-18 08:30:00+00', '2026-04-19 11:30:00+00')
) as seed_providers(
  id,
  user_id,
  category_slug,
  business_name,
  display_name,
  bio,
  phone,
  email,
  website_url,
  city,
  province_state,
  country,
  service_area,
  years_experience,
  license_number,
  profile_image_url,
  status,
  rejection_reason,
  submitted_at,
  approved_at
)
join public.categories
  on categories.slug = seed_providers.category_slug
on conflict (id) do update
set
  user_id = excluded.user_id,
  category_id = excluded.category_id,
  business_name = excluded.business_name,
  display_name = excluded.display_name,
  bio = excluded.bio,
  phone = excluded.phone,
  email = excluded.email,
  website_url = excluded.website_url,
  city = excluded.city,
  province_state = excluded.province_state,
  country = excluded.country,
  service_area = excluded.service_area,
  years_experience = excluded.years_experience,
  license_number = excluded.license_number,
  profile_image_url = excluded.profile_image_url,
  status = excluded.status,
  rejection_reason = excluded.rejection_reason,
  submitted_at = excluded.submitted_at,
  approved_at = excluded.approved_at;

insert into public.provider_languages (provider_profile_id, language_id)
select
  seed_provider_languages.provider_profile_id::uuid,
  languages.id
from (
  values
    ('10000000-0000-4000-8000-000000000001', 'english'),
    ('10000000-0000-4000-8000-000000000001', 'mandarin'),
    ('10000000-0000-4000-8000-000000000002', 'english'),
    ('10000000-0000-4000-8000-000000000002', 'french'),
    ('10000000-0000-4000-8000-000000000003', 'english'),
    ('10000000-0000-4000-8000-000000000003', 'hindi'),
    ('10000000-0000-4000-8000-000000000004', 'english'),
    ('10000000-0000-4000-8000-000000000005', 'spanish'),
    ('10000000-0000-4000-8000-000000000006', 'english'),
    ('10000000-0000-4000-8000-000000000007', 'arabic'),
    ('10000000-0000-4000-8000-000000000008', 'english'),
    ('10000000-0000-4000-8000-000000000009', 'urdu'),
    ('10000000-0000-4000-8000-000000000010', 'punjabi'),
    ('10000000-0000-4000-8000-000000000011', 'english'),
    ('10000000-0000-4000-8000-000000000012', 'portuguese')
) as seed_provider_languages(provider_profile_id, language_slug)
join public.languages
  on languages.slug = seed_provider_languages.language_slug
on conflict (provider_profile_id, language_id) do nothing;

insert into public.provider_specialties (provider_profile_id, specialty_id)
select
  seed_provider_specialties.provider_profile_id::uuid,
  specialties.id
from (
  values
    ('10000000-0000-4000-8000-000000000001', 'first-time-buyers'),
    ('10000000-0000-4000-8000-000000000001', 'condos'),
    ('10000000-0000-4000-8000-000000000001', 'investment-properties'),
    ('10000000-0000-4000-8000-000000000001', 'luxury-homes'),
    ('10000000-0000-4000-8000-000000000001', 'commercial-real-estate'),
    ('10000000-0000-4000-8000-000000000002', 'first-time-buyer-mortgages'),
    ('10000000-0000-4000-8000-000000000002', 'refinancing'),
    ('10000000-0000-4000-8000-000000000002', 'self-employed-mortgages'),
    ('10000000-0000-4000-8000-000000000002', 'investment-property-financing'),
    ('10000000-0000-4000-8000-000000000003', 'pre-purchase-inspection'),
    ('10000000-0000-4000-8000-000000000003', 'new-construction-inspection'),
    ('10000000-0000-4000-8000-000000000003', 'condo-inspection'),
    ('10000000-0000-4000-8000-000000000005', 'residential-appraisals'),
    ('10000000-0000-4000-8000-000000000006', 'home-insurance'),
    ('10000000-0000-4000-8000-000000000007', 'renovations')
) as seed_provider_specialties(provider_profile_id, specialty_slug)
join public.specialties
  on specialties.slug = seed_provider_specialties.specialty_slug
on conflict (provider_profile_id, specialty_id) do nothing;

insert into public.saved_providers (id, user_id, provider_profile_id)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000006'),
  ('30000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000007'),
  ('30000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000008'),
  ('30000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000009'),
  ('30000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000010'),
  ('30000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000011'),
  ('30000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000012'),
  ('30000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003')
on conflict (id) do update
set
  user_id = excluded.user_id,
  provider_profile_id = excluded.provider_profile_id;

insert into public.contact_requests (
  id,
  provider_profile_id,
  sender_user_id,
  sender_name,
  sender_email,
  sender_phone,
  message,
  status
)
values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'Hannah Lee', 'hannah.lee@example.com', '416-555-1101', 'I am buying my first condo and would like to book a consultation.', 'new'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000014', 'Jacob Wilson', 'jacob.wilson@example.com', '647-555-1102', 'Can you help compare pre-approval options this week?', 'read'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', null, 'Taylor Guest', 'taylor.guest@example.com', '905-555-1103', 'I need a home inspection for a townhouse in Hamilton.', 'responded'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000013', 'Hannah Lee', 'hannah.lee@example.com', null, 'I need closing cost information for a condo purchase.', 'archived'),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', null, 'Sam Patel', 'sam.patel@example.com', '289-555-1105', 'Please send pricing for a residential appraisal in Vaughan.', 'new'),
  ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000014', 'Jacob Wilson', 'jacob.wilson@example.com', '647-555-1106', 'I am looking for landlord insurance for a duplex.', 'read'),
  ('40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', null, 'Casey Morgan', 'casey.morgan@example.com', null, 'Can you quote a kitchen refresh before listing?', 'new'),
  ('40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000013', 'Hannah Lee', 'hannah.lee@example.com', '416-555-1108', 'I need listing photos for a Burlington condo.', 'responded'),
  ('40000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', null, 'Jordan Ellis', 'jordan.ellis@example.com', '437-555-1109', 'Do you offer vacant staging packages in Markham?', 'new'),
  ('40000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000014', 'Jacob Wilson', 'jacob.wilson@example.com', null, 'I have a rental property and need monthly management.', 'read'),
  ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000011', null, 'Riley Brooks', 'riley.brooks@example.com', '905-555-1111', 'Can you help with a local move next month?', 'new'),
  ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013', 'Hannah Lee', 'hannah.lee@example.com', '416-555-1112', 'I need move-out cleaning for a two-bedroom condo.', 'responded'),
  ('40000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', null, 'Alex Nguyen', 'alex.nguyen@example.com', '416-555-1113', 'I am interested in investment properties near transit.', 'new'),
  ('40000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', null, 'Morgan Reed', 'morgan.reed@example.com', '647-555-1114', 'Can you explain options for self-employed income?', 'archived'),
  ('40000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000014', 'Jacob Wilson', 'jacob.wilson@example.com', '647-555-1115', 'Do you inspect new construction homes?', 'read')
on conflict (id) do update
set
  provider_profile_id = excluded.provider_profile_id,
  sender_user_id = excluded.sender_user_id,
  sender_name = excluded.sender_name,
  sender_email = excluded.sender_email,
  sender_phone = excluded.sender_phone,
  message = excluded.message,
  status = excluded.status;
