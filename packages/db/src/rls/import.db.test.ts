import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 3: imports RLS and the atomic job-claim function. Executed against
 * the real migrations in PGlite.
 */
describe("import workflow", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    // A queued job on the harness's baseline run.
    await ctx.actAsSuperuser();
    await ctx.db.exec(`
      insert into private.collection_jobs (id, collection_run_id, job_type, status)
      values ('00000000-0000-0000-0000-0000000aa001', '${ctx.ids.runA}', 'import', 'queued');
      insert into public.imports (id, organization_id, dataset_id, source_id, status, file_checksum)
      values ('00000000-0000-0000-0000-0000000bb001', '${ctx.ids.org1}', '${ctx.ids.datasetA}', '${ctx.ids.source1}', 'completed', 'chk-1');
      insert into public.import_rejections (import_id, row_number, error_code)
      values ('00000000-0000-0000-0000-0000000bb001', 1, 'invalid_status');
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("claims a queued job exactly once (JOB-01)", async () => {
    await ctx.actAsSuperuser();
    const first = await ctx.db.query<{ id: string | null }>(
      `select (private.claim_collection_job('worker-1')).id as id`,
    );
    expect(first.rows[0]?.id).toBe("00000000-0000-0000-0000-0000000aa001");

    const status = await ctx.db.query<{ status: string | null }>(
      `select status::text as status from private.collection_jobs where id = '00000000-0000-0000-0000-0000000aa001'`,
    );
    expect(status.rows[0]?.status).toBe("running");

    // No queued job remains, so a second claim returns nothing.
    const second = await ctx.db.query<{ id: string | null }>(
      `select (private.claim_collection_job('worker-2')).id as id`,
    );
    expect(second.rows[0]?.id ?? null).toBeNull();
  });

  it("scopes imports and rejections to the owning organization", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const own = await ctx.db.query(`select id from public.imports`);
    expect(own.rows).toHaveLength(1);
    const rej = await ctx.db.query(`select id from public.import_rejections`);
    expect(rej.rows).toHaveLength(1);

    await ctx.actAs(ctx.ids.owner2);
    expect(
      (await ctx.db.query(`select id from public.imports`)).rows,
    ).toHaveLength(0);
    expect(
      (await ctx.db.query(`select id from public.import_rejections`)).rows,
    ).toHaveLength(0);
  });

  it("lets a non-viewer create an import but blocks a viewer", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const ok = await ctx.db.query(
      `insert into public.imports (organization_id, dataset_id, source_id, status, file_checksum)
       values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', '${ctx.ids.source1}', 'uploaded', 'chk-owner')`,
    );
    expect(ok.affectedRows).toBe(1);

    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `insert into public.imports (organization_id, dataset_id, source_id, status, file_checksum)
         values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', '${ctx.ids.source1}', 'uploaded', 'chk-viewer')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("enqueues a run + job when an import with a file is created", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const ins = await ctx.db.query<{ id: string }>(
      `insert into public.imports (organization_id, dataset_id, source_id, status, file_checksum, input_object_path)
       values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', '${ctx.ids.source1}', 'uploaded', 'chk-enq', 'org1/imp/file.csv')
       returning id`,
    );
    const importId = ins.rows[0]?.id;

    await ctx.actAsSuperuser();
    const jobs = await ctx.db.query(
      `select id from private.collection_jobs where payload->>'import_id' = '${importId}'`,
    );
    expect(jobs.rows).toHaveLength(1);
    const run = await ctx.db.query<{ collection_run_id: string | null }>(
      `select collection_run_id from public.imports where id = '${importId}'`,
    );
    expect(run.rows[0]?.collection_run_id).not.toBeNull();
  });
});
