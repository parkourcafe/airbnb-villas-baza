# 0002 — Postgres job queue for the MVP

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Imports and collection runs must be processed asynchronously and idempotently.
A dedicated broker (Redis/SQS) adds operational surface the MVP does not need.

## Decision

Use a PostgreSQL table queue with `FOR UPDATE SKIP LOCKED` for atomic job claims.
Jobs are created transactionally with their runs; retries, heartbeats and stale
recovery are modeled as rows.

## Consequences

- Fewer moving parts; one source of truth; easy auditability.
- Claiming is transactional and safe across multiple workers.
- A dedicated queue is revisited past defined scale thresholds (e.g. >100k jobs/day).

## Alternatives

- **Redis/BullMQ** — rejected for the MVP: extra infrastructure.
- **Cloud queue (SQS/PubSub)** — rejected for the MVP: weaker transactional coupling.
