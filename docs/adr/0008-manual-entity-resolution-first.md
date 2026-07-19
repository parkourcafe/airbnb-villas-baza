# 0008 — Manual entity resolution first

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Deciding that two source listings are the same physical property is
consequential. Automated merging risks silently corrupting identity and history.

## Decision

For the MVP, resolve canonical properties explicitly: honor an import-provided
`canonical_property_key`, otherwise create a new property per new source listing.
Merges and splits are manual, audited actions. The system may suggest candidates
with reasons and a score, but never auto-merges opaquely.

## Consequences

- Identity changes are deliberate and auditable.
- Merge retains all source listings and history; split preserves evidence.
- Some duplicate properties exist until a human merges them.

## Alternatives

- **Automatic AI merge** — rejected: unaccountable identity changes.
- **No merge capability** — rejected: duplicates would accumulate permanently.
