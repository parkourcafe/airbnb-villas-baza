# Implementation status

This document tracks milestone progress for Bali Accommodation Intelligence
(BAI). It is updated at the end of every milestone.

## Current state

- **Active milestone:** Milestone 0 — Repository foundation ✅ complete
- **Next milestone:** Milestone 1 — Local Supabase, auth and tenancy (not started)
- **Runtime:** Node.js 24 LTS · pnpm · Turborepo · Next.js App Router · TypeScript strict

## Milestone 0 — Repository foundation ✅

| Area                                                       | Status | Notes                                                                                       |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Git + `.nvmrc` (Node 24) + `packageManager`                | ✅     | pnpm workspace + Turborepo                                                                  |
| TypeScript strict base config                              | ✅     | `tsconfig.base.json`, shared presets in `@bai/config`                                       |
| Shared ESLint (flat) + Prettier                            | ✅     | `@bai/config` exposes `eslint/*` and `prettier`                                             |
| `.editorconfig`, `.gitignore`, `.env.example`, `README.md` | ✅     | Secrets are names-only in `.env.example`                                                    |
| `apps/web` (Next.js App Router, Tailwind, `src/`)          | ✅     | Home + methodology + `/api/health`                                                          |
| `apps/worker` (Node TS)                                    | ✅     | Structured logger, smoke mode, graceful shutdown                                            |
| `packages/*` scaffolds                                     | ✅     | domain, db, source-sdk, import/snapshot/event engines, reporting, ui, config, test-fixtures |
| shadcn/ui-style kit + theme tokens                         | ✅     | Button, Card, Input, Table, Badge, Sheet, Dialog, DropdownMenu, Tabs, Skeleton              |
| Vitest unit smoke tests                                    | ✅     | One per meaningful package                                                                  |
| Playwright web E2E smoke test                              | ✅     | Home render + health endpoint                                                               |
| Worker smoke test                                          | ✅     | Config defaults + smoke run exits 0                                                         |
| CI workflow                                                | ✅     | `.github/workflows/ci.yml`                                                                  |
| `docs/IMPLEMENTATION_STATUS.md` + `docs/adr/`              | ✅     | 8 ADR placeholders created                                                                  |

### Stop condition honored

Supabase is **not** set up in milestone 0. `pnpm supabase:status` and
`pnpm db:types` are intentional no-ops until milestone 1, and `test:db` scripts
report that database tests arrive later.

### Deviations

- **Node runtime for verification.** The spec pins Node 24 LTS (`.nvmrc` = 24,
  `engines.node >= 24`). Node 24.18.0 was installed in the execution environment
  to run all checks on the pinned runtime.
- **Fonts.** Per the plan, no bundled fonts from any provided HTML are imported.
  A system font-stack fallback (`--font-sans` / `--font-mono`) is used instead of
  a remote web-font fetch to keep the build free of network dependencies.
- **Lint during build.** `next build` has ESLint disabled (`eslint.ignoreDuringBuilds`)
  because linting runs as a dedicated `pnpm lint` task using the shared flat config.

## Later milestones

Milestones 1–10 are defined in `bai_codex_spec/05_CODEX_IMPLEMENTATION_PLAN.md`
and have not been started.
