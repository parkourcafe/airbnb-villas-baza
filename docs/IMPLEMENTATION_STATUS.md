# Implementation status

This document tracks milestone progress for Bali Accommodation Intelligence
(BAI). It is updated at the end of every milestone.

## Current state

- **Completed:** Milestones 0–5 (foundation · auth/tenancy · core catalogue · CSV import · snapshot & diff engine · lifecycle & event engine)
- **Next milestone:** Milestone 6 — Production dashboard experience
- **Runtime:** Node.js 24 LTS · pnpm · Turborepo · Next.js 16 App Router · TypeScript strict

## Milestone 5 — Lifecycle & event engine ✅

| Area                                    | Status | Notes                                                                                                                                                                                                                              |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle reducer (`@bai/event-engine`) | ✅     | pure `reduceLifecycle` (04 §18): qualifying-miss rules, versioned thresholds (first_miss→suspected: ≥2 misses/≥24h/≥2 runs; →confirmed: ≥3 misses/≥7d/high-conf not_found), degraded-run suppression, reactivation reset, `lifecycle-state:v1` |
| Run health                              | ✅     | `assessRunHealth`: valid-drop <70%, error-rate >15%, blocked-rate >5% → degraded (04 §7, 05 §5.2)                                                                                                                                  |
| Events + dedupe                         | ✅     | material field-change events (price/rating/review-count/host/direct-channel) + lifecycle transition events; deterministic dedupe keys (04 §9); engine `EventType` mapped to `app.event_type` at the DB boundary                    |
| Evidence                                | ✅     | every generated event writes an `event_evidence` row (snapshot/run/rule-version/explanation, 04 §15, EVT-01)                                                                                                                       |
| Persistence (worker)                    | ✅     | import runner now emits `listing_created` on first sight, field-change events from diffs, and lifecycle transitions; updates the authoritative lifecycle projection + `lifecycle_state` jsonb (new migration)                       |
| Engine tests                            | ✅     | 20 timeline/unit tests: LIFE-01…LIFE-10 + EVT-03…EVT-07 + run-health + idempotency                                                                                                                                                |
| DB tests                                | ✅     | event dedupe-key idempotency, evidence linkage, lifecycle jsonb state, dataset-scoped RLS, dismissal-in-history (4 executed; 32 total)                                                                                             |

**Acceptance (M5):** all `06_ACCEPTANCE_TESTS.md` Lifecycle scenarios (LIFE-01…LIFE-10) are covered by the pure reducer's timeline tests; Event scenarios EVT-01…EVT-07 by the event-derivation + persistence tests. Manual-review **columns** (`is_reviewed`/`reviewed_*`/`dismissed_*`) exist and a dismissed event stays in history (EVT-08); the review/dismiss **UI + audited RPC** lands with the dashboard/review surfaces (M6/M7), since events are append-only to `authenticated` and review mutation needs a SECURITY DEFINER action.

**Not executable here:** the live worker running the reducer over an adapter timeline against Postgres. The reducer/events/run-health are pure and fully unit-tested; the event/evidence/lifecycle **write path** (dedupe idempotency, evidence linkage, jsonb state, RLS) is executed against the real migration in PGlite.

## Milestone 4 — Snapshot & diff engine ✅

| Area                                     | Status | Notes                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalization (`@bai/snapshot-engine`)   | ✅     | Unicode/whitespace text, URL (tracking-param strip, port/slash/fragment/query canonicalization), boolean, number (thousands-sep), set (sorted/de-duped/lower-cased) + hashes, `setDelta`                                                  |
| Snapshot builder                         | ✅     | `buildSnapshot`: title/description/photos/amenities hashes, time-independent `content_fingerprint`, `field_presence` (not-collected vs collected-null), `quality_flags`, rounded coords, `snapshot-normalizer:v1`                        |
| Comparable-snapshot selection            | ✅     | `selectComparableSnapshot`: latest earlier · valid for field · parser-compatible · non-degraded · deterministic tie-break (04 §11)                                                                                                        |
| Diff engine + versioned materiality      | ✅     | per-field-type diffs (scalar/money/boolean/hash/set/location); price ≥5% (same currency+unit only), rating ≥0.05, review-count increase-only; parser-mismatch suppression; `field-diff:v1` config; exact deltas stored                   |
| Persistence wiring (worker)              | ✅     | import runner now upserts source listings (unique dataset+source+external), resolves canonical property (explicit key via alias, else new), inserts immutable snapshots (unique per listing/run), selects comparable, persists diffs      |
| Engine tests                             | ✅     | 37 golden/unit tests (normalize, snapshot, diff, selection) — covers 04 scenarios 11/12/13 + idempotency + parser-version                                                                                                                |
| DB tests                                 | ✅     | snapshot immutability, diff idempotency (unique key), dataset-scoped RLS, append-only enforcement (4 executed in PGlite; 28 total)                                                                                                        |

**Acceptance (M4):** baseline→follow-up creates expected diffs ✓ · uncollected fields never diff ✓ · incompatible prices (currency/unit) not compared ✓ · repeated run creates no duplicate snapshots/diffs (unique constraints + deterministic keys) ✓ · parser version stored on every snapshot ✓.

**Not executable here** (no Docker/Supabase/Storage): the live worker turning an uploaded CSV into snapshots against a running Postgres. The engine (pure) is fully unit-tested; the snapshot/diff **write path** (immutability, diff idempotency, RLS scoping, append-only) is executed against the real migration in PGlite. The TS orchestration in `snapshot-persistence.ts` (source-listing upsert + canonical property + comparable-selection SQL) is typechecked and mirrors the M3 runner pattern but is exercised end-to-end only where a live worker+DB is available.

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
