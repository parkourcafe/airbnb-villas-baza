# Implementation status

This document tracks milestone progress for Bali Accommodation Intelligence
(BAI). It is updated at the end of every milestone.

## Current state

- **Completed:** Milestones 0–3 (foundation · auth/tenancy · core catalogue · CSV import)
- **Next milestone:** Milestone 4 — Snapshot & diff engine (in progress)
- **Runtime:** Node.js 24 LTS · pnpm · Turborepo · Next.js 16 App Router · TypeScript strict

## Milestone 3 — CSV import workflow ✅

| Area                                 | Status | Notes                                                                                                                                                                                                                                   |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import engine (`@bai/import-engine`) | ✅     | streaming CSV parse, per-row validation + reason codes, dedup (identical vs conflicting), file checksum. Executable tests: baseline→6 accepted (IMP-01), invalid_rows→expected codes (IMP-02), duplicates (IMP-04)                      |
| Migration                            | ✅     | `imports`, `import_rejections`, `import_status` enum, org-scoped RLS, `claim_collection_job` (FOR UPDATE SKIP LOCKED), heartbeat, insert-trigger that enqueues run+job, curated `import_sources` view, private storage bucket (guarded) |
| DB tests                             | ✅     | JOB-01 atomic claim, imports/rejections RLS, viewer-blocked insert, trigger enqueue (24 total)                                                                                                                                          |
| Worker                               | ✅     | postgres.js queue (claim/heartbeat/complete/stale-recovery), import runner (validate→persist rejections + raw observations + metrics, transactional), poll loop dispatch                                                                |
| Web                                  | ✅     | imports list/detail, upload wizard (presigned upload + RLS insert), signed rejections CSV download (injection-safe)                                                                                                                     |

**Not executable here** (no Docker/Supabase/Storage): live async worker run, storage upload/download, and the 25k-row async timing (IMP-05). The import _logic_ (parse/validate/dedup/idempotency) is fully unit-tested; the queue claim + RLS + enqueue trigger are executed in PGlite. Snapshot/source-listing creation from accepted rows is the M4 snapshot engine (this runner records raw-observation evidence + rejections + metrics).

## Milestone 2 — Core data schema and fixture catalogue ✅

| Area                     | Status | Notes                                                                                                                                                                                                                     |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core schema migration    | ✅     | regions, properties, aliases, source_listings, listing_snapshots, snapshot_diffs, events, event_evidence, audit_logs (public) + data_sources, parser_versions, collection_runs/jobs, job_logs, raw_observations (private) |
| Enums (app)              | ✅     | observation/lifecycle/confidence/source-access/source-compliance/run/job/event types                                                                                                                                      |
| PostGIS + numeric coords | ✅     | spec `geography` columns + GiST; app/tests read denormalized `latitude`/`longitude numeric`                                                                                                                               |
| RLS + grants             | ✅     | dataset-scoped SELECT; `regions` shared; evidence scoped via event; **append-only** (no client write grants); private tables ungranted                                                                                    |
| Seed fixtures (demo)     | ✅     | Bali regions, 5 sources (approved/disabled/pending), 20 properties, 25 listings, 25 snapshots, 5 events + evidence — idempotent, demo-marked                                                                              |
| Typed repositories       | ✅     | listProperties/getProperty/listSourceListings/listListingSnapshots/listEvents/getEventEvidence/getDatasetOverview/listRegions — keyset pagination, no N+1                                                                 |
| Catalogue UI             | ✅     | Overview KPIs, Properties table (region/status filters + keyset), Property detail tabs, Events + evidence drawer, Map (MapLibre gated on `MAP_STYLE_URL` + accessible list)                                               |
| RLS tests                | ✅     | 8 executed catalogue tests (20 total with tenancy)                                                                                                                                                                        |
| Unit tests               | ✅     | coordinate-precision rounding in `@bai/domain`                                                                                                                                                                            |

### Verification note (Milestone 2)

The new migration is executed in **PGlite** with its PostGIS DDL stripped (extension,
`geography` columns → `text`, GiST indexes dropped) — RLS never references geo columns,
so dataset-scoping/isolation/append-only/private-invisibility are all asserted against
the real policies. The `seed.sql` catalogue block was executed against the migrated
schema in PGlite to confirm it is valid and produces the expected row counts (20/25/25/5).

Could **not** be executed here (needs Docker/Supabase): the live PostGIS `geography`
columns and spatial queries (the demo seed leaves `location` null; the app reads numeric
lat/lng), and browsing the catalogue against a running Data API. The keyset `.or()`
cursor clauses and the `regions(name)` embed are exercised only against a live PostgREST.

## Milestone 1 — Local Supabase, auth and tenancy ✅

