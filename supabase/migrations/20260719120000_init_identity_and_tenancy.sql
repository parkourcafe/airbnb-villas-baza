-- Milestone 1: identity and tenancy foundation.
--
-- Creates the profiles / organizations / memberships / datasets / dataset-access
-- model with Row Level Security on every exposed table. No property, listing,
-- snapshot or import tables are created here (that is Milestone 2).
--
-- Security model:
--   * The Data API is scoped to `public` (see config.toml); `private` and `app`
--     are never exposed through PostgREST.
--   * RLS helper functions live in `private` and are SECURITY DEFINER with a
--     fixed empty search_path so they can evaluate membership without tripping
--     the row policies of the tables they read (which would otherwise recurse).
--   * Authorization derives ONLY from these tables, never from user metadata.

-- ---------------------------------------------------------------------------
-- Schemas and extensions
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
create schema if not exists private;
create schema if not exists app;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (kept in the `app` schema; only the ones Milestone 1 uses)
-- ---------------------------------------------------------------------------
create type app.member_role as enum ('owner', 'admin', 'analyst', 'viewer');
create type app.dataset_status as enum ('active', 'paused', 'archived');
create type app.access_level as enum ('read', 'manage');

-- ---------------------------------------------------------------------------
-- Shared trigger helpers (private)
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per Supabase Auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text not null default 'Asia/Makassar',
  is_system_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.is_system_owner is
  'Server-only elevated flag. Never used for row authorization in RLS policies.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  status text not null default 'active',
  plan_code text not null default 'internal_beta',
  default_timezone text not null default 'Asia/Makassar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role app.member_role not null,
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx
  on public.organization_members (user_id, organization_id);
create index organization_members_org_role_idx
  on public.organization_members (organization_id, role);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  description text,
  status app.dataset_status not null default 'active',
  owner_organization_id uuid references public.organizations (id),
  coverage_country_code char(2) not null default 'ID',
  coverage_region text not null default 'Bali',
  default_timezone text not null default 'Asia/Makassar',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_dataset_access (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  access_level app.access_level not null default 'read',
  created_at timestamptz not null default now(),
  primary key (organization_id, dataset_id)
);
create index organization_dataset_access_dataset_idx
  on public.organization_dataset_access (dataset_id);

-- updated_at triggers
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger datasets_set_updated_at
  before update on public.datasets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- New-user handling: create a profile row when an auth user is created.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions (private, SECURITY DEFINER, fixed search_path).
-- They bypass the row policies of the tables they read, which prevents policy
-- recursion. Authorization derives only from membership/access tables.
-- ---------------------------------------------------------------------------
create or replace function private.is_org_member(uid uuid, org uuid)
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = uid and m.organization_id = org
  );
$$;

create or replace function private.user_has_org_role(
  uid uuid, org uuid, allowed_roles app.member_role[]
)
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = uid
      and m.organization_id = org
      and m.role = any (allowed_roles)
  );
$$;

create or replace function private.user_can_access_dataset(uid uuid, ds uuid)
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_dataset_access a
      on a.organization_id = m.organization_id
    where m.user_id = uid and a.dataset_id = ds
  );
$$;

create or replace function private.user_can_manage_dataset(uid uuid, ds uuid)
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_dataset_access a
      on a.organization_id = m.organization_id
    where m.user_id = uid
      and a.dataset_id = ds
      and a.access_level = 'manage'
      and m.role in ('owner', 'admin')
  );
$$;

