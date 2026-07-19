import type { Metadata } from "next";
import { listBrowserCollectionSources } from "@bai/db";
import { canMutateData } from "@bai/domain";
import { BALI_MARKET } from "@bai/collector-core";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "../../_components/page-parts";
import { NewCollectionForm } from "../new-collection-form";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;

  if (!ctx || !org || !dataset) {
    return (
      <div>
        <PageHeader title="New collection" />
        <EmptyState
          title="Select an organization and dataset"
          description="A collection targets a specific dataset within your organization."
        />
      </div>
    );
  }

  if (!canMutateData(org.role)) {
    return (
      <div>
        <PageHeader title="New collection" />
        <EmptyState
          title="Read-only role"
          description="Your role cannot start collections. Ask an owner or admin for access."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const sources = await listBrowserCollectionSources(supabase);

  return (
    <div>
      <PageHeader
        title="New collection"
        description={`Queue a browser collection for ${dataset.name}. Run the local collector on your own computer to execute it.`}
      />
      <NewCollectionForm
        areas={BALI_MARKET.areas.map((a) => ({ key: a.key, name: a.name }))}
        sources={sources.map((s) => ({
          id: s.id,
          displayName: s.displayName,
          complianceStatus: s.complianceStatus,
        }))}
      />
    </div>
  );
}
