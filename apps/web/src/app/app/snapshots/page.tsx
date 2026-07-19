import type { Metadata } from "next";
import Link from "next/link";
import { listMarketSnapshots } from "@bai/db";
import {
  Badge,
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

export const metadata: Metadata = { title: "Snapshots" };

const QUALITY_VARIANT: Record<
  string,
  "default" | "secondary" | "warning" | "destructive"
> = {
  complete: "default",
  partial: "warning",
  degraded: "warning",
  failed: "destructive",
};

export default async function SnapshotsPage() {
  const ctx = await loadTenancyContext();
  const dataset = ctx?.selectedDataset ?? null;
  if (!dataset) {
    return (
      <div>
        <PageHeader title="Snapshots" />
        <EmptyState
          title="Select a dataset"
          description="Snapshots belong to a dataset."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const snapshots = await listMarketSnapshots(supabase, dataset.id);

  return (
    <div>
      <PageHeader
        title="Snapshots"
        description="Immutable market snapshots produced by collections. A degraded snapshot is never compared automatically without your confirmation."
      />
      {snapshots.length === 0 ? (
        <EmptyState
          title="No snapshots yet"
          description="Run a collection to finalize a market snapshot."
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead className="text-right">Listings</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/app/snapshots/${s.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {s.market}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={QUALITY_VARIANT[s.qualityStatus] ?? "warning"}
                    >
                      {s.qualityStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.uniqueListingCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.completionPercentage}%
                  </TableCell>
                  <TableCell>{formatDateTime(s.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
