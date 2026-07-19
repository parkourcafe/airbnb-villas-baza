import type { Metadata } from "next";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Properties" };

export default function PropertiesPage() {
  return (
    <div>
      <PageHeader
        title="Properties"
        description="Canonical accommodation records for the selected dataset."
      />
      <EmptyState
        title="No properties yet"
        description="The property catalogue is seeded from fixtures in Milestone 2 and populated by imports in Milestone 3. Nothing is shown until real observations exist."
      />
    </div>
  );
}
