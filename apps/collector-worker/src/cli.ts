import { createInterface } from "node:readline/promises";
import { loadCollectorConfig, type CollectorConfig } from "./config";
import { getSql, closeSql } from "./db";
import { logger } from "./logger";
import { PgCollectorStore } from "./store/pg-store";
import { PlaywrightPageDriver } from "./browser/playwright-driver";
import type { PageDriver } from "./browser/page-driver";
import { runCollection } from "./runner/collect";
import { runVerification } from "./runner/verify";
import type { CollectorStore } from "./store/store";

const USAGE = `bai-collector <command>

Commands:
  login            Open the visible browser so you can sign in once (session is
                   saved to your local profile; no credentials are stored).
  start            Claim queued collections and run them in a visible browser.
  status           Show recent collections and their progress.
  resume <jobId>   Resume a paused / manual-action collection.
  stop <jobId>     Cancel a collection.
  verify <jobId>   Run an existing-listing verification collection.

Live collection requires AIRBNB_LIVE_COLLECTOR_ENABLED=true and SUPABASE_DB_URL.
The collector STOPS and asks you to act on any login / CAPTCHA / blocking page —
it never tries to bypass a site's protections.`;

function requireDb(config: CollectorConfig): CollectorStore {
  if (!config.databaseUrl) {
    throw new Error("SUPABASE_DB_URL is required to reach the BAI database.");
  }
  return new PgCollectorStore(getSql(config.databaseUrl));
}

function makePacing(config: CollectorConfig) {
  return {
    actionDelayMs: config.actionDelayMs,
    retryLimit: config.retryLimit,
  };
}

function makeDriver(config: CollectorConfig): PageDriver {
  if (!config.liveEnabled) {
    throw new Error(
      "Live collection is disabled. Set AIRBNB_LIVE_COLLECTOR_ENABLED=true to run a real browser collection.",
    );
  }
  return new PlaywrightPageDriver({
    profileDir: config.profileDir,
    headless: config.headless,
  });
}

async function cmdLogin(config: CollectorConfig): Promise<number> {
  const driver = makeDriver(config);
  await driver.launch();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  logger.info("collector.login.prompt", { profileDir: config.profileDir });
  await rl.question(
    "A browser window is open. Sign in if prompted, then press Enter here to save the session… ",
  );
  rl.close();
  await driver.close();
  return 0;
}

async function runOne(
  config: CollectorConfig,
  store: CollectorStore,
  collectionId: string,
): Promise<void> {
  const collection = await store.getCollection(collectionId);
  if (!collection) throw new Error(`collection ${collectionId} not found`);
  const deps = {
    store,
    driver: makeDriver(config),
    pacing: makePacing(config),
  };
  if (collection.mode === "verify_existing_listings") {
    await runVerification(deps, collectionId, config.workerId);
  } else {
    await runCollection(deps, collectionId, config.workerId);
  }
}

async function cmdStart(config: CollectorConfig): Promise<number> {
  const store = requireDb(config);
  let ran = 0;
  for (;;) {
    const collection = await store.claimCollection(config.workerId);
    if (!collection) break;
    logger.info("collector.claimed", {
      collection: collection.id,
      mode: collection.mode,
    });
    await runOne(config, store, collection.id);
    ran += 1;
  }
  logger.info("collector.start.done", { ran });
  return 0;
}

async function cmdResume(
  config: CollectorConfig,
  jobId: string,
): Promise<number> {
  const store = requireDb(config);
  await runOne(config, store, jobId);
  return 0;
}

async function cmdVerify(
  config: CollectorConfig,
  jobId: string,
): Promise<number> {
  const store = requireDb(config);
  await runVerification(
    { store, driver: makeDriver(config), pacing: makePacing(config) },
    jobId,
    config.workerId,
  );
  return 0;
}

async function cmdStop(
  config: CollectorConfig,
  jobId: string,
): Promise<number> {
  const store = requireDb(config);
  await store.setState(jobId, "cancelled", { finished: true });
  logger.info("collector.stopped", { collection: jobId });
  return 0;
}

async function cmdStatus(config: CollectorConfig): Promise<number> {
  if (!config.databaseUrl) throw new Error("SUPABASE_DB_URL is required.");
  const sql = getSql(config.databaseUrl);
  const rows = await sql<
    {
      id: string;
      state: string;
      market: string;
      unique_listings: number;
      completed_cells: number;
      planned_cells: number;
    }[]
  >`
    select id, state, market, unique_listings, completed_cells, planned_cells
    from public.browser_collections
    order by created_at desc
    limit 20
  `;
  for (const row of rows) {
    logger.info("collector.status", {
      collection: row.id,
      state: row.state,
      market: row.market,
      cells: `${row.completed_cells}/${row.planned_cells}`,
      uniqueListings: row.unique_listings,
    });
  }
  return 0;
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const config = loadCollectorConfig();
  const [command, arg] = argv;
  try {
    switch (command) {
      case "login":
        return await cmdLogin(config);
      case "start":
        return await cmdStart(config);
      case "status":
        return await cmdStatus(config);
      case "resume":
        if (!arg) throw new Error("resume requires a <jobId>");
        return await cmdResume(config, arg);
      case "verify":
        if (!arg) throw new Error("verify requires a <jobId>");
        return await cmdVerify(config, arg);
      case "stop":
        if (!arg) throw new Error("stop requires a <jobId>");
        return await cmdStop(config, arg);
      case undefined:
      case "help":
      case "--help":
      case "-h":
        process.stdout.write(`${USAGE}\n`);
        return 0;
      default:
        process.stderr.write(`Unknown command: ${command}\n\n${USAGE}\n`);
        return 1;
    }
  } catch (error) {
    logger.error("collector.command.failed", {
      command,
      message: error instanceof Error ? error.message : String(error),
    });
    return 1;
  } finally {
    await closeSql();
  }
}
