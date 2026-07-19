# Implementation status

This document tracks milestone progress for Bali Accommodation Intelligence
(BAI). It is updated at the end of every milestone.

## Current state

- **Completed:** Milestone 0 (foundation) · Milestone 1 (Supabase schema, auth, tenancy)
- **Next milestone:** Milestone 2 — Core data schema and fixture catalogue (not started)
- **Runtime:** Node.js 24 LTS · pnpm · Turborepo · Next.js 16 App Router · TypeScript strict

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
| RLS tests                                                          | ✅     | 9 executed tests (see verification note)                                                                              |
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