| Area                                                               | Status | Notes                                                                                                                 |
| ------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Supabase project layout (`supabase/config.toml`, migrations, seed) | ✅     | Data API scoped to `public` only                                                                                      |
| Identity/tenancy migration                                         | ✅     | profiles, organizations, organization_members, datasets, organization_dataset_access                                  |
| Enums + extensions                                                 | ✅     | `app.member_role/dataset_status/access_level`; citext/pgcrypto in `extensions`                                        |
| RLS on every exposed table                                         | ✅     | SELECT/mutation policies per table                                                                                    |
| RLS helper functions                                               | ✅     | `private.*` SECURITY DEFINER, fixed `search_path`, execute granted to `authenticated` only                            |
| Explicit grants                                                    | ✅     | anon gets nothing on tenancy tables; authenticated is row-restricted                                                  |
| Seed data (demo, marked)                                           | ✅     | demo org/dataset/users; `is_demo`/`is_system_owner`                                                                   |
| Supabase SSR auth                                                  | ✅     | server + browser + proxy clients, lazy env, `getUser()` (not `getSession`)                                            |
| Login / logout                                                     | ✅     | email+password; open-redirect-safe `next`                                                                             |
| Protected `/app` area + shell                                      | ✅     | proxy guard + layout guard; org/dataset switchers persist via cookies                                                 |
| App shell routes                                                   | ✅     | overview, properties, events, imports, watchlists, reports, settings/{organization,team} — empty states, no fake data |
| Role-gated controls                                                | ✅     | viewer mutation controls disabled (`canMutateData`/`canManageMembers`)                                                |
| RLS tests                                                          | ✅     | 12 executed tests (see verification note)                                                                             |
| Open-redirect + capability unit tests                              | ✅     | in `@bai/domain`                                                                                                      |
| E2E                                                                | ✅     | unauthenticated `/app` → login (AUTH-01); login form renders                                                          |

### Verification note — how RLS was executed without Docker

The execution environment has **no running Docker daemon**, and `supabase.com`
/ GitHub releases are blocked by the network policy, so the Supabase CLI and the
full local stack could not run here. To still verify the schema and policies by
**execution** (not just review), the migration is applied to **PGlite** (an
in-process WASM Postgres) with the Supabase-provided objects (`auth` schema,
`auth.users`, `auth.uid()`, the anon/authenticated/service_role roles)
reproduced, and the RLS matrix is asserted as each role. `pnpm test:db` runs
this suite.

What this **does** verify: table/enum/trigger creation, every RLS policy,
tenant isolation, viewer read-only enforcement, owner membership management,
grant scoping (anon denied), and the SECURITY DEFINER helper (no policy
recursion).

What could **not** be executed here (requires Docker/Supabase; wired up to run
where available):

- `supabase start` / `db reset` and the auth GoTrue server (live login);
- `supabase gen types` — `packages/db/src/generated/database.types.ts` is
  hand-authored to match the migration until the CLI can regenerate it
  (`pnpm db:types`);
- `supabase db lint` / database advisors;
- Data-API schema scoping is asserted structurally (grants) rather than through
  a running PostgREST.

### Security posture (Milestone 1)

- Service-role key never reaches the browser; the service client refuses to
  construct client-side and is created lazily.
- Authorization derives only from membership/access tables — never from user
  metadata (`is_system_owner` is a server-only flag, unused by RLS).
- `private` and `app` schemas are excluded from the Data API (`config.toml`).
- Post-login redirect is open-redirect safe (`sanitizeInternalPath`).
- No secrets committed; `.env.example` is names-only.

An adversarial security review of the diff found grants/schema-exposure, SSR
auth, open-redirect and secret handling clean, and three RLS hardening issues,
all fixed and regression-tested:

1. the `organization_dataset_access` INSERT policy now also requires the caller
   to administer the target dataset (via `private.user_can_administer_dataset`),
   closing a cross-tenant dataset-access grant;
2. `profiles` write grants are column-scoped so clients cannot set the
   server-only `is_system_owner` flag;
3. owner-role membership changes are gated to owners, so an admin cannot
   self-escalate to owner or remove an owner.

## Milestone 0 — Repository foundation ✅

(Complete — see git history. Monorepo, tooling, design system, engines
scaffolding, CI, ADRs.)

### Cross-cutting deviations (environment)

- **Node 24** installed via nvm to run all checks on the pinned runtime.
- **Dependencies** updated to latest stable, holding `@playwright/test` at
  1.56.1 (matches the only available Chromium build), and Tailwind 3 / Zod 3 /
  ESLint 9 / TypeScript 5.9 (v4/v10/v7 are unsupported-by-toolchain or breaking).
- **Fonts:** system font stack (no remote/bundled font fetch).

## Later milestones

Milestones 2–10 are defined in `docs/bai_codex_spec/05_CODEX_IMPLEMENTATION_PLAN.md`
and have not been started.
