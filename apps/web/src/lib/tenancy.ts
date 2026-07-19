import { cache } from "react";
import {
  getProfile,
  listAccessibleDatasets,
  listOrganizationsForUser,
} from "@bai/db";
import type {
  DatasetWithAccess,
  OrganizationWithRole,
  Profile,
} from "@bai/domain";
import { createSupabaseServerClient } from "./supabase/server";
import { readSelection } from "./selection";

export interface TenancyContext {
  userId: string;
  userEmail: string | null;
  profile: Profile | null;
  organizations: OrganizationWithRole[];
  datasets: DatasetWithAccess[];
  selectedOrganization: OrganizationWithRole | null;
  selectedDataset: DatasetWithAccess | null;
}

/**
 * Load the signed-in user's tenancy context (profile, organizations, datasets
 * and the current selection). Wrapped in React `cache` so the layout and its
 * pages share a single load per request. All queries are RLS-scoped.
 */
export const loadTenancyContext = cache(
  async (): Promise<TenancyContext | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const [profile, organizations, datasets, selection] = await Promise.all([
      getProfile(supabase, user.id),
      listOrganizationsForUser(supabase),
      listAccessibleDatasets(supabase),
      readSelection(),
    ]);

    const selectedOrganization =
      organizations.find((o) => o.id === selection.organizationId) ??
      organizations[0] ??
      null;
    const selectedDataset =
      datasets.find((d) => d.id === selection.datasetId) ?? datasets[0] ?? null;

    return {
      userId: user.id,
      userEmail: user.email ?? null,
      profile,
      organizations,
      datasets,
      selectedOrganization,
      selectedDataset,
    };
  },
);
