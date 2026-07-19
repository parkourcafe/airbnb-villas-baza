# Bali Accommodation Intelligence (BAI)

Source-agnostic, history-first, evidence-backed analytics for the Bali
accommodation market. BAI ingests repeated observations from **approved** data
channels, stores immutable history, compares snapshots, and surfaces
evidence-backed events — using observation language, never legal conclusions.

> **Status:** Milestone 0 (repository foundation). Data ingestion, database and
> dashboards arrive in later milestones. See
> [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md).

## Requirements

- **Node.js 24 LTS** (see [`.nvmrc`](./.nvmrc))
- **pnpm** (pinned via `packageManager` in [`package.json`](./package.json);
  `corepack enable` will provision it)

## Quick start

```bash
corepack enable            # provisions the pinned pnpm
pnpm install --frozen-lockfile
pnpm dev                   # runs web + worker in dev
```

- Web app: http://localhost:3000
- Worker: long-running process (heartbeat logs). Smoke run:
  `pnpm --filter @bai/worker smoke`.

## Verification

```bash
pnpm lint          # ESLint (flat config)
pnpm typecheck     # tsc --noEmit across the workspace
pnpm test          # Vitest unit tests
pnpm test:e2e      # Playwright web smoke test
pnpm build         # production builds (web + worker)
pnpm format:check  # Prettier

# Introduced in milestone 1 (currently no-ops):
pnpm test:db
pnpm supabase:status
pnpm db:types
```

## Monorepo layout

```text
apps/
  web/       Next.js App Router app (public site + dashboard shell)
  worker/    Long-running Node worker (queue polling, engines)
packages/
  domain/          Pure domain model (enums, schemas, errors) — no db/network
  db/              Lazy clients + keyset pagination (Supabase from M1)
  source-sdk/      Source adapter contract + compliance gate + registry
  import-engine/   CSV contract + validation (full pipeline in M3)
  snapshot-engine/ Normalization + fingerprints (full engine in M4)
  event-engine/    Event dedupe + rule version (lifecycle in M4–M5)
  reporting/       Injection-safe CSV export (reports in M7)
  ui/              shadcn/ui-style kit + Tailwind preset + theme tokens
  config/          Shared TS/ESLint/Prettier config
  test-fixtures/   Controlled demo datasets (clearly marked demo)
docs/
  IMPLEMENTATION_STATUS.md
  adr/             Architecture Decision Records
  bai_codex_spec/  The BAI specification bundle (reference)
```

## Principles

- **Source-agnostic:** `Property → Source Listing → Snapshot → Diff → Event`.
- **Evidence-backed:** every event references its snapshots, run and rule version.
- **Observation language:** `Not observed in search`, `Suspected inactive`,
  `Likely inactive` — never "illegal" or "removed for cause".
- **Compliance first:** no live restricted-source scraping; the `airbnb` source
  is seeded disabled and every automated adapter passes the compliance gate.
- **Time:** stored in UTC, displayed in Asia/Makassar.

## Security

- Secrets are never committed. [`.env.example`](./.env.example) contains names
  only. The service role key is never exposed to the browser; SDKs are lazily
  initialized. See the ADRs in [`docs/adr`](./docs/adr).