-- May the user grant/revoke access to this dataset? Only an owner/admin of the
-- dataset's owning organization can administer its access grants. This is what
-- stops an org admin from granting their own org access to another org's
-- dataset by id.
create or replace function private.user_can_administer_dataset(uid uuid, ds uuid)
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select exists (
    select 1
    from public.datasets d
    join public.organization_members m
      on m.organization_id = d.owner_organization_id
    where d.id = ds
      and m.user_id = uid
      and m.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.datasets enable row level security;
alter table public.organization_dataset_access enable row level security;

-- profiles: self access only (system-owner reads go through a server-only path).
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: members read; owners/admins update.
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (private.is_org_member((select auth.uid()), id));
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (
    private.user_has_org_role((select auth.uid()), id, array['owner', 'admin']::app.member_role[])
  )
  with check (
    private.user_has_org_role((select auth.uid()), id, array['owner', 'admin']::app.member_role[])
  );

-- organization_members: members read co-members; owners/admins manage.
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
-- Owners may manage any member (including other owners). Admins may manage
-- non-owner members only, and cannot create/promote owners - this prevents an
-- admin from self-escalating to owner or removing an owner.
create policy organization_members_insert_admin on public.organization_members
  for insert to authenticated
  with check (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner']::app.member_role[])
    or (
      private.user_has_org_role((select auth.uid()), organization_id, array['admin']::app.member_role[])
      and role <> 'owner'
    )
  );
create policy organization_members_update_admin on public.organization_members
  for update to authenticated
  using (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner']::app.member_role[])
    or (
      private.user_has_org_role((select auth.uid()), organization_id, array['admin']::app.member_role[])
      and role <> 'owner'
    )
  )
  with check (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner']::app.member_role[])
    or (
      private.user_has_org_role((select auth.uid()), organization_id, array['admin']::app.member_role[])
      and role <> 'owner'
    )
  );
create policy organization_members_delete_admin on public.organization_members
  for delete to authenticated
  using (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner']::app.member_role[])
    or (
      private.user_has_org_role((select auth.uid()), organization_id, array['admin']::app.member_role[])
      and role <> 'owner'
    )
  );

-- datasets: accessible to organizations granted access; managed by manage access.
create policy datasets_select_access on public.datasets
  for select to authenticated
  using (private.user_can_access_dataset((select auth.uid()), id));
create policy datasets_update_manage on public.datasets
  for update to authenticated
  using (private.user_can_manage_dataset((select auth.uid()), id))
  with check (private.user_can_manage_dataset((select auth.uid()), id));

-- organization_dataset_access: members read; owners/admins manage.
create policy org_dataset_access_select on public.organization_dataset_access
  for select to authenticated
  using (private.is_org_member((select auth.uid()), organization_id));
create policy org_dataset_access_insert_admin on public.organization_dataset_access
  for insert to authenticated
  with check (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner', 'admin']::app.member_role[])
    and private.user_can_administer_dataset((select auth.uid()), dataset_id)
  );
create policy org_dataset_access_delete_admin on public.organization_dataset_access
  for delete to authenticated
  using (
    private.user_has_org_role((select auth.uid()), organization_id, array['owner', 'admin']::app.member_role[])
  );

-- ---------------------------------------------------------------------------
-- Explicit grants (the Data API cannot see a table without them).
-- anon receives nothing on tenancy tables; authenticated is row-restricted by RLS.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant usage on schema app to anon, authenticated;
grant usage on schema extensions to anon, authenticated;

-- `authenticated` needs USAGE on `private` to invoke the SECURITY DEFINER RLS
-- helpers from policies. This does NOT expose private tables via the Data API,
-- which is scoped to `public` only. No table privileges are granted here.
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid, uuid) to authenticated;
grant execute on function private.user_has_org_role(uuid, uuid, app.member_role[]) to authenticated;
grant execute on function private.user_can_access_dataset(uuid, uuid) to authenticated;
grant execute on function private.user_can_manage_dataset(uuid, uuid) to authenticated;
grant execute on function private.user_can_administer_dataset(uuid, uuid) to authenticated;

-- Column-scoped grants keep clients from writing the server-only
-- `is_system_owner` flag (it is set by the seed/service role only).
grant select on public.profiles to authenticated;
grant insert (id, full_name, avatar_url, timezone) on public.profiles to authenticated;
grant update (full_name, avatar_url, timezone) on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, update on public.datasets to authenticated;
grant select, insert, delete on public.organization_dataset_access to authenticated;
