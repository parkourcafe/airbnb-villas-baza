# Operations runbook — Bali Accommodation Intelligence

Internal-beta operations guide. Pair with `SECURITY_CHECKLIST.md`.

## Services

- **web** (`apps/web`) — Next.js App Router; SSR auth, dashboard, RLS-scoped reads,
  privileged mutations via server actions.
- **worker** (`apps/worker`) — polls the Postgres job queue; runs imports and
  approved source adapters; bounded concurrency, heartbeat, retry, stale recovery.
- **database** — Supabase Postgres; RLS on every exposed table; `private`/`app`
  schemas off the Data API.

## Environment

Required variables (see `.env.example`, names only):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server-only), `DATABASE_URL` (worker),
`CRON_SECRET` (cron). The service-role key and `DATABASE_URL` must never reach
the browser.

## Launch checklist

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm build && pnpm test:e2e` all green.
2. Migrations applied in order; `supabase db lint` / advisors clean or documented.
3. `SECURITY_CHECKLIST.md` items confirmed for the target environment.
4. Secrets set from a secret manager; none committed.
5. `CRON_SECRET` set (cron fails closed without it).
6. Demo data: keep `is_demo`-marked rows only in non-production datasets.
7. No live restricted source enabled (`airbnb`/`booking` stay disabled/pending).

## Data-freshness & confidence

- Timestamps are stored UTC and displayed in Asia/Makassar.
- Lifecycle status uses observation language only; `confirmed_inactive` shows
  **Likely inactive**, never "removed/banned".
- Confidence and the qualifying evidence are stored in `event_evidence.metadata`.

## Source disable switch

To stop a source immediately, set its `compliance_status` away from `approved`
(e.g. `disabled`) in `private.data_sources`. The DB trigger then rejects any new
collection run for it, and the worker's compliance gate blocks it at runtime —
even a hand-inserted job cannot run.

## Data correction workflow

- **Wrong event** → analyst dismisses it (stays in history, audited) or marks it
  reviewed.
- **Duplicate property** → admin merges via the property detail page; snapshots and
  source listings are preserved, a redirect + audit row are written.
- **Bad run** → set the run degraded/failed; degraded runs never drive lifecycle
  transitions. Snapshots are immutable and are never edited.

## Incident checklist

1. Identify scope: web, worker, database, or a single source.
2. If a source misbehaves, flip its compliance status to disable it (above).
3. If the worker is stuck, stale jobs auto-recover after the heartbeat timeout;
   otherwise restart the worker (graceful shutdown drains in-flight jobs).
4. Check `audit_logs` for the actions around the incident window.
5. Never edit immutable snapshots to "fix" data — correct via events/merge/notes.

## Backup expectations

- Rely on the managed Postgres point-in-time recovery for the database.
- Object storage (raw evidence, import files) retained per bucket policy; raw
  observation payloads are immutable evidence and must not be mutated.
- Restores are validated by re-running `pnpm test:db` against a restored schema.
