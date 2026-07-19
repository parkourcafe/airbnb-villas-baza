# BAI local collector

A small program you run **on your own computer** to fill a collection you created
in the BAI dashboard. It opens a **visible browser** you can watch, and it
**stops and asks you** whenever a page needs a human (a login, a "verify you're a
human" check, or a block). It never tries to get around those pages.

## What it does

1. You create a collection in the dashboard (**Collections → New collection**).
2. You run the collector here; it claims the collection.
3. It opens a visible browser, walks the planned search areas, and collects the
   listing cards it can see.
4. It removes duplicates (a listing found in two areas counts once).
5. Optionally it opens each listing to capture more detail.
6. It saves an immutable **snapshot** you can view under **Snapshots**.

## Safety

The collector does **not**: solve CAPTCHAs, take over accounts, spoof
fingerprints, rotate proxies, evade rate limits, or reverse-engineer hidden APIs.
When it meets a login / CAPTCHA / block it marks the collection
`manual_action_required` and waits for you. Your Airbnb login is **never** stored
in this repo or in BAI — it lives only in your local browser profile.

Automated, unattended collection stays **off**. Live collection only runs when you
set `AIRBNB_LIVE_COLLECTOR_ENABLED=true` yourself; otherwise the collector uses
mocked pages only (used by the tests).

## Setup

```bash
# from the repo root
pnpm install
pnpm --filter @bai/collector-worker build   # or use `pnpm --filter @bai/collector-worker collector <cmd>`

# required: point it at your BAI database (server-only connection string)
export SUPABASE_DB_URL="postgresql://…"
# turn on the real browser (off by default)
export AIRBNB_LIVE_COLLECTOR_ENABLED=true
```

## Commands

```bash
pnpm --filter @bai/collector-worker collector login          # sign in once, in the visible window
pnpm --filter @bai/collector-worker collector start          # claim queued collections and run them
pnpm --filter @bai/collector-worker collector status         # list recent collections
pnpm --filter @bai/collector-worker collector resume <jobId> # continue after you resolved a block
pnpm --filter @bai/collector-worker collector stop <jobId>   # cancel a collection
pnpm --filter @bai/collector-worker collector verify <jobId> # re-check a previous snapshot's listings
```

## Settings (environment variables)

| Variable                        | Default            | Meaning                                   |
| ------------------------------- | ------------------ | ----------------------------------------- |
| `SUPABASE_DB_URL`               | –                  | BAI database connection (required)        |
| `AIRBNB_LIVE_COLLECTOR_ENABLED` | `false`            | Turn on the real browser                  |
| `COLLECTOR_PROFILE_DIR`         | `~/.bai-collector` | Persistent browser profile (session only) |
| `COLLECTOR_ACTION_DELAY_MS`     | `1500`             | Pause between page actions (be gentle)    |
| `COLLECTOR_RETRY_LIMIT`         | `2`                | Retries for ordinary transient errors     |
| `COLLECTOR_HEADLESS`            | `false`            | Keep the browser visible (recommended)    |
| `WORKER_ID`                     | `collector-local`  | Identifies this collector                 |
