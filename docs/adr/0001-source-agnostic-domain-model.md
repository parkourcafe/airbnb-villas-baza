# 0001 — Source-agnostic domain model

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Accommodation data will eventually arrive from many channels (CSV, licensed
APIs, owner-provided data, public registries, fixtures). Building the core around
one external site would force a rewrite whenever that site changes.

## Decision

Model everything as `Physical Property → Source Listing → Observation/Snapshot →
Diff → Event`. Core domain packages (`@bai/domain` and the engines) contain no
source-specific or network code.

## Consequences

- New sources are added as adapters without touching the core.
- One physical property can hold listings from multiple sources over time.
- A small amount of indirection exists even when only one source is active.

## Alternatives

- **Airbnb-centric schema** — rejected: brittle and hard to extend.
- **Per-source siloed schemas** — rejected: prevents cross-source identity.
