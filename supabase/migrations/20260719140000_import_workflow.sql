-- Milestone 3: CSV import workflow.
--
-- Adds the user-facing `imports` record and its `import_rejections`, an
-- import_status enum, a private storage bucket for uploaded files, and the
-- atomic job-claim function (FOR UPDATE SKIP LOCKED) the worker uses. Snapshot
-- creation from accepted rows is the snapshot engine's job (M4).

create type app.import_status as enum (
  'uploaded', 'validating', 'ready', 'processing',
  'completed', 'completed_with_errors', 'failed', 'cancelled'
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_id uuid not null references private.data_sources (id),
  status app.import_status not null default 'uploaded',
  input_object_path text,
  original_filename text,
  file_checksum text,
  column_mapping jsonb not null default '{}',
  requested_by uuid,
  collection_run_id uuid references private.collection_runs (id),
  total_rows integer not null default 0,
  accepted_rows integer not null default 0,
  rejected_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  warning_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
-- Idempotency: the same file for the same org/dataset/source is one import.
create unique index imports_idempotency_idx
  on public.imports (organization_id, dataset_id, source_id, file_checksum)
  where file_checksum is not null;
create index imports_org_created_idx
  on public.imports (organization_id, created_at desc);

create table public.import_rejections (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.imports (id) on delete cascade,
  row_number integer not null,
  error_code text not null,
  error_message text,
  raw_row jsonb,
  created_at timestamptz not null default now()
);
create index import_rejections_import_idx
  on public.import_rejections (import_id, row_number);

-- RLS helper: can the user reach this import (via its organization)?
create or replace function private.user_can_access_import(uid uuid, imp uuid)
  returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.imports i
    join public.organization_members m on m.organization_id = i.organization_id
    where i.id = imp and m.user_id = uid
  );
$$;

alter table public.imports enable row level security;
alter table public.import_rejections enable row level security;

create policy imports_select on public.imports
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));

-- Non-viewers may create an import for an organization they belong to, on a
-- dataset they can access.
create policy imports_insert on public.imports
  for insert to authenticated
  with check (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner','admin','analyst']::app.member_role[])
    and private.user_can_access_dataset((select auth.uid()), dataset_id)
  );

create policy import_rejections_select on public.import_rejections
  for select to authenticated
  using (private.user_can_access_import((select auth.uid()), import_id));

grant execute on function private.user_can_access_import(uuid, uuid) to authenticated;
grant select, insert on public.imports to authenticated;
grant select on public.import_rejections to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic job claim (FOR UPDATE SKIP LOCKED). Called by the worker (service
-- role). Two workers can call concurrently; each queued job is claimed once.
-- ---------------------------------------------------------------------------
create or replace function private.claim_collection_job(p_worker text)
  returns private.collection_jobs
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  claimed private.collection_jobs;
begin
  with next_job as (
    select id
    from private.collection_jobs
    where status = 'queued' and scheduled_for <= now()
    order by priority desc, scheduled_for asc, created_at asc
    for update skip locked
    limit 1
  )
  update private.collection_jobs job
  set
    status = 'running',
    locked_at = now(),
    locked_by = p_worker,
    started_at = coalesce(job.started_at, now()),
    heartbeat_at = now(),
    attempts = job.attempts + 1
  from next_job
  where job.id = next_job.id
  returning job.* into claimed;

  return claimed;
end;
$$;

create or replace function private.heartbeat_collection_job(
  p_job uuid, p_worker text, p_current integer default null, p_total integer default null, p_stage text default null
)
  returns void language sql security definer set search_path = '' as $$
  update private.collection_jobs
  set heartbeat_at = now(),
      progress_current = coalesce(p_current, progress_current),
      progress_total = coalesce(p_total, progress_total),
      progress_stage = coalesce(p_stage, progress_stage)
  where id = p_job and locked_by = p_worker;
$$;

grant execute on function private.claim_collection_job(text) to service_role;
grant execute on function private.heartbeat_collection_job(uuid, text, integer, integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- Enqueue a collection run + import job when an import row with an uploaded file
-- is created. This keeps the web app to RLS-checked inserts on `public.imports`
-- (it never touches the private queue directly). Deterministic idempotency keys
-- make re-inserting the same import a no-op.
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_import_job()
  returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  run_id uuid;
begin
  if new.input_object_path is null then
    return new;
  end if;

  insert into private.collection_runs
    (dataset_id, source_id, run_kind, status, requested_by_user_id, idempotency_key)
  values
    (new.dataset_id, new.source_id, 'import', 'queued', new.requested_by, 'import:' || new.id::text)
  on conflict (idempotency_key) do nothing
  returning id into run_id;

  if run_id is null then
    select id into run_id from private.collection_runs
    where idempotency_key = 'import:' || new.id::text;
  end if;

  update public.imports set collection_run_id = run_id where id = new.id;

  insert into private.collection_jobs
    (collection_run_id, job_type, status, payload, idempotency_key)
  values
    (run_id, 'import', 'queued', jsonb_build_object('import_id', new.id::text), 'import-job:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

create trigger imports_enqueue
  after insert on public.imports
  for each row execute function private.enqueue_import_job();

-- ---------------------------------------------------------------------------
-- Curated public projection of approved manual-import sources so the import
-- wizard can offer a source without exposing the private registry. Exposes only
-- non-sensitive reference fields (no credentials, config schema or rate limits).
-- Runs as owner (not security_invoker) purely to read the private table; the
-- projected data is non-tenant reference data.
-- ---------------------------------------------------------------------------
create view public.import_sources
with (security_invoker = false) as
select
  id,
  key::text as key,
  display_name,
  access_mode::text as access_mode
from private.data_sources
where compliance_status = 'approved'
  and access_mode in ('manual_import', 'demo_fixture', 'owner_supplied');

grant select on public.import_sources to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket for uploaded CSVs (guarded: the `storage` schema only
-- exists in a real Supabase stack, not in the PGlite test harness). Uploads and
-- downloads go through server-generated signed URLs, so no per-user storage RLS
-- is required for the MVP.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('import-files', 'import-files', false)
    on conflict (id) do nothing;
  end if;
end
$$;
