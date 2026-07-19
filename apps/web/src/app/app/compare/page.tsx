import type { Metadata } from "next";
import Link from "next/link";
import { listListingSnapshots, listSnapshotDiffs } from "@bai/db";
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
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../_components/page-parts";

export const metadata: Metadata = { title: "Compare" };

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type SearchParams = Promise<{ listing?: string; snapshot?: string }>;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ctx = await loadTenancyContext();
  const listingId = params.listing;

  if (!ctx?.selectedDataset || !listingId) {
    return (
      <div>
        <PageHeader
          title="Compare snapshots"
          description="Compare a listing snapshot against its previous comparable observation."
        />
        <EmptyState
          title="Choose a listing"
          description="Open a property, then a source listing, and choose “Compare snapshots” to see field-level differences."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const snapshots = await listListingSnapshots(supabase, listingId);
  const current =
    snapshots.find((s) => s.id === params.snapshot) ?? snapshots[0] ?? null;
  const diffs = current ? await listSnapshotDiffs(supabase, current.id) : [];
  const materialCount = diffs.filter((d) => d.isMaterial).length;

  return (
    <div>
      <PageHeader
        title="Compare snapshots"
        description="Field-level differences against the previous comparable snapshot. Observation language only."
      />

      {snapshots.length === 0 ? (
        <EmptyState
          title="No snapshots"
          description="This listing has no stored snapshots yet."
        />
      ) : (
        <>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="listing" value={listingId} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Snapshot</span>
              <select
                name="snapshot"
                defaultValue={current?.id ?? ""}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {formatDate(snapshot.observedAt)} ·{" "}
                    {snapshot.observationStatus}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm" variant="outline">
              Compare
            </Button>
          </form>

          <p className="mb-4 text-sm text-muted-foreground">
            {diffs.length} field change{diffs.length === 1 ? "" : "s"} ·{" "}
            {materialCount} material.
          </p>

          {diffs.length === 0 ? (
            <EmptyState
              title="No differences"
              description="This snapshot has no stored field diffs against a previous comparable observation."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Previous</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead className="text-right">Material</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.map((diff) => (
                    <TableRow key={diff.fieldName}>
                      <TableCell className="font-medium">
                        {humanize(diff.fieldName)}
                      </TableCell>
                      <TableCell>{humanize(diff.changeKind)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {renderValue(diff.previousValue)}
                      </TableCell>
                      <TableCell>{renderValue(diff.currentValue)}</TableCell>
                      <TableCell className="text-right">
                        {diff.isMaterial ? (
                          <Badge variant="secondary">Material</Badge>
                        ) : (
                          <Badge variant="outline">Minor</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <Link
        href="/app/properties"
        className="mt-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Back to properties
      </Link>
    </div>
  );
}
