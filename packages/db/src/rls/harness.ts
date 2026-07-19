import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * In-process Postgres (PGlite/WASM) harness for exercising the identity/tenancy
 * migration and its Row Level Security policies WITHOUT Docker or the Supabase
 * stack.
 *
 * It reproduces the objects Supabase provides at runtime (the `auth` schema,
 * `auth.users`, `auth.uid()` and the anon/authenticated/service_role roles) and
 * then applies the real migration files verbatim, so the policies under test are
 * exactly the ones that ship. `auth.uid()` is emulated by reading the
 * `request.jwt.claim.sub` GUC, which is how the real function resolves the JWT
 * subject.
 *
 * Note: PGlite does not bundle `pgcrypto`. It is only needed by the seed's
 * `crypt()` calls, never by the schema/policies, and `gen_random_uuid()` is a
 * Postgres 13+ built-in, so the harness strips the `create extension pgcrypto`
 * line before applying.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(
  here,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
);

export const TENANCY_IDS = {
  owner1: "00000000-0000-0000-0000-0000000a0001",
  viewer1: "00000000-0000-0000-0000-0000000a0002",
  owner2: "00000000-0000-0000-0000-0000000a0003",
  outsider: "00000000-0000-0000-0000-0000000a0004",
  extra: "00000000-0000-0000-0000-0000000a0005",
  admin1: "00000000-0000-0000-0000-0000000a0006",
  org1: "00000000-0000-0000-0000-0000000b0001",
  org2: "00000000-0000-0000-0000-0000000b0002",
  org3: "00000000-0000-0000-0000-0000000b0003",
  datasetA: "00000000-0000-0000-0000-0000000c0001",
  datasetB: "00000000-0000-0000-0000-0000000c0002",
  // datasetC is owned by org1 but has no access grant yet.
  datasetC: "00000000-0000-0000-0000-0000000c0003",
  // Catalogue fixtures (Milestone 2).
  region1: "00000000-0000-0000-0000-0000000d0001",
  source1: "00000000-0000-0000-0000-0000000d0002",
  runA: "00000000-0000-0000-0000-0000000d0003",
  propertyA1: "00000000-0000-0000-0000-0000000e0001",
  propertyA2: "00000000-0000-0000-0000-0000000e0002",
  propertyB1: "00000000-0000-0000-0000-0000000e0003",
  listingA1: "00000000-0000-0000-0000-0000000f0001",
  snapshotA1: "00000000-0000-0000-0000-0000000f0002",
  eventA1: "00000000-0000-0000-0000-0000000f0003",
  evidenceA1: "00000000-0000-0000-0000-000000100001",
} as const;

/**
 * Read all migrations and preprocess the DDL that PGlite cannot run. This only
 * removes extensions/types/indexes the RLS policies never reference:
 * - `pgcrypto` (only the seed's crypt() needs it; gen_random_uuid is built-in);
 * - `postgis` + `geography(...)` columns + GiST spatial indexes (PGlite has no
 *   PostGIS; the app/tests read the denormalized numeric lat/lng columns).
 */
function readMigrations(): string {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return files
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n")
    .replace(
      /create extension if not exists pgcrypto[^;]*;/gi,
      "-- pgcrypto omitted (not needed for schema/RLS tests)",
    )
    .replace(
      /create extension if not exists postgis[^;]*;/gi,
      "-- postgis omitted (PGlite has no PostGIS; geo columns become text)",
    )
    .replace(/geography\([^)]*\)/gi, "text")
    .replace(
      /create index[^;]*using gist[^;]*;/gi,
      "-- gist spatial index omitted (no PostGIS in PGlite)",
    );
}

export interface TestDatabase {
  db: PGlite;
  /** Run subsequent queries as `authenticated` with the given user id as auth.uid(). */
  actAs(userId: string): Promise<void>;
  /** Run subsequent queries as the anonymous role. */
  actAsAnon(): Promise<void>;
  /** Return to the (superuser) migration/seed role. */
  actAsSuperuser(): Promise<void>;
  ids: typeof TENANCY_IDS;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite({ extensions: { citext } });

  // Objects that Supabase provides at runtime.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      raw_app_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);

  await db.exec(readMigrations());

  await seed(db);

  const actAs = async (userId: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      userId,
    ]);
    await db.exec("set role authenticated");
  };
  const actAsAnon = async () => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec("set role anon");
  };
  const actAsSuperuser = async () => {
    await db.exec("reset role");
  };

  return { db, actAs, actAsAnon, actAsSuperuser, ids: TENANCY_IDS };
}

