-- ---------------------------------------------------------------------------
-- Milestone 9 follow-up: property split and merge rollback
--
-- Split separates a source listing into its own property; rollback reverses a
-- prior merge precisely using the recorded moved-listing set. Both are
-- admin-gated, audited, and preserve snapshots/source listings (nothing is ever
-- deleted). The redirect record gains a `kind` and the exact set of source
-- listings moved so a rollback can be exact.
-- ---------------------------------------------------------------------------
alter table public.property_redirects
  add column kind text not null default 'merge';
alter table public.property_redirects
  add column moved_source_listing_ids uuid[] not null default '{}';

-- Recreate merge_properties so it records the exact listings it moved, enabling
-- a precise rollback later. Behaviour is otherwise identical to Milestone 9.
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
  v_moved uuid[];
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
  if not private.user_can_administer_dataset(v_uid, v_dataset) then
    raise exception 'not authorized to merge properties in this dataset';
  end if;

  -- Capture the exact set of listings being moved before reassigning them.
  select coalesce(array_agg(id), '{}') into v_moved
  from public.source_listings where property_id = p_from;

  update public.source_listings set property_id = p_to, updated_at = now()
    where property_id = p_from;
  update public.events set property_id = p_to where property_id = p_from;
  update public.property_aliases set property_id = p_to where property_id = p_from;
  update public.property_notes set property_id = p_to where property_id = p_from;

  update public.properties tgt
  set first_observed_at = least(tgt.first_observed_at,
        (select min(first_seen_at) from public.source_listings where property_id = p_to)),
      last_observed_at = greatest(tgt.last_observed_at,
        (select max(last_observed_at) from public.source_listings where property_id = p_to)),
      updated_at = now()
  where tgt.id = p_to;

  update public.properties set archived_at = now(), updated_at = now()
    where id = p_from;

  insert into public.property_redirects
    (dataset_id, from_property_id, to_property_id, reason, created_by, kind, moved_source_listing_ids)
    values (v_dataset, p_from, p_to, p_reason, v_uid, 'merge', v_moved);

  select owner_organization_id into v_org from public.datasets where id = v_dataset;
  insert into public.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (v_org, v_uid, 'property.merge', 'property', p_from::text,
            jsonb_build_object('to_property_id', p_to, 'reason', p_reason,
                               'moved_count', coalesce(array_length(v_moved, 1), 0)));
end;
$$;

revoke all on function public.merge_properties(uuid, uuid, text) from public;
revoke all on function public.merge_properties(uuid, uuid, text) from anon;
grant execute on function public.merge_properties(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- split_listing: move one source listing (and its events) into a new property.
-- ---------------------------------------------------------------------------
create or replace function public.split_listing(
  p_source_listing uuid, p_reason text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_dataset uuid;
  v_from uuid;
  v_to uuid;
  v_org uuid;
  v_title text;
  v_external text;
begin
  select dataset_id, property_id, current_title, external_id
    into v_dataset, v_from, v_title, v_external
  from public.source_listings where id = p_source_listing;
  if v_dataset is null then
    raise exception 'source listing not found';
  end if;
  if not private.user_can_administer_dataset(v_uid, v_dataset) then
    raise exception 'not authorized to split listings in this dataset';
  end if;

  insert into public.properties (dataset_id, canonical_name, first_observed_at, last_observed_at)
  select v_dataset, coalesce(v_title, 'Listing ' || v_external),
         sl.first_seen_at, sl.last_observed_at
  from public.source_listings sl where sl.id = p_source_listing
  returning id into v_to;

  update public.source_listings set property_id = v_to, updated_at = now()
    where id = p_source_listing;
  update public.events set property_id = v_to
    where source_listing_id = p_source_listing;

  insert into public.property_redirects
    (dataset_id, from_property_id, to_property_id, reason, created_by, kind, moved_source_listing_ids)
    values (v_dataset, v_from, v_to, p_reason, v_uid, 'split', array[p_source_listing]);

  select owner_organization_id into v_org from public.datasets where id = v_dataset;
  insert into public.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (v_org, v_uid, 'property.split', 'source_listing', p_source_listing::text,
            jsonb_build_object('from_property_id', v_from, 'to_property_id', v_to, 'reason', p_reason));
  return v_to;
end;
$$;

revoke all on function public.split_listing(uuid, text) from public;
revoke all on function public.split_listing(uuid, text) from anon;
grant execute on function public.split_listing(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- rollback_merge: reverse a prior merge using its recorded moved-listing set.
-- ---------------------------------------------------------------------------
create or replace function public.rollback_merge(
  p_redirect uuid, p_reason text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_dataset uuid;
  v_from uuid;
  v_to uuid;
  v_kind text;
  v_moved uuid[];
  v_org uuid;
begin
  select dataset_id, from_property_id, to_property_id, kind, moved_source_listing_ids
    into v_dataset, v_from, v_to, v_kind, v_moved
  from public.property_redirects where id = p_redirect;
  if v_dataset is null then
    raise exception 'redirect not found';
  end if;
  if v_kind <> 'merge' then
    raise exception 'only a merge can be rolled back';
  end if;
  if not private.user_can_administer_dataset(v_uid, v_dataset) then
    raise exception 'not authorized to roll back in this dataset';
  end if;

  -- Restore the archived source property and move exactly the merged listings back.
  update public.properties set archived_at = null, updated_at = now() where id = v_from;
  update public.source_listings set property_id = v_from, updated_at = now()
    where id = any (v_moved);
  update public.events set property_id = v_from
    where source_listing_id = any (v_moved);

  insert into public.property_redirects
    (dataset_id, from_property_id, to_property_id, reason, created_by, kind, moved_source_listing_ids)
    values (v_dataset, v_to, v_from, p_reason, v_uid, 'rollback', v_moved);

  select owner_organization_id into v_org from public.datasets where id = v_dataset;
  insert into public.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (v_org, v_uid, 'property.merge_rollback', 'property', v_from::text,
            jsonb_build_object('redirect_id', p_redirect, 'reason', p_reason));
end;
$$;

revoke all on function public.rollback_merge(uuid, text) from public;
revoke all on function public.rollback_merge(uuid, text) from anon;
grant execute on function public.rollback_merge(uuid, text) to authenticated;
