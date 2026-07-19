import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

/**
 * Executed RLS verification for the identity/tenancy migration (Milestone 1.5).
 * Runs the real migration in PGlite and asserts the policies behave. The Data
 * API schema scoping (private not exposed via PostgREST) is enforced in
 * config.toml and cannot be exercised here; it is asserted structurally via
 * grants instead.
 */
describe("identity & tenancy RLS", () => {
  let ctx: TestDatabase;

  beforeAll(async () => {
    ctx = await createTestDatabase();
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it("creates a profile for every auth user via the trigger", async () => {
    await ctx.actAsSuperuser();
    const { rows } = await ctx.db.query<{ count: string }>(
      "select count(*)::text as count from public.profiles",
    );
    expect(rows[0]?.count).toBe("6");
  });

  it("lets a user read only their own profile", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const { rows } = await ctx.db.query<{ id: string }>(
      "select id from public.profiles",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(ctx.ids.owner1);
  });

  it("isolates organizations across tenants (AUTH-02)", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const seenByOwner1 = await ctx.db.query<{ slug: string }>(
      "select slug::text as slug from public.organizations order by slug",
    );
    expect(seenByOwner1.rows.map((r) => r.slug)).toEqual(["org-one"]);

    await ctx.actAs(ctx.ids.owner2);
    const seenByOwner2 = await ctx.db.query<{ slug: string }>(
      "select slug::text as slug from public.organizations order by slug",
    );
    expect(seenByOwner2.rows.map((r) => r.slug)).toEqual(["org-two"]);
  });

  it("isolates organization membership rows", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const org1 = await ctx.db.query<{ count: string }>(
      "select count(*)::text as count from public.organization_members",
    );
    expect(org1.rows[0]?.count).toBe("3");

    await ctx.actAs(ctx.ids.owner2);
    const org2 = await ctx.db.query<{ count: string }>(
      "select count(*)::text as count from public.organization_members",
    );
    expect(org2.rows[0]?.count).toBe("1");
  });

  it("enforces dataset access (AUTH-03)", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const a = await ctx.db.query<{ slug: string }>(
      "select slug::text as slug from public.datasets order by slug",
    );
    expect(a.rows.map((r) => r.slug)).toEqual(["dataset-a"]);

    await ctx.actAs(ctx.ids.owner2);
    const b = await ctx.db.query<{ slug: string }>(
      "select slug::text as slug from public.datasets order by slug",
    );
    expect(b.rows.map((r) => r.slug)).toEqual(["dataset-b"]);

    // A member whose organization has no dataset access sees nothing.
    await ctx.actAs(ctx.ids.outsider);
    const none = await ctx.db.query("select 1 from public.datasets");
    expect(none.rows).toHaveLength(0);
  });

  it("denies the anonymous role any tenancy data (explicit grants)", async () => {
    await ctx.actAsAnon();
    await expect(
      ctx.db.query("select * from public.organizations"),
    ).rejects.toThrow(/permission denied/i);
  });

  it("keeps the private schema off-limits to clients while allowing RLS helpers", async () => {
    await ctx.actAsSuperuser();
    const grants = await ctx.db.query<{
      anon_private: boolean;
      auth_private: boolean;
      auth_exec: boolean;
      anon_select: boolean;
      auth_select: boolean;
    }>(`
      select
        has_schema_privilege('anon','private','usage')            as anon_private,
        has_schema_privilege('authenticated','private','usage')   as auth_private,
        has_function_privilege('authenticated','private.is_org_member(uuid,uuid)','execute') as auth_exec,
        has_table_privilege('anon','public.organizations','select')          as anon_select,
        has_table_privilege('authenticated','public.organizations','select') as auth_select
    `);
    const g = grants.rows[0];
    expect(g?.anon_private).toBe(false); // anon cannot even reach private
    expect(g?.auth_private).toBe(true); // authenticated may invoke helpers
    expect(g?.auth_exec).toBe(true);
    expect(g?.anon_select).toBe(false); // anon has no grant on tenancy tables
    expect(g?.auth_select).toBe(true);
  });

  it("prevents a viewer from mutating the organization but allows an owner (AUTH-04)", async () => {
    await ctx.actAs(ctx.ids.viewer1);
    const viewerUpdate = await ctx.db.query(
      `update public.organizations set name = 'renamed-by-viewer' where id = '${ctx.ids.org1}'`,
    );
    expect(viewerUpdate.affectedRows).toBe(0);

    await ctx.actAs(ctx.ids.owner1);
    const ownerUpdate = await ctx.db.query(
      `update public.organizations set name = 'renamed-by-owner' where id = '${ctx.ids.org1}'`,
    );
    expect(ownerUpdate.affectedRows).toBe(1);
  });

  it("lets an owner manage membership but blocks a viewer", async () => {
    await ctx.actAs(ctx.ids.owner1);
    const ownerInsert = await ctx.db.query(
      `insert into public.organization_members (organization_id, user_id, role)
       values ('${ctx.ids.org1}', '${ctx.ids.extra}', 'analyst')`,
    );
    expect(ownerInsert.affectedRows).toBe(1);

    await ctx.actAs(ctx.ids.viewer1);
    await expect(
      ctx.db.query(
        `insert into public.organization_members (organization_id, user_id, role)
         values ('${ctx.ids.org1}', '${ctx.ids.outsider}', 'admin')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("restricts dataset-access grants to dataset administrators (Finding #1)", async () => {
    // Owner of org2 cannot grant org2 access to dataset C (owned by org1).
    await ctx.actAs(ctx.ids.owner2);
    await expect(
      ctx.db.query(
        `insert into public.organization_dataset_access (organization_id, dataset_id, access_level)
         values ('${ctx.ids.org2}', '${ctx.ids.datasetC}', 'read')`,
      ),
    ).rejects.toThrow(/row-level security/i);

    // The dataset's owning-org admin (owner1) may grant access to it.
    await ctx.actAs(ctx.ids.owner1);
    const ok = await ctx.db.query(
      `insert into public.organization_dataset_access (organization_id, dataset_id, access_level)
       values ('${ctx.ids.org1}', '${ctx.ids.datasetC}', 'manage')`,
    );
    expect(ok.affectedRows).toBe(1);
  });

  it("forbids clients from writing the privileged is_system_owner column (Finding #2)", async () => {
    await ctx.actAsSuperuser();
    const { rows } = await ctx.db.query<{
      sys: boolean;
      name: boolean;
    }>(`
      select
        has_column_privilege('authenticated','public.profiles','is_system_owner','update') as sys,
        has_column_privilege('authenticated','public.profiles','full_name','update')       as name
    `);
    expect(rows[0]?.sys).toBe(false);
    expect(rows[0]?.name).toBe(true);
  });

  it("blocks an admin from becoming owner or removing an owner (Finding #3)", async () => {
    // Admin cannot promote themselves to owner.
    await ctx.actAs(ctx.ids.admin1);
    await expect(
      ctx.db.query(
        `update public.organization_members set role = 'owner'
         where organization_id = '${ctx.ids.org1}' and user_id = '${ctx.ids.admin1}'`,
      ),
    ).rejects.toThrow(/row-level security/i);

    // Admin cannot delete the owner's membership row.
    const adminDelete = await ctx.db.query(
      `delete from public.organization_members
       where organization_id = '${ctx.ids.org1}' and user_id = '${ctx.ids.owner1}'`,
    );
    expect(adminDelete.affectedRows).toBe(0);

    // The owner may change an admin's role.
    await ctx.actAs(ctx.ids.owner1);
    const ownerUpdate = await ctx.db.query(
      `update public.organization_members set role = 'analyst'
       where organization_id = '${ctx.ids.org1}' and user_id = '${ctx.ids.admin1}'`,
    );
    expect(ownerUpdate.affectedRows).toBe(1);
  });
});
