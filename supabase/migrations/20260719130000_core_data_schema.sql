-- Milestone 2: core data schema and fixture catalogue.
--
-- Adds the source-agnostic data model: regions, the private source registry,
-- properties/aliases/source listings, private collection/job/raw tables, and the
-- immutable snapshot/diff/event/evidence + audit tables. Populated read-only from
-- seed fixtures; the import pipeline (M3), snapshot/diff engine (M4) and lifecycle
-- engine (M5) come later.
--
-- Coordinates: spec-faithful PostGIS `geography` columns are declared for future
-- spatial queries, alongside denormalized `latitude`/`longitude numeric` columns
-- that the application and map actually read (so no PostGIS is in the read path).
-- The PGlite RLS harness strips the PostGIS DDL (extension, geography types, GiST
-- indexes) since it ships no PostGIS; RLS policies never reference geo columns.
--
-- All public tables here are READ-ONLY for `authenticated` in this milestone:
-- SELECT is granted (RLS-scoped); no INSERT/UPDATE/DELETE grants, so snapshots,
-- diffs and events are effectively append-only from the client's perspective
-- (writes happen through the worker/service role from M3 onward).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (app schema; names per 03_DATABASE_SCHEMA.md)
-- ---------------------------------------------------------------------------
create type app.observation_status as enum (
  'active', 'unavailable', 'not_found', 'search_not_observed',
  'blocked', 'source_error', 'unknown'
);
create type app.listing_lifecycle_status as enum (
  'active', 'first_miss', 'suspected_inactive', 'confirmed_inactive',
  'reactivated', 'archived'
);
create type app.confidence_level as enum ('low', 'medium', 'high');
create type app.source_access_mode as enum (
  'owner_supplied', 'licensed_api', 'public_registry', 'manual_import',
  'browser_automation', 'demo_fixture'
);
create type app.source_compliance_status as enum (
  'approved', 'restricted', 'pending_review', 'disabled'
);
create type app.collection_run_status as enum (
  'pending', 'queued', 'running', 'completed', 'completed_with_errors',
  'degraded', 'failed', 'cancelled'
);
create type app.job_status as enum (
  'queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled'
);
create type app.job_type as enum (
  'import', 'collect', 'normalize', 'compare', 'report', 'export',
  'notify', 'maintenance'
);
create type app.event_type as enum (
  'listing_created', 'listing_first_miss', 'listing_suspected_inactive',
  'listing_confirmed_inactive', 'listing_reactivated', 'listing_archived',
  'price_changed', 'rating_changed', 'review_count_changed', 'title_changed',
  'description_changed', 'photos_changed', 'amenities_changed', 'host_changed',
  'superhost_gained', 'superhost_lost', 'location_changed',
  'direct_channel_added', 'direct_channel_removed', 'source_error',
  'manual_correction', 'property_merged', 'property_split'
);

-- ---------------------------------------------------------------------------
-- Geography: global reference data
-- ---------------------------------------------------------------------------
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.regions (id) on delete set null,
  name text not null,
  slug extensions.citext not null,
  region_type text,
  country_code char(2) not null default 'ID',
  geometry geography(MultiPolygon, 4326),
  centroid geography(Point, 4326),
  created_at timestamptz not null default now(),
  unique nulls not distinct (parent_id, slug)
);
create index regions_parent_type_idx on public.regions (parent_id, region_type);
create index regions_geometry_idx on public.regions using gist (geometry);
create index regions_centroid_idx on public.regions using gist (centroid);

-- ---------------------------------------------------------------------------
-- Private source registry (never exposed to the Data API)
-- ---------------------------------------------------------------------------
create table private.data_sources (
  id uuid primary key default gen_random_uuid(),
  key extensions.citext not null unique,
  display_name text not null,
  access_mode app.source_access_mode not null,
  compliance_status app.source_compliance_status not null,
  automation_allowed boolean not null default false,
  capabilities text[] not null default '{}',
  terms_reviewed_at timestamptz,
  review_expires_at timestamptz,
  reviewed_by uuid,
  restriction_reason text,
  configuration_schema jsonb,
  rate_limit_policy jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.parser_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.data_sources (id) on delete cascade,
  version text not null,
  schema_version integer not null default 1,
  compatible_with_previous boolean not null default true,
  released_at timestamptz not null default now(),
  notes text,
  is_active boolean not null default true,
  unique (source_id, version)
);

