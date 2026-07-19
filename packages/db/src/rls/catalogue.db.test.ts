import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Executed RLS verification for the Milestone 2 catalogue tables. Runs the real
 * migrations in PGlite (PostGIS DDL stripped) and asserts dataset-scoping,
 * cross-tenant isolation, evidence scoping, shared regions, append-only grants
 * and private-table invisibility.
 */
describe("catalogue RLS", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  async function countAs(userId: string, table: string): Promise<number> {
    await ctx.actAs(userId);
    const { rows } = await ctx.db.query<{ count: string }>(
      `select count(*)::text as count from ${table}`,
    );
    return Number(rows[0]?.count ?? "0");
  }

  it("scopes properties to the caller's accessible datasets", async () => {
    // org1 owns/accesses datasetA (2 properties); org2 accesses datasetB (1).
    expect(await countAs(ctx.ids.owner1, "public.properties")).toBe(2);
    expect(await countAs(ctx.ids.owner2, "public.properties")).toBe(1);
    // org3 has no dataset access.
    expect(await countAs(ctx.ids.outsider, "public.properties")).toBe(0);
  });

  it("does not leak a property across tenants", async () => {
    await ctx.actAs(ctx.ids.owner2);
    const { rows } = await ctx.db.query(
      `select id from public.properties where id = '${ctx.ids.propertyA1}'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("scopes source listings, snapshots and events by dataset", async () => {
    expect(await countAs(ctx.ids.owner1, "public.source_listings")).toBe(1);
    expect(await countAs(ctx.ids.owner2, "public.source_listings")).toBe(0);

    expect(await countAs(ctx.ids.owner1, "public.listing_snapshots")).toBe(1);
    expect(await countAs(ctx.ids.owner2, "public.listing_snapshots")).toBe(0);

    expect(await countAs(ctx.ids.owner1, "public.events")).toBe(1);
    expect(await countAs(ctx.ids.owner2, "public.events")).toBe(0);
  });

  it("scopes event evidence via its event's dataset", async () => {
    expect(await countAs(ctx.ids.owner1, "public.event_evidence")).toBe(1);
    expect(await countAs(ctx.ids.owner2, "public.event_evidence")).toBe(0);
    expect(await countAs(ctx.ids.outsider, "public.event_evidence")).toBe(0);
  });

  it("shares regions with every authenticated user", async () => {
    expect(await countAs(ctx.ids.owner1, "public.regions")).toBe(1);
    expect(await countAs(ctx.ids.owner2, "public.regions")).toBe(1);
    expect(await countAs(ctx.ids.outsider, "public.regions")).toBe(1);
  });

  it("denies the anonymous role catalogue access", async () => {
    await ctx.actAsAnon();
    await expect(
      ctx.db.query("select * from public.properties"),
    ).rejects.toThrow(/permission denied/i);
  });

  it("makes snapshots and events append-only for clients (no write grants)", async () => {
    await ctx.actAsSuperuser();
    const { rows } = await ctx.db.query<{
      snap_select: boolean;
      snap_insert: boolean;
      snap_update: boolean;
      snap_delete: boolean;
      event_insert: boolean;
    }>(`
      select
        has_table_privilege('authenticated','public.listing_snapshots','select') as snap_select,
        has_table_privilege('authenticated','public.listing_snapshots','insert') as snap_insert,
        has_table_privilege('authenticated','public.listing_snapshots','update') as snap_update,
        has_table_privilege('authenticated','public.listing_snapshots','delete') as snap_delete,
        has_table_privilege('authenticated','public.events','insert')            as event_insert
    `);
    const g = rows[0];
    expect(g?.snap_select).toBe(true);
    expect(g?.snap_insert).toBe(false);
    expect(g?.snap_update).toBe(false);
    expect(g?.snap_delete).toBe(false);
    expect(g?.event_insert).toBe(false);
  });

  it("keeps the private source registry off the Data API", async () => {
    await ctx.actAsSuperuser();
    const { rows } = await ctx.db.query<{
      anon_ds: boolean;
      auth_ds: boolean;
    }>(`
      select
        has_table_privilege('anon','private.data_sources','select')          as anon_ds,
        has_table_privilege('authenticated','private.data_sources','select') as auth_ds
    `);
    expect(rows[0]?.anon_ds).toBe(false);
    expect(rows[0]?.auth_ds).toBe(false);
  });
});
