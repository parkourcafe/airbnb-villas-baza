# 0009 — Private SECURITY DEFINER RLS helpers, tested with PGlite

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

RLS policies on tenancy tables must answer "is this user a member of / does this
user have access to this org/dataset?". Reading `organization_members` from a
policy that is itself on `organization_members` recurses. Separately, the target
environment has no Docker, so the Supabase local stack and CLI advisors cannot
run, yet the policies must be verified by execution, not just review.

## Decision

- Put RLS helper functions in the `private` schema as `SECURITY DEFINER` with a
  fixed empty `search_path`, fully-qualifying every object. They bypass the row
  policies of the tables they read, so membership checks never recurse.
  `authenticated` is granted `USAGE` on `private` and `EXECUTE` on the helpers
  only; the Data API is scoped to `public`, so no `private` table is reachable.
- Verify the migration and every policy by applying it to **PGlite** (in-process
  WASM Postgres) with the Supabase-provided objects (`auth.uid()`, roles)
  reproduced, and asserting the RLS matrix per role (`pnpm test:db`).

## Consequences

- No policy recursion; authorization derives only from membership/access tables.
- RLS is covered by fast, Docker-free, executed tests in CI.
- The emulation is not the real GoTrue/PostgREST stack; live login, database
  advisors and `gen types` still run where Docker/Supabase are available.

## Alternatives

- **SECURITY INVOKER helpers** — rejected: recursion on membership policies.
- **Public SECURITY DEFINER helpers** — rejected: broader exposure; the spec
  prefers private, revoked-from-public helpers.
- **Only running RLS tests against a live Supabase** — rejected as the sole
  method: impossible in this environment and slower in CI.
