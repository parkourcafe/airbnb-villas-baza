-- ---------------------------------------------------------------------------
-- Milestone 8 follow-ups: source admin catalogue + scheduled collection enqueue
--
-- `private.data_sources` is off the Data API. This exposes a SAFE, credential-
-- free projection for the source-admin screen, plus a schedule table and a
-- service-role-only enqueue function that the cron trigger calls to create due
-- collection runs — always subject to the compliance gate.
-- ---------------------------------------------------------------------------
create view public.source_catalog
with (security_invoker = false) as
select
  id,
  key::text as key,
  display_name,
  access_mode::text as access_mode,
  compliance_status::text as compliance_status,
  automation_allowed,
  capabilities,
  terms_reviewed_at,
  review_expires_at,
  restriction_reason,
  rate_limit_policy
from private.data_sources;

grant select on public.source_catalog to authenticated;

-- ---------------------------------------------------------------------------
-- Collection schedules (dataset admins manage these).
-- ---------------------------------------------------------------------------
create table public.collection_schedules (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  source_id uuid not null references private.data_sources (id) on delete cascade,
  cadence_minutes integer not null default 1440,
  enabled boolean not null default true,
  last_enqueued_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dataset_id, source_id),
  constraint collection_schedules_cadence_positive check (cadence_minutes > 0)
);
create index collection_schedules_due_idx
  on public.collection_schedules (enabled, last_enqueued_at);

alter table public.collection_schedules enable row level security;
create policy collection_schedules_select on public.collection_schedules
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));
create policy collection_schedules_insert on public.collection_schedules
  for insert to authenticated
  with check (private.user_can_administer_dataset((select auth.uid()), dataset_id));
create policy collection_schedules_update on public.collection_schedules
  for update to authenticated
  using (private.user_can_administer_dataset((select auth.uid()), dataset_id))
  with check (private.user_can_administer_dataset((select auth.uid()), dataset_id));
grant select, insert, update on public.collection_schedules to authenticated;

-- ---------------------------------------------------------------------------
-- enqueue_due_collections: create runs+jobs for due schedules whose source is
-- approved and automation-allowed. Service-role only (called by the cron
-- trigger); never enqueues for a non-approved source (the compliance trigger on
-- collection_runs enforces this even if this function is changed).
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_due_collections()
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  r record;
  v_run uuid;
  v_count integer := 0;
begin
  for r in
    select s.id as schedule_id, s.dataset_id, s.source_id, s.cadence_minutes
    from public.collection_schedules s
    join private.data_sources d on d.id = s.source_id
    where s.enabled
      and d.compliance_status = 'approved'
      and d.automation_allowed
      and (
        s.last_enqueued_at is null
        or s.last_enqueued_at < now() - make_interval(mins => s.cadence_minutes)
      )
  loop
    insert into private.collection_runs (dataset_id, source_id, run_kind, status, requested_by_system)
      values (r.dataset_id, r.source_id, 'collect', 'queued', 'cron')
      returning id into v_run;
    insert into private.collection_jobs (collection_run_id, job_type, status)
      values (v_run, 'collect', 'queued');
    update public.collection_schedules set last_enqueued_at = now(), updated_at = now()
      where id = r.schedule_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.enqueue_due_collections() from public;
revoke all on function public.enqueue_due_collections() from anon;
revoke all on function public.enqueue_due_collections() from authenticated;
grant execute on function public.enqueue_due_collections() to service_role;
