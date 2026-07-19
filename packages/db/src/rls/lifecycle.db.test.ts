import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Milestone 5: the lifecycle/event write path against the real migrations in
 * PGlite. Verifies event dedupe-key idempotency, evidence linkage, the
 * lifecycle auxiliary-state column, and dataset-scoped RLS on events.
 */
describe("lifecycle and event persistence", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("de-duplicates events on their deterministic key", async () => {
    await ctx.actAsSuperuser();
    // The harness seeds eventA1 with deduplication_key 'dedup-a1'.
    await expect(
      ctx.db.query(`
        insert into public.events
          (dataset_id, property_id, source_listing_id, event_type, event_at, confidence,
           title, deduplication_key)
        values ('${ctx.ids.datasetA}', '${ctx.ids.propertyA1}', '${ctx.ids.listingA1}',
                'price_changed', '2026-07-21T00:00:00Z', 'high', 'Dup', 'dedup-a1')
      `),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("persists lifecycle auxiliary state as jsonb", async () => {
    await ctx.actAsSuperuser();
    await ctx.db.exec(`
      update public.source_listings
      set current_lifecycle_status = 'first_miss',
          consecutive_misses = 1,
          lifecycle_state = '{"distinctMissRuns":1,"transitionSequence":1}'
      where id = '${ctx.ids.listingA1}';
    `);
    const row = await ctx.db.query<{
      status: string;
      misses: number;
      aux: Record<string, unknown>;
    }>(
      `select current_lifecycle_status as status, consecutive_misses as misses, lifecycle_state as aux
       from public.source_listings where id = '${ctx.ids.listingA1}'`,
    );
    expect(row.rows[0]?.status).toBe("first_miss");
    expect(row.rows[0]?.aux.distinctMissRuns).toBe(1);
  });

  it("keeps events dataset-scoped and evidence readable via the event", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const own = await ctx.db.query(`select id from public.events`);
    expect(own.rows.length).toBeGreaterThanOrEqual(1);
    const evidence = await ctx.db.query(`select id from public.event_evidence`);
    expect(evidence.rows.length).toBeGreaterThanOrEqual(1);

    await ctx.actAs(ctx.ids.owner2);
    expect((await ctx.db.query(`select id from public.events`)).rows).toHaveLength(0);
    expect(
      (await ctx.db.query(`select id from public.event_evidence`)).rows,
    ).toHaveLength(0);
  });

  it("records a review action with an audit entry (service-role path)", async () => {
    await ctx.actAsSuperuser();
    await ctx.db.exec(`
      update public.events
      set is_reviewed = true, reviewed_by = '${ctx.ids.owner1}', reviewed_at = now()
      where deduplication_key = 'dedup-a1';
      insert into public.audit_logs (organization_id, actor_user_id, action, target_type, target_id)
      select '${ctx.ids.org1}', '${ctx.ids.owner1}', 'event.reviewed', 'event', id::text
      from public.events where deduplication_key = 'dedup-a1';
    `);
    const reviewed = await ctx.db.query<{ is_reviewed: boolean }>(
      `select is_reviewed from public.events where deduplication_key = 'dedup-a1'`,
    );
    expect(reviewed.rows[0]?.is_reviewed).toBe(true);
    const audit = await ctx.db.query(
      `select id from public.audit_logs where action = 'event.reviewed'`,
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps a dismissed event in history (EVT-08)", async () => {
    await ctx.actAsSuperuser();
    await ctx.db.exec(`
      update public.events
      set dismissed_at = now(), dismissal_reason = 'analyst review'
      where deduplication_key = 'dedup-a1';
    `);
    const row = await ctx.db.query<{ dismissal_reason: string | null }>(
      `select dismissal_reason from public.events where deduplication_key = 'dedup-a1'`,
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]?.dismissal_reason).toBe("analyst review");
  });
});
