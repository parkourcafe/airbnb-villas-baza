-- ---------------------------------------------------------------------------
-- Milestone 11: browser-operated collection.
--
-- A user starts a collection job from the dashboard; a LOCAL worker on their own
-- machine claims it and runs a VISIBLE browser. This is a distinct path from the
-- automated cron collection gated on `private.collection_runs` — it is user
-- operated, headed, and STOPS for manual intervention on any login/CAPTCHA/
-- blocking page. Live collection is additionally gated in the worker behind a
-- disabled feature flag; the source below stays seeded `disabled` for automation.
--
-- All operational rows live in `public` with dataset-scoped RLS. They are
-- append-only for `authenticated` (the worker writes as the service role);
-- users create a `browser_collections` row via an RLS-checked insert.
-- ---------------------------------------------------------------------------

create type app.collection_mode as enum (
  'search_results_only', 'search_and_details', 'verify_existing_listings'
);

create type app.collection_job_state as enum (
  'draft', 'queued', 'claimed', 'running', 'manual_action_required',
  'paused', 'completing', 'completed', 'partial', 'failed', 'cancelled'
);

create type app.manual_action_reason as enum (
  'captcha', 'login_challenge', 'account_verification',
  'access_denied', 'blocking_page', 'navigation_failure'
);

create type app.search_cell_status as enum (
  'pending', 'running', 'completed', 'manual_action_required', 'failed', 'skipped'
);

create type app.snapshot_quality_status as enum (
  'complete', 'partial', 'degraded', 'failed'
);

create type app.listing_verification_status as enum (
  'active', 'unavailable', 'not_found', 'login_required',
  'blocked', 'source_error', 'unknown'
);

create type app.detail_observed_status as enum (
  'collected', 'unavailable', 'not_found', 'blocked', 'error', 'skipped'
);

-- ---------------------------------------------------------------------------
-- Seed the browser-automation source (idempotent). Stays `disabled` for the
-- automated/cron path by design; the user-operated collector offers it via the
-- projection below and only reaches the network when the worker's live flag is on.
-- ---------------------------------------------------------------------------
insert into private.data_sources (key, display_name, access_mode, compliance_status, automation_allowed, capabilities)
values (
  'airbnb', 'Airbnb (browser)', 'browser_automation', 'disabled', false,
  '{listing_identity,listing_status,search_presence,title,rating,review_count,price,location,host_identity,amenities}'
)
on conflict (key) do nothing;

-- Credential-free projection of the browser-automation sources for the new
-- collection form (no config schema, rate limits or credentials exposed).
create view public.browser_collection_sources
with (security_invoker = false) as
select id, key::text as key, display_name, access_mode::text as access_mode,
       compliance_status::text as compliance_status
from private.data_sources
where access_mode = 'browser_automation';

grant select on public.browser_collection_sources to authenticated;

-- ---------------------------------------------------------------------------
-- browser_collections: the user-facing collection job.
-- ---------------------------------------------------------------------------
create table public.browser_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_id uuid not null references private.data_sources (id),
  source_key text not null,
  market text not null default 'bali',
  mode app.collection_mode not null default 'search_results_only',
  state app.collection_job_state not null default 'draft',
  headed boolean not null default true,
  collect_details boolean not null default false,
  max_listings integer,
  min_rating numeric(3, 2),
  min_review_count integer,
  selected_areas text[] not null default '{}',
  requested_start_at timestamptz,
  source_snapshot_id uuid,
  config jsonb not null default '{}',
  -- progress metrics
  planned_cells integer not null default 0,
  completed_cells integer not null default 0,
  cards_discovered integer not null default 0,
  unique_listings integer not null default 0,
  duplicate_discoveries integer not null default 0,
  detail_pages_completed integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  current_area text,
  current_cell text,
  -- manual intervention
  manual_action_reason app.manual_action_reason,
  manual_action_detail text,
  -- worker lease
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  requested_by uuid default auth.uid(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint browser_collections_max_listings_positive
    check (max_listings is null or max_listings > 0),
  constraint browser_collections_min_rating_range
    check (min_rating is null or (min_rating >= 0 and min_rating <= 5)),
  constraint browser_collections_min_reviews_nonneg
    check (min_review_count is null or min_review_count >= 0)
);
create index browser_collections_dataset_created_idx
  on public.browser_collections (dataset_id, created_at desc);
