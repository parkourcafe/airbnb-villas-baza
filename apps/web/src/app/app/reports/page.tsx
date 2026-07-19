import type { Metadata } from "next";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Reproducible reports and exports with immutable parameters."
      />
      <EmptyState
        title="No reports yet"
        description="Report definitions, async generation and signed CSV exports arrive in Milestone 7."
      />
    </div>
  );
}
