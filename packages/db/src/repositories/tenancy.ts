import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessLevel,
  DatasetWithAccess,
  MemberRole,
  OrganizationWithRole,
  Profile,
} from "@bai/domain";
import type { Database } from "../generated/database.types";

/**
 * Authorization-aware tenancy repositories. They operate on a caller-provided,
 * RLS-scoped Supabase client (the SSR server client for the signed-in user), so
 * every result is already filtered to what that user may see. Passing the
 * service client here would bypass RLS - callers must not.
 */
export type DbClient = SupabaseClient<Database>;

export async function getProfile(
  client: DbClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, avatar_url, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    timezone: data.timezone,
  };
}

interface MembershipRow {
  role: MemberRole;
  organizations: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan_code: string;
    default_timezone: string;
  } | null;
}

export async function listOrganizationsForUser(
  client: DbClient,
): Promise<OrganizationWithRole[]> {
  const { data, error } = await client
    .from("organization_members")
    .select(
      "role, organizations(id, name, slug, status, plan_code, default_timezone)",
    )
    .returns<MembershipRow[]>();
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const org = row.organizations;
    if (!org) return [];
    return [
      {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        planCode: org.plan_code,
        defaultTimezone: org.default_timezone,
        role: row.role,
      },
    ];
  });
}

interface DatasetAccessRow {
  access_level: AccessLevel;
  datasets: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: Database["public"]["Enums"]["dataset_status"];
    is_demo: boolean;
  } | null;
}

export interface OrganizationMember {
  userId: string;
  role: MemberRole;
}

/** Members of an organization the caller belongs to (RLS-scoped). */
export async function listOrganizationMembers(
  client: DbClient,
  organizationId: string,
): Promise<OrganizationMember[]> {
  const { data, error } = await client
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .order("role", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ userId: row.user_id, role: row.role }));
}

const ACCESS_RANK: Record<AccessLevel, number> = { read: 0, manage: 1 };

export async function listAccessibleDatasets(
  client: DbClient,
): Promise<DatasetWithAccess[]> {
  const { data, error } = await client
    .from("organization_dataset_access")
    .select(
      "access_level, datasets(id, name, slug, description, status, is_demo)",
    )
    .returns<DatasetAccessRow[]>();
  if (error) throw error;

  // A dataset may be reachable via several of the user's organizations; keep the
  // strongest access level per dataset.
  const byId = new Map<string, DatasetWithAccess>();
  for (const row of data ?? []) {
    const ds = row.datasets;
    if (!ds) continue;
    const existing = byId.get(ds.id);
    if (
      existing &&
      ACCESS_RANK[existing.accessLevel] >= ACCESS_RANK[row.access_level]
    ) {
      continue;
    }
    byId.set(ds.id, {
      id: ds.id,
      name: ds.name,
      slug: ds.slug,
      description: ds.description,
      status: ds.status,
      isDemo: ds.is_demo,
      accessLevel: row.access_level,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
