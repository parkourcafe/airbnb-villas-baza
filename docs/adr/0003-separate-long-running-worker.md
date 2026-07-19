# 0003 — Separate long-running worker

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Collection, parsing and engine work are long-running and CPU/IO heavy. Serverless
web requests and cron invocations are the wrong place for them.

## Decision

Run a separate long-running Node.js worker process. Vercel Cron only enqueues due
jobs via a protected endpoint; the worker polls and processes them with bounded
concurrency, heartbeats and graceful shutdown.

## Consequences

- The web app stays responsive and never parses large files synchronously.
- The worker can be hosted on any container platform.
- Two deployment targets must be operated (web + worker).

## Alternatives

- **Process jobs inside web/serverless functions** — rejected: execution limits,
  no long-running guarantees.
- **Run heavy work directly in cron** — rejected: cron only schedules.
