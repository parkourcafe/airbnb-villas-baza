# Launch readiness — Bali Accommodation Intelligence

Honest assessment of what is done, what is proven, and exactly what remains to
run the product for real. Pair with `IMPLEMENTATION_STATUS.md` (per-milestone
detail), `SECURITY_CHECKLIST.md`, and `RUNBOOK.md`.

## Scorecard

| Dimension                                        | Score       |
| ------------------------------------------------ | ----------- |
| Functional coverage of the spec (is it written?) | ~90/100     |
| Verification (is it proven to work?)             | ~55/100     |
| Production readiness (can real users use it?)    | ~35/100     |
| **Overall readiness for a full launch**          | **~65/100** |

The gap between 90 and 65 has one root cause: **nothing has ever run against a
real Supabase / Postgres / Storage / GoTrue.** All verification is PGlite (WASM
Postgres with PostGIS stripped), pure unit tests, `next build`, and Playwright on
unauthenticated paths only.

## Proven (green, executed here)

- Pure engines: import + fuzz, snapshot/diff (golden per field), lifecycle
  (LIFE-01…10), events (EVT-03…07), source-adapter contracts, CSV injection.
- Schema + RLS: **51 PGlite tests** against the real migrations (tenant
  isolation, append-only, org-private, compliance gate, merge/split/rollback,
  scheduling).
- Security checklist items (RLS, grants, SECURITY DEFINER hardening, cron auth,
  injection, secrets).
- `next build` + e2e (redirect guard, login render, health, cron 401/405).

## Written but NOT verified live (and why)

| Area                                               | Why not verified                                     |
| -------------------------------------------------- | ---------------------------------------------------- |
| CSV → worker → snapshots → events → dashboard      | No live Postgres/worker here (no Docker/CLI)         |
| Login via real GoTrue, authenticated screens       | No running Supabase Auth                             |
| Storage: import/report upload/download, signed URL | No Storage backend                                   |
| PostGIS geography + spatial queries                | PGlite has no PostGIS (DDL preprocessed)             |
| Live adapter / cron scheduler run                  | Needs worker + DB                                    |
| `database.types.ts`                                | Hand-authored, not `supabase gen types` — drift risk |

---

## Launch checklist

### A. Critical — cannot launch without these

1. **Provision a real Supabase project**; apply every migration to a real
   Postgres **with PostGIS** and confirm they apply cleanly (PGlite may have
   hidden geography/GiST/citext issues).
2. **Run `supabase gen types`** and replace the hand-authored
   `packages/db/src/generated/database.types.ts`; re-run typecheck.
3. **Live end-to-end smoke:** upload the demo CSV → worker processes the job →
   properties/snapshots/events appear → visible on the dashboard.
4. **Run the worker as a service** (host, `DATABASE_URL`, service role); verify
   claim/heartbeat/retry/stale-recovery against the real DB.
5. **Storage buckets + object policies:** `import-files` and `reports` buckets
   plus RLS policies on the objects (bucket rows are created by migration; object
   access policies are not written/verified yet).
6. **Live authentication:** login/logout through GoTrue, sessions, prod cookies.
7. **Host the web app (Next.js)** with env from a secret manager, `CRON_SECRET`,
   and wire the actual cron trigger (Vercel Cron / external scheduler → `/api/cron`).
8. **CI → CD pipeline:** auto-apply migrations, deploy web + worker, run
   `supabase db lint`/advisors and `pnpm audit` (currently only documented).

### B. Important — needed for real operation, can trail a soft launch

9. **Authenticated e2e** (Playwright with a real login) — currently zero
   coverage of protected screens.
10. **Load test** IMP-05 (25k-row async import); check indexes/query plans and
    the absence of N+1 at real volume.
11. **A real, permitted data source:** the only working source today is fixtures.
    Live Airbnb/OTA scraping is prohibited by design, so data must come legally
    from owner-supplied / licensed-API / manual-CSV sources in production.
12. **Monitoring / alerting / logs** in prod (structured logs exist; no sink),
    worker metrics.
13. **Backups / PITR** actually configured, with a tested restore (documented in
    the runbook, not executed).
14. **Demo-data guard:** ensure `is_demo`-marked rows never reach a production
    dataset (the flag exists; a hard cutoff does not).

### C. Functional tails — deliberately simplified, post-launch

15. Notifications / email delivery (`notification_rules` — post-MVP, no table).
16. Exports > 10k rows as a true async job (sync 10k cap + signal today; report
    async pipeline exists, a dedicated `exports` table does not).
17. Merge candidate-suggestion ranking (name/coordinate proximity) — manual pick
    today.
18. PDF reports, richer region analytics, scheduled reports (v1.1 per spec).
19. UI polish of loading/error states and an accessibility audit.

---

## Deploy runbook — the A path, step by step

Prereqs: a Supabase account/project, a host for the web app (e.g. Vercel) and one
for the worker (any Node 24 host / container), and a secret manager.

### A1 · Provision + migrate

```bash
# Link the repo to your Supabase project and push migrations to real Postgres.
supabase login
supabase link --project-ref <project-ref>
supabase db push                 # applies supabase/migrations/*.sql in order
supabase db lint                 # advisors must be clean or triaged
```

Confirm PostGIS is enabled and the geography columns/GiST indexes were created
(these are stripped under PGlite, so this is the first place they run for real).

### A2 · Regenerate types

```bash
supabase gen types typescript --linked --schema public > packages/db/src/generated/database.types.ts
pnpm typecheck                   # must stay green; reconcile any drift
```

### A5 · Storage

- Confirm the `import-files` and `reports` buckets exist (created by migration
  where Storage is present) and are **private**.
- Add object-level RLS policies so a user can only read/write objects under their
  own org/dataset prefix; verify signed-URL download works and expires.

### A6 · Auth

- Enable email/password in Supabase Auth; seed the demo users only in non-prod.
- Verify login → `/app` → logout end to end against GoTrue.

### A4 · Worker

```bash
# On the worker host:
DATABASE_URL=<direct-postgres-url> \
SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
node apps/worker/dist/index.js
```

Watch the logs for `worker.start`, then trigger an import and confirm
`job.claimed` → `import.completed`.

### A3 · End-to-end smoke

1. Log in, open Imports → upload the demo CSV.
2. Confirm the worker claims and completes the job.
3. Confirm properties/snapshots appear in the catalogue and events on the Events
   page; open Compare for a listing.

### A7 · Web host + cron

- Deploy `apps/web` with all env vars from the secret manager (never commit).
- Set `CRON_SECRET`; configure the platform cron to `POST /api/cron` with
  `Authorization: Bearer $CRON_SECRET` on the desired cadence.
- Add a collection schedule (Sources page) and confirm `enqueue_due_collections`
  creates a run + job that the worker then runs (fixture source only until a real
  permitted source is configured).

### A8 · CI/CD

- Add a deploy workflow that, on merge to `main`: applies migrations, deploys web
  and worker, and runs `supabase db lint` + `pnpm audit`.
- Keep the existing `verify` workflow (lint, format:check, typecheck, test,
  test:db, build, e2e) as the required gate.

## Rough effort

The A path is **deploy-and-verify**, not "write more code": roughly **1–2 weeks
for one engineer**, plus securing at least one legal data source (B11). B and C
follow after a soft launch.
