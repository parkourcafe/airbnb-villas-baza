# Security checklist — Bali Accommodation Intelligence

This checklist maps each Milestone 10 security requirement to where it is
enforced in the codebase and how it is verified. "Verified" means executed by a
test (unit / PGlite / e2e); "reviewed" means asserted structurally in code.

## Access control & tenancy

| Item                        | Enforcement                                                                                             | Status                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| RLS on every exposed table  | Policies on all `public` tables; `private`/`app` schemas excluded from the Data API (`config.toml`)     | Verified (PGlite RLS suite)      |
| Grants review               | `anon` gets nothing on tenant data; `authenticated` is row-restricted; append-only where required       | Verified (grant-scoping tests)   |
| Authorization source        | Only membership/access tables (`private.is_org_member`/`user_has_org_role`/`user_can_*`); never user metadata | Reviewed + verified            |
| Org-private tables          | watchlists/leads/reports/notes/imports scoped to org membership; cross-org isolation                    | Verified (`leads.db.test`)       |
| Admin-only actions          | property merge gated on `user_can_administer_dataset`; event review gated on `canMutateData`             | Verified (`merge`/`lifecycle` tests) |
| SECURITY DEFINER hardening  | Fixed empty `search_path`, explicit `auth.uid()` check, execute revoked from public/anon, granted to `authenticated` | Reviewed (`merge_properties`, RLS helpers) |

## Data-layer safety

| Item                          | Enforcement                                                                                 | Status                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------- |
| CSV formula-injection         | `escapeCsvCell` prefixes `= + - @ \t \r` cells; RFC-4180 quoting                             | Verified (`reporting/csv.test`) |
| Input fuzzing                 | Hostile field values + malformed CSV never crash; bad rows rejected with typed codes         | Verified (`import-engine/fuzz.test`) |
| Immutable snapshots           | `unique (source_listing_id, collection_run_id)`; no client write grants                       | Verified (`snapshot.db.test`) |
| Immutable report parameters   | Trigger blocks changes to `reports.parameters`                                                | Verified (`leads.db.test`)    |
| Source compliance gate        | DB trigger rejects a run for any non-approved source; worker gate blocks disabled/pending     | Verified (`source.db.test`)   |
| Audit integrity               | Merge/review actions write `audit_logs`; dismissed events stay in history                     | Verified (`merge`/`lifecycle` tests) |

## Perimeter & secrets

| Item                        | Enforcement                                                                        | Status                    |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| Service role never in browser | `getServiceClient` refuses to construct client-side; key server-only              | Reviewed                  |
| Signed URL expiration       | Import upload/download use short-lived signed URLs (presign route)                  | Reviewed                  |
| Cron authentication         | `POST /api/cron` requires `CRON_SECRET` (constant-time), fails closed when unset    | Verified (`cron.spec` e2e) |
| Open-redirect safety        | `sanitizeInternalPath` on post-login redirect                                       | Verified (`domain` unit)  |
| No committed secrets        | `.env.example` names-only; no secrets in the tree                                   | Reviewed                  |
| Observation language        | UI never claims "removed/illegal/banned"; "Likely inactive" for confirmed_inactive  | Reviewed                  |

## Not runnable in this environment (wired to run where available)

- `supabase db lint` / database advisors — run in CI with a live database.
- Live storage-policy tests and signed-URL expiry against real Storage.
- Dependency audit (`pnpm audit`) — run in CI with registry access.
- Live PostGIS spatial queries (denormalized lat/lng used in the read path here).
