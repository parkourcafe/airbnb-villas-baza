# 0005 — Dataset-based multi-tenancy

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Multiple organizations use the platform and must be strictly isolated, while a
single organization may hold several datasets with different access.

## Decision

Authorize on organization membership plus explicit dataset access. Enforce it in
the database with Row Level Security on every exposed table, backed by
server-side checks. Authorization never derives from user-editable metadata.

## Consequences

- Data is scoped by organization and dataset at the lowest layer.
- RLS predicates must be indexed for performance.
- Every exposed table needs deliberate policies and grants.

## Alternatives

- **Application-only checks** — rejected: one missed check leaks data.
- **Schema-per-tenant** — rejected: heavy to operate at MVP scale.
