-- Milestone 1 seed data. ALL rows here are demo data for local development and
-- must never be presented as real production data.
--
-- Demo credentials (local only):
--   owner@demo.local  / demo-password-owner   (role: owner)
--   viewer@demo.local / demo-password-viewer  (role: viewer)
--
-- NOTE: directly seeding `auth.users` is Supabase-version sensitive. This is
-- provided for local convenience (`supabase db reset`); for other environments
-- prefer the Supabase admin API / CLI to create users. Everything is idempotent.

-- --- Production guard (B14) -------------------------------------------------
-- Refuse to load demo data into a production database. Set the marker once per
-- environment with:  alter database <db> set app.environment = 'production';
-- In any other environment `current_setting(..., true)` is null and the seed
-- proceeds. Running under psql with ON_ERROR_STOP aborts the whole seed here.
do $$
begin
  if current_setting('app.environment', true) = 'production' then
    raise exception
      'refusing to load demo seed data: app.environment=production';
  end if;
end
$$;

-- --- Demo auth users -------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated', 'authenticated', 'owner@demo.local',
    extensions.crypt('demo-password-owner', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Demo Owner"}', false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a2',
    'authenticated', 'authenticated', 'viewer@demo.local',
    extensions.crypt('demo-password-viewer', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Demo Viewer"}', false
  )
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"owner@demo.local"}',
    'email', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a2',
    '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"viewer@demo.local"}',
    'email', now(), now(), now()
  )
on conflict (provider, provider_id) do nothing;

-- Mark the demo owner as the system owner (server-only flag, not used by RLS).
update public.profiles set is_system_owner = true, full_name = 'Demo Owner'
where id = '00000000-0000-0000-0000-0000000000a1';

-- --- Demo organization -----------------------------------------------------
insert into public.organizations (id, name, slug, plan_code)
values (
  '00000000-0000-0000-0000-0000000000b1',
  'Other Bali Internal', 'other-bali-internal', 'internal_beta'
)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', 'viewer')
on conflict (organization_id, user_id) do nothing;

-- --- Demo dataset ----------------------------------------------------------
insert into public.datasets (id, name, slug, description, owner_organization_id, is_demo)
values (
  '00000000-0000-0000-0000-0000000000c1',
  'Bali Accommodation Market', 'bali-accommodation-market',
  'Demo dataset for the Bali accommodation market.',
  '00000000-0000-0000-0000-0000000000b1', true
)
on conflict (id) do nothing;

insert into public.organization_dataset_access (organization_id, dataset_id, access_level)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000c1', 'manage'
)
on conflict (organization_id, dataset_id) do nothing;

-- ===========================================================================
-- Milestone 2 catalogue fixtures (all demo data, in the demo dataset).
-- Deterministic UUIDs via md5(...) so re-seeding is idempotent. Coordinates are
-- rounded to ~110 m. The geography `location` column is left null in the demo
-- seed (the import pipeline populates it later); the app reads the numeric
-- latitude/longitude columns.
-- ===========================================================================

-- Bali geography starter set.
insert into public.regions (id, name, slug, region_type, country_code, parent_id)
values (md5('bai-region-bali')::uuid, 'Bali', 'bali', 'province', 'ID', null)
on conflict (id) do nothing;

insert into public.regions (id, name, slug, region_type, parent_id)
select
  md5('bai-region-' || slug)::uuid, name, slug, 'area',
  md5('bai-region-bali')::uuid
from (
  values
    ('Canggu', 'canggu'), ('Uluwatu', 'uluwatu'), ('Ubud', 'ubud'),
    ('Seminyak', 'seminyak'), ('Pererenan', 'pererenan'), ('Bingin', 'bingin'),
    ('Sanur', 'sanur'), ('Denpasar', 'denpasar')
) as r(name, slug)
on conflict (id) do nothing;

-- Source registry: approved / disabled / pending, clearly stated.
insert into private.data_sources
  (id, key, display_name, access_mode, compliance_status, automation_allowed, capabilities)
values
  (md5('bai-source-manual_csv')::uuid, 'manual_csv', 'Manual CSV', 'manual_import', 'approved', false, '{listing_identity,listing_status}'),
  (md5('bai-source-demo_fixture')::uuid, 'demo_fixture', 'Demo Fixture', 'demo_fixture', 'approved', true, '{listing_identity,listing_status,price,rating}'),
  (md5('bai-source-owner_supplied')::uuid, 'owner_supplied', 'Owner Supplied', 'owner_supplied', 'approved', false, '{listing_identity}'),
  (md5('bai-source-airbnb')::uuid, 'airbnb', 'Airbnb', 'browser_automation', 'disabled', false, '{listing_identity,listing_status,price,rating,review_count}'),
  (md5('bai-source-booking')::uuid, 'booking', 'Booking.com', 'licensed_api', 'pending_review', false, '{listing_identity,price}')
on conflict (id) do nothing;

insert into private.parser_versions (id, source_id, version, schema_version, is_active)
values (md5('bai-parser-demo-1')::uuid, md5('bai-source-demo_fixture')::uuid, 'demo-1', 1, true)
on conflict (id) do nothing;

insert into private.collection_runs
  (id, dataset_id, source_id, run_kind, status, parser_version, idempotency_key)
