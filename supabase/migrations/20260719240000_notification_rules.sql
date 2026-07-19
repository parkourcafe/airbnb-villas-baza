-- ---------------------------------------------------------------------------
-- Launch follow-up (C15): notification rules (behind delivery flag)
--
-- Stores which events an organization wants to be notified about. Actual email/
-- channel delivery is post-MVP (v1.1); this table lets rules be authored now and
-- delivered later. Organization-private, analyst+ to manage (03 §12.3).
-- ---------------------------------------------------------------------------
create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  watchlist_id uuid references public.watchlists (id) on delete set null,
  name text not null,
  event_types text[] not null default '{}',
  minimum_confidence app.confidence_level not null default 'medium',
  channel text not null default 'email',
  destination text,
  schedule text,
  enabled boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_rules_org_idx on public.notification_rules (organization_id, enabled);

alter table public.notification_rules enable row level security;
create policy notification_rules_select on public.notification_rules
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy notification_rules_insert on public.notification_rules
  for insert to authenticated
  with check (private.user_can_action_org((select auth.uid()), organization_id));
create policy notification_rules_update on public.notification_rules
  for update to authenticated
  using (private.user_can_action_org((select auth.uid()), organization_id))
  with check (private.user_can_action_org((select auth.uid()), organization_id));
grant select, insert, update on public.notification_rules to authenticated;
