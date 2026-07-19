# 05. Codex Implementation Plan

## 1. Execution contract

Codex must work milestone by milestone.

For each milestone:

1. inspect current repository;
2. state assumptions;
3. implement only that milestone;
4. run required checks;
5. fix failures;
6. summarize files changed;
7. update `docs/IMPLEMENTATION_STATUS.md`;
8. stop.

Codex must not continue automatically to the next milestone.

---

## 2. Standard verification commands

Exact scripts may be adjusted during scaffolding, but repository must expose:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```

Additional:

```bash
pnpm format:check
pnpm supabase:status
pnpm db:types
```

Never report a milestone complete if the required checks fail.

---

# Milestone 0 - Repository foundation

## Goal

Create a clean, reproducible monorepo.

## Tasks

### 0.1 Initialize

- Git repository if absent.
- `.nvmrc` with Node 24.
- `package.json` with `packageManager`.
- pnpm workspace.
- Turborepo.
- TypeScript strict base config.
- shared ESLint and Prettier.
- `.editorconfig`.
- `.gitignore`.
- `.env.example`.
- `README.md`.

### 0.2 Scaffold apps

- `apps/web` with Next.js App Router, TypeScript, Tailwind, ESLint, `src/`.
- `apps/worker` as Node TypeScript app.
- package scripts for dev/build/test/typecheck.

### 0.3 Scaffold packages

Create:

```text
packages/db
packages/domain
packages/source-sdk
packages/import-engine
packages/snapshot-engine
packages/event-engine
packages/reporting
packages/ui
packages/config
packages/test-fixtures
```

Each has:

- package.json;
- tsconfig;
- src/index.ts;
- test placeholder only if meaningful.

### 0.4 UI setup

- shadcn/ui;
- theme tokens;
- Other Bali-inspired palette;
- app font fallback strategy;
- Button, Card, Input, Table, Badge, Sheet, Dialog, DropdownMenu, Tabs, Skeleton.

Do not import bundled font files from the provided HTML. Use properly licensed web delivery or fallback.

### 0.5 Quality

- Vitest;
- Playwright Test;
- CI workflow;
- one unit smoke test;
- one web E2E smoke test;
- one worker smoke test.

### 0.6 Documentation

Create:

```text
docs/IMPLEMENTATION_STATUS.md
docs/adr/
```

Add required ADR placeholders.

## Acceptance criteria

- fresh clone installs with one command;
- no interactive install prompt;
- web app starts;
- worker starts and exits cleanly in smoke mode;
- all standard checks for this milestone pass;
- no secrets committed;
- package versions pinned through lockfile.

## Stop condition

Do not set up Supabase yet.

---

# Milestone 1 - Local Supabase, auth and tenancy

## Goal

Create database foundation and protected app shell.

## Tasks

### 1.1 Supabase local setup

- initialize Supabase directory;
- verify CLI command syntax through `--help`;
- create first migration using Supabase CLI;
- add extensions;
- create schemas;
- create enums;
- create profiles, organizations, memberships, datasets, access tables;
- create seed data.

### 1.2 RLS

Implement and test:

- profile self-access;
- organization membership;
- dataset access;
- role checks;
- explicit grants;
- private schema not exposed.

### 1.3 Auth integration

- Supabase SSR client;
- lazy initialization;
- login page;
- logout;
- protected `/app` layout;
- user profile loading;
- organization selector;
- dataset selector.

### 1.4 App shell

Routes:

```text
/app/overview
/app/properties
/app/events
/app/imports
/app/watchlists
/app/reports
/app/settings/organization
/app/settings/team
```

Pages may use empty states, not fake data.

### 1.5 Tests

- unauthenticated redirect;
- authenticated access;
- user A cannot see org B;
- owner can manage membership;
- viewer cannot mutate;
- dataset access enforced.

### 1.6 Security verification

- run database advisors;
- inspect grants;
- verify no service role in client bundle;
- verify no user-editable metadata is used for role authorization.

## Acceptance criteria

- local login works;
- org and dataset context persist;
- RLS tests pass;
- protected routes work;
- private schema inaccessible through Data API;
- production build passes.

## Stop condition

Do not create property/import tables until milestone 2.

---

# Milestone 2 - Core data schema and fixture catalogue

## Goal

Implement properties, source listings, snapshots and read-only catalogue using seed fixtures.

## Tasks

### 2.1 Database

Create migrations for:

- regions;
- private data_sources;
- parser_versions;
- properties;
- aliases;
- source_listings;
- collection_runs;
- collection_jobs;
- raw observation metadata;
- listing_snapshots;
- diffs;
- events;
- evidence;
- audit log.

### 2.2 Seed

Seed:

- Bali geography starter set;
- approved manual CSV;
- approved demo fixture;
- disabled Airbnb source;
- 20 demo properties;
- 25 source listings;
- baseline snapshots;
- a small set of events.

Demo data must be explicitly marked.

### 2.3 Repositories

Implement typed repositories:

- listProperties;
- getProperty;
- listSourceListings;
- listEvents;
- getEventEvidence;
- getDatasetOverview.

Use keyset pagination.

### 2.4 UI

Implement:

- Overview with demo badge;
- Properties table;
- Property detail tabs;
- Events table;
- basic map with demo points.

### 2.5 Tests

- repository filters;
- keyset pagination;
- RLS;
- property detail evidence;
- map coordinate precision.

## Acceptance criteria

- user can browse seeded catalogue;
- no N+1 queries;
- filters work;
- all rows are dataset-scoped;
- events show evidence;
- map does not expose coordinates beyond permitted precision.

---

# Milestone 3 - CSV import workflow

## Goal

Import a baseline snapshot asynchronously.

## Tasks

### 3.1 Upload

- private Storage bucket;
- signed upload URL;
- allowed MIME;
- size limit;
- generated object key;
- checksum.

### 3.2 Wizard

Steps:

1. dataset;
2. source;
3. file;
4. column mapping;
5. validation preview;
6. confirmation;
7. status.

### 3.3 CSV schema

Support at minimum:

```text
source_key
external_id
source_url
title
observed_at
observation_status
region
latitude
longitude
rating
review_count
observed_price_amount
observed_price_currency
observed_price_unit
bedrooms
bathrooms
guest_capacity
is_superhost
host_external_id
official_website
business_whatsapp
direct_booking_url
canonical_property_key
```

Required:

```text
source_key
external_id
observed_at
observation_status
```

### 3.4 Validation

- required headers;
- source key exists and approved for manual import;
- external ID nonblank;
- timestamp valid;
- status enum valid;
- rating 0..5;
- review count >=0;
- coordinates valid and plausibly within configured coverage;
- currency format;
- URL format;
- duplicates;
- file checksum.

### 3.5 Async processing

- create import;
- create collection run;
- create job;
- worker claims job;
- parse streaming;
- batch writes;
- progress;
- rejected rows;
- complete metrics.

### 3.6 Idempotency

Same file for same org/dataset/source:

- returns existing import result;
- does not duplicate snapshots;
- offers admin-only explicit reprocess under new rule/parser version.

### 3.7 UI

- import list;
- import detail;
- progress;
- metrics;
- rejected rows download;
- failure state.

## Acceptance criteria

- `fixtures/baseline.csv` imports successfully;
- invalid fixture yields expected rejection reasons;
- 25,000-row generated CSV processes asynchronously;
- duplicate import is idempotent;
- app remains responsive;
- run and job logs are visible to admin.

---

# Milestone 4 - Snapshot and diff engine

## Goal

Create immutable snapshots and deterministic field diffs.

## Tasks

### 4.1 Normalization

Implement:

- Unicode normalization;
- whitespace normalization;
- URL normalization;
- boolean parsing;
- number parsing;
- money;
- set sorting;
- hashes;
- field_presence;
- quality_flags.

### 4.2 Source listing upsert

Unique:

```text
dataset_id + source_id + external_id
```

### 4.3 Canonical property

MVP:

- explicit `canonical_property_key` matches;
- otherwise new property per new source listing;
- manual merge later.

### 4.4 Snapshot insertion

- immutable;
- unique per listing/run;
- raw evidence reference;
- parser version;
- fingerprints.

### 4.5 Previous comparable snapshot

Implement selection rules from spec.

### 4.6 Diffs

- scalar;
- money;
- booleans;
- hashes;
- sets;
- location;
- field presence.

### 4.7 Materiality

Versioned config.

### 4.8 Tests

Golden tests for every field type and idempotency.

## Acceptance criteria

- baseline then follow-up creates expected diffs;
- missing uncollected fields do not create false changes;
- incompatible price observations are not compared;
- repeated engine run creates no duplicates;
- parser version stored.

---

# Milestone 5 - Lifecycle and event engine

## Goal

Implement evidence-backed status transitions.

## Tasks

### 5.1 Lifecycle reducer

Implement pure state transition function.

### 5.2 Degraded run

- calculate coverage;
- source errors;
- parser compatibility;
- suppress unsafe transitions.

### 5.3 Events

Implement all MVP event types and deduplication.

### 5.4 Evidence

Every event records snapshots, run, rule version and explanation.

### 5.5 Reactivation

Implement reset and event.

### 5.6 Manual review

- mark reviewed;
- dismiss;
- note;
- audit.

### 5.7 Tests

Use timeline fixtures.

## Acceptance criteria

All scenarios in `06_ACCEPTANCE_TESTS.md` section Lifecycle pass.

---

# Milestone 6 - Production dashboard experience

## Goal

Replace fixture-like UI with complete working screens.

## Tasks

### 6.1 Overview

- coverage;
- KPI cards;
- trend;
- area table;
- event feed;
- import health.

### 6.2 Properties

- all required columns;
- filters;
- saved query state in URL;
- cursor pagination;
- column controls;
- export selection.

### 6.3 Property detail

- overview;
- listings;
- history;
- evidence;
- notes.

### 6.4 Map

- clustering;
- lifecycle layers;
- filters;
- drawer;
- coordinate precision.

### 6.5 Events

- filters;
- review actions;
- evidence drawer;
- convert to lead placeholder or actual milestone 7.

### 6.6 Compare

- select two runs/snapshots;
- summary;
- tabs;
- export.

### 6.7 States

Every page:

- loading;
- empty;
- error;
- partial data;
- permission denied;
- stale data.

### 6.8 Accessibility

- keyboard;
- focus;
- semantic tables;
- labels;
- chart summaries;
- contrast.

## Acceptance criteria

- no fake production values;
- filters survive refresh through URL;
- selected org/dataset respected;
- mobile usable;
- all E2E dashboard flows pass.

---

# Milestone 7 - Watchlists, leads and reports

## Goal

Turn observations into action.

## Tasks

### 7.1 Watchlists

- CRUD;
- property/listing/region/filter items;
- add from tables;
- watchlist detail;
- org-private RLS.

### 7.2 Leads

- create from property/event;
- lead stages;
- notes/activities;
- assignment;
- do-not-contact;
- source attribution;
- no send functionality.

### 7.3 Reports

- report definitions;
- async generation;
- web preview;
- CSV;
- signed download;
- immutable parameters.

### 7.4 Exports

- async above 10k;
- filters recorded;
- row count;
- expiration.

### 7.5 Tests

- org isolation;
- do-not-contact;
- report reproducibility;
- export authorization.

## Acceptance criteria

- Other Bali analyst can convert a high-confidence event to a lead;
- lead retains evidence link;
- watchlist report generates;
- organization cannot access another organization’s leads/reports.

---

# Milestone 8 - Source Adapter SDK and worker scheduling

## Goal

Create safe extension point for approved sources.

## Tasks

### 8.1 Source SDK

- interfaces;
- capability validation;
- configuration validation;
- health check;
- compliance gate;
- rate-limit metadata;
- parser version.

### 8.2 Fixture adapter

- reads controlled fixture pages/files;
- simulates active/not-found/errors;
- passes contract tests.

### 8.3 Manual CSV adapter

- wraps import engine under adapter conventions.

### 8.4 Worker

- polling;
- bounded concurrency;
- graceful shutdown;
- heartbeat;
- retry;
- stale job recovery;
- structured logs.

### 8.5 Cron

- protected endpoint;
- enqueue due jobs only;
- `CRON_SECRET`;
- production-only configuration.

### 8.6 Source admin

- list;
- details;
- compliance status;
- review dates;
- capability display;
- health.

### 8.7 Explicit prohibition

Do not implement a live Airbnb/Booking/Agoda collector in this milestone.

## Acceptance criteria

- disabled source cannot run even if job inserted manually;
- pending source cannot run;
- approved fixture source runs;
- unauthorized cron request returns 401;
- two workers do not claim same job;
- stale job recovers.

---

# Milestone 9 - Manual entity resolution

## Goal

Safely merge/split canonical properties.

## Tasks

- candidate suggestions;
- reason list;
- merge preview;
- split;
- redirect record;
- recompute summary;
- audit;
- permissions;
- rollback strategy.

## Acceptance criteria

- snapshots are never deleted;
- all source listings preserved;
- events/history remain reachable;
- action audited;
- non-admin cannot merge.

---

# Milestone 10 - Security, performance and launch hardening

## Goal

Prepare internal beta.

## Tasks

### Security

- RLS review;
- grants review;
- storage policies;
- secret scan;
- dependency audit;
- input fuzz tests;
- CSV formula injection prevention;
- signed URL expiration;
- cron auth;
- rate limits;
- admin route authorization;
- audit integrity.

### Performance

- seed performance dataset;
- query plans;
- indexes;
- eliminate N+1;
- async exports;
- worker batch tuning;
- map clustering.

### Reliability

- retry tests;
- worker shutdown;
- degraded source;
- partial import;
- storage failure;
- database timeout;
- idempotency.

### UX

- methodology;
- data freshness;
- confidence explanations;
- correction request;
- legal copy;
- demo labels removed or retained correctly.

### Operations

- backup expectations documented;
- runbook;
- incident checklist;
- source disable switch;
- data correction workflow;
- launch checklist.

## Acceptance criteria

- full test suite passes;
- production build passes;
- security checklist completed;
- database advisors clean or documented;
- no live restricted source;
- internal beta can import and compare real permitted datasets.

---

## 3. Post-MVP roadmap

### v1.1

- notifications;
- PDF reports;
- scheduled reports;
- richer region analytics;
- better entity suggestions;
- owner portal;
- Other Bali integration.

### v1.2

- licensed API adapters;
- cross-source property identity;
- portfolio management;
- API beta;
- plan entitlements.

### v2

- investment reports;
- market indices;
- direct booking readiness;
- approved partner lead feeds;
- enterprise API;
- billing.

---

## 4. Required completion report format

After every milestone Codex returns:

```markdown
# Milestone X completion report

## Implemented
- ...

## Files changed
- path: purpose

## Database changes
- migration name
- tables/policies/functions

## Commands run
- command: result

## Tests
- passed
- failed
- skipped with reason

## Security checks
- ...

## Known limitations
- ...

## Decisions required
- ...

## Next milestone
- exact milestone name
```
