-- Milestone 1 seed data. ALL rows here are demo data for local development and
-- must never be presented as real production data.
--
-- Demo credentials (local only):
--   owner@demo.local  / demo-password-owner   (role: owner)
--   viewer@demo.local / demo-password-viewer  (role: viewer)
--
-- NOTE: directly seeding `auth.users` is Supabase-version sensitive. This is
-- provided for local convenience (`supabase db reset`); for other environments
-- prefer the Supabase admin API / CLI to create users. Everything is idempotent.

-- --- Demo auth users -------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated', 'authenticated', 'owner@demo.local',
    extensions.crypt('demo-password-owner', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Demo Owner"}', false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a2',
    'authenticated', 'authenticated', 'viewer@demo.local',
    extensions.crypt('demo-password-viewer', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Demo Viewer"}', false
  )
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a1',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"owner@demo.local"}',
    'email', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a2',
    '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"viewer@demo.local"}',
    'email', now(), now(), now()
  )
on conflict (provider, provider_id) do nothing;

-- Mark the demo owner as the system owner (server-only flag, not used by RLS).
update public.profiles set is_system_owner = true, full_name = 'Demo Owner'
where id = '00000000-0000-0000-0000-0000000000a1';

-- --- Demo organization -----------------------------------------------------
insert into public.organizations (id, name, slug, plan_code)
values (
  '00000000-0000-0000-0000-0000000000b1',
  'Other Bali Internal', 'other-bali-internal', 'internal_beta'
)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', 'viewer')
on conflict (organization_id, user_id) do nothing;

-- --- Demo dataset ----------------------------------------------------------
insert into public.datasets (id, name, slug, description, owner_organization_id, is_demo)
values (
  '00000000-0000-0000-0000-0000000000c1',
  'Bali Accommodation Market', 'bali-accommodation-market',
  'Demo dataset for the Bali accommodation market.',
  '00000000-0000-0000-0000-0000000000b1', true
)
on conflict (id) do nothing;

insert into public.organization_dataset_access (organization_id, dataset_id, access_level)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000c1', 'manage'
)
on conflict (organization_id, dataset_id) do nothing;
