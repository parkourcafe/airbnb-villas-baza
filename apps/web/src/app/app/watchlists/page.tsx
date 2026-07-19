import type { Metadata } from "next";
import { canMutateData } from "@bai/domain";
import { Button } from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Watchlists" };

export default async function WatchlistsPage() {
  const ctx = await loadTenancyContext();
  const role = ctx?.selectedOrganization?.role;
  const canCreate = role ? canMutateData(role) : false;

  return (
    <div>
      <PageHeader
        title="Watchlists"
        description="Saved sets of properties, listings and filters, private to your organization."
        actions={
          <Button size="sm" disabled title="Available in Milestone 7">
            New watchlist
          </Button>
        }
      />
      <EmptyState
        title="No watchlists yet"
        description={
          canCreate
            ? "Watchlists and leads arrive in Milestone 7. They will be private to your organization."
            : "Your role is read-only, so creating watchlists is disabled. Watchlists arrive in Milestone 7."
        }
      />
    </div>
  );
}
