# Supabase bring-up — step by step

Concrete, copy-paste setup for **this repo** to take BAI from code to a running
stack. Covers the A-path items from `LAUNCH_READINESS.md` that only you can do
(they need a real project, keys, and hosts). Times are one engineer, ~half a day
for A1–A6 plus deploy.

Exact env-var names this repo reads:

| Variable                                                       | Used by              | What                                         |
| -------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                     | web                  | Project URL                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                         | web                  | Anon/publishable key (browser-safe)          |
| `SUPABASE_SERVICE_ROLE_KEY`                                    | web (server), worker | Service role — **server only**               |
| `SUPABASE_DB_URL`                                              | worker               | Direct Postgres connection string            |
| `CRON_SECRET`                                                  | web                  | Shared secret for `POST /api/cron`           |
| `WORKER_ID` / `WORKER_POLL_INTERVAL_MS` / `WORKER_CONCURRENCY` | worker               | Worker tuning                                |
| `APP_URL` / `APP_TIMEZONE`                                     | web                  | Base URL / display TZ (`Asia/Makassar`)      |
| `MAP_STYLE_URL` / `MAP_TILE_API_KEY`                           | web                  | Optional map tiles (list view works without) |

The Data API is scoped to `public` + `graphql_public` only (`supabase/config.toml`);
`private`/`app` schemas are never exposed — keep it that way.

---

## 0. Prerequisites

```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase --version
node -v                      # must be 24 (see .nvmrc)
corepack enable && pnpm -v   # pnpm 10.x
```

## 1. Create the project + collect keys

1. Create a project at app.supabase.com; note the **project ref** (in the URL).
2. Settings → API: copy **Project URL**, **anon/publishable key**, **service_role key**.
3. Settings → Database: copy the **connection string** (URI) → this is `SUPABASE_DB_URL`.

## 2. Enable PostGIS (critical — PGlite hid this locally)

Dashboard → Database → Extensions → enable **postgis** (the migrations create
`geography` columns + GiST indexes and will fail without it). `pgcrypto` and
`citext` live in the `extensions` schema and are created by the migrations.

## 3. Link + apply migrations

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push                     # applies supabase/migrations/*.sql in order
supabase db lint --level warning     # triage or accept advisors
```

Verify in the SQL editor that geography columns exist and indexes were created —
this is the first time that DDL runs for real:

```sql
select f_table_name, f_geometry_column, type
from geometry_columns;               -- expect properties/listing_snapshots/regions
```

## 4. Regenerate the typed schema

The committed `packages/db/src/generated/database.types.ts` is hand-authored.
Replace it from the real DB and confirm nothing drifted:

```bash
pnpm --filter @bai/db db:types       # supabase gen types … --linked --schema public
pnpm typecheck                       # must stay green; reconcile any diff
```

If typecheck breaks, the hand-authored types differed from the DB — fix the
call sites, commit the regenerated file.

## 5. Seed demo data (non-prod ONLY)

```bash
supabase db reset                    # local; applies migrations + seed.sql
```

Against a shared/prod DB, **do not** run the seed. The guard in `seed.sql`
hard-aborts if you mark the database production:

```sql
alter database postgres set app.environment = 'production';
```

## 6. Auth

Dashboard → Authentication → Providers → enable **Email** (password). Create real
users via the dashboard or admin API. Do **not** rely on `seed.sql` auth users
outside local. Then verify: log in on the web app → land on `/app` → log out.

## 7. Storage buckets + object policies

The migrations create the private `import-files` and `reports` buckets where
Storage exists, and `20260719220000_storage_object_policies.sql` adds object RLS
(import-files scoped to the uploader's `user_id` prefix; reports to dataset
members). Confirm both buckets are **Private** in the dashboard, then test a
signed upload/download round-trip through the Imports wizard.

## 8. Environment files

`apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server only, never shipped to browser
CRON_SECRET=<long-random-string>
APP_URL=https://<your-web-domain>
APP_TIMEZONE=Asia/Makassar
# MAP_STYLE_URL=<optional tile style>
```

`apps/worker/.env`:

```bash
SUPABASE_DB_URL=postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
WORKER_ID=worker-1
WORKER_POLL_INTERVAL_MS=5000
WORKER_CONCURRENCY=2
```

## 9. Run the worker

```bash
pnpm --filter @bai/worker build
node apps/worker/dist/index.js
# expect: worker.start … then job.claimed / import.completed on activity
```

## 10. End-to-end smoke (the real proof — never run before)

1. Log in → **Imports** → upload a small demo CSV (headers:
   `source_key,external_id,observed_at,observation_status,…`; `source_key=demo_fixture`).
2. Worker logs show `job.claimed` → `import.completed`.
3. **Properties** shows canonical properties; **Events** shows `listing_created`;
   open **Compare** on a listing to see field diffs.
4. As an admin, try **Sources** → add a schedule for the fixture source; trigger
   `/api/cron` (below) and confirm a collect run appears and the worker runs it.

## 11. Cron

Point a scheduler (Vercel Cron, GitHub Actions cron, or any external caller) at:

```
POST https://<your-web-domain>/api/cron
Authorization: Bearer <CRON_SECRET>
```

It calls `enqueue_due_collections()` — only approved, automation-allowed sources
with an elapsed schedule are enqueued. A missing/wrong secret returns 401.

## 12. Production hardening checklist

- [ ] `alter database … set app.environment = 'production';` (blocks demo seed).
- [ ] Service role + `SUPABASE_DB_URL` live only in the host's secret manager.
- [ ] `supabase db lint` advisors triaged; `pnpm audit --prod` reviewed.
- [ ] Backups/PITR confirmed (Supabase plan) + a test restore.
- [ ] A real, permitted data source configured (fixtures are demo-only; live
      Airbnb/OTA scraping stays disabled by design).
- [ ] Monitoring sink wired for the worker's structured logs.

---

Once you pick hosts (e.g. Vercel for `apps/web`, a container/Fly/Railway for
`apps/worker`), `.github/workflows/deploy.yml` is ready to fill in — tell me the
stack and I'll wire the deploy steps + required secrets.
