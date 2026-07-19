# 0004 — Evidence-backed lifecycle state

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

The product makes claims about whether a listing appears active or inactive.
These claims must be defensible and must never overstate certainty.

## Decision

Every event references its evidence: the contributing snapshots, the collection
run, the rule version and a human-readable explanation. Lifecycle uses a
three-step confirmation (`first_miss` → `suspected_inactive` →
`confirmed_inactive`) with reactivation. Search absence and source errors never
increment misses.

## Consequences

- Findings are auditable and reproducible under a known rule version.
- Degraded runs suppress unsafe transitions.
- Slightly more storage per event (evidence rows).

## Alternatives

- **Single-miss inactivity** — rejected: too many false positives.
- **Opaque scoring without evidence** — rejected: not defensible.
