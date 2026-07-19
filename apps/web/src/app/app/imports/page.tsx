import type { Metadata } from "next";
import { canMutateData } from "@bai/domain";
import { Button } from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Imports" };

export default async function ImportsPage() {
  const ctx = await loadTenancyContext();
  const role = ctx?.selectedOrganization?.role;
  const canImport = role ? canMutateData(role) : false;

  return (
    <div>
      <PageHeader
        title="Imports"
        description="Upload and track CSV snapshot imports."
        actions={
          <Button size="sm" disabled title="Available in Milestone 3">
            Start import
          </Button>
        }
      />
      <EmptyState
        title="No imports yet"
        description={
          canImport
            ? "The CSV import workflow arrives in Milestone 3. You will be able to upload a baseline snapshot and follow-up runs here."
            : "Your role is read-only, so starting an import is disabled. The CSV import workflow arrives in Milestone 3."
        }
      />
    </div>
  );
}
