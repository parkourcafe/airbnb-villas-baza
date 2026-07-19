import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 8: the database-level source compliance gate. A collection run may
 * only be created for an APPROVED source — even by a direct insert — so a
 * disabled or pending source can never run (08 acceptance).
 */
describe("source compliance gate", () => {
  let ctx: TestDatabase;
  const disabledSource = "00000000-0000-0000-0000-0000000d0d01";
  const pendingSource = "00000000-0000-0000-0000-0000000d0d02";

  beforeAll(async () => {
    ctx = await createTestDatabase();
    await ctx.actAsSuperuser();
    await ctx.db.exec(`
      insert into private.data_sources (id, key, display_name, access_mode, compliance_status, automation_allowed)
      values ('${disabledSource}', 'airbnb', 'Airbnb', 'browser_automation', 'disabled', false),
             ('${pendingSource}', 'booking', 'Booking', 'licensed_api', 'pending_review', false);
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("allows a run for an approved source", async () => {
    await ctx.actAsSuperuser();
    const res = await ctx.db.query(
      `insert into private.collection_runs (dataset_id, source_id, run_kind, status)
       values ('${ctx.ids.datasetA}', '${ctx.ids.source1}', 'collect', 'pending')`,
    );
    expect(res.affectedRows).toBe(1);
  });

  it("rejects a run for a disabled source, even inserted directly", async () => {
    await ctx.actAsSuperuser();
    await expect(
      ctx.db.query(
        `insert into private.collection_runs (dataset_id, source_id, run_kind, status)
         values ('${ctx.ids.datasetA}', '${disabledSource}', 'collect', 'pending')`,
      ),
    ).rejects.toThrow(/not approved/i);
  });

  it("rejects a run for a pending source", async () => {
    await ctx.actAsSuperuser();
    await expect(
      ctx.db.query(
        `insert into private.collection_runs (dataset_id, source_id, run_kind, status)
         values ('${ctx.ids.datasetA}', '${pendingSource}', 'collect', 'pending')`,
      ),
    ).rejects.toThrow(/not approved/i);
  });
});