async function seed(db: PGlite): Promise<void> {
  const i = TENANCY_IDS;
  // Auth users (fires the handle_new_user trigger -> profiles).
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${i.owner1}',  'owner1@demo.local',  '{"full_name":"Owner One"}'),
      ('${i.viewer1}', 'viewer1@demo.local', '{"full_name":"Viewer One"}'),
      ('${i.owner2}',  'owner2@demo.local',  '{"full_name":"Owner Two"}'),
      ('${i.outsider}','outsider@demo.local','{"full_name":"Outsider"}'),
      ('${i.extra}',   'extra@demo.local',   '{"full_name":"Extra"}'),
      ('${i.admin1}',  'admin1@demo.local',  '{"full_name":"Admin One"}');

    insert into public.organizations (id, name, slug) values
      ('${i.org1}', 'Org One', 'org-one'),
      ('${i.org2}', 'Org Two', 'org-two'),
      ('${i.org3}', 'Org Three', 'org-three');

    insert into public.organization_members (organization_id, user_id, role) values
      ('${i.org1}', '${i.owner1}',  'owner'),
      ('${i.org1}', '${i.admin1}',  'admin'),
      ('${i.org1}', '${i.viewer1}', 'viewer'),
      ('${i.org2}', '${i.owner2}',  'owner'),
      ('${i.org3}', '${i.outsider}','owner');

    insert into public.datasets (id, name, slug, is_demo, owner_organization_id) values
      ('${i.datasetA}', 'Dataset A', 'dataset-a', true, '${i.org1}'),
      ('${i.datasetB}', 'Dataset B', 'dataset-b', true, '${i.org2}'),
      ('${i.datasetC}', 'Dataset C', 'dataset-c', true, '${i.org1}');

    insert into public.organization_dataset_access (organization_id, dataset_id, access_level) values
      ('${i.org1}', '${i.datasetA}', 'manage'),
      ('${i.org2}', '${i.datasetB}', 'read');
  `);

  // Catalogue fixtures (geography columns are text in the harness; only the
  // numeric lat/lng and the non-geo columns are populated).
  await db.exec(`
    insert into public.regions (id, name, slug, region_type) values
      ('${i.region1}', 'Canggu', 'canggu', 'area');

    insert into private.data_sources (id, key, display_name, access_mode, compliance_status, automation_allowed, capabilities) values
      ('${i.source1}', 'demo_fixture', 'Demo Fixture', 'demo_fixture', 'approved', true, '{listing_identity,listing_status}');

    insert into private.collection_runs (id, dataset_id, source_id, run_kind, status, parser_version) values
      ('${i.runA}', '${i.datasetA}', '${i.source1}', 'import', 'completed', 'demo-1');

    insert into public.properties
      (id, dataset_id, canonical_name, primary_region_id, latitude, longitude, current_lifecycle_status, current_confidence, first_observed_at, last_observed_at) values
      ('${i.propertyA1}', '${i.datasetA}', 'Villa Aruna', '${i.region1}', -8.6478, 115.1385, 'active', 'high', '2026-07-18T00:00:00Z', '2026-07-20T00:00:00Z'),
      ('${i.propertyA2}', '${i.datasetA}', 'Villa Sora', '${i.region1}', -8.8291, 115.0849, 'suspected_inactive', 'medium', '2026-07-18T00:00:00Z', '2026-07-22T00:00:00Z'),
      ('${i.propertyB1}', '${i.datasetB}', 'Villa Other', '${i.region1}', -8.7000, 115.2000, 'active', 'high', '2026-07-18T00:00:00Z', '2026-07-20T00:00:00Z');

    insert into public.source_listings
      (id, dataset_id, property_id, source_id, external_id, current_observation_status, current_lifecycle_status, first_seen_at, last_observed_at) values
      ('${i.listingA1}', '${i.datasetA}', '${i.propertyA1}', '${i.source1}', 'demo-001', 'active', 'active', '2026-07-18T00:00:00Z', '2026-07-20T00:00:00Z');

    insert into public.listing_snapshots
      (id, dataset_id, source_listing_id, collection_run_id, observed_at, observation_status, rating, review_count, content_fingerprint, parser_version, field_presence) values
      ('${i.snapshotA1}', '${i.datasetA}', '${i.listingA1}', '${i.runA}', '2026-07-20T00:00:00Z', 'active', 4.92, 184, 'fp-demo-001', 'demo-1', '{"rating":true}');

    insert into public.events
      (id, dataset_id, property_id, source_listing_id, event_type, event_at, confidence, title, deduplication_key) values
      ('${i.eventA1}', '${i.datasetA}', '${i.propertyA1}', '${i.listingA1}', 'listing_created', '2026-07-18T00:00:00Z', 'high', 'Listing first observed', 'dedup-a1');

    insert into public.event_evidence
      (id, event_id, current_snapshot_id, evidence_type, explanation) values
      ('${i.evidenceA1}', '${i.eventA1}', '${i.snapshotA1}', 'snapshot', 'First observation snapshot for this listing.');
  `);
}
