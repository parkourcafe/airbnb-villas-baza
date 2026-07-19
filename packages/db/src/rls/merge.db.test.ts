import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 9: manual property merge. Executed against the real migrations in
 * PGlite. Verifies the acceptance criteria: snapshots and source listings are
 * preserved, events/history stay reachable through the canonical property, the
 * action is audited, and a non-admin cannot merge.
 */
describe("property merge", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("blocks a non-admin (viewer) from merging", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `select public.merge_properties('${ctx.ids.propertyA1}', '${ctx.ids.propertyA2}', 'dup')`,
      ),
    ).rejects.toThrow(/not authorized/i);
  });

  it("merges a duplicate into the canonical property, preserving all history", async () => {
    // propertyA1 (with listingA1 + snapshotA1 + eventA1) is the duplicate; A2 canonical.
    await ctx.actAs(ctx.ids.owner1);
    await ctx.db.query(
      `select public.merge_properties('${ctx.ids.propertyA1}', '${ctx.ids.propertyA2}', 'duplicate villa')`,
    );

    await ctx.actAsSuperuser();
    // Source listing reassigned; snapshot preserved.
    const listing = await ctx.db.query<{ property_id: string }>(
      `select property_id from public.source_listings where id = '${ctx.ids.listingA1}'`,
    );
    expect(listing.rows[0]?.property_id).toBe(ctx.ids.propertyA2);
    const snapshot = await ctx.db.query(
      `select id from public.listing_snapshots where id = '${ctx.ids.snapshotA1}'`,
    );
    expect(snapshot.rows).toHaveLength(1);

    // Event reassigned so history remains reachable via the canonical property.
    const event = await ctx.db.query<{ property_id: string }>(
      `select property_id from public.events where id = '${ctx.ids.eventA1}'`,
    );
    expect(event.rows[0]?.property_id).toBe(ctx.ids.propertyA2);

    // Duplicate archived, not deleted.
    const archived = await ctx.db.query<{ archived_at: string | null }>(
      `select archived_at from public.properties where id = '${ctx.ids.propertyA1}'`,
    );
    expect(archived.rows[0]?.archived_at).not.toBeNull();

    // Redirect + audit recorded.
    const redirect = await ctx.db.query(
      `select id from public.property_redirects where from_property_id = '${ctx.ids.propertyA1}'`,
    );
    expect(redirect.rows).toHaveLength(1);
    const audit = await ctx.db.query(
      `select id from public.audit_logs where action = 'property.merge'`,
    );
    expect(audit.rows).toHaveLength(1);
  });

  it("refuses to merge a property into itself", async () => {
    await ctx.actAs(ctx.ids.owner1);
    await expect(
      ctx.db.query(
        `select public.merge_properties('${ctx.ids.propertyA2}', '${ctx.ids.propertyA2}', null)`,
      ),
    ).rejects.toThrow(/into itself/i);
  });
});
