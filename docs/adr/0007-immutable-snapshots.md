# 0007 — Immutable snapshots

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Historical analytics require a trustworthy record of what was observed and when.
Mutating past observations would destroy the ability to explain events.

## Decision

Snapshots are immutable. Each is unique per listing and run, references its raw
evidence, and records the parser version and fingerprints. Corrections adjust
projections; they never edit or delete the original snapshot.

## Consequences

- History is auditable and diffs are reproducible.
- Storage grows over time (retention handled per bucket/table).
- Idempotency keys prevent duplicate snapshots on reprocessing.

## Alternatives

- **Mutable "current" rows only** — rejected: loses history.
- **Soft-deleting/editing snapshots** — rejected: breaks evidence integrity.
