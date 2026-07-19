import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarketSnapshot, listSnapshotListings } from "@bai/db";
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bai/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "../../_components/page-parts";

export const metadata: Metadata = { title: "Snapshot" };

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;
  const supabase = await createSupabaseServerClient();
  const snapshot = await getMarketSnapshot(supabase, snapshotId);
  if (!snapshot) notFound();
  const listings = await listSnapshotListings(supabase, snapshotId);

  return (
    <div>
      <PageHeader
        title={`Snapshot · ${snapshot.market}`}
        description={`${snapshot.source} · ${formatDateTime(snapshot.createdAt)}`}
        actions={
          <Badge
            variant={
              snapshot.qualityStatus === "complete" ? "default" : "warning"
            }
          >
            {snapshot.qualityStatus}
          </Badge>
        }
      />

      {snapshot.qualityStatus === "degraded" ? (
        <div className="mb-6 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          This snapshot is <strong>degraded</strong>. It will not be compared
          automatically — confirm explicitly before using it as a baseline.
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Unique listings" value={snapshot.uniqueListingCount} />
        <Metric
          label="Completion"
          value={`${snapshot.completionPercentage}%`}
        />
        <Metric label="Warnings" value={snapshot.warningCount} />
        <Metric
          label="Coverage"
          value={`${Math.round(snapshot.searchCellCoverage * 100)}%`}
        />
      </div>

      <p className="mb-6 text-xs text-muted-foreground">
        Checksum{" "}
        <code className="rounded bg-muted px-1">{snapshot.checksum}</code>
        {snapshot.observationStartedAt
          ? ` · observed ${formatDateTime(snapshot.observationStartedAt)}`
          : null}
        {snapshot.observationCompletedAt
          ? ` → ${formatDateTime(snapshot.observationCompletedAt)}`
          : null}
      </p>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Reviews</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No listings in this snapshot.
                </TableCell>
              </TableRow>
            ) : (
              listings.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    {l.sourceUrl ? (
                      <a
                        href={l.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {l.sourceListingId}
                      </a>
                    ) : (
                      l.sourceListingId
                    )}
                  </TableCell>
                  <TableCell>{l.title ?? "—"}</TableCell>
                  <TableCell>{l.area ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {l.rating ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.reviewCount ?? "—"}
                  </TableCell>
                  <TableCell>
                    {l.displayedPrice
                      ? `${l.displayedPrice}${l.currency ? ` ${l.currency}` : ""}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
