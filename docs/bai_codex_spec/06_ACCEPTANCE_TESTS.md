# 06. Acceptance Tests

## 1. Test strategy

The MVP requires:

- unit tests;
- database integration tests;
- worker integration tests;
- E2E browser tests;
- security tests;
- deterministic fixture scenarios.

No live third-party platform is required for tests.

---

## 2. Repository quality

### Q-01 Install

Given a clean clone  
When `pnpm install --frozen-lockfile` runs  
Then installation succeeds.

### Q-02 Lint/type/build

These pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Q-03 No secrets

Repository scan finds no:

- service role key;
- database password;
- source API token;
- real contact list;
- private raw payload.

---

## 3. Auth and tenancy

### AUTH-01 Protected route

Unauthenticated user opening `/app/overview` is redirected to login.

### AUTH-02 Organization isolation

User in Organization A cannot read:

- watchlists;
- leads;
- notes;
- imports;
- reports

owned by Organization B.

### AUTH-03 Dataset access

User cannot read dataset without `organization_dataset_access`.

### AUTH-04 Viewer permissions

Viewer cannot:

- create watchlist;
- create lead;
- start import;
- mark event reviewed;
- invite member.

### AUTH-05 Service role

No `SUPABASE_SERVICE_ROLE_KEY` appears in browser JavaScript or public env.

### AUTH-06 Private schema

Authenticated Data API request cannot access private source, job or raw-observation tables.

---

## 4. Import tests

### IMP-01 Baseline

Import `fixtures/baseline.csv`.

Expected:

- import completed;
- 6 accepted rows;
- 0 rejected;
- 6 source listings;
- 6 snapshots;
- canonical properties created according to keys;
- run metrics correct.

### IMP-02 Invalid rows

Import `fixtures/invalid_rows.csv`.

Expected rejection codes include:

- missing_external_id;
- invalid_timestamp;
- invalid_status;
- rating_out_of_range;
- negative_review_count;
- invalid_coordinates;
- unknown_source.

### IMP-03 Duplicate file

Import exact baseline again.

Expected:

- existing import returned or duplicate state;
- no duplicate snapshots;
- no duplicate events.

### IMP-04 Duplicate rows in file

Duplicate `(source_key, external_id)` rows within one file are handled deterministically:

- identical duplicate counted;
- conflicting duplicate rejected or resolved by documented rule.

### IMP-05 25k performance

Generated 25,000-row file:

- async;
- UI responsive;
- progress visible;
- completes within target;
- no memory explosion;
- batch writes.

### IMP-06 CSV injection

Cells beginning with `=`, `+`, `-`, `@` are escaped on export where spreadsheet injection is possible.

---

## 5. Snapshot and diff tests

### SNAP-01 Immutable

Existing snapshot cannot be updated through normal app role.

### SNAP-02 Comparable previous

Engine ignores:

- later snapshot;
- source_error snapshot;
- incompatible parser snapshot;
- wrong source listing.

### SNAP-03 Field presence

If rating is not collected in current snapshot, no `rating_changed`.

### SNAP-04 Price context

Different currency or unit does not create comparable price change without explicit normalization.

### SNAP-05 Hash normalization

Whitespace-only title/description changes do not create material event.

### SNAP-06 Idempotency

Reprocessing same run creates no duplicate snapshot/diff.

---

## 6. Lifecycle tests

Fixture timeline uses:

- `baseline.csv`;
- `followup_1.csv`;
- `followup_2.csv`;
- `followup_3.csv`;
- `reactivated.csv`.

### LIFE-01 Search absence

A listing with `search_not_observed`:

- stays active;
- misses do not increment;
- no suspected inactive.

### LIFE-02 Source error

`source_error`:

- does not increment miss;
- creates source error visibility;
- does not create inactivity.

### LIFE-03 First direct miss

One `not_found`:

- lifecycle `first_miss`;
- consecutive_misses = 1;
- not confirmed.

### LIFE-04 Suspected

Second qualifying miss after at least 24h:

- lifecycle `suspected_inactive`;
- event once;
- confidence medium or configured.

### LIFE-05 Confirmed

Third qualifying miss across at least 7 days:

- lifecycle `confirmed_inactive`;
- UI label likely inactive;
- event once;
- high confidence;
- evidence lists all qualifying observations.

### LIFE-06 Degraded run

If run coverage is degraded:

- snapshot stored;
- misses not incremented;
- no inactivity transition.

### LIFE-07 Reactivation

Active observation after suspected/confirmed:

- creates reactivated;
- resets misses;
- updates last_seen_active_at;
- event once.

