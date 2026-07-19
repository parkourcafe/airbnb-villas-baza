import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 11: browser-operated collection schema + RLS.
 *
 * Verifies dataset-scoped reads, that only non-viewers can create a collection,
 * cross-tenant isolation, that child tables are append-only for authenticated
 * (the worker writes as the service role), and that the atomic claim leases a
 * queued collection exactly once.
 */
describe("browser collection RLS", () => {
  let ctx: TestDatabase;
  const collectionA = "00000000-0000-0000-0000-0000000ba001";
  const airbnb = "airbnb";
  let airbnbId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    await ctx.actAsSuperuser();
    const src = await ctx.db.query<{ id: string }>(
      `select id from private.data_sources where key = '${airbnb}'`,
    );
    airbnbId = src.rows[0]!.id;
    // A queued collection in datasetA (org1), created as superuser for setup.
    await ctx.db.exec(`
      insert into public.browser_collections
        (id, organization_id, dataset_id, source_id, source_key, market, mode, state, selected_areas)
      values
        ('${collectionA}', '${ctx.ids.org1}', '${ctx.ids.datasetA}', '${airbnbId}', 'airbnb',
         'bali', 'search_results_only', 'queued', '{canggu,ubud}');
      insert into public.collection_search_cells
        (collection_id, dataset_id, parent_area, north, south, east, west, zoom)
      values
        ('${collectionA}', '${ctx.ids.datasetA}', 'canggu', -8.62, -8.66, 115.16, 115.11, 14);
      insert into public.collection_observations
        (collection_id, dataset_id, source_id, source_listing_id, observed_at)
      values
        ('${collectionA}', '${ctx.ids.datasetA}', '${airbnbId}', '12345', now());
    `);
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("seeds the airbnb browser source as disabled", async () => {
    await ctx.actAsSuperuser();
    const rows = await ctx.db.query<{
      access_mode: string;
      compliance_status: string;
    }>(
      `select access_mode, compliance_status from private.data_sources where key = 'airbnb'`,
    );
    expect(rows.rows[0]?.access_mode).toBe("browser_automation");
    expect(rows.rows[0]?.compliance_status).toBe("disabled");
  });

  it("exposes browser sources via the credential-free projection", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const rows = await ctx.db.query<{ key: string }>(
      `select key from public.browser_collection_sources`,
    );
    expect(rows.rows.map((r) => r.key)).toContain("airbnb");
  });

  it("lets a dataset member read the collection and its children", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const cols = await ctx.db.query(
      `select id from public.browser_collections where id = '${collectionA}'`,
    );
    expect(cols.rows).toHaveLength(1);
    const cells = await ctx.db.query(
      `select id from public.collection_search_cells where collection_id = '${collectionA}'`,
    );
    expect(cells.rows).toHaveLength(1);
    const obs = await ctx.db.query(
      `select id from public.collection_observations where collection_id = '${collectionA}'`,
    );
    expect(obs.rows).toHaveLength(1);
  });

  it("hides another tenant's collection", async () => {
    await ctx.actAs(ctx.ids.owner2);
    const cols = await ctx.db.query(
      `select id from public.browser_collections where id = '${collectionA}'`,
    );
    expect(cols.rows).toHaveLength(0);
  });

  it("lets a non-viewer create a collection but blocks a viewer", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `insert into public.browser_collections
           (organization_id, dataset_id, source_id, source_key, mode, state)
         values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', '${airbnbId}', 'airbnb', 'search_results_only', 'queued')`,
      ),
    ).rejects.toThrow(/row-level security/i);

    await ctx.actAs(ctx.ids.owner1);
    const ok = await ctx.db.query(
      `insert into public.browser_collections
         (organization_id, dataset_id, source_id, source_key, mode, state)
       values ('${ctx.ids.org1}', '${ctx.ids.datasetA}', '${airbnbId}', 'airbnb', 'search_results_only', 'draft')`,
    );
    expect(ok.affectedRows).toBe(1);
  });

  it("is append-only: authenticated cannot write observations directly", async () => {
    await ctx.actAs(ctx.ids.owner1);
    await expect(
      ctx.db.query(
        `insert into public.collection_observations
           (collection_id, dataset_id, source_id, source_listing_id, observed_at)
         values ('${collectionA}', '${ctx.ids.datasetA}', '${airbnbId}', '999', now())`,
      ),
    ).rejects.toThrow(/(row-level security|permission denied)/i);
  });

  it("claims a queued collection exactly once (service role)", async () => {
    await ctx.actAsSuperuser();
    const first = await ctx.db.query<{ id: string; state: string }>(
      `select id, state from private.claim_browser_collection('worker-test')`,
    );
    expect(first.rows[0]?.id).toBe(collectionA);
    expect(first.rows[0]?.state).toBe("claimed");

    // No other queued collection remains claimable now.
    const second = await ctx.db.query<{ id: string | null }>(
      `select id from private.claim_browser_collection('worker-test')`,
    );
    expect(second.rows[0]?.id ?? null).toBeNull();
  });
});
