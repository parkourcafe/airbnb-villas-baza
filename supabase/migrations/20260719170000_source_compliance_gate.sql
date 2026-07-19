-- ---------------------------------------------------------------------------
-- Milestone 8: database-level source compliance gate
--
-- The worker enforces the compliance gate in code before it invokes an adapter,
-- but a collection run must NEVER be creatable for a non-approved source even if
-- a row is inserted by hand (08 acceptance: "disabled/pending source cannot run
-- even if job inserted manually"). This trigger rejects any collection run whose
-- source is not approved, so the prohibition holds at the data layer too.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_source_compliance()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_status app.source_compliance_status;
  v_automation boolean;
begin
  select compliance_status, automation_allowed
    into v_status, v_automation
  from private.data_sources
  where id = new.source_id;

  if v_status is null then
    raise exception 'unknown source % for collection run', new.source_id;
  end if;
  if v_status is distinct from 'approved' then
    raise exception 'source % is not approved for collection (status: %)',
      new.source_id, v_status;
  end if;
  return new;
end;
$$;

create trigger collection_runs_source_compliance
  before insert on private.collection_runs
  for each row execute function private.enforce_source_compliance();
