-- ---------------------------------------------------------------------------
-- Launch follow-up (C16/7.4): async exports
--
-- Large exports (>10k rows) run as a worker job rather than synchronously. An
-- export records its filters, row count and expiry; the file lands in the
-- reports bucket. Organization-private, same as reports.
-- ---------------------------------------------------------------------------
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  export_type text not null,
  format text not null default 'csv',
  filters jsonb not null default '{}',
  status app.report_status not null default 'pending',
  output_object_path text,
  row_count integer,
  requested_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  error_summary text
);
create index exports_org_idx on public.exports (organization_id, dataset_id, created_at desc);

alter table public.exports enable row level security;
create policy exports_select on public.exports
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy exports_insert on public.exports
  for insert to authenticated
  with check (
    private.user_can_action_org((select auth.uid()), organization_id)
    and private.user_can_access_dataset((select auth.uid()), dataset_id)
  );
grant select, insert on public.exports to authenticated;

-- Enqueue an export job on creation (no collection run — this is analytics).
create or replace function private.enqueue_export_job()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into private.collection_jobs (job_type, status, payload, idempotency_key)
  values ('export', 'queued', jsonb_build_object('export_id', new.id::text),
          'export-job:' || new.id::text)
  on conflict (idempotency_key) do nothing;
  update public.exports set status = 'queued' where id = new.id;
  return new;
end;
$$;

create trigger exports_enqueue
  after insert on public.exports
  for each row execute function private.enqueue_export_job();
