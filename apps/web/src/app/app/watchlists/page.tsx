import type { Metadata } from "next";
import { listWatchlists } from "@bai/db";
import { canMutateData } from "@bai/domain";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../_components/page-parts";
import { ActionForm } from "../_components/action-form";
import { createWatchlistAction } from "./actions";

export const metadata: Metadata = { title: "Watchlists" };

export default async function WatchlistsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  const canCreate = org ? canMutateData(org.role) : false;

  if (!org || !dataset) {
    return (
      <div>
        <PageHeader title="Watchlists" />
        <EmptyState
          title="No organization selected"
          description="Select an organization and dataset to view watchlists."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const watchlists = await listWatchlists(supabase, org.id, dataset.id);

  return (
    <div>
      <PageHeader
        title="Watchlists"
        description={`Saved sets of properties, listings and filters — private to ${org.name}.`}
      />

      {canCreate ? (
        <div className="mb-6 rounded-lg border border-border p-4">
          <ActionForm
            action={createWatchlistAction}
            submitLabel="Create watchlist"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input
                name="name"
                required
                maxLength={120}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Description</span>
              <input
                name="description"
                maxLength={280}
                className="h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
          </ActionForm>
        </div>
      ) : null}

      {watchlists.length === 0 ? (
        <EmptyState
          title="No watchlists yet"
          description={
            canCreate
              ? "Create a watchlist above, then add properties from the Properties table."
              : "Your role is read-only, so creating watchlists is disabled."
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlists.map((watchlist) => (
                <TableRow key={watchlist.id}>
                  <TableCell className="font-medium">
                    {watchlist.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {watchlist.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {watchlist.itemCount}
                  </TableCell>
                  <TableCell>{formatDate(watchlist.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