-- ---------------------------------------------------------------------------
-- Properties and listings
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  canonical_name text not null,
  slug extensions.citext,
  property_type text,
  primary_region_id uuid references public.regions (id) on delete set null,
  location geography(Point, 4326),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  coordinate_precision_meters integer,
  bedrooms numeric(4, 1),
  bathrooms numeric(4, 1),
  guest_capacity integer,
  official_website text,
  business_whatsapp text,
  direct_booking_url text,
  owner_verified boolean not null default false,
  verification_source text,
  current_lifecycle_status app.listing_lifecycle_status,
  current_confidence app.confidence_level,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index properties_dataset_slug_idx
  on public.properties (dataset_id, slug) where slug is not null;
create index properties_dataset_lifecycle_idx
  on public.properties (dataset_id, current_lifecycle_status);
create index properties_dataset_region_idx
  on public.properties (dataset_id, primary_region_id);
create index properties_dataset_last_observed_idx
  on public.properties (dataset_id, last_observed_at desc);
create index properties_location_idx on public.properties using gist (location);

create table public.property_aliases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  alias text not null,
  source text,
  created_at timestamptz not null default now()
);
create unique index property_aliases_unique_idx
  on public.property_aliases (property_id, lower(alias));

-- ---------------------------------------------------------------------------
-- Private collection/job/raw tables (never exposed to the Data API)
-- ---------------------------------------------------------------------------
create table private.collection_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_id uuid not null references private.data_sources (id),
  run_kind text not null default 'import',
  status app.collection_run_status not null default 'pending',
  idempotency_key text unique,
  requested_by_user_id uuid,
  requested_by_system text,
  parser_version text,
  coverage_spec jsonb not null default '{}',
  started_at timestamptz,
  finished_at timestamptz,
  total_observations integer not null default 0,
  valid_observations integer not null default 0,
  active_observations integer not null default 0,
  error_observations integer not null default 0,
  rejected_observations integer not null default 0,
  coverage_ratio numeric(8, 5),
  is_degraded boolean not null default false,
  degradation_reason text,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index collection_runs_dataset_source_idx
  on private.collection_runs (dataset_id, source_id, created_at desc);
create index collection_runs_status_idx
  on private.collection_runs (status, created_at);

create table private.collection_jobs (
  id uuid primary key default gen_random_uuid(),
  collection_run_id uuid references private.collection_runs (id) on delete cascade,
  job_type app.job_type not null,
  status app.job_status not null default 'queued',
  priority integer not null default 0,
  idempotency_key text unique,
  payload jsonb not null default '{}',
  scheduled_for timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  progress_current integer,
  progress_total integer,
  progress_stage text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now()
);
create index collection_jobs_claim_idx
  on private.collection_jobs (priority desc, scheduled_for, created_at)
  where status = 'queued';
create index collection_jobs_status_heartbeat_idx
  on private.collection_jobs (status, heartbeat_at);

