# AGENTS.md

This repository implements Bali Accommodation Intelligence (BAI).

Read these files before changing code (the specification bundle lives in
`docs/bai_codex_spec/`):

1. `docs/bai_codex_spec/00_READ_ME_FIRST.md`
2. `docs/bai_codex_spec/01_PRODUCT_AND_SITE_ARCHITECTURE.md`
3. `docs/bai_codex_spec/02_SYSTEM_ARCHITECTURE.md`
4. `docs/bai_codex_spec/03_DATABASE_SCHEMA.md`
5. `docs/bai_codex_spec/04_EVENT_AND_REMOVAL_ENGINE.md`
6. `docs/bai_codex_spec/05_CODEX_IMPLEMENTATION_PLAN.md`
7. `docs/bai_codex_spec/06_ACCEPTANCE_TESTS.md`
8. `docs/bai_codex_spec/07_SOURCE_COMPLIANCE.md`

## Operating rules

### Scope

- Work on one milestone at a time.
- Do not begin the next milestone without an explicit user request.
- Do not silently broaden product scope.
- Update `docs/IMPLEMENTATION_STATUS.md`.

### Product language

- UI is English.
- Store timestamps in UTC.
- Display dates in Asia/Makassar by default.
- Use observation language.
- Never label a property illegal.
- Never claim a listing was removed for a particular cause without authoritative evidence.
- Use `Not observed in search`, `Suspected inactive`, and `Likely inactive`.

### Source compliance

- Do not build or run a live Airbnb scraper.
- Do not bypass CAPTCHA, bot detection, rate limits, authentication, robots controls or security measures.
- Do not reverse engineer undocumented private APIs.
- Do not enable Booking, Agoda or another OTA automatically.
- Every automated adapter must pass the source compliance gate.
- Use CSV, demo fixtures, owner-provided data, licensed APIs or reviewed public data.
- `airbnb` is seeded disabled.

### Architecture

- Keep the source-agnostic model:
  `Property -> Source Listing -> Snapshot -> Diff -> Event`.
- Snapshots are immutable.
- Events require evidence.
- Search absence is not removal.
- Source errors and blocked responses do not increment lifecycle misses.
- Worker is a separate long-running process.
- Vercel Cron only enqueues jobs.
- Job processing is idempotent.
- Core domain packages must not depend on UI or network.
- Push `use client` to the smallest interactive component.
- Use Server Components by default.
- Initialize service/database SDKs lazily, not at module scope.

### Supabase

- Verify current Supabase docs/changelog before implementation.
- Use migrations created through Supabase CLI.
- Enable RLS on every exposed table.
- Use explicit grants.
- Do not expose private schema.
- Never expose service role to browser.
- Do not use user metadata for authorization.
- Index RLS predicates.
- Views must use `security_invoker = true` when exposed.
- Avoid SECURITY DEFINER. If unavoidable, private schema, fixed search path, explicit auth check, revoked public execute and tests.
- Run database advisors after schema/security work.
- Generate and commit database types.

### Code quality

- TypeScript strict.
- No `any` without a documented reason.
- Zod at all untrusted boundaries.
- Named exports for components and utilities where practical.
- One component per file unless helper is truly private.
- No large barrel files.
- No N+1 queries.
- Cursor pagination for large lists.
- Stable list keys.
- Semantic HTML and keyboard support.
- Designed loading, empty, error and permission states.
- Pin dependencies and commit lockfile.
- Never commit secrets.

### Database and jobs

- Use transactions for job claim, lifecycle transition, event insert, merge/split and membership changes.
- Use `FOR UPDATE SKIP LOCKED` for job claim.
- Use deterministic idempotency/deduplication keys.
- One invalid row must not fail a whole import unless threshold is exceeded.
- Record parser version, rule version, run ID and evidence.
- Do not edit raw snapshots during corrections.

### Testing

Before marking a milestone complete, run its required commands.

Repository-level target scripts:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```

Do not claim success when a required check was skipped. State why.

### Change reporting

At the end of each task return:

- what was implemented;
- files changed;
- migrations;
- commands run;
- tests and results;
- security checks;
- known limitations;
- unresolved decisions;
- exact next milestone.

### Prohibited shortcuts

- fake production metrics;
- placeholder data presented as real;
- duplicated snapshots/events;
- direct client use of privileged keys;
- synchronous 25k-row import in a web request;
- hidden source automation;
- unaudited lifecycle override;
- deleting historical evidence;
- automatic mass outreach.
