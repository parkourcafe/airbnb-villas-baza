-- ---------------------------------------------------------------------------
-- Milestone 7: watchlists, leads, notes and reports
--
-- These are ORGANIZATION-PRIVATE tables (03 §17.3): a row is visible only to
-- members of its owning organization. Mutations require an analyst-or-higher
-- role (owner/admin/analyst); viewers are read-only. There is NO send/outreach
-- capability — leads capture intent and evidence only (07 compliance, 7.2).
-- ---------------------------------------------------------------------------

create type app.lead_stage as enum (
  'new', 'qualified', 'contacted', 'in_progress', 'won', 'lost', 'archived'
);

create type app.report_status as enum (
  'pending', 'queued', 'running', 'ready', 'failed', 'expired'
);

-- Analyst-or-higher predicate reused by every mutation policy below.
create or replace function private.user_can_action_org(uid uuid, org uuid)
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select private.user_has_org_role(
    uid, org, array['owner','admin','analyst']::app.member_role[]
  );
$$;
grant execute on function private.user_can_action_org(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Watchlists
-- ---------------------------------------------------------------------------
create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dataset_id, name)
);
create index watchlists_org_idx on public.watchlists (organization_id, dataset_id);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  item_type text not null,
  property_id uuid references public.properties (id) on delete cascade,
  source_listing_id uuid references public.source_listings (id) on delete cascade,
  region_id uuid references public.regions (id) on delete cascade,
  saved_filter jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Exactly one target type is populated (03 §12.2).
  constraint watchlist_items_one_target check (
    (case when property_id is not null then 1 else 0 end)
    + (case when source_listing_id is not null then 1 else 0 end)
    + (case when region_id is not null then 1 else 0 end)
    + (case when saved_filter is not null then 1 else 0 end) = 1
  )
);
create index watchlist_items_watchlist_idx on public.watchlist_items (watchlist_id);

-- ---------------------------------------------------------------------------
-- Leads and activities
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  source_listing_id uuid references public.source_listings (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  stage app.lead_stage not null default 'new',
  priority integer not null default 0,
  reason_code text,
  reason_text text,
  contact_name text,
  contact_role text,
  business_email extensions.citext,
  business_whatsapp text,
  website text,
  instagram text,
  contact_source_url text,
  contact_data_basis text,
  assigned_to uuid,
  last_activity_at timestamptz,
  next_action_at timestamptz,
  do_not_contact boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, property_id)
);
create index leads_org_stage_idx on public.leads (organization_id, stage, created_at desc);
create index leads_property_idx on public.leads (property_id);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  activity_type text not null,
  body text,
  previous_stage app.lead_stage,
  new_stage app.lead_stage,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Property notes (organization-private)
-- ---------------------------------------------------------------------------
create table public.property_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  body text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index property_notes_property_idx on public.property_notes (property_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Reports (immutable parameters; async generation is a worker job)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  report_type text not null,
  name text not null,
  parameters jsonb not null default '{}',
  status app.report_status not null default 'pending',
  output_object_path text,
  row_count integer,
  requested_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  error_summary text
);
create index reports_org_idx on public.reports (organization_id, dataset_id, created_at desc);

-- Report parameters are immutable once created (07 §7.3): block updates to the
-- parameters column so a "reproducible report" always reflects its request.
create or replace function private.reports_lock_parameters()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.parameters is distinct from old.parameters then
    raise exception 'report parameters are immutable';
  end if;
  return new;
end;
$$;
create trigger reports_parameters_immutable
  before update on public.reports
  for each row execute function private.reports_lock_parameters();

-- ---------------------------------------------------------------------------
-- RLS: organization-private
-- ---------------------------------------------------------------------------
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.property_notes enable row level security;
alter table public.reports enable row level security;

-- watchlists
create policy watchlists_select on public.watchlists
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy watchlists_insert on public.watchlists
  for insert to authenticated
  with check (
    private.user_can_action_org((select auth.uid()), organization_id)
    and private.user_can_access_dataset((select auth.uid()), dataset_id)
  );
create policy watchlists_update on public.watchlists
  for update to authenticated
  using (private.user_can_action_org((select auth.uid()), organization_id))
  with check (private.user_can_action_org((select auth.uid()), organization_id));
create policy watchlists_delete on public.watchlists
  for delete to authenticated
  using (private.user_can_action_org((select auth.uid()), organization_id));

-- watchlist_items: scoped through the parent watchlist's organization.
create policy watchlist_items_select on public.watchlist_items
  for select to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id
      and private.is_org_member((select auth.uid()), w.organization_id)
  ));
create policy watchlist_items_insert on public.watchlist_items
  for insert to authenticated
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id
      and private.user_can_action_org((select auth.uid()), w.organization_id)
  ));
create policy watchlist_items_delete on public.watchlist_items
  for delete to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id
      and private.user_can_action_org((select auth.uid()), w.organization_id)
  ));

-- leads
create policy leads_select on public.leads
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    private.user_can_action_org((select auth.uid()), organization_id)
    and private.user_can_access_dataset((select auth.uid()), dataset_id)
  );
create policy leads_update on public.leads
  for update to authenticated
  using (private.user_can_action_org((select auth.uid()), organization_id))
  with check (private.user_can_action_org((select auth.uid()), organization_id));

-- lead_activities: scoped through the parent lead's organization.
create policy lead_activities_select on public.lead_activities
  for select to authenticated
  using (exists (
    select 1 from public.leads l
    where l.id = lead_id
      and private.is_org_member((select auth.uid()), l.organization_id)
  ));
create policy lead_activities_insert on public.lead_activities
  for insert to authenticated
  with check (exists (
    select 1 from public.leads l
    where l.id = lead_id
      and private.user_can_action_org((select auth.uid()), l.organization_id)
  ));

-- property_notes
create policy property_notes_select on public.property_notes
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy property_notes_insert on public.property_notes
  for insert to authenticated
  with check (private.user_can_action_org((select auth.uid()), organization_id));
create policy property_notes_update on public.property_notes
  for update to authenticated
  using (private.user_can_action_org((select auth.uid()), organization_id))
  with check (private.user_can_action_org((select auth.uid()), organization_id));

-- reports
create policy reports_select on public.reports
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    private.user_can_action_org((select auth.uid()), organization_id)
    and private.user_can_access_dataset((select auth.uid()), dataset_id)
  );
create policy reports_update on public.reports
  for update to authenticated
  using (private.user_can_action_org((select auth.uid()), organization_id))
  with check (private.user_can_action_org((select auth.uid()), organization_id));

-- ---------------------------------------------------------------------------
-- Grants (row access still governed by the policies above)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.watchlists to authenticated;
grant select, insert, delete on public.watchlist_items to authenticated;
grant select, insert, update on public.leads to authenticated;
grant select, insert on public.lead_activities to authenticated;
grant select, insert, update on public.property_notes to authenticated;
grant select, insert, update on public.reports to authenticated;
