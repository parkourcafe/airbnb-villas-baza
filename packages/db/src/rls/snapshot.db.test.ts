import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 4: the snapshot/diff write path exercised against the real
 * migrations in PGlite. Verifies snapshot immutability (unique per listing/run),
 * deterministic diff idempotency (unique per snapshot/field/rule), and that
 * diffs stay dataset-scoped under RLS.
 */
describe("snapshot and diff persistence", () => {
  let ctx: TestDatabase;
  const runB = "00000000-0000-0000-0000-0000000d0aa2";
  const snap2 = "00000000-0000-0000-0000-0000000f0aa2";

  beforeAll(async () => {
    ctx = await createTestDatabase();
    await ctx.actAsSuperuser();
    // A second, later collection run and a follow-up snapshot for listingA1
    // with a >=5% price rise relative to a baseline of 3,500,000 IDR.
    await ctx.db.exec(`
      insert into private.collection_runs (id, dataset_id, source_id, run_kind, status, parser_version, idempotency_key)
      values ('${runB}', '${ctx.ids.datasetA}', '${ctx.ids.source1}', 'import', 'completed', 'csv-import:v1', 'demo-2');

      insert into public.listing_snapshots
        (id, dataset_id, source_listing_id, collection_run_id, observed_at, observation_status,
         observed_price_amount, observed_price_currency, observed_price_unit,
         content_fingerprint, parser_version, field_presence)
      values
        ('${snap2}', '${ctx.ids.datasetA}', '${ctx.ids.listingA1}', '${runB}',
         '2026-07-22T00:00:00Z', 'active', 3800000, 'IDR', 'night', 'fp-demo-002',
         'csv-import:v1', '{"price":true}');

      insert into public.snapshot_diffs
        (dataset_id, source_listing_id, previous_snapshot_id, current_snapshot_id,
         field_name, previous_value, current_value, change_kind, absolute_delta,
         percent_delta, is_material, rule_version)
      values
        ('${ctx.ids.datasetA}', '${ctx.ids.listingA1}', '${ctx.ids.snapshotA1}', '${snap2}',
         'price', '{"amount":"3500000","currency":"IDR","unit":"night"}',
         '{"amount":"3800000","currency":"IDR","unit":"night"}', 'increased', 300000,
         0.0857, true, 'field-diff:v1');
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("keeps snapshots immutable: one row per listing per run", async () => {
    await ctx.actAsSuperuser();
    await expect(
      ctx.db.query(`
        insert into public.listing_snapshots
          (dataset_id, source_listing_id, collection_run_id, observed_at, observation_status,
           content_fingerprint, parser_version)
        values ('${ctx.ids.datasetA}', '${ctx.ids.listingA1}', '${runB}',
                '2026-07-22T00:00:00Z', 'active', 'fp-dupe', 'csv-import:v1')
      `),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("does not duplicate a diff on a repeated engine run (idempotency)", async () => {
    await ctx.actAsSuperuser();
    await expect(
      ctx.db.query(`
        insert into public.snapshot_diffs
          (dataset_id, source_listing_id, current_snapshot_id, field_name,
           change_kind, is_material, rule_version)
        values ('${ctx.ids.datasetA}', '${ctx.ids.listingA1}', '${snap2}',
                'price', 'increased', true, 'field-diff:v1')
      `),
    ).rejects.toThrow(/duplicate key|unique/i);

    const rows = await ctx.db.query(
      `select id from public.snapshot_diffs where current_snapshot_id = '${snap2}' and field_name = 'price'`,
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("scopes diffs to the owning dataset under RLS", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const own = await ctx.db.query(
      `select id, is_material from public.snapshot_diffs where field_name = 'price'`,
    );
    expect(own.rows).toHaveLength(1);

    await ctx.actAs(ctx.ids.owner2);
    const other = await ctx.db.query(
      `select id from public.snapshot_diffs where field_name = 'price'`,
    );
    expect(other.rows).toHaveLength(0);
  });

  it("blocks authenticated clients from writing snapshots (append-only)", async () => {
    await ctx.actAs(ctx.ids.owner1);
    await expect(
      ctx.db.query(`
        insert into public.listing_snapshots
          (dataset_id, source_listing_id, collection_run_id, observed_at, observation_status,
           content_fingerprint, parser_version)
        values ('${ctx.ids.datasetA}', '${ctx.ids.listingA1}', '${ctx.ids.runA}',
                '2026-07-23T00:00:00Z', 'active', 'fp-x', 'csv-import:v1')
      `),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});