create table private.job_logs (
  id bigint generated always as identity primary key,
  job_id uuid references private.collection_jobs (id) on delete cascade,
  level text not null,
  message text not null,
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table private.raw_observations (
  id uuid primary key default gen_random_uuid(),
  collection_run_id uuid not null references private.collection_runs (id) on delete cascade,
  source_listing_id uuid,
  source_id uuid not null references private.data_sources (id),
  external_id text not null,
  observed_at timestamptz not null,
  observation_status app.observation_status not null,
  object_path text,
  payload_checksum text not null,
  request_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (collection_run_id, source_id, external_id, payload_checksum)
);

-- ---------------------------------------------------------------------------
-- Source listings (channel-specific records)
-- ---------------------------------------------------------------------------
create table public.source_listings (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  source_id uuid not null references private.data_sources (id),
  external_id text not null,
  source_url text,
  current_title text,
  current_observation_status app.observation_status,
  current_lifecycle_status app.listing_lifecycle_status not null default 'active',
  current_confidence app.confidence_level not null default 'low',
  first_seen_at timestamptz not null,
  last_seen_active_at timestamptz,
  last_observed_at timestamptz not null,
  consecutive_misses integer not null default 0,
  first_miss_at timestamptz,
  suspected_inactive_at timestamptz,
  confirmed_inactive_at timestamptz,
  reactivated_at timestamptz,
  latest_snapshot_id uuid,
  host_external_id text,
  official_website text,
  business_whatsapp text,
  direct_booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (dataset_id, source_id, external_id)
);
create index source_listings_dataset_source_lifecycle_idx
  on public.source_listings (dataset_id, source_id, current_lifecycle_status);
create index source_listings_dataset_last_observed_idx
  on public.source_listings (dataset_id, last_observed_at desc);
create index source_listings_property_source_idx
  on public.source_listings (property_id, source_id);
create index source_listings_source_external_idx
  on public.source_listings (source_id, external_id);
create index source_listings_host_idx
  on public.source_listings (host_external_id) where host_external_id is not null;

-- ---------------------------------------------------------------------------
-- Immutable snapshots and diffs
-- ---------------------------------------------------------------------------
create table public.listing_snapshots (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_listing_id uuid not null references public.source_listings (id) on delete cascade,
  collection_run_id uuid not null references private.collection_runs (id),
  raw_observation_id uuid references private.raw_observations (id),
  observed_at timestamptz not null,
  observation_status app.observation_status not null,
  title text,
  property_type text,
  region_id uuid references public.regions (id),
  location geography(Point, 4326),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  rating numeric(3, 2),
  review_count integer,
  observed_price_amount numeric(14, 2),
  observed_price_currency char(3),
  observed_price_unit text,
  bedrooms numeric(4, 1),
  bathrooms numeric(4, 1),
  guest_capacity integer,
  is_superhost boolean,
  host_external_id text,
  official_website text,
  business_whatsapp text,
  direct_booking_url text,
  title_hash text,
  description_hash text,
  photos_hash text,
  amenities_hash text,
  content_fingerprint text not null,
  parser_version text not null,
  field_presence jsonb not null default '{}',
  quality_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint listing_snapshots_rating_range check (rating is null or (rating >= 0 and rating <= 5)),
  constraint listing_snapshots_review_count_nonneg check (review_count is null or review_count >= 0),
  unique (source_listing_id, collection_run_id)
);
create index listing_snapshots_listing_observed_idx
  on public.listing_snapshots (source_listing_id, observed_at desc);
create index listing_snapshots_dataset_observed_idx
  on public.listing_snapshots (dataset_id, observed_at desc);
create index listing_snapshots_dataset_status_observed_idx
  on public.listing_snapshots (dataset_id, observation_status, observed_at desc);
create index listing_snapshots_dataset_region_observed_idx
  on public.listing_snapshots (dataset_id, region_id, observed_at desc);
create index listing_snapshots_fingerprint_idx
  on public.listing_snapshots (content_fingerprint);
create index listing_snapshots_location_idx
  on public.listing_snapshots using gist (location);

-- Circular FK: a source listing points at its latest snapshot.
alter table public.source_listings
  add constraint source_listings_latest_snapshot_fk
  foreign key (latest_snapshot_id)
  references public.listing_snapshots (id) on delete set null;

create table public.snapshot_diffs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_listing_id uuid not null references public.source_listings (id) on delete cascade,
  previous_snapshot_id uuid references public.listing_snapshots (id),
  current_snapshot_id uuid not null references public.listing_snapshots (id) on delete cascade,
  field_name text not null,
  previous_value jsonb,
  current_value jsonb,
  change_kind text not null,
  absolute_delta numeric,
  percent_delta numeric,
  is_material boolean not null default false,
  rule_version text not null,
  created_at timestamptz not null default now(),
  unique (current_snapshot_id, field_name, rule_version)
);
create index snapshot_diffs_listing_idx
  on public.snapshot_diffs (source_listing_id, created_at desc);
create index snapshot_diffs_dataset_field_material_idx
  on public.snapshot_diffs (dataset_id, field_name, is_material);

