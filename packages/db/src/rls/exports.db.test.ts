import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Launch follow-ups: async exports + notification rules. Both organization-
 * private. Verifies cross-org isolation, viewer read-only, and export-job
 * enqueue.
 */
describe("exports and notification rules", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    await ctx.actAs(ctx.ids.owner1);
    await ctx.db.exec(`
      insert into public.exports (id, organization_id, dataset_id, export_type, filters)
      values ('00000000-0000-0000-0000-0000000ee001', '${ctx.ids.org1}', '${ctx.ids.datasetA}',
              'properties', '{"region":"canggu"}');
      insert into public.notification_rules (id, organization_id, name, event_types)
      values ('00000000-0000-0000-0000-0000000ee002', '${ctx.ids.org1}', 'Inactivity alerts',
              '{listing_confirmed_inactive}');
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("enqueues an export job on creation", async () => {
    await ctx.actAsSuperuser();
    const jobs = await ctx.db.query(
      `select id from private.collection_jobs
       where job_type = 'export' and payload->>'export_id' = '00000000-0000-0000-0000-0000000ee001'`,
    );
    expect(jobs.rows).toHaveLength(1);
    const status = await ctx.db.query<{ status: string }>(
      `select status::text as status from public.exports where id = '00000000-0000-0000-0000-0000000ee001'`,
    );
    expect(status.rows[0]?.status).toBe("queued");
  });

  it("hides another organization's exports and notification rules", async () => {
    await ctx.actAs(ctx.ids.owner2);
    expect(
      (await ctx.db.query(`select id from public.exports`)).rows,
    ).toHaveLength(0);
    expect(
      (await ctx.db.query(`select id from public.notification_rules`)).rows,
    ).toHaveLength(0);
  });

  it("blocks a viewer from creating an export or a rule", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `insert into public.exports (organization_id, dataset_id, export_type)
         values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', 'properties')`,
      ),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      ctx.db.query(
        `insert into public.notification_rules (organization_id, name)
         values ('${ctx.ids.org1}', 'x')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
