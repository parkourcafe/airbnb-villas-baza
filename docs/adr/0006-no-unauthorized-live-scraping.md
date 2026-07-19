# 0006 — No unauthorized live scraping

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Restricted platforms protect their sites with bot detection, CAPTCHAs, rate
limits and terms of use. Unauthorized scraping is a legal and ethical risk and is
out of scope for the MVP.

## Decision

Do not build or run a live Airbnb/Booking/Agoda collector. Never bypass CAPTCHA,
bot detection, rate limits, authentication or robots controls, and never reverse
engineer private APIs. Data enters only via CSV, demo fixtures, owner-provided
data, licensed APIs or reviewed public data. The `airbnb` source is seeded
disabled, and every automated adapter must pass the compliance gate before it can
run.

## Consequences

- The system is safe and compliant by default.
- Enabling any restricted source requires an explicit, separate decision.
- Coverage depends on approved channels rather than scraping.

## Alternatives

- **Scrape restricted sites** — rejected: prohibited and risky.