-- ---------------------------------------------------------------------------
-- Events and evidence
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  source_listing_id uuid references public.source_listings (id) on delete set null,
  event_type app.event_type not null,
  event_at timestamptz not null,
  detected_at timestamptz not null default now(),
  confidence app.confidence_level,
  title text not null,
  summary text,
  previous_value jsonb,
  current_value jsonb,
  rule_version text,
  deduplication_key text unique,
  is_reviewed boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  dismissed_at timestamptz,
  dismissal_reason text,
  created_at timestamptz not null default now()
);
create index events_dataset_event_at_idx on public.events (dataset_id, event_at desc);
create index events_dataset_type_idx on public.events (dataset_id, event_type, event_at desc);
create index events_property_idx on public.events (property_id, event_at desc);
create index events_listing_idx on public.events (source_listing_id, event_at desc);
create index events_review_idx
  on public.events (dataset_id, is_reviewed, event_at desc) where dismissed_at is null;

create table public.event_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  previous_snapshot_id uuid references public.listing_snapshots (id),
  current_snapshot_id uuid references public.listing_snapshots (id),
  collection_run_id uuid references private.collection_runs (id),
  raw_observation_id uuid references private.raw_observations (id),
  evidence_type text not null,
  explanation text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index event_evidence_event_idx on public.event_evidence (event_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid,
  actor_type text not null default 'user',
  action text not null,
  target_type text,
  target_id text,
  request_id text,
  ip_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

-- updated_at triggers on mutable tables
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function private.set_updated_at();
create trigger source_listings_set_updated_at
  before update on public.source_listings
  for each row execute function private.set_updated_at();
create trigger data_sources_set_updated_at
  before update on private.data_sources
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions (private, SECURITY DEFINER) for child-table scoping
-- ---------------------------------------------------------------------------
create or replace function private.user_can_access_property(uid uuid, prop uuid)
  returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.properties p
    join public.organization_dataset_access a on a.dataset_id = p.dataset_id
    join public.organization_members m on m.organization_id = a.organization_id
    where p.id = prop and m.user_id = uid
  );
$$;

create or replace function private.user_can_access_event(uid uuid, ev uuid)
  returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.events e
    join public.organization_dataset_access a on a.dataset_id = e.dataset_id
    join public.organization_members m on m.organization_id = a.organization_id
    where e.id = ev and m.user_id = uid
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (read-only catalogue: SELECT policies only)
-- ---------------------------------------------------------------------------
alter table public.regions enable row level security;
alter table public.properties enable row level security;
alter table public.property_aliases enable row level security;
alter table public.source_listings enable row level security;
alter table public.listing_snapshots enable row level security;
alter table public.snapshot_diffs enable row level security;
alter table public.events enable row level security;
alter table public.event_evidence enable row level security;
alter table public.audit_logs enable row level security;

-- regions are shared reference data.
create policy regions_select on public.regions
  for select to authenticated using (true);

create policy properties_select on public.properties
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy property_aliases_select on public.property_aliases
  for select to authenticated
  using (private.user_can_access_property((select auth.uid()), property_id));

create policy source_listings_select on public.source_listings
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy listing_snapshots_select on public.listing_snapshots
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy snapshot_diffs_select on public.snapshot_diffs
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy events_select on public.events
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy event_evidence_select on public.event_evidence
  for select to authenticated
  using (private.user_can_access_event((select auth.uid()), event_id));

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    organization_id is not null
    and private.is_org_member((select auth.uid()), organization_id)
  );

-- ---------------------------------------------------------------------------
-- Grants (SELECT only for authenticated; no writes from the client in M2).
-- anon receives nothing. Private tables receive no Data API grant.
-- ---------------------------------------------------------------------------
grant execute on function private.user_can_access_property(uuid, uuid) to authenticated;
grant execute on function private.user_can_access_event(uuid, uuid) to authenticated;

grant select on public.regions to authenticated;
grant select on public.properties to authenticated;
grant select on public.property_aliases to authenticated;
grant select on public.source_listings to authenticated;
grant select on public.listing_snapshots to authenticated;
grant select on public.snapshot_diffs to authenticated;
grant select on public.events to authenticated;
grant select on public.event_evidence to authenticated;
grant select on public.audit_logs to authenticated;
