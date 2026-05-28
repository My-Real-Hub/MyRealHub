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
    ('home-inspector', 'Condo inspection', 'condo-inspection', 'Inspection services focused on condo units.')
) as seed_specialties(category_slug, name, slug, description)
join public.categories
  on categories.slug = seed_specialties.category_slug
on conflict (slug) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description;
