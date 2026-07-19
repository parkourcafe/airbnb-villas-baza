-- ---------------------------------------------------------------------------
-- Milestone 7 follow-up: enqueue report generation as a worker job
--
-- A report is generated asynchronously. When one is created it is queued as a
-- `report` job (no collection run — reports are analytics, not collection). The
-- worker claims the job, generates the CSV, uploads it and marks the report
-- ready with a row count and an expiry. Parameters remain immutable, so the
-- output is reproducible.
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_report_job()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into private.collection_jobs (job_type, status, payload, idempotency_key)
  values ('report', 'queued', jsonb_build_object('report_id', new.id::text),
          'report-job:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  update public.reports set status = 'queued' where id = new.id;
  return new;
end;
$$;

create trigger reports_enqueue
  after insert on public.reports
  for each row execute function private.enqueue_report_job();

-- Private bucket for generated report/export CSVs (created only where Storage
-- exists, mirroring the import-files bucket). Downloads use short-lived signed URLs.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('reports', 'reports', false)
    on conflict (id) do nothing;
  end if;
end
$$;
