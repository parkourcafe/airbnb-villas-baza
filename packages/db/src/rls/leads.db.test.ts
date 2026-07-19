import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 7: watchlists / leads / reports are organization-private. Executed
 * against the real migrations in PGlite. Asserts cross-org isolation, viewer
 * read-only enforcement, lead→evidence linkage, and report-parameter
 * immutability.
 */
describe("watchlists, leads and reports", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    await ctx.actAs(ctx.ids.owner1);
    await ctx.db.exec(`
      insert into public.watchlists (id, organization_id, dataset_id, name)
      values ('00000000-0000-0000-0000-0000000cc001', '${ctx.ids.org1}', '${ctx.ids.datasetA}', 'High-value villas');
      insert into public.watchlist_items (watchlist_id, item_type, property_id)
      values ('00000000-0000-0000-0000-0000000cc001', 'property', '${ctx.ids.propertyA1}');
      insert into public.leads (id, organization_id, dataset_id, property_id, event_id, reason_code, reason_text)
      values ('00000000-0000-0000-0000-0000000cc002', '${ctx.ids.org1}', '${ctx.ids.datasetA}',
              '${ctx.ids.propertyA1}', '${ctx.ids.eventA1}', 'high_confidence_event', 'Converted from a confirmed event');
      insert into public.reports (id, organization_id, dataset_id, report_type, name, parameters)
      values ('00000000-0000-0000-0000-0000000cc003', '${ctx.ids.org1}', '${ctx.ids.datasetA}',
              'watchlist_summary', 'Weekly watchlist', '{"watchlist_id":"00000000-0000-0000-0000-0000000cc001"}');
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("converts an event to a lead that retains its evidence link", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const rows = await ctx.db.query<{ event_id: string | null }>(
      `select event_id from public.leads where id = '00000000-0000-0000-0000-0000000cc002'`,
    );
    expect(rows.rows[0]?.event_id).toBe(ctx.ids.eventA1);
  });

  it("hides another organization's watchlists, leads and reports", async () => {
    await ctx.actAs(ctx.ids.owner2);
    for (const table of ["watchlists", "leads", "reports", "watchlist_items"]) {
      const rows = await ctx.db.query(`select * from public.${table}`);
      expect(rows.rows).toHaveLength(0);
    }
  });

  it("blocks a viewer from creating a lead", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `insert into public.leads (organization_id, dataset_id, property_id, reason_code)
         values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', '${ctx.ids.propertyA2}', 'manual')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("lets a viewer read its organization's leads", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    const rows = await ctx.db.query(`select id from public.leads`);
    expect(rows.rows).toHaveLength(1);
  });

  it("enqueues a report generation job when a report is created", async () => {
    await ctx.actAsSuperuser();
    const jobs = await ctx.db.query(
      `select id from private.collection_jobs
       where job_type = 'report' and payload->>'report_id' = '00000000-0000-0000-0000-0000000cc003'`,
    );
    expect(jobs.rows).toHaveLength(1);
  });

  it("enforces immutable report parameters (reproducibility)", async () => {
    await ctx.actAs(ctx.ids.owner1);
    // Non-parameter columns can change...
    await ctx.db.exec(
      `update public.reports set status = 'ready', ready_at = now()
       where id = '00000000-0000-0000-0000-0000000cc003'`,
    );
    // ...but the parameters are frozen.
    await expect(
      ctx.db.query(
        `update public.reports set parameters = '{"watchlist_id":"other"}'
         where id = '00000000-0000-0000-0000-0000000cc003'`,
      ),
    ).rejects.toThrow(/immutable/i);
  });

  it("enforces exactly one watchlist-item target", async () => {
    await ctx.actAs(ctx.ids.owner1);
    await expect(
      ctx.db.query(
        `insert into public.watchlist_items (watchlist_id, item_type, property_id, region_id)
         values ('00000000-0000-0000-0000-0000000cc001', 'property', '${ctx.ids.propertyA1}', '${ctx.ids.region1}')`,
      ),
    ).rejects.toThrow(/watchlist_items_one_target|check/i);
  });
});
