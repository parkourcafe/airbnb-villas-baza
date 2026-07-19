import type { Metadata } from "next";
import Link from "next/link";
import { listProperties, listRegions, type PropertyFilters } from "@bai/db";
import { LIFECYCLE_STATUS, type LifecycleStatus } from "@bai/domain";
import {
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
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader, EmptyState } from "../_components/page-parts";
import { LifecycleBadge } from "../_components/lifecycle-badge";

export const metadata: Metadata = { title: "Properties" };

type SearchParams = Promise<{
  region?: string;
  status?: string;
  cursor?: string;
}>;

function parseStatus(raw: string | undefined): LifecycleStatus | undefined {
  return raw && (LIFECYCLE_STATUS as readonly string[]).includes(raw)
    ? (raw as LifecycleStatus)
    : undefined;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ctx = await loadTenancyContext();
  const dataset = ctx?.selectedDataset ?? null;

  if (!dataset) {
    return (
      <div>
        <PageHeader title="Properties" />
        <EmptyState
          title="No dataset selected"
          description="Select a dataset to browse its property catalogue."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const filters: PropertyFilters = {
    regionId: params.region || undefined,
    lifecycleStatus: parseStatus(params.status),
  };
  const [regions, page] = await Promise.all([
    listRegions(supabase),
    listProperties(supabase, dataset.id, {
      filters,
      page: { cursor: params.cursor },
    }),
  ]);

  const baseQuery: Record<string, string> = {};
  if (params.region) baseQuery.region = params.region;
  if (params.status) baseQuery.status = params.status;

  return (
    <div>
      <PageHeader
        title="Properties"
        description={`Canonical accommodation records in ${dataset.name}.`}
        actions={
          <a
            href={`/api/properties/export?${new URLSearchParams(baseQuery).toString()}`}
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-accent"
          >
            Export CSV
          </a>
        }
      />

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3"
        aria-label="Filter properties"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Region</span>
          <select
            name="region"
            defaultValue={params.region ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Any status</option>
            {LIFECYCLE_STATUS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
        {(params.region || params.status) && (
          <Button asChild size="sm" variant="ghost">
            <Link href="/app/properties">Clear</Link>
          </Button>
        )}
      </form>

      {page.items.length === 0 ? (
        <EmptyState
          title="No properties match"
          description="No properties in this dataset match the current filters. Clear the filters or import data (Milestone 3)."
        />
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Bedrooms</TableHead>
                  <TableHead className="text-right">Guests</TableHead>
                  <TableHead>Last observed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/app/properties/${property.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {property.canonicalName}
                      </Link>
                    </TableCell>
                    <TableCell>{property.regionName ?? "—"}</TableCell>
                    <TableCell>
                      <LifecycleBadge
                        status={property.currentLifecycleStatus}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(property.bedrooms)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(property.guestCapacity)}
                    </TableCell>
                    <TableCell>{formatDate(property.lastObservedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {page.nextCursor ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={{
                    pathname: "/app/properties",
                    query: { ...baseQuery, cursor: page.nextCursor },
                  }}
                >
                  Next page
                </Link>
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                End of results
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