### LIFE-08 Duplicate processing

Running lifecycle engine twice creates no duplicate transition/event.

### LIFE-09 Active between misses

An active observation between misses resets sequence.

### LIFE-10 Unavailable

Repeated unavailable follows configured lower-confidence path and does not instantly confirm.

---

## 7. Event tests

### EVT-01 Evidence required

Every non-manual event has at least one evidence row.

### EVT-02 Rule version

Every diff/event has rule version.

### EVT-03 Price materiality

Price change below threshold is stored as non-material diff but not visible event by default.

### EVT-04 Rating materiality

Rating change meeting threshold creates event with previous/new.

### EVT-05 Review count

Negative review-count change creates quality warning unless source rule permits.

### EVT-06 Host change

Host external ID change creates observation event but does not claim property sale.

### EVT-07 Direct channel

Website addition creates `direct_channel_added` with source attribution.

### EVT-08 Dismissal

Dismissed event remains in history and audit log.

---

## 8. UI/E2E tests

### UI-01 Overview empty

No dataset history shows useful empty state and import CTA.

### UI-02 Overview populated

After fixtures:

- KPI totals correct;
- freshness visible;
- demo/fixture source visible;
- degraded warning appears where relevant.

### UI-03 Properties filters

Filter by region/status/rating updates URL and results.

### UI-04 Cursor pagination

Next/previous works without duplicate/missing rows under stable order.

### UI-05 Property history

Timeline shows events in correct order and evidence opens.

### UI-06 Map

- clusters render;
- status filter works;
- coordinate precision respected;
- keyboard-accessible alternative list exists.

### UI-07 Compare

Baseline vs follow-up shows expected tabs and counts.

### UI-08 Import wizard

User can upload, map, validate, confirm and observe completion.

### UI-09 Permission state

Viewer sees disabled/hidden mutation controls with correct behavior.

### UI-10 Responsive

Key pages usable at:

- 390x844;
- 768x1024;
- 1440x900.

---

## 9. Watchlist/lead tests

### WL-01 Watchlist CRUD

Analyst can create and add accessible property.

### WL-02 Dataset boundary

Cannot add inaccessible dataset item.

### LEAD-01 Create from event

Lead stores:

- property;
- source listing;
- reason;
- evidence link;
- creator.

### LEAD-02 Do not contact

When `do_not_contact = true`, UI visibly blocks outreach-related future actions.

### LEAD-03 Attribution

Business contact requires source URL or owner-provided marker.

### LEAD-04 No send

MVP has no mass-send or automatic messaging action.

---

## 10. Jobs and scheduler

### JOB-01 Atomic claim

Two workers attempt same queued job. Exactly one claims it.

### JOB-02 Heartbeat

Running job updates heartbeat/progress.

### JOB-03 Stale recovery

Stale retryable job moves to retry_wait/queued.

### JOB-04 Permanent failure

Validation/compliance error does not loop.

### JOB-05 Compliance gate

Disabled or pending source job fails before network execution.

### JOB-06 Cron auth

- no header -> 401;
- wrong secret -> 401;
- correct secret -> enqueue response.

### JOB-07 Cron scope

Cron endpoint enqueues due jobs and returns quickly. It does not execute collection.

---

## 11. Security tests

### SEC-01 RLS on exposed tables

Automated migration test asserts RLS enabled.

### SEC-02 Explicit grants

Only intended tables/operations granted.

### SEC-03 Storage policies

Organization cannot download another organization’s import/report.

### SEC-04 Signed URL expiration

Expired signed URL fails.

### SEC-05 Admin route

Non-system owner cannot open `/admin`.

### SEC-06 Input validation

Every route/action validates with Zod.

### SEC-07 Open redirect

Login redirect accepts only internal destinations.

### SEC-08 Audit

Membership, merge/split, manual correction, source compliance and event dismissal create audit rows.

---

## 12. Data quality tests

### DQ-01 Coverage collapse

Current run at 50% previous valid coverage becomes degraded.

### DQ-02 Error spike

Source error rate above threshold suppresses lifecycle misses.

### DQ-03 Coordinates

Coordinates outside expected coverage are flagged, not silently accepted.

### DQ-04 Parser change

Incompatible parser version suppresses unsafe diff.

### DQ-05 Correction

Manual correction changes projection but leaves original snapshot intact.

---

## 13. Launch gate

No internal beta launch until:

- all critical tests pass;
- no severity-high security issue;
- RLS verified;
- source registry correct;
- restricted source disabled;
- backup/runbook documented;
- user-facing language reviewed;
- evidence links work;
- test/demo labels cannot be confused with real production data.