create index browser_collections_claim_idx
  on public.browser_collections (state, requested_start_at, created_at)
  where state = 'queued';

-- ---------------------------------------------------------------------------
-- Search cells planned for a collection.
-- ---------------------------------------------------------------------------
create table public.collection_search_cells (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.browser_collections (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  parent_area text not null,
  north numeric(9, 6) not null,
  south numeric(9, 6) not null,
  east numeric(9, 6) not null,
  west numeric(9, 6) not null,
  zoom integer not null,
  status app.search_cell_status not null default 'pending',
  listings_discovered integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index collection_search_cells_collection_idx
  on public.collection_search_cells (collection_id, status);

-- ---------------------------------------------------------------------------
-- Deduplicated discovered listings for a collection (batch-written).
-- ---------------------------------------------------------------------------
create table public.collection_observations (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.browser_collections (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_id uuid not null references private.data_sources (id),
  source_listing_id text not null,
  source_url text,
  title text,
  area text,
  rating numeric(3, 2),
  review_count integer,
  displayed_price text,
  currency text,
  guest_capacity integer,
  bedrooms integer,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  image_url text,
  discovery_cell_ids uuid[] not null default '{}',
  discovery_count integer not null default 1,
  detail_collected boolean not null default false,
  detail_observed_status app.detail_observed_status,
  detail jsonb,
  raw_payload jsonb not null default '{}',
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, source_listing_id)
);
create index collection_observations_collection_idx
  on public.collection_observations (collection_id);
create index collection_observations_detail_pending_idx
  on public.collection_observations (collection_id)
  where detail_collected = false;

-- ---------------------------------------------------------------------------
-- Immutable market snapshots + their listing rows.
-- ---------------------------------------------------------------------------
create table public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  collection_id uuid references public.browser_collections (id) on delete set null,
  source_id uuid not null references private.data_sources (id),
  source_key text not null,
  market text not null,
  observation_started_at timestamptz,
  observation_completed_at timestamptz,
  unique_listing_count integer not null default 0,
  search_cell_coverage numeric(5, 4) not null default 0,
  completion_percentage integer not null default 0,
  quality_status app.snapshot_quality_status not null,
  warning_count integer not null default 0,
  checksum text not null,
  created_at timestamptz not null default now()
);
create index market_snapshots_dataset_created_idx
  on public.market_snapshots (dataset_id, created_at desc);

create table public.market_snapshot_listings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.market_snapshots (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_listing_id text not null,
  source_url text,
  title text,
  area text,
  rating numeric(3, 2),
  review_count integer,
  displayed_price text,
  currency text,
  guest_capacity integer,
  bedrooms integer,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  detail jsonb,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (snapshot_id, source_listing_id)
);
create index market_snapshot_listings_snapshot_idx
  on public.market_snapshot_listings (snapshot_id);

-- ---------------------------------------------------------------------------
-- Existing-listing verification outcomes. One failed observation must never be
-- read as a removal (enforced in the worker/UI, not by a single status here).
-- ---------------------------------------------------------------------------
create table public.listing_verifications (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.browser_collections (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_id uuid not null references private.data_sources (id),
  source_listing_id text not null,
  source_url text,
  status app.listing_verification_status not null,
  previous_snapshot_id uuid references public.market_snapshots (id) on delete set null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index listing_verifications_collection_idx
  on public.listing_verifications (collection_id);

-- ---------------------------------------------------------------------------
-- Row Level Security. Reads are dataset-scoped; only browser_collections is
-- user-insertable/updatable. Child tables are append-only for authenticated
-- (the worker writes as the service role, which bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.browser_collections enable row level security;
alter table public.collection_search_cells enable row level security;
alter table public.collection_observations enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.market_snapshot_listings enable row level security;
alter table public.listing_verifications enable row level security;

create policy browser_collections_select on public.browser_collections
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

-- Non-viewers who can reach the dataset may create a collection for their org.
create policy browser_collections_insert on public.browser_collections
  for insert to authenticated
  with check (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner','admin','analyst']::app.member_role[])
    and private.user_can_access_dataset((select auth.uid()), dataset_id)
  );

-- Dataset admins may update a collection (e.g. cancel/pause) they can administer.
create policy browser_collections_update on public.browser_collections
  for update to authenticated
  using (private.user_can_administer_dataset((select auth.uid()), dataset_id))
  with check (private.user_can_administer_dataset((select auth.uid()), dataset_id));

create policy collection_search_cells_select on public.collection_search_cells
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy collection_observations_select on public.collection_observations
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy market_snapshots_select on public.market_snapshots
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy market_snapshot_listings_select on public.market_snapshot_listings
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

create policy listing_verifications_select on public.listing_verifications
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));

grant select, insert, update on public.browser_collections to authenticated;
grant select on public.collection_search_cells to authenticated;
grant select on public.collection_observations to authenticated;
grant select on public.market_snapshots to authenticated;
grant select on public.market_snapshot_listings to authenticated;
grant select on public.listing_verifications to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic claim for the local worker (service role). Picks the oldest queued
-- collection whose requested start time has elapsed. FOR UPDATE SKIP LOCKED so
-- two workers never claim the same job.
-- ---------------------------------------------------------------------------
create or replace function private.claim_browser_collection(p_worker text)
  returns public.browser_collections
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  claimed public.browser_collections;
begin
  with next_job as (
    select id
    from public.browser_collections
    where state = 'queued'
      and (requested_start_at is null or requested_start_at <= now())
    order by requested_start_at asc nulls first, created_at asc
    for update skip locked
    limit 1
  )
  update public.browser_collections c
  set state = 'claimed',
      locked_by = p_worker,
      locked_at = now(),
      heartbeat_at = now(),
      started_at = coalesce(c.started_at, now()),
      updated_at = now()
  from next_job
  where c.id = next_job.id
  returning c.* into claimed;

  return claimed;
end;
$$;

-- Heartbeat + progress update from the worker. Only the lease holder may update.
create or replace function private.heartbeat_browser_collection(
  p_worker text,
  p_collection uuid,
  p_state app.collection_job_state default null,
  p_metrics jsonb default '{}'::jsonb
)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  update public.browser_collections
  set heartbeat_at = now(),
      updated_at = now(),
      state = coalesce(p_state, state),
      planned_cells = coalesce((p_metrics->>'planned_cells')::int, planned_cells),
      completed_cells = coalesce((p_metrics->>'completed_cells')::int, completed_cells),
      cards_discovered = coalesce((p_metrics->>'cards_discovered')::int, cards_discovered),
      unique_listings = coalesce((p_metrics->>'unique_listings')::int, unique_listings),
      duplicate_discoveries = coalesce((p_metrics->>'duplicate_discoveries')::int, duplicate_discoveries),
      detail_pages_completed = coalesce((p_metrics->>'detail_pages_completed')::int, detail_pages_completed),
      warning_count = coalesce((p_metrics->>'warning_count')::int, warning_count),
      error_count = coalesce((p_metrics->>'error_count')::int, error_count),
      current_area = coalesce(p_metrics->>'current_area', current_area),
      current_cell = coalesce(p_metrics->>'current_cell', current_cell)
  where id = p_collection and locked_by = p_worker;
$$;

revoke all on function private.claim_browser_collection(text) from public;
revoke all on function private.heartbeat_browser_collection(text, uuid, app.collection_job_state, jsonb) from public;
grant execute on function private.claim_browser_collection(text) to service_role;
grant execute on function private.heartbeat_browser_collection(text, uuid, app.collection_job_state, jsonb) to service_role;
