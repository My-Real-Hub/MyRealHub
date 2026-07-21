alter table public.service_regions
  add column center_latitude double precision,
  add column center_longitude double precision,
  add column location_match_terms text[] not null default '{}';

update public.service_regions
set
  center_latitude = seed.center_latitude,
  center_longitude = seed.center_longitude,
  location_match_terms = string_to_array(seed.match_terms, '|')
from (
  values
    ('nl-st-johns-metro', 47.5615, -52.7126, 'St. John''s|Mount Pearl|Paradise|Conception Bay South|Torbay'),
    ('nl-avalon-peninsula', 47.2000, -53.4000, 'Avalon|Placentia|Carbonear|Harbour Grace|Bay Roberts'),
    ('nl-eastern-newfoundland', 48.2000, -53.7000, 'Clarenville|Bonavista|Burin|Marystown'),
    ('nl-central-newfoundland', 49.0000, -55.5000, 'Gander|Grand Falls-Windsor|Lewisporte|Bishop''s Falls'),
    ('nl-western-newfoundland', 49.2000, -57.8000, 'Corner Brook|Deer Lake|Stephenville|Port aux Basques'),
    ('nl-labrador', 53.3000, -60.4000, 'Happy Valley-Goose Bay|Labrador City|Wabush|Nain'),
    ('pe-charlottetown-area', 46.2382, -63.1311, 'Charlottetown|Stratford|Cornwall'),
    ('pe-summerside-area', 46.3934, -63.7902, 'Summerside|Kensington'),
    ('pe-eastern-prince-edward-island', 46.3500, -62.4000, 'Souris|Montague|Georgetown|Three Rivers'),
    ('pe-western-prince-edward-island', 46.7000, -64.1500, 'Alberton|Tignish|O''Leary'),
    ('ns-halifax-regional-municipality', 44.6488, -63.5752, 'Halifax|Dartmouth|Bedford|Sackville|Cole Harbour'),
    ('ns-cape-breton', 46.1400, -60.1900, 'Sydney|Glace Bay|North Sydney|New Waterford|Baddeck'),
    ('ns-annapolis-valley', 45.0700, -64.5000, 'Kentville|Wolfville|Berwick|Middleton|Annapolis Royal'),
    ('ns-south-shore', 44.3800, -64.5200, 'Bridgewater|Lunenburg|Liverpool|Shelburne|Yarmouth'),
    ('ns-northern-nova-scotia', 45.6200, -62.9000, 'Truro|New Glasgow|Pictou|Antigonish|Amherst'),
    ('nb-greater-moncton', 46.0878, -64.7782, 'Moncton|Dieppe|Riverview'),
    ('nb-greater-saint-john', 45.2733, -66.0633, 'Saint John|Quispamsis|Rothesay|Grand Bay-Westfield'),
    ('nb-greater-fredericton', 45.9636, -66.6431, 'Fredericton|Oromocto|New Maryland'),
    ('nb-northern-new-brunswick', 47.3000, -65.3000, 'Bathurst|Campbellton|Edmundston|Miramichi|Caraquet'),
    ('qc-greater-montreal', 45.5017, -73.5673, 'Montreal|Laval|Longueuil|Brossard|Terrebonne|Repentigny|Vaudreuil-Dorion'),
    ('qc-quebec-city-area', 46.8139, -71.2080, 'Quebec City|Québec|Levis|Lévis|Saint-Augustin-de-Desmaures'),
    ('qc-outaouais', 45.4765, -75.7013, 'Gatineau|Chelsea|Cantley|Maniwaki'),
    ('qc-estrie', 45.4000, -71.9000, 'Sherbrooke|Magog|Coaticook|Lac-Megantic|Lac-Mégantic'),
    ('qc-mauricie', 46.3430, -72.5430, 'Trois-Rivieres|Trois-Rivières|Shawinigan|La Tuque'),
    ('qc-centre-du-quebec', 45.8800, -72.4800, 'Drummondville|Victoriaville|Nicolet'),
    ('qc-saguenay-lac-saint-jean', 48.4284, -71.0686, 'Saguenay|Chicoutimi|Jonquiere|Jonquière|Alma|Roberval'),
    ('qc-eastern-quebec', 48.4380, -68.5230, 'Rimouski|Riviere-du-Loup|Rivière-du-Loup|Gaspe|Gaspé|Baie-Comeau'),
    ('qc-northern-quebec', 49.9168, -74.3659, 'Chibougamau|Chapais|Kuujjuaq|Radisson|Nord-du-Quebec|Nord-du-Québec'),
    ('on-greater-toronto-area', 43.6532, -79.3832, 'Toronto|Etobicoke|North York|Scarborough|Mississauga|Brampton|Vaughan|Markham|Richmond Hill|Aurora|Newmarket|Caledon'),
    ('on-ottawa-region', 45.4215, -75.6972, 'Ottawa|Kanata|Nepean|Orleans|Orléans|Gloucester|Stittsville'),
    ('on-hamilton-and-halton', 43.3255, -79.7990, 'Hamilton|Burlington|Oakville|Milton|Halton Hills|Georgetown'),
    ('on-niagara-region', 43.0896, -79.0849, 'Niagara Falls|St. Catharines|Welland|Fort Erie|Grimsby|Thorold|Port Colborne'),
    ('on-waterloo-region-and-guelph', 43.4516, -80.4925, 'Kitchener|Waterloo|Cambridge|Guelph|Woolwich|Wellesley'),
    ('on-london-and-middlesex', 42.9849, -81.2453, 'London|Middlesex Centre|Strathroy-Caradoc'),
    ('on-windsor-essex', 42.3149, -83.0364, 'Windsor|Essex|Leamington|Kingsville|Amherstburg|Lakeshore'),
    ('on-simcoe-county', 44.3894, -79.6903, 'Barrie|Orillia|Collingwood|Innisfil|Bradford|Wasaga Beach|Midland'),
    ('on-durham-region', 43.8971, -78.8658, 'Oshawa|Whitby|Ajax|Pickering|Clarington|Bowmanville|Uxbridge|Scugog'),
    ('on-eastern-ontario', 44.2312, -76.4860, 'Kingston|Belleville|Peterborough|Cornwall|Brockville|Quinte West|Lindsay'),
    ('on-southwestern-ontario', 42.4048, -82.1910, 'Chatham-Kent|Sarnia|Woodstock|Brantford|Stratford|St. Thomas|Owen Sound'),
    ('on-northern-ontario', 46.4917, -80.9930, 'Sudbury|Thunder Bay|Sault Ste. Marie|North Bay|Timmins|Kenora'),
    ('mb-winnipeg-metro', 49.8951, -97.1384, 'Winnipeg|Headingley|East St. Paul|West St. Paul'),
    ('mb-westman', 49.8485, -99.9501, 'Brandon|Virden|Souris|Dauphin'),
    ('mb-central-manitoba', 49.9720, -98.2920, 'Portage la Prairie|Winkler|Morden|Carman'),
    ('mb-interlake-eastern-manitoba', 50.1436, -96.8845, 'Selkirk|Gimli|Stonewall|Beausejour|Lac du Bonnet'),
    ('mb-northern-manitoba', 55.7435, -97.8558, 'Thompson|The Pas|Flin Flon|Churchill'),
    ('sk-saskatoon-area', 52.1332, -106.6700, 'Saskatoon|Warman|Martensville'),
    ('sk-regina-area', 50.4452, -104.6189, 'Regina|White City|Emerald Park'),
    ('sk-central-saskatchewan', 52.7575, -108.2861, 'North Battleford|Battleford|Humboldt|Kindersley'),
    ('sk-southern-saskatchewan', 50.3916, -105.5349, 'Moose Jaw|Swift Current|Estevan|Weyburn|Yorkton'),
    ('sk-northern-saskatchewan', 53.2033, -105.7531, 'Prince Albert|La Ronge|Meadow Lake|Melfort'),
    ('ab-calgary-region', 51.0447, -114.0719, 'Calgary|Airdrie|Cochrane|Chestermere|Okotoks'),
    ('ab-edmonton-region', 53.5461, -113.4938, 'Edmonton|St. Albert|Sherwood Park|Spruce Grove|Leduc|Beaumont|Fort Saskatchewan'),
    ('ab-central-alberta', 52.2681, -113.8112, 'Red Deer|Lacombe|Sylvan Lake|Olds|Camrose'),
    ('ab-rocky-mountain-region', 51.1784, -115.5708, 'Banff|Canmore|Jasper|Hinton|Rocky Mountain House'),
    ('ab-southern-alberta', 49.6956, -112.8451, 'Lethbridge|Medicine Hat|Brooks|Taber'),
    ('ab-northern-alberta', 55.1707, -118.7884, 'Grande Prairie|Fort McMurray|Peace River|Cold Lake|Lloydminster'),
    ('bc-greater-vancouver', 49.2827, -123.1207, 'Vancouver|Burnaby|Richmond|Surrey|Delta|New Westminster|Coquitlam|Port Coquitlam|North Vancouver|West Vancouver'),
    ('bc-fraser-valley', 49.0504, -122.3045, 'Abbotsford|Chilliwack|Mission|Langley|Hope'),
    ('bc-vancouver-island', 49.1659, -123.9401, 'Victoria|Nanaimo|Saanich|Langford|Courtenay|Campbell River|Duncan|Parksville|Port Alberni'),
    ('bc-thompson-okanagan', 49.8880, -119.4960, 'Kelowna|Kamloops|Vernon|Penticton|Salmon Arm'),
    ('bc-kootenay-region', 49.5120, -115.7690, 'Cranbrook|Nelson|Castlegar|Trail|Fernie|Revelstoke'),
    ('bc-cariboo-region', 52.1292, -122.1397, 'Williams Lake|Quesnel|100 Mile House'),
    ('bc-north-coast-and-nechako', 53.9171, -122.7497, 'Prince George|Prince Rupert|Terrace|Kitimat|Smithers'),
    ('bc-northeast-british-columbia', 56.2465, -120.8476, 'Fort St. John|Dawson Creek|Fort Nelson|Tumbler Ridge'),
    ('yt-whitehorse-area', 60.7212, -135.0568, 'Whitehorse'),
    ('yt-rural-yukon', 64.0000, -137.0000, 'Dawson City|Watson Lake|Haines Junction|Carmacks'),
    ('nt-yellowknife-area', 62.4540, -114.3718, 'Yellowknife'),
    ('nt-beaufort-delta', 68.3607, -133.7230, 'Inuvik|Tuktoyaktuk|Aklavik'),
    ('nt-dehcho', 61.8620, -121.3516, 'Fort Simpson|Fort Liard|Nahanni Butte'),
    ('nt-north-slave', 63.5000, -113.0000, 'Behchoko|Whatì|Gameti|Wekweeti'),
    ('nt-sahtu', 65.2820, -126.8329, 'Norman Wells|Deline|Tulita|Fort Good Hope'),
    ('nt-south-slave', 60.8156, -115.7999, 'Hay River|Fort Smith|Fort Resolution'),
    ('nu-qikiqtaaluk', 63.7467, -68.5170, 'Iqaluit|Pangnirtung|Pond Inlet|Clyde River'),
    ('nu-kivalliq', 62.8084, -92.0853, 'Rankin Inlet|Arviat|Baker Lake|Chesterfield Inlet'),
    ('nu-kitikmeot', 69.1169, -105.0597, 'Cambridge Bay|Kugluktuk|Gjoa Haven|Taloyoak')
) as seed(slug, center_latitude, center_longitude, match_terms)
where service_regions.slug = seed.slug;

alter table public.service_regions
  alter column center_latitude set not null,
  alter column center_longitude set not null;

alter table public.service_regions
  add constraint service_regions_center_latitude_check
    check (center_latitude between 40 and 84),
  add constraint service_regions_center_longitude_check
    check (center_longitude between -142 and -52);
