-- ---------------------------------------------------------------------------
-- Milestone 9: manual entity resolution (property merge)
--
-- Merging reassigns a duplicate property's source listings, events, aliases and
-- notes onto a canonical property, records an auditable redirect, and archives
-- (never deletes) the duplicate. Immutable snapshots and source listings are
-- always preserved, so all history stays reachable through the canonical
-- property (09 acceptance). Only a dataset administrator may merge.
-- ---------------------------------------------------------------------------
create table public.property_redirects (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  from_property_id uuid not null,
  to_property_id uuid not null references public.properties (id) on delete cascade,
  reason text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index property_redirects_from_idx on public.property_redirects (from_property_id);
create index property_redirects_to_idx on public.property_redirects (to_property_id);

alter table public.property_redirects enable row level security;
create policy property_redirects_select on public.property_redirects
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), dataset_id));
grant select on public.property_redirects to authenticated;

-- ---------------------------------------------------------------------------
-- merge_properties: privileged, audited, admin-gated.
--
-- Client-callable RPC, so it lives in `public`; per AGENTS.md the SECURITY
-- DEFINER hardening checklist is applied in full: fixed empty search_path,
-- explicit auth.uid() admin validation, execute revoked from public/anon and
-- granted only to authenticated. It never deletes snapshots or source listings.
-- ---------------------------------------------------------------------------
create or replace function public.merge_properties(
  p_from uuid, p_to uuid, p_reason text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_dataset uuid;
  v_to_dataset uuid;
  v_org uuid;
begin
  if p_from = p_to then
    raise exception 'cannot merge a property into itself';
  end if;

  select dataset_id into v_dataset from public.properties where id = p_from;
  select dataset_id into v_to_dataset from public.properties where id = p_to;
  if v_dataset is null or v_to_dataset is null then
    raise exception 'both properties must exist';
  end if;
  if v_dataset is distinct from v_to_dataset then
    raise exception 'properties belong to different datasets';
  end if;

  -- Authorization from the membership tables (never user metadata).
  if not private.user_can_administer_dataset(v_uid, v_dataset) then
    raise exception 'not authorized to merge properties in this dataset';
  end if;

  -- Reassign everything that points at the duplicate; snapshots follow their
  -- source listings, so nothing is deleted and all history stays reachable.
  update public.source_listings set property_id = p_to, updated_at = now()
    where property_id = p_from;
  update public.events set property_id = p_to where property_id = p_from;
  update public.property_aliases set property_id = p_to where property_id = p_from;
  update public.property_notes set property_id = p_to where property_id = p_from;

  -- Recompute the canonical property's observation window.
  update public.properties tgt
  set first_observed_at = least(
        tgt.first_observed_at,
        (select min(first_seen_at) from public.source_listings where property_id = p_to)
      ),
      last_observed_at = greatest(
        tgt.last_observed_at,
        (select max(last_observed_at) from public.source_listings where property_id = p_to)
      ),
      updated_at = now()
  where tgt.id = p_to;

  -- Archive (do not delete) the duplicate.
  update public.properties set archived_at = now(), updated_at = now()
    where id = p_from;

  insert into public.property_redirects (dataset_id, from_property_id, to_property_id, reason, created_by)
    values (v_dataset, p_from, p_to, p_reason, v_uid);

  select owner_organization_id into v_org from public.datasets where id = v_dataset;
  insert into public.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (v_org, v_uid, 'property.merge', 'property', p_from::text,
            jsonb_build_object('to_property_id', p_to, 'reason', p_reason));
end;
$$;

revoke all on function public.merge_properties(uuid, uuid, text) from public;
revoke all on function public.merge_properties(uuid, uuid, text) from anon;
grant execute on function public.merge_properties(uuid, uuid, text) to authenticated;
