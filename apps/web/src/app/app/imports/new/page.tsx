import type { Metadata } from "next";
import { listImportSources } from "@bai/db";
import { canMutateData } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "../../_components/page-parts";
import { ImportWizard } from "../import-wizard";

export const metadata: Metadata = { title: "New import" };

export default async function NewImportPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;

  if (!ctx || !org || !dataset) {
    return (
      <div>
        <PageHeader title="New import" />
        <EmptyState
          title="Select an organization and dataset"
          description="An import targets a specific dataset within your organization."
        />
      </div>
    );
  }

  if (!canMutateData(org.role)) {
    return (
      <div>
        <PageHeader title="New import" />
        <EmptyState
          title="Read-only role"
          description="Your role cannot start imports. Ask an owner or admin for access."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const sources = await listImportSources(supabase);

  return (
    <div>
      <PageHeader
        title="New import"
        description={`Import a CSV snapshot into ${dataset.name}.`}
      />
      <ImportWizard
        organizationId={org.id}
        datasetId={dataset.id}
        userId={ctx.userId}
        sources={sources}
      />
    </div>
  );
}
