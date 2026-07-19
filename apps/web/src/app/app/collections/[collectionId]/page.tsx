import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBrowserCollection,
  listCollectionObservations,
  listListingVerifications,
  listSearchCells,
} from "@bai/db";
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

export const metadata: Metadata = { title: "Collection" };

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

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const supabase = await createSupabaseServerClient();
  const collection = await getBrowserCollection(supabase, collectionId);
  if (!collection) notFound();

  const [cells, observations, verifications] = await Promise.all([
    listSearchCells(supabase, collectionId),
    collection.mode === "verify_existing_listings"
      ? Promise.resolve([])
      : listCollectionObservations(supabase, collectionId),
    collection.mode === "verify_existing_listings"
      ? listListingVerifications(supabase, collectionId)
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title={`Collection · ${collection.market}`}
        description={`${collection.source} · ${collection.mode.replace(/_/g, " ")}`}
        actions={
          <Badge
            variant={
              collection.state === "manual_action_required"
                ? "warning"
                : "outline"
            }
          >
            {collection.state.replace(/_/g, " ")}
          </Badge>
        }
      />

      {collection.state === "manual_action_required" ? (
        <div className="mb-6 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          <p className="font-medium">The collector needs you.</p>
          <p className="mt-1 text-muted-foreground">
            It stopped on a{" "}
            {collection.manualActionReason?.replace(/_/g, " ") ??
              "verification"}{" "}
            page. Switch to the visible browser window on your computer, resolve
            it, then run{" "}
            <code className="rounded bg-muted px-1">
              pnpm collector resume {collection.id}
            </code>
            . The collector never bypasses these pages for you.
          </p>
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Planned cells" value={collection.plannedCells} />
        <Metric label="Completed cells" value={collection.completedCells} />
        <Metric label="Cards discovered" value={collection.cardsDiscovered} />
        <Metric label="Unique listings" value={collection.uniqueListings} />
        <Metric
          label="Duplicate discoveries"
          value={collection.duplicateDiscoveries}
        />
        <Metric label="Detail pages" value={collection.detailPagesCompleted} />
        <Metric label="Warnings" value={collection.warnings} />
        <Metric label="Errors" value={collection.errors} />
      </div>

      <div className="mb-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p>Current area: {collection.currentArea ?? "—"}</p>
        <p>
          Last heartbeat:{" "}
          {collection.lastHeartbeatAt
            ? formatDateTime(collection.lastHeartbeatAt)
            : "—"}
        </p>
        <p>
          Started:{" "}
          {collection.startedAt ? formatDateTime(collection.startedAt) : "—"}
        </p>
        <p>
          Finished:{" "}
          {collection.finishedAt ? formatDateTime(collection.finishedAt) : "—"}
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium">Search cells</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Listings</TableHead>
                <TableHead>Zoom</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cells.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No cells planned yet.
                  </TableCell>
                </TableRow>
              ) : (
                cells.map((cell) => (
                  <TableRow key={cell.id}>
                    <TableCell>{cell.parentArea}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {cell.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {cell.listingsDiscovered}
                    </TableCell>
                    <TableCell>{cell.zoom}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {collection.mode === "verify_existing_listings" ? (
        <section>
          <h2 className="mb-2 text-sm font-medium">Verification results</h2>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No verifications recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  verifications.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">
                        {v.sourceListingId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {v.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(v.observedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : (
        <section>
          <h2 className="mb-2 text-sm font-medium">
            Discovered listings ({observations.length})
          </h2>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No listings collected yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  observations.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {o.sourceUrl ? (
                          <a
                            href={o.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {o.sourceListingId}
                          </a>
                        ) : (
                          o.sourceListingId
                        )}
                      </TableCell>
                      <TableCell>{o.title ?? "—"}</TableCell>
                      <TableCell>{o.area ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {o.rating ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.reviewCount ?? "—"}
                      </TableCell>
                      <TableCell>{o.detailCollected ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
