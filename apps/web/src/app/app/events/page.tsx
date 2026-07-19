import type { Metadata } from "next";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <div>
      <PageHeader
        title="Events"
        description="Evidence-backed changes and lifecycle transitions. Observation language only."
      />
      <EmptyState
        title="No events yet"
        description="Events are produced by the snapshot/diff and lifecycle engines in Milestones 4 and 5. Each event will link to the snapshots and run that support it."
      />
    </div>
  );
}
