import type { Metadata } from "next";
import Link from "next/link";
import { listBrowserCollections } from "@bai/db";
import { canMutateData } from "@bai/domain";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bai/ui";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Collections" };

const STATE_VARIANT: Record<
  string,
  "default" | "secondary" | "warning" | "destructive" | "outline"
> = {
  completed: "default",
  partial: "warning",
  running: "secondary",
  claimed: "secondary",
  queued: "secondary",
  draft: "outline",
  manual_action_required: "warning",
  paused: "outline",
  completing: "secondary",
  failed: "destructive",
  cancelled: "outline",
};

export default async function CollectionsPage() {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  const canRun = org ? canMutateData(org.role) : false;

  if (!org || !dataset) {
    return (
      <div>
        <PageHeader title="Collections" />
        <EmptyState
          title="Select an organization and dataset"
          description="A collection runs against a specific dataset."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const collections = await listBrowserCollections(supabase, dataset.id);

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Browser-operated collections you run yourself from your own computer. The collector opens a visible browser and stops for you on any login or verification page."
        actions={
          <Button asChild size="sm" disabled={!canRun}>
            <Link href="/app/collections/new">New collection</Link>
          </Button>
        }
      />

      {collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description={
            canRun
              ? "Create a collection, then run the local collector on your machine to fill it."
              : "Your role is read-only, so starting a collection is disabled."
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/app/collections/${c.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {c.market}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.source}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.mode.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATE_VARIANT[c.state] ?? "outline"}>
                      {c.state.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