values (
  md5('bai-run-baseline')::uuid,
  '00000000-0000-0000-0000-0000000000c1',
  md5('bai-source-demo_fixture')::uuid,
  'import', 'completed', 'demo-1', 'baseline-demo'
)
on conflict (id) do nothing;

-- 20 demo properties.
insert into public.properties
  (id, dataset_id, canonical_name, slug, property_type, primary_region_id,
   latitude, longitude, coordinate_precision_meters, bedrooms, bathrooms,
   guest_capacity, current_lifecycle_status, current_confidence,
   first_observed_at, last_observed_at)
select
  md5('bai-demo-property-' || g)::uuid,
  '00000000-0000-0000-0000-0000000000c1',
  'Demo Villa ' || g,
  'demo-villa-' || g,
  'villa',
  md5('bai-region-' || (array['canggu','uluwatu','ubud','seminyak','pererenan','bingin','sanur','denpasar'])[1 + (g % 8)])::uuid,
  round((-8.60 - (g % 10) * 0.02)::numeric, 3),
  round((115.10 + (g % 12) * 0.02)::numeric, 3),
  110,
  2 + (g % 3), 2 + (g % 2), 4 + (g % 4),
  (array['active','active','active','active','suspected_inactive','confirmed_inactive'])[1 + (g % 6)]::app.listing_lifecycle_status,
  (array['high','medium','low'])[1 + (g % 3)]::app.confidence_level,
  timestamptz '2026-07-18 00:00:00+00',
  timestamptz '2026-07-18 00:00:00+00' + (g || ' hours')::interval
from generate_series(1, 20) as g
on conflict (id) do nothing;

-- 25 source listings (properties 1-5 have a second listing).
insert into public.source_listings
  (id, dataset_id, property_id, source_id, external_id, source_url,
   current_title, current_observation_status, current_lifecycle_status,
   current_confidence, first_seen_at, last_observed_at)
select
  md5('bai-demo-listing-' || g)::uuid,
  '00000000-0000-0000-0000-0000000000c1',
  md5('bai-demo-property-' || (1 + ((g - 1) % 20)))::uuid,
  md5('bai-source-demo_fixture')::uuid,
  'demo-' || lpad(g::text, 3, '0'),
  'https://fixture.local/listing/demo-' || lpad(g::text, 3, '0'),
  'Demo Villa ' || (1 + ((g - 1) % 20)),
  'active', 'active', 'high',
  timestamptz '2026-07-18 00:00:00+00',
  timestamptz '2026-07-20 00:00:00+00'
from generate_series(1, 25) as g
on conflict (id) do nothing;

-- Baseline snapshots (one per listing).
insert into public.listing_snapshots
  (id, dataset_id, source_listing_id, collection_run_id, observed_at,
   observation_status, latitude, longitude, rating, review_count,
   observed_price_amount, observed_price_currency, observed_price_unit,
   content_fingerprint, parser_version, field_presence)
select
  md5('bai-demo-snapshot-' || g)::uuid,
  '00000000-0000-0000-0000-0000000000c1',
  md5('bai-demo-listing-' || g)::uuid,
  md5('bai-run-baseline')::uuid,
  timestamptz '2026-07-20 00:00:00+00',
  'active',
  round((-8.60 - (g % 10) * 0.02)::numeric, 3),
  round((115.10 + (g % 12) * 0.02)::numeric, 3),
  round((4.5 + (g % 5) * 0.1)::numeric, 2),
  50 + g * 3,
  (2000000 + g * 100000)::numeric, 'IDR', 'night',
  'fp-demo-' || g, 'demo-1',
  '{"rating":true,"review_count":true,"price":true}'::jsonb
from generate_series(1, 25) as g
on conflict (source_listing_id, collection_run_id) do nothing;

update public.source_listings sl
set latest_snapshot_id = s.id
from public.listing_snapshots s
where s.source_listing_id = sl.id and sl.latest_snapshot_id is null;

-- A small set of events with evidence (properties 1-5 first observed).
insert into public.events
  (id, dataset_id, property_id, source_listing_id, event_type, event_at,
   confidence, title, summary, rule_version, deduplication_key)
select
  md5('bai-demo-event-' || g)::uuid,
  '00000000-0000-0000-0000-0000000000c1',
  md5('bai-demo-property-' || g)::uuid,
  md5('bai-demo-listing-' || g)::uuid,
  'listing_created',
  timestamptz '2026-07-18 00:00:00+00',
  'high',
  'Listing first observed',
  'Demo Villa ' || g || ' was first observed in the baseline snapshot.',
  'demo-rules-1',
  'demo-dedup-' || g
from generate_series(1, 5) as g
on conflict (deduplication_key) do nothing;

insert into public.event_evidence
  (id, event_id, current_snapshot_id, collection_run_id, evidence_type, explanation)
select
  md5('bai-demo-evidence-' || g)::uuid,
  md5('bai-demo-event-' || g)::uuid,
  md5('bai-demo-snapshot-' || g)::uuid,
  md5('bai-run-baseline')::uuid,
  'snapshot',
  'Baseline observation snapshot supporting this event.'
from generate_series(1, 5) as g
on conflict (id) do nothing;
