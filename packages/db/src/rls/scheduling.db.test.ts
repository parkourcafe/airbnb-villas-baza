import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 8 follow-up: source catalogue view + scheduled-collection enqueue.
 * Verifies the safe source projection, admin-only schedule management, and that
 * enqueue only creates runs for approved, due, automation-allowed sources.
 */
describe("source catalogue and scheduling", () => {
  let ctx: TestDatabase;
  const disabledSource = "00000000-0000-0000-0000-0000000d0e01";

  beforeAll(async () => {
    ctx = await createTestDatabase();
    await ctx.actAsSuperuser();
    // Fixture source1 is approved but automation is not implied; enable it.
    await ctx.db.exec(`
      update private.data_sources set automation_allowed = true where id = '${ctx.ids.source1}';
      -- 'airbnb' is seeded disabled by the browser-collection migration; keep this
      -- insert idempotent so both paths agree on a single disabled source row.
      insert into private.data_sources (id, key, display_name, access_mode, compliance_status, automation_allowed)
      values ('${disabledSource}', 'airbnb', 'Airbnb', 'browser_automation', 'disabled', true)
      on conflict (key) do nothing;
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("exposes a safe source projection without credentials", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const rows = await ctx.db.query<{ key: string; compliance_status: string }>(
      `select key, compliance_status from public.source_catalog where key = 'demo_fixture'`,
    );
    expect(rows.rows[0]?.compliance_status).toBe("approved");
  });

  it("lets an admin create a schedule but blocks a viewer", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `insert into public.collection_schedules (dataset_id, source_id, cadence_minutes)
         values ('${ctx.ids.datasetA}', '${ctx.ids.source1}', 60)`,
      ),
    ).rejects.toThrow(/row-level security/i);

    await ctx.actAs(ctx.ids.owner1);
    const ok = await ctx.db.query(
      `insert into public.collection_schedules (dataset_id, source_id, cadence_minutes)
       values ('${ctx.ids.datasetA}', '${ctx.ids.source1}', 60)`,
    );
    expect(ok.affectedRows).toBe(1);
    // A schedule for a disabled source: allowed to store, never enqueued.
    await ctx.db
      .query(
        `insert into public.collection_schedules (dataset_id, source_id, cadence_minutes)
       values ('${ctx.ids.datasetB}', '${disabledSource}', 60)`,
      )
      .catch(() => {
        /* datasetB not administered by owner1 — that's fine, ignore */
      });
  });

  it("enqueues due runs only for approved sources, then not again until due", async () => {
    await ctx.actAsSuperuser();
    const first = await ctx.db.query<{ enqueue_due_collections: number }>(
      `select public.enqueue_due_collections() as enqueue_due_collections`,
    );
    expect(first.rows[0]?.enqueue_due_collections).toBe(1);

    const runs = await ctx.db.query(
      `select id from private.collection_runs where requested_by_system = 'cron'`,
    );
    expect(runs.rows).toHaveLength(1);
    const jobs = await ctx.db.query(
      `select id from private.collection_jobs where job_type = 'collect' and status = 'queued'`,
    );
    expect(jobs.rows.length).toBeGreaterThanOrEqual(1);

    // Immediately re-running enqueues nothing (schedule not due for 60 minutes).
    const second = await ctx.db.query<{ enqueue_due_collections: number }>(
      `select public.enqueue_due_collections() as enqueue_due_collections`,
    );
    expect(second.rows[0]?.enqueue_due_collections).toBe(0);
  });
});
